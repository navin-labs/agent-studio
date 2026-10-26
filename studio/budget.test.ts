// The paid-call boundary, end to end: where paid calls can start (traced in the source), that the ceiling cannot be disabled by a bad
// value, that concurrent calls cannot overshoot it, and that environment overrides are validated. A fake executor stands in for the
// CLI; nothing here can reach a model or a paid API. Run: node studio/budget.test.ts
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertLimits, CostGuard, CostLimitExceededError, type Exec, type ExecRequest, HARD_MAX, LIMITS} from './costguard.ts';
import {limitsFromEnv} from './director.ts';

const REPO = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-test-'));
const zero = {input_tokens: 1, output_tokens: 1, cache_write_tokens: 0, cache_read_tokens: 0};
const quiet = () => undefined;

// ---- 1. every place a paid call can start, found in the source ----
{
  const walk = (d: string): string[] => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => (e.name === 'node_modules' || e.name === '.cache' || e.name === 'out' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = [...walk(path.join(REPO, 'studio')), ...walk(path.join(REPO, 'engine/scripts')), ...walk(path.join(REPO, 'engine/src'))].filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !/\.test\.ts$/.test(f));
  const text = new Map(files.map((f) => [path.relative(REPO, f), fs.readFileSync(f, 'utf8')]));
  const where = (re: RegExp) => [...text].filter(([f, t]) => re.test(t) && f !== 'studio/budget.test.ts').map(([f]) => f).sort();
  // the Claude CLI is started in exactly one place, and only through the guard's default executor
  assert.deepEqual(where(/spawn(Sync)?\(\s*['"`]claude['"`]/), ['studio/costguard.ts']);
  // aliasing the spawn does not hide it: the bare string 'claude' (a command name) appears as code only in the executor
  assert.deepEqual(where(/(?<![\w/.-])['"`]claude['"`]\s*[,)]/), ['studio/costguard.ts'], 'no other file names the claude command');
  assert.deepEqual(where(/\b(execFileSync|execFile|exec|execSync)\(\s*['"`](claude|codex|gemini|openai)\b/), []);
  assert.deepEqual(where(/\bclaudeExec\b/), ['studio/costguard.ts'], 'the raw executor is not imported anywhere else');
  // the guard is used by the Director and the repair loop, and by nothing that builds its own executor
  assert.deepEqual(where(/new CostGuard\(/), ['studio/director.ts']);
  assert.deepEqual(where(/\bguard\.call\(/), ['studio/director.ts', 'studio/repair.ts']);
  assert.deepEqual(where(/\.exec\(\{|this\.exec\(/), ['studio/costguard.ts'], 'only the guard calls the executor');
  // no model SDK or other model HTTP endpoint in the code
  assert.deepEqual(where(/api\.anthropic\.com|@anthropic-ai|generativelanguage\.googleapis|api\.mistral|api\.cohere/), []);
  // the only other paid endpoints are the two TTS APIs, in make.mjs, behind tts-budget.mjs
  assert.deepEqual(where(/api\.openai\.com|api\.elevenlabs\.io/), ['engine/scripts/make.mjs']);
  const make = text.get('engine/scripts/make.mjs')!;
  assert.match(make, /const API_PROVIDER = paidProvider\(process\.env\)/, 'paid TTS is chosen only by paidProvider');
  assert.match(make, /const ttsOpenAI = async \(text\) => \{\n\s*TTS_BUDGET\.spend\(text\.length\)/, 'the OpenAI call spends from the budget first');
  assert.match(make, /const ttsEleven = async [^\n]*\n\s*TTS_BUDGET\.spend\(/, 'the ElevenLabs call spends from the budget first');
}

// ---- 2. a limit that is not a positive finite number is not a ceiling: refused ----
for (const bad of [NaN, 0, -1, Infinity, -Infinity, undefined, '5' as unknown as number]) {
  assert.throws(() => assertLimits({...LIMITS, MAX_RUN_COST_USD: bad as number}), /must be a positive number/, String(bad));
  assert.throws(() => new CostGuard(path.join(tmp, 'bad'), 'b', {limits: {MAX_WALL_CLOCK_MS: bad as number}, exec: async () => ({text: '', usage: zero, cost_usd: 0, isError: false}), log: quiet}), /must be a positive number/);
}
assert.throws(() => assertLimits({...LIMITS, MAX_RUN_COST_USD: HARD_MAX.MAX_RUN_COST_USD + 1}), /above the hard maximum/);
assert.throws(() => assertLimits({...LIMITS, WARN_COST_USD: LIMITS.MAX_RUN_COST_USD + 0.01}), /warning level is above/);
assertLimits(LIMITS);

// ---- 3. environment overrides (COSTGUARD_*): validated, bounded, never silently "off" ----
for (const name of ['COSTGUARD_MAX_USD', 'COSTGUARD_MAX_MS', 'COSTGUARD_MAX_CALLS'])
  for (const bad of ['', ' ', 'abc', 'NaN', '-1', '0', 'Infinity', '1e999'])
    assert.throws(() => limitsFromEnv({[name]: bad}), /must be a positive number/, `${name}=${JSON.stringify(bad)}`);
assert.throws(() => limitsFromEnv({COSTGUARD_MAX_USD: '26'}), /above the hard maximum/);
assert.throws(() => limitsFromEnv({COSTGUARD_MAX_MS: '3600001'}), /above the hard maximum/);
assert.throws(() => limitsFromEnv({COSTGUARD_MAX_CALLS: '51'}), /above the hard maximum/);
assert.deepEqual(limitsFromEnv({}), {});
assert.equal(limitsFromEnv({COSTGUARD_MAX_USD: '2'}).MAX_RUN_COST_USD, 2);
assert.equal(limitsFromEnv({COSTGUARD_MAX_CALLS: '12.9'}).MAX_TOTAL_CALLS_PER_RUN, 12);
assert.ok(Math.abs(limitsFromEnv({COSTGUARD_MAX_USD: '2'}).WARN_COST_USD! - 1.25) < 1e-9, 'the warning level scales with the ceiling');

// ---- 4. concurrent calls cannot overshoot: they run one at a time, each check sees the one before ----
{
  let running = 0, peak = 0;
  const seen: ExecRequest[] = [];
  const exec: Exec = async (r) => {
    seen.push(r);
    peak = Math.max(peak, ++running);
    await new Promise((res) => setTimeout(res, 30));
    running--;
    return {text: 'ok', usage: zero, cost_usd: 0.15, isError: false};
  };
  const g = new CostGuard(path.join(tmp, 'concurrent'), 'b', {exec, log: quiet});
  const results = await Promise.allSettled(Array.from({length: 5}, (_, i) => g.call({stage: 'director', model: 'm', prompt: `p${i}`})));
  assert.equal(peak, 1, 'never two model calls at once');
  assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'fulfilled', 'rejected', 'rejected', 'rejected'], 'two fit under $0.40; the third would cross it and is refused, and so is everything after');
  assert.ok(results.slice(2).every((r) => (r as PromiseRejectedResult).reason instanceof CostLimitExceededError));
  assert.equal(seen.length, 2, 'the refused calls never reached the executor');
  assert.ok(g.spent <= LIMITS.MAX_RUN_COST_USD, `spent $${g.spent} stays under the ceiling`);
  assert.deepEqual(seen.map((r) => Number(r.maxBudgetUsd.toFixed(2))), [0.4, 0.25], 'each CLI call is capped at what is left, not at the full allowance');
}
{
  // a failing call does not wedge the queue or let later calls skip the checks
  let n = 0;
  const exec: Exec = async () => {
    if (n++ === 0) throw Object.assign(new Error('spawn claude ENOENT'), {code: 'ENOENT'});
    return {text: 'ok', usage: zero, cost_usd: 0.01, isError: false};
  };
  const g = new CostGuard(path.join(tmp, 'queue-after-fail'), 'b', {exec, log: quiet});
  const [a, b] = await Promise.allSettled([g.call({stage: 'a', model: 'm', prompt: 'p'}), g.call({stage: 'b', model: 'm', prompt: 'p'})]);
  assert.deepEqual([a.status, b.status], ['rejected', 'fulfilled']);
}
{
  // the call ceiling holds under a burst too
  const g = new CostGuard(path.join(tmp, 'burst'), 'b', {exec: async () => ({text: 'ok', usage: zero, cost_usd: 0, isError: false}), log: quiet});
  const rs = await Promise.allSettled(Array.from({length: 20}, () => g.call({stage: 'w', model: 'm', prompt: 'p'})));
  assert.equal(rs.filter((r) => r.status === 'fulfilled').length, LIMITS.MAX_TOTAL_CALLS_PER_RUN);
}

// ---- 5. retries are bounded by the guard, not by the caller ----
{
  const g = new CostGuard(path.join(tmp, 'retries'), 'b', {exec: async () => ({text: 'ok', usage: zero, cost_usd: 0.001, isError: false}), log: quiet});
  await g.call({stage: 'writer', model: 'm', prompt: 'p', retry: LIMITS.MAX_STAGE_RETRIES});
  await assert.rejects(g.call({stage: 'writer', model: 'm', prompt: 'p', retry: LIMITS.MAX_STAGE_RETRIES + 1}), /never made|human/i);
  assert.equal(g.ledger.status, 'human-review');
}

// ---- 6. the executor only ever receives the budget the guard computed (a caller cannot hand it a bigger one) ----
{
  const ks = Object.keys({prompt: 1, model: 1} as unknown as ExecRequest);
  void ks;
  const seen: ExecRequest[] = [];
  const g = new CostGuard(path.join(tmp, 'override'), 'b', {exec: async (r) => (seen.push(r), {text: 'ok', usage: zero, cost_usd: 0.1, isError: false}), log: quiet});
  await g.call({stage: 'a', model: 'm', prompt: 'p', ...({maxBudgetUsd: 999, timeoutMs: 1e9} as object)} as never);
  assert.ok(seen[0].maxBudgetUsd <= LIMITS.MAX_RUN_COST_USD && seen[0].timeoutMs <= LIMITS.MAX_WALL_CLOCK_MS, 'budget and timeout in a request are ignored');
}

fs.rmSync(tmp, {recursive: true, force: true});
console.log('budget ok: the Claude CLI starts in one place (behind the guard), the only other paid endpoints are two TTS APIs behind an explicit opt-in and a character budget; NaN, zero, negative, infinite or huge limits and COSTGUARD_* values are refused; concurrent calls run one at a time and cannot overshoot; a failed call does not wedge the queue; retries and the call count hold under a burst; callers cannot raise the per-call budget');
