// Model-call failure behaviour with NO real model: the real executor (claudeExec) is run against a fake `claude` program placed first
// on PATH, so spawning, argument passing, output parsing, kill-on-timeout, abort, a missing CLI and a runaway output are exercised for
// real; the CostGuard is then driven with failing and malformed executors. Nothing here can reach the network or cost money.
// Run: node studio/modelcalls.test.ts
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CostGuard, CostLimitExceededError, claudeExec, reconcile, type Exec, type ExecResult, type ExecRequest, LIMITS, MAX_OUTPUT_CHARS, parseClaudeJson} from './costguard.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'modelcalls-test-'));
const bin = path.join(tmp, 'bin');
fs.mkdirSync(bin);
const argsLog = path.join(tmp, 'args.json');
fs.writeFileSync(
  path.join(bin, 'claude'),
  `#!${process.execPath}
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(argsLog)}, JSON.stringify(process.argv.slice(2)));
const mode = process.env.FAKE_CLAUDE;
const ok = (o) => process.stdout.write(JSON.stringify(o));
if (mode === 'ok') ok({result: 'hello', total_cost_usd: 0.012, usage: {input_tokens: 100, output_tokens: 20}});
else if (mode === 'no-cost') ok({result: 'hi', usage: {input_tokens: 1000, output_tokens: 200}});
else if (mode === 'rate-limit') { ok({is_error: true, result: 'API Error: 429 rate limit exceeded', usage: {}}); process.exit(1); }
else if (mode === 'budget') ok({is_error: true, subtype: 'error_max_budget_usd', result: '', usage: {input_tokens: 0, output_tokens: 0}, modelUsage: {m: {inputTokens: 500, outputTokens: 50}}, total_cost_usd: 0.2});
else if (mode === 'garbage') process.stdout.write('<<not json>> partial {"res');
else if (mode === 'empty') process.exit(0);
else if (mode === 'hang') setInterval(() => {}, 1000);
else if (mode === 'flood') { const t = setInterval(() => process.stdout.write('x'.repeat(100000)), 1); setTimeout(() => clearInterval(t), 20000); }
else process.exit(3);
`,
);
fs.chmodSync(path.join(bin, 'claude'), 0o755);
const realPath = process.env.PATH;
const withFake = (mode: string) => {
  process.env.PATH = `${bin}:${realPath}`;
  process.env.FAKE_CLAUDE = mode;
};
const req = (o: Partial<ExecRequest> = {}): ExecRequest => ({prompt: 'p', model: 'm', maxBudgetUsd: 0.1, timeoutMs: 10_000, signal: new AbortController().signal, cwd: tmp, ...o});

// ---- the real executor against the fake CLI ----
withFake('ok');
const good = await claudeExec(req({lean: true, tools: ''}));
assert.deepEqual([good.text, good.cost_usd, good.isError, good.usage.input_tokens], ['hello', 0.012, false, 100]);
const argv: string[] = JSON.parse(fs.readFileSync(argsLog, 'utf8'));
for (const must of ['-p', '--output-format', 'json', '--no-session-persistence', '--max-budget-usd', '0.1000', '--disable-slash-commands', '--strict-mcp-config']) assert.ok(argv.includes(must), `argument ${must}`);
assert.ok(!argv.some((a) => /dangerously|bypass/i.test(a)), 'never asks the CLI to skip permissions');
assert.equal(argv[argv.indexOf('--tools') + 1], '', 'a repair gets no built-in tools');

