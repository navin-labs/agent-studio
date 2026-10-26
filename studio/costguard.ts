// costGuard: a deterministic circuit breaker around every model call a Director run makes (session 44: an unattended run burned
// about 60% of a weekly allowance in 16 hours). Everything here is plain code outside the prompts, so the Director cannot raise a
// limit or skip a check. It keeps a per-run ledger (run-ledger.json), refuses a call before it starts when any ceiling is reached,
// refuses an oversized prompt, locks the paid Critic behind the free gates, and prints a cost table when the run ends or aborts.
// Cost comes from the claude CLI's own JSON report (total_cost_usd, usage); a call is also capped from inside by --max-budget-usd.
// Self-test: node studio/costguard.test.ts
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const LIMITS = {
  MAX_RUN_COST_USD: 0.4, // hard stop: abort and throw
  WARN_COST_USD: 0.25, // loud warning
  MAX_TOTAL_CALLS_PER_RUN: 6, // every sub-agent spawn / model call in the run
  MAX_STAGE_RETRIES: 2, // retries of one stage after its first failure; a third retry never fires
  MAX_WALL_CLOCK_MS: 300_000, // 5 minutes per run
  MAX_INPUT_TOKENS: 6000, // per prompt we send, estimated before the call
  MAX_CRITIC_CALLS: 1,
};
export type Limits = typeof LIMITS;

// (no constructor parameter properties: Node runs this file with type stripping only)
export class CostLimitExceededError extends Error {
  readonly limit: string;
  constructor(limit: string, message: string) {
    super(message);
    this.name = 'CostLimitExceededError';
    this.limit = limit;
  }
}
export class PromptTooLargeError extends Error {
  readonly tokens: number;
  readonly cap: number;
  constructor(tokens: number, cap: number, stage: string) {
    super(`${stage}: prompt is about ${tokens} tokens, the cap is ${cap}; send the failing part only, never the whole history`);
    this.name = 'PromptTooLargeError';
    this.tokens = tokens;
    this.cap = cap;
  }
}
export class CriticLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CriticLockedError';
  }
}
export class HumanReviewRequired extends Error {
  readonly stage: string;
  constructor(stage: string, message: string) {
    super(message);
    this.name = 'HumanReviewRequired';
    this.stage = stage;
  }
}

// a fast pre-flight estimate, no tokenizer
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.8);

export type Usage = {input_tokens: number; output_tokens: number; cache_write_tokens: number; cache_read_tokens: number};
export type ExecRequest = {prompt: string; model: string; lean?: boolean; system?: string; tools?: string; allowed?: string; disallowed?: string; appendSystem?: string; maxBudgetUsd: number; timeoutMs: number; signal: AbortSignal; cwd: string};
export type ExecResult = {text: string; usage: Usage; cost_usd: number | null; isError: boolean};
export type Exec = (req: ExecRequest) => Promise<ExecResult>;

// The real executor: one headless `claude -p` session, JSON report, aborted by the signal or the timeout.
export const claudeExec: Exec = (req) =>
  new Promise((resolve, reject) => {
    const args = ['-p', req.prompt, '--model', req.model, '--output-format', 'json', '--no-session-persistence', '--permission-mode', 'acceptEdits', '--max-budget-usd', req.maxBudgetUsd.toFixed(4)];
    if (req.tools !== undefined) args.push('--tools', req.tools); // '' turns every built-in tool off (a repair needs none)
    if (req.allowed) args.push('--allowedTools', req.allowed);
    // lean: a stateless micro-prompt needs none of the machine's skills, plugins, MCP tool lists or memory. Without these flags a headless
    // call here loads about 176k tokens of context: a cold cache write of that cost $0.71 for one repair, against $0.013 lean.
    if (req.lean) args.push('--disable-slash-commands', '--strict-mcp-config', '--setting-sources', 'project', '--effort', 'low', '--system-prompt', req.system ?? 'Reply with exactly what is asked, nothing else.');
    if (req.appendSystem) args.push('--append-system-prompt', req.appendSystem);
    if (req.disallowed) args.push('--disallowedTools', req.disallowed);
    const child = spawn('claude', args, {cwd: req.cwd, stdio: ['ignore', 'pipe', 'inherit'], signal: req.signal});
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), req.timeoutMs);
    child.on('error', (e) => (clearTimeout(timer), reject(e)));
    child.on('close', () => {
      clearTimeout(timer);
      resolve(parseClaudeJson(out));
    });
  });

