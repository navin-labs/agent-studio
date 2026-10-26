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
// A ceiling that is NaN, zero, negative or infinite compares false against everything and so is no ceiling at all (a typo in an
// environment variable did exactly that). Refuse such a guard before any call; and refuse values no film needs.
export const HARD_MAX = {MAX_RUN_COST_USD: 25, MAX_WALL_CLOCK_MS: 3_600_000, MAX_TOTAL_CALLS_PER_RUN: 50};
export const assertLimits = (l: Limits) => {
  for (const [k, v] of Object.entries(l)) if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) throw new Error(`cost limit ${k} must be a positive number, got ${String(v)}`);
  for (const [k, max] of Object.entries(HARD_MAX)) if (l[k as keyof Limits] > max) throw new Error(`cost limit ${k} is ${l[k as keyof Limits]}, above the hard maximum ${max}`);
  if (l.WARN_COST_USD > l.MAX_RUN_COST_USD) throw new Error('the cost warning level is above the cost ceiling');
};

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

export const MAX_OUTPUT_CHARS = 2_000_000;
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
    child.stdout.on('data', (d) => {
      out += d;
      if (out.length > MAX_OUTPUT_CHARS) {
        out = ''; // a runaway session cannot fill memory: stop it; the empty report counts as an error call
        child.kill('SIGKILL');
      }
    });
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

export type CallRecord = {stage: string; model: string; retry: number; input_tokens: number; output_tokens: number; cache_write_tokens: number; cache_read_tokens: number; estimated_cost_usd: number; cost_source: 'cli' | 'estimate' | 'unknown' | 'none' | 'reconciled'; elapsed_ms: number; status: 'ok' | 'error'; at: string};
export type RunLedger = {run_id: string; board: string; started_at: string; limits: Limits; calls: CallRecord[]; retries: Record<string, number>; critic_calls: number; total_cost_usd: number; status: 'running' | 'done' | 'aborted' | 'human-review'; reason?: string};

export type CallRequest = {stage: string; model: string; prompt: string; lean?: boolean; system?: string; tools?: string; allowed?: string; disallowed?: string; appendSystem?: string; retry?: number; critic?: boolean; gates?: string[]; cwd?: string};