withFake('rate-limit');
const rl = await claudeExec(req());
assert.deepEqual([rl.isError, /429/.test(rl.text)], [true, true], 'a rate-limit answer is an error call, text kept for the log');
withFake('budget');
const bud = await claudeExec(req());
assert.deepEqual([bud.isError, bud.usage.input_tokens, bud.cost_usd], [true, 500, 0.2], 'a session stopped on its budget still reports real usage');
for (const mode of ['garbage', 'empty', 'exit3']) {
  withFake(mode);
  const r = await claudeExec(req());
  assert.equal(r.isError, true, `${mode}: malformed or empty output is an error call, never a success`);
  assert.equal(r.cost_usd, null);
}
withFake('hang');
const t0 = Date.now();
const hung = await claudeExec(req({timeoutMs: 400}));
assert.ok(hung.isError && Date.now() - t0 < 5000, 'a hung session is killed at its timeout');
const ac = new AbortController();
withFake('hang');
setTimeout(() => ac.abort(), 200);
await assert.rejects(claudeExec(req({signal: ac.signal})), /abort/i, 'an aborted run kills the session');
withFake('flood');
const flooded = await claudeExec(req({timeoutMs: 15_000}));
assert.ok(flooded.isError && flooded.text.length <= MAX_OUTPUT_CHARS + 200_000, 'a runaway output is cut off and counted as an error');
process.env.PATH = '/nonexistent';
await assert.rejects(claudeExec(req()), /ENOENT/, 'a missing CLI is a clear error');
process.env.PATH = realPath;
delete process.env.FAKE_CLAUDE;

// ---- parsing ----
assert.equal(parseClaudeJson('{"result":"x","is_error":false}').isError, false);
assert.equal(parseClaudeJson('').isError, true);
assert.equal(parseClaudeJson('[1,2]').text, '', 'valid JSON of the wrong shape yields no text');
assert.equal(parseClaudeJson('{"result":"x","total_cost_usd":"0.5"}').cost_usd, null, 'a cost that is not a number is not trusted');