// The CLI's JSON report. When a session stops on its own budget (error_max_budget_usd) the top-level usage is zeroed and the real
// numbers are only in modelUsage, so both are read. Anything unparseable (killed, garbled) counts as an error call.
export const parseClaudeJson = (out: string): ExecResult => {
  const none: Usage = {input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0};
  try {
    const j = JSON.parse(out);
    const u = j.usage ?? {};
    let usage: Usage = {input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, cache_write_tokens: u.cache_creation_input_tokens ?? 0, cache_read_tokens: u.cache_read_input_tokens ?? 0};
    if (!(usage.input_tokens + usage.output_tokens + usage.cache_write_tokens + usage.cache_read_tokens) && j.modelUsage) {
      for (const m of Object.values(j.modelUsage) as {inputTokens?: number; outputTokens?: number; cacheCreationInputTokens?: number; cacheReadInputTokens?: number}[])
        usage = {input_tokens: usage.input_tokens + (m.inputTokens ?? 0), output_tokens: usage.output_tokens + (m.outputTokens ?? 0), cache_write_tokens: usage.cache_write_tokens + (m.cacheCreationInputTokens ?? 0), cache_read_tokens: usage.cache_read_tokens + (m.cacheReadInputTokens ?? 0)};
    }
    return {text: String(j.result ?? ''), usage, cost_usd: typeof j.total_cost_usd === 'number' ? j.total_cost_usd : null, isError: !!j.is_error};
  } catch {
    return {text: out, usage: none, cost_usd: null, isError: true};
  }
};

// If the CLI gave no cost, estimate it at an Opus-class list price (a deliberate over-estimate: $15 in, $75 out per million tokens,
// cache writes 1.25x and reads 0.1x of input). Better to stop early than late.
const estimateCost = (u: Usage) => ((u.input_tokens + u.cache_write_tokens * 1.25 + u.cache_read_tokens * 0.1) * 15 + u.output_tokens * 75) / 1e6;

export type CallRecord = {stage: string; model: string; retry: number; input_tokens: number; output_tokens: number; cache_write_tokens: number; cache_read_tokens: number; estimated_cost_usd: number; cost_source: 'cli' | 'estimate'; elapsed_ms: number; status: 'ok' | 'error'; at: string};
export type RunLedger = {run_id: string; board: string; started_at: string; limits: Limits; calls: CallRecord[]; retries: Record<string, number>; critic_calls: number; total_cost_usd: number; status: 'running' | 'done' | 'aborted' | 'human-review'; reason?: string};

export type CallRequest = {stage: string; model: string; prompt: string; lean?: boolean; system?: string; tools?: string; allowed?: string; disallowed?: string; appendSystem?: string; retry?: number; critic?: boolean; gates?: string[]; cwd?: string};

export class CostGuard {
  readonly controller = new AbortController();
  readonly ledger: RunLedger;
  readonly file: string;
  private readonly t0: number;
  constructor(dir: string, board: string, opts: {limits?: Partial<Limits>; exec?: Exec; now?: () => number; log?: (s: string) => void} = {}) {
    this.limits = {...LIMITS, ...opts.limits};
    this.now = opts.now ?? Date.now;
    this.exec = opts.exec ?? claudeExec;
    this.log = opts.log ?? ((s) => console.error(s));
    this.t0 = this.now();
    fs.mkdirSync(dir, {recursive: true});
    this.file = path.join(dir, 'run-ledger.json');
    this.ledger = {run_id: path.basename(dir), board, started_at: new Date(this.t0).toISOString(), limits: this.limits, calls: [], retries: {}, critic_calls: 0, total_cost_usd: 0, status: 'running'};
    this.save();
  }
  readonly limits: Limits;
  private readonly now: () => number;
  private readonly exec: Exec;
  private readonly log: (s: string) => void;