export class CostGuard {
  readonly controller = new AbortController();
  readonly ledger: RunLedger;
  readonly file: string;
  private readonly t0: number;
  constructor(dir: string, board: string, opts: {limits?: Partial<Limits>; exec?: Exec; now?: () => number; log?: (s: string) => void} = {}) {
    this.limits = {...LIMITS, ...opts.limits};
    assertLimits(this.limits);
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

  // Calls run strictly one at a time, in the order asked. The ceilings are checked against what earlier calls SPENT, so two calls
  // started together would both see the same remaining budget and could together overshoot it; a queue makes every check see the
  // result of the call before it.
  private queue: Promise<unknown> = Promise.resolve();
  call(req: CallRequest): Promise<ExecResult> {
    const run = this.queue.then(() => this.callOnce(req));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async callOnce(req: CallRequest): Promise<ExecResult> {
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
    const budget = Math.max(0.0001, L.MAX_RUN_COST_USD - this.spent); // what this call may spend; also what an unreported call is booked at
    let res: ExecResult;
    try {
      res = await this.exec({
        prompt: req.prompt, model: req.model, lean: req.lean, system: req.system, tools: req.tools, allowed: req.allowed, disallowed: req.disallowed, appendSystem: req.appendSystem, cwd: req.cwd ?? process.cwd(), signal: this.controller.signal,
        maxBudgetUsd: budget, // the CLI stops the session itself at the remaining budget
        timeoutMs: Math.max(1000, L.MAX_WALL_CLOCK_MS - this.elapsed),
      });
    } catch (e) {
      const never = ['ENOENT', 'EACCES'].includes((e as NodeJS.ErrnoException).code ?? ''); // the CLI could not even start: it cost nothing
      this.record(req, retry, {input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0}, null, this.now() - started, 'error', never ? 'none' : budget);
      if (this.controller.signal.aborted) throw new CostLimitExceededError('ABORTED', 'the run was aborted');
      if (this.spent >= L.MAX_RUN_COST_USD) {
        const msg = `a ${req.stage} call failed without reporting its cost and is booked at its $${budget.toFixed(2)} budget; the run's ceiling is $${L.MAX_RUN_COST_USD.toFixed(2)} (${(e as Error).message}). Check the provider's usage page, then reconcile`;
        this.stop('aborted', msg);
        throw new CostLimitExceededError('MAX_RUN_COST_USD', msg);
      }
      throw e;
    }
    const silent = res.isError && res.cost_usd === null && !(res.usage.input_tokens + res.usage.output_tokens + res.usage.cache_write_tokens + res.usage.cache_read_tokens);
    this.record(req, retry, res.usage, res.cost_usd, this.now() - started, res.isError ? 'error' : 'ok', silent ? budget : undefined);
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

  // cost_source: cli = the CLI's own figure; estimate = priced from the tokens it reported; none = the call never started (cost really 0);
  // unknown = the call may have run and nothing was reported (killed, timed out, garbled): booked at the cap it was given, an UPPER bound
  // by the flag (not a measurement), until someone reads the provider's usage page and runs `reconcile`; reconciled = that figure.
  private record(req: CallRequest, retry: number, u: Usage, cost: number | null, elapsed: number, status: 'ok' | 'error', unknown?: number | 'none') {
    const unk = typeof unknown === 'number';
    const usd = unk ? unknown : unknown === 'none' ? 0 : cost ?? estimateCost(u);
    const source: CallRecord['cost_source'] = unk ? 'unknown' : unknown === 'none' ? 'none' : cost === null ? 'estimate' : 'cli';
    this.ledger.calls.push({stage: req.stage, model: req.model, retry, ...u, estimated_cost_usd: Number(usd.toFixed(6)), cost_source: source, elapsed_ms: elapsed, status, at: new Date().toISOString()});
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
    const unk = this.ledger.calls.filter((c) => c.cost_source === 'unknown').length;
    return [line(head), rule, ...rows.map(line), unk ? `${unk} call(s) reported no cost and are booked at their budget cap; check the provider's usage page, then: node studio/costguard.ts reconcile ${this.file} <call number> <usd>` : '', this.ledger.reason ? `stopped: ${this.ledger.reason}` : ''].filter(Boolean).join('\n');
  }
}

// Replace an unknown call's booked figure with the real one read from the provider's usage page. Only unknown calls can be reconciled.
export const reconcile = (ledgerFile: string, call: number, usd: number) => {
  const l = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) as RunLedger;
  const c = l.calls[call - 1];
  if (!c) throw new Error(`no call ${call} in ${path.basename(ledgerFile)} (${l.calls.length} calls)`);
  if (c.cost_source !== 'unknown') throw new Error(`call ${call} is ${c.cost_source}, not unknown: nothing to reconcile`);
  if (!Number.isFinite(usd) || usd < 0) throw new Error('the cost must be a number of dollars, 0 or more');
  c.estimated_cost_usd = Number(usd.toFixed(6));
  c.cost_source = 'reconciled';
  l.total_cost_usd = Number(l.calls.reduce((a, x) => a + x.estimated_cost_usd, 0).toFixed(6));
  const tmp = `${ledgerFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(l, null, 2) + '\n');
  fs.renameSync(tmp, ledgerFile);
  return l;
};
if (import.meta.main && process.argv[2] === 'reconcile') {
  const [f, n, usd] = process.argv.slice(3);
  if (!f || !n || usd === undefined) (console.error('usage: node studio/costguard.ts reconcile <run-ledger.json> <call number> <usd>'), process.exit(2));
  try {
    console.log(`call ${n} reconciled; run total now $${reconcile(f, Number(n), Number(usd)).total_cost_usd}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