// ---- the guard with failing executors: bounded, whatever goes wrong ----
const dir = (n: string) => path.join(tmp, n);
const bad: Exec = async () => {
  throw new Error('spawn failed');
};
{
  // a CLI that cannot even start (missing, not executable) cost nothing, but every attempt still counts toward the call ceiling
  const noStart: Exec = async () => {
    throw Object.assign(new Error('spawn claude ENOENT'), {code: 'ENOENT'});
  };
  const g = new CostGuard(dir('throws'), 'b', {exec: noStart, log: () => undefined});
  const errors: string[] = [];
  for (let i = 0; i < 20; i++) {
    try {
      await g.call({stage: 'writer', model: 'm', prompt: 'p'});
    } catch (e) {
      errors.push((e as Error).constructor.name);
      if (e instanceof CostLimitExceededError) break;
    }
  }
  assert.equal(g.ledger.calls.length, LIMITS.MAX_TOTAL_CALLS_PER_RUN, 'attempts stop at the per-run call ceiling');
  assert.equal(errors.at(-1), 'CostLimitExceededError');
  assert.ok(g.ledger.calls.every((c) => c.status === 'error' && c.cost_source === 'none' && c.estimated_cost_usd === 0), 'never-started calls are booked as costing nothing, and say so');
  assert.equal(JSON.parse(fs.readFileSync(g.file, 'utf8')).status, 'aborted', 'the ledger on disk says why it stopped');
}
{
  // a call that may have run (killed, timed out, crashed mid-way) with no cost reported is NOT booked at $0: it is booked at the
  // budget it was allowed, flagged unknown, and that ends the run at the ceiling until Navin checks the provider's usage page
  const g = new CostGuard(dir('unknown'), 'b', {exec: async () => { throw new Error('socket hang up'); }, log: () => undefined});
  await assert.rejects(g.call({stage: 'director', model: 'm', prompt: 'p'}), (e: Error) => e instanceof CostLimitExceededError && e.limit === 'MAX_RUN_COST_USD');
  const c = g.ledger.calls[0];
  assert.deepEqual([c.cost_source, c.estimated_cost_usd, g.ledger.status], ['unknown', LIMITS.MAX_RUN_COST_USD, 'aborted']);
  assert.match(g.summary(), /1 call\(s\) reported no cost and are booked at their budget cap.*reconcile/);
  // reconcile: only an unknown call, only a real number; the total follows
  assert.throws(() => reconcile(g.file, 2, 0.1), /no call 2/);
  assert.throws(() => reconcile(g.file, 1, -1), /0 or more/);
  assert.throws(() => reconcile(g.file, 1, NaN), /0 or more/);
  const after = reconcile(g.file, 1, 0.07);
  assert.deepEqual([after.calls[0].cost_source, after.calls[0].estimated_cost_usd, after.total_cost_usd], ['reconciled', 0.07, 0.07]);
  assert.throws(() => reconcile(g.file, 1, 0.01), /is reconciled, not unknown/, 'a reconciled figure cannot be silently rewritten');
  assert.equal(fs.readdirSync(path.dirname(g.file)).filter((f) => f.endsWith('.tmp')).length, 0);
}
{
  // the same through the real executor: a session killed at its timeout reports nothing, so it is unknown, not free
  withFake('hang');
  const g = new CostGuard(dir('killed'), 'b', {limits: {MAX_WALL_CLOCK_MS: 1000}, log: () => undefined});
  await assert.rejects(g.call({stage: 'director', model: 'm', prompt: 'p'}), CostLimitExceededError);
  assert.equal(g.ledger.calls[0].cost_source, 'unknown');
  assert.ok(g.ledger.calls[0].estimated_cost_usd > 0, 'a killed call is never booked at $0');
  process.env.PATH = realPath;
  delete process.env.FAKE_CLAUDE;
}
{
  // an error answer (rate limit) is returned to the caller flagged, recorded, and counted; the guard never re-sends it by itself
  let calls = 0;
  const exec: Exec = async () => (calls++, {text: '429 rate limit', usage: {input_tokens: 10, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0}, cost_usd: null, isError: true} as ExecResult);
  const g = new CostGuard(dir('ratelimit'), 'b', {exec, log: () => undefined});
  const r = await g.call({stage: 'writer', model: 'm', prompt: 'p'});
  assert.deepEqual([r.isError, calls, g.ledger.calls[0].status, g.ledger.calls[0].cost_source], [true, 1, 'error', 'estimate']);
}
{
  // a missing cost is estimated high (list price), flagged as an estimate, and still stops the run at the ceiling
  const exec: Exec = async () => ({text: 'x', usage: {input_tokens: 20_000, output_tokens: 4_000, cache_write_tokens: 0, cache_read_tokens: 0}, cost_usd: null, isError: false});
  const g = new CostGuard(dir('estimate'), 'b', {exec, log: () => undefined});
  await assert.rejects(g.call({stage: 'director', model: 'm', prompt: 'p'}), (e: Error) => e instanceof CostLimitExceededError && e.limit === 'MAX_RUN_COST_USD');
  assert.equal(g.ledger.calls[0].cost_source, 'estimate');
  assert.ok(g.ledger.calls[0].estimated_cost_usd >= 0.5, 'priced at an Opus-class list price, an over-estimate');
}
{
  // the CLI is told the REMAINING budget and the REMAINING time, so a later call can never be given the full allowance again
  const seen: ExecRequest[] = [];
  let t = 0;
  const exec: Exec = async (r) => (seen.push(r), {text: 'ok', usage: {input_tokens: 1, output_tokens: 1, cache_write_tokens: 0, cache_read_tokens: 0}, cost_usd: 0.15, isError: false});
  const g = new CostGuard(dir('remaining'), 'b', {exec, now: () => t, log: () => undefined});
  await g.call({stage: 'a', model: 'm', prompt: 'p'});
  t += 100_000;
  await g.call({stage: 'b', model: 'm', prompt: 'p'});
  assert.ok(Math.abs(seen[0].maxBudgetUsd - 0.4) < 1e-9 && Math.abs(seen[1].maxBudgetUsd - 0.25) < 1e-9);
  assert.equal(seen[1].timeoutMs, LIMITS.MAX_WALL_CLOCK_MS - 100_000);
}
{
  // a hung executor's timeout is the guard's remaining wall clock, not unlimited
  const g = new CostGuard(dir('wall'), 'b', {exec: async (r) => ({text: String(r.timeoutMs), usage: {input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0}, cost_usd: 0, isError: false}), now: () => 0, log: () => undefined});
  assert.equal(Number((await g.call({stage: 'a', model: 'm', prompt: 'p'})).text), LIMITS.MAX_WALL_CLOCK_MS);
}

fs.rmSync(tmp, {recursive: true, force: true});
console.log('modelcalls ok: the real executor against a fake claude (args, rate limit, budget stop, garbage/empty/non-zero, hang killed at timeout, abort, runaway output cut off, missing CLI); a CLI that cannot start costs nothing and stops at 6 recorded calls; a killed or crashed call is booked at its budget cap as unknown (never $0) and can be reconciled once; errors and missing costs are recorded and over-estimated; remaining budget and time are passed down');