  private save() {
    this.ledger.total_cost_usd = Number(this.ledger.calls.reduce((a, c) => a + c.estimated_cost_usd, 0).toFixed(6));
    fs.writeFileSync(this.file, JSON.stringify(this.ledger, null, 2) + '\n');
  }
  private stop(status: 'aborted' | 'human-review', reason: string) {
    this.ledger.status = status;
    this.ledger.reason = reason;
    this.controller.abort();
    this.save();
  }
  get spent() {
    return this.ledger.calls.reduce((a, c) => a + c.estimated_cost_usd, 0);
  }
  get elapsed() {
    return this.now() - this.t0;
  }

  // refuses before the call starts
  private assertRoom(stage: string) {
    const L = this.limits;
    const fail = (limit: string, msg: string): never => {
      this.stop('aborted', msg);
      throw new CostLimitExceededError(limit, msg);
    };
    if (this.elapsed >= L.MAX_WALL_CLOCK_MS) fail('MAX_WALL_CLOCK_MS', `run has used ${Math.round(this.elapsed / 1000)} s, the limit is ${L.MAX_WALL_CLOCK_MS / 1000} s`);
    if (this.ledger.calls.length >= L.MAX_TOTAL_CALLS_PER_RUN) fail('MAX_TOTAL_CALLS_PER_RUN', `run has made ${this.ledger.calls.length} calls, the limit is ${L.MAX_TOTAL_CALLS_PER_RUN}`);
    if (this.spent >= L.MAX_RUN_COST_USD) fail('MAX_RUN_COST_USD', `run has spent $${this.spent.toFixed(3)}, the limit is $${L.MAX_RUN_COST_USD.toFixed(2)}`);
    // a session's own budget flag is checked only between its steps, so one call can overshoot (seen: $0.71 against a $0.20 flag);
    // refuse a call whose likely cost, the dearest earlier call of its stage, would cross the ceiling
    const likely = Math.max(0, ...this.ledger.calls.filter((c) => c.stage === stage).map((c) => c.estimated_cost_usd));
    if (this.spent + likely > L.MAX_RUN_COST_USD) fail('MAX_RUN_COST_USD', `a ${stage} call costs about $${likely.toFixed(3)} and the run has spent $${this.spent.toFixed(3)} of $${L.MAX_RUN_COST_USD.toFixed(2)}`);
  }

  async call(req: CallRequest): Promise<ExecResult> {
    const L = this.limits;
    this.assertRoom(req.stage);
    const retry = req.retry ?? 0;
    if (retry > L.MAX_STAGE_RETRIES) {
      const msg = `${req.stage} failed its gate after ${L.MAX_STAGE_RETRIES} retries; a ${retry}th attempt is never made`;
      this.stop('human-review', msg);
      throw new HumanReviewRequired(req.stage, msg);
    }
    if (req.critic) {
      if (req.gates?.length) throw new CriticLockedError(`the paid Critic runs only after every free gate passes; failing: ${req.gates.join(' | ')}`);
      if (this.ledger.critic_calls >= L.MAX_CRITIC_CALLS) throw new CriticLockedError(`the Critic has already been called ${this.ledger.critic_calls} time(s) in this run (limit ${L.MAX_CRITIC_CALLS})`);
    }
    const tokens = estimateTokens(req.prompt + (req.appendSystem ?? ''));
    if (tokens > L.MAX_INPUT_TOKENS) throw new PromptTooLargeError(tokens, L.MAX_INPUT_TOKENS, req.stage);

    const started = this.now();
    let res: ExecResult;
    try {
      res = await this.exec({
        prompt: req.prompt, model: req.model, lean: req.lean, system: req.system, tools: req.tools, allowed: req.allowed, disallowed: req.disallowed, appendSystem: req.appendSystem, cwd: req.cwd ?? process.cwd(), signal: this.controller.signal,
        maxBudgetUsd: Math.max(0.0001, L.MAX_RUN_COST_USD - this.spent), // the CLI stops the session itself at the remaining budget
        timeoutMs: Math.max(1000, L.MAX_WALL_CLOCK_MS - this.elapsed),
      });
    } catch (e) {
      this.record(req, retry, {input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0}, null, this.now() - started, 'error');
      if (this.controller.signal.aborted) throw new CostLimitExceededError('ABORTED', 'the run was aborted');
      throw e;
    }
    this.record(req, retry, res.usage, res.cost_usd, this.now() - started, res.isError ? 'error' : 'ok');
    if (req.critic) this.ledger.critic_calls++;
    this.ledger.retries[req.stage] = Math.max(this.ledger.retries[req.stage] ?? 0, retry);
    this.save();
    if (this.spent >= L.MAX_RUN_COST_USD) {
      const msg = `run has spent $${this.spent.toFixed(3)}, the limit is $${L.MAX_RUN_COST_USD.toFixed(2)}`;
      this.stop('aborted', msg);
      throw new CostLimitExceededError('MAX_RUN_COST_USD', msg);
    }
    if (this.spent >= L.WARN_COST_USD) this.log(`!!! COST WARNING: $${this.spent.toFixed(3)} of $${L.MAX_RUN_COST_USD.toFixed(2)} spent after ${req.stage} !!!`);
    return res;
  }

  private record(req: CallRequest, retry: number, u: Usage, cost: number | null, elapsed: number, status: 'ok' | 'error') {
    this.ledger.calls.push({stage: req.stage, model: req.model, retry, ...u, estimated_cost_usd: Number((cost ?? estimateCost(u)).toFixed(6)), cost_source: cost === null ? 'estimate' : 'cli', elapsed_ms: elapsed, status, at: new Date().toISOString()});
  }

  // close the run: done, or the reason it stopped
  finish(status: RunLedger['status'] = 'done', reason?: string) {
    if (this.ledger.status === 'running') this.ledger.status = status;
    if (reason && !this.ledger.reason) this.ledger.reason = reason;
    this.save();
  }

  // Stage | Calls | Retries | Tokens (In/Out) | Cost ($ USD) | Status
  summary(): string {
    const stages = [...new Set(this.ledger.calls.map((c) => c.stage))];
    const rows = stages.map((s) => {
      const cs = this.ledger.calls.filter((c) => c.stage === s);
      const inT = cs.reduce((a, c) => a + c.input_tokens + c.cache_write_tokens + c.cache_read_tokens, 0);
      const outT = cs.reduce((a, c) => a + c.output_tokens, 0);
      const bad = cs.some((c) => c.status === 'error');
      return [s, String(cs.length), String(this.ledger.retries[s] ?? 0), `${inT}/${outT}`, cs.reduce((a, c) => a + c.estimated_cost_usd, 0).toFixed(4), bad ? 'error' : 'ok'];
    });
    const total = this.ledger.calls;
    rows.push(['TOTAL', String(total.length), '', `${total.reduce((a, c) => a + c.input_tokens + c.cache_write_tokens + c.cache_read_tokens, 0)}/${total.reduce((a, c) => a + c.output_tokens, 0)}`, this.spent.toFixed(4), this.ledger.status.toUpperCase()]);
    const head = ['Stage', 'Calls', 'Retries', 'Tokens (In/Out)', 'Cost ($ USD)', 'Status'];
    const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
    const line = (r: string[]) => '| ' + r.map((c, i) => c.padEnd(w[i])).join(' | ') + ' |';
    const rule = '|-' + w.map((n) => '-'.repeat(n)).join('-|-') + '-|';
    return [line(head), rule, ...rows.map(line), this.ledger.reason ? `stopped: ${this.ledger.reason}` : ''].filter(Boolean).join('\n');
  }
}
