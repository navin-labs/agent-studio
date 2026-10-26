// Self-test for the cost guard, the free gates' targeting and the surgical repair. No model is called: a fake executor stands in.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {CostGuard, CostLimitExceededError, CriticLockedError, type Exec, HumanReviewRequired, LIMITS, parseClaudeJson, PromptTooLargeError} from './costguard.ts';
import {limitsFromEnv} from './director.ts';
import {type Board, gateFailures, targetsOf} from './gates.ts';
import {applyPatches, repairBoard, repairPrompt} from './repair.ts';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'costguard-'));
const reply = (text: string, cost: number): Exec => async () => ({text, cost_usd: cost, isError: false, usage: {input_tokens: 100, output_tokens: 50, cache_write_tokens: 1000, cache_read_tokens: 5000}});
const guard = (exec: Exec, extra: {now?: () => number; log?: (s: string) => void} = {}) => new CostGuard(tmp(), 'b.json', {exec, ...extra});
const req = (stage: string, extra = {}) => ({stage, model: 'sonnet', prompt: 'hi', ...extra});

// ---- the ceilings are the agreed numbers (a change here is a decision, not a tweak)
assert.deepStrictEqual(LIMITS, {MAX_RUN_COST_USD: 0.4, WARN_COST_USD: 0.25, MAX_TOTAL_CALLS_PER_RUN: 6, MAX_STAGE_RETRIES: 2, MAX_WALL_CLOCK_MS: 300_000, MAX_INPUT_TOKENS: 6000, MAX_CRITIC_CALLS: 1});

// ---- ledger and cost table
{
  const g = guard(reply('ok', 0.05));
  await g.call(req('director'));
  await g.call(req('critic', {critic: true, gates: []}));
  const j = JSON.parse(fs.readFileSync(g.file, 'utf8'));
  assert.strictEqual(j.calls.length, 2);
  assert.deepStrictEqual(Object.keys(j.calls[0]).filter((k) => ['stage', 'model', 'input_tokens', 'output_tokens', 'cache_write_tokens', 'estimated_cost_usd', 'elapsed_ms'].includes(k)).sort(), ['cache_write_tokens', 'elapsed_ms', 'estimated_cost_usd', 'input_tokens', 'model', 'output_tokens', 'stage']);
  assert.ok(Math.abs(j.total_cost_usd - 0.1) < 1e-9 && j.critic_calls === 1);
  g.finish('done');
  const t = g.summary();
  for (const want of ['Stage', 'Calls', 'Retries', 'Tokens (In/Out)', 'Cost ($ USD)', 'Status', 'director', 'critic', 'TOTAL', 'DONE']) assert.ok(t.includes(want), `summary has ${want}:\n${t}`);
}

// ---- cost: loud warning at 0.25, hard stop at 0.40 (abort + throw), and no call after it
{
  const warned: string[] = [];
  const g = guard(reply('ok', 0.13), {log: (s) => warned.push(s)});
  await g.call(req('a'));
  assert.deepStrictEqual(warned, [], 'no warning at $0.13');
  await g.call(req('b'));
  assert.ok(warned.length === 1 && warned.join('').includes('COST WARNING'), 'warning at $0.26');
  await g.call(req('c'));
  await assert.rejects(g.call(req('d')), (e: Error) => e instanceof CostLimitExceededError && (e as CostLimitExceededError).limit === 'MAX_RUN_COST_USD', 'refused once $0.39 + a call is over, or at the next call');
}
{
  const g = guard(reply('ok', 0.45));
  await assert.rejects(g.call(req('big')), (e: Error) => e instanceof CostLimitExceededError, 'one call over the ceiling throws');
  assert.ok(g.controller.signal.aborted, 'AbortController.abort() fired');
  assert.strictEqual(g.ledger.status, 'aborted');
  await assert.rejects(g.call(req('after')), CostLimitExceededError, 'nothing runs after an abort');
}

// ---- the remaining budget and clock are handed to the call itself
{
  let seen: {maxBudgetUsd: number; timeoutMs: number} | undefined;
  const g = guard(async (r) => ((seen = r), {text: '', cost_usd: 0.1, isError: false, usage: {input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0}}));
  await g.call(req('a'));
  await g.call(req('b'));
  assert.ok(Math.abs(seen!.maxBudgetUsd - 0.3) < 1e-9, `the second call may spend only what is left ($${seen!.maxBudgetUsd})`);
  assert.ok(seen!.timeoutMs <= LIMITS.MAX_WALL_CLOCK_MS);
}

// ---- a cold call is expensive: the next call is refused when a call of its stage already costs too much to fit
{
  const g = guard(reply('ok', 0.3));
  await g.call(req('repair'));
  await assert.rejects(g.call(req('repair')), (e: Error) => e instanceof CostLimitExceededError && e.message.includes('costs about'), 'a $0.30 stage is not repeated at $0.30 spent of $0.40');
  assert.ok(g.controller.signal.aborted);
}

// ---- the CLI's report: normal, and the budget-stop shape where only modelUsage holds the numbers (seen live)
{
  const ok = parseClaudeJson(JSON.stringify({result: 'OK', is_error: false, total_cost_usd: 0.0135, usage: {input_tokens: 2, output_tokens: 4, cache_creation_input_tokens: 3356, cache_read_input_tokens: 0}}));
  assert.deepStrictEqual([ok.text, ok.cost_usd, ok.isError, ok.usage.cache_write_tokens], ['OK', 0.0135, false, 3356]);
  const stopped = parseClaudeJson(JSON.stringify({result: null, is_error: true, subtype: 'error_max_budget_usd', total_cost_usd: 0.0595, usage: {input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0}, modelUsage: {'claude-sonnet-5-5': {inputTokens: 2, outputTokens: 4, cacheReadInputTokens: 165426, cacheCreationInputTokens: 10731, costUSD: 0.0595}}}));
  assert.deepStrictEqual([stopped.isError, stopped.cost_usd, stopped.usage.cache_read_tokens, stopped.usage.cache_write_tokens], [true, 0.0595, 165426, 10731], 'tokens are read from modelUsage when usage is zeroed');
  const junk = parseClaudeJson('Killed');
  assert.ok(junk.isError && junk.cost_usd === null, 'unparseable output is an error call, costed by estimate');
}

// ---- calls: six at most
{
  const g = guard(reply('ok', 0.001));
  for (let i = 0; i < LIMITS.MAX_TOTAL_CALLS_PER_RUN; i++) await g.call(req(`s${i}`));
  await assert.rejects(g.call(req('seventh')), (e: Error) => e instanceof CostLimitExceededError && (e as CostLimitExceededError).limit === 'MAX_TOTAL_CALLS_PER_RUN');
}

// ---- wall clock: five minutes
{
  let t = 1_000_000;
  const g = guard(reply('ok', 0.001), {now: () => t});
  await g.call(req('a'));
  t += LIMITS.MAX_WALL_CLOCK_MS;
  await assert.rejects(g.call(req('b')), (e: Error) => e instanceof CostLimitExceededError && (e as CostLimitExceededError).limit === 'MAX_WALL_CLOCK_MS');
}

// ---- pre-flight: an oversized prompt never reaches the model
{
  let calls = 0;
  const g = guard(async () => (calls++, {text: '', cost_usd: 0, isError: false, usage: {input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0}}));
  await assert.rejects(g.call(req('writer', {prompt: 'x'.repeat(Math.ceil(LIMITS.MAX_INPUT_TOKENS * 3.8) + 10)})), PromptTooLargeError);
  assert.strictEqual(calls, 0, 'no executor call, no ledger line');
  assert.strictEqual(g.ledger.calls.length, 0);
  await g.call(req('writer', {prompt: 'x'.repeat(Math.floor(LIMITS.MAX_INPUT_TOKENS * 3.8) - 10)}));
}

// ---- stage retries: two allowed, the third is never fired
{
  const g = guard(reply('ok', 0.001));
  await g.call(req('writer-repair', {retry: 0}));
  await g.call(req('writer-repair', {retry: 1}));
  await g.call(req('writer-repair', {retry: 2}));
  await assert.rejects(g.call(req('writer-repair', {retry: 3})), HumanReviewRequired);
  assert.strictEqual(g.ledger.status, 'human-review');
  assert.strictEqual(g.ledger.calls.length, 3);
}

// ---- the paid Critic: only after every free gate passes, and once
{
  const g = guard(reply('ok', 0.01));
  await assert.rejects(g.call(req('critic', {critic: true, gates: ['script: hook too long']})), (e: Error) => e instanceof CriticLockedError && e.message.includes('hook too long'));
  assert.strictEqual(g.ledger.calls.length, 0, 'a locked Critic costs nothing');
  await g.call(req('critic', {critic: true, gates: []}));
  await assert.rejects(g.call(req('critic', {critic: true, gates: []})), CriticLockedError, 'a second Critic call is refused');
}

// ---- the human-only knobs
assert.deepStrictEqual(limitsFromEnv({}), {});
assert.strictEqual(limitsFromEnv({COSTGUARD_MAX_USD: '2'}).MAX_RUN_COST_USD, 2);
assert.ok(Math.abs(limitsFromEnv({COSTGUARD_MAX_USD: '2'}).WARN_COST_USD! - 1.25) < 1e-9, 'the warning scales with the ceiling');

// ---- gates, targeting and surgical repair
const S = (vo?: string) => ({primitive: 'x', ...(vo ? {vo} : {})});
const good: Board = {
  film: 'x',
  scenes: [S("You've touched this every day and never noticed it."), S('In 1941, a dog came home covered in burrs.'), S('Most people would brush them off. But George de Mestral put one under a microscope.'), S('Every burr held hundreds of tiny hooks. So it gripped anything with a loop.'), S('Fourteen years later, US patent 2,717,437 turned that into a fastener.'), S("Today it holds astronauts' gear in space, and the thing you touched today."), S()],
  meta: {devices: ['novelty', 'reveal', 'contrast', 'proof', 'stakes', 'number', 'loop'], proof: {fact: 'US patent 2,717,437 (1955)', source: 'https://patents.google.com/patent/US2717437A/en'}, structure: 'story', cta: 'none'},
};
assert.deepStrictEqual(gateFailures(good), [], 'the good board passes every free gate');
const longLine = 'Most people would brush them off. But George de Mestral put one under a microscope and wrote down every single detail he could find about it.';
const broken: Board = {...good, scenes: good.scenes.map((s, i) => (i === 2 ? S(longLine) : s))};
const errs = gateFailures(broken);
assert.ok(errs.some((e) => e.startsWith('sentence 4:')), `the long sentence is found: ${errs}`);
const placed = targetsOf(broken, errs);
assert.deepStrictEqual(placed.targets.map((t) => t.scene), [2], 'sentence 4 belongs to scene 2');
assert.deepStrictEqual(placed.unplaced, []);
assert.deepStrictEqual(targetsOf(good, ['density: 3.1 s with nothing new on screen from 4.0 s (scene 3, chat-pop); the limit is 2.5 s.']).targets.map((t) => t.scene), [2]);
assert.strictEqual(targetsOf(good, ['devices: declare reveal in meta.devices']).unplaced.length, 1, 'a whole-script error has no line to repair');

const prompt = repairPrompt(broken, placed.targets);
assert.ok(prompt.includes('wrote down every single detail') && prompt.includes('In 1941') && prompt.includes('Every burr held'), 'the failing line and its neighbours are sent');
assert.ok(!prompt.includes('patent 2,717,437') && !prompt.includes('astronauts'), 'nothing else from the script is sent');
assert.ok(prompt.includes('sentence 4:'), 'the exact error text is sent');

const fix = JSON.stringify({patches: [{scene: 2, vo: 'Most people would brush them off. But George de Mestral put one under a microscope.'}]});
{
  const g = guard(reply(fix, 0.02));
  const r = await repairBoard(g, broken);
  assert.strictEqual(r.attempts, 1);
  assert.deepStrictEqual(gateFailures(r.board), []);
  assert.strictEqual(r.board.scenes[3].vo, good.scenes[3].vo, 'other scenes are untouched');
  assert.strictEqual(g.ledger.calls.length, 1, 'one micro-call fixed it');
}
{
  const g = guard(reply(JSON.stringify({patches: [{scene: 2, vo: longLine}]}), 0.01));
  await assert.rejects(repairBoard(g, broken), HumanReviewRequired);
  assert.strictEqual(g.ledger.calls.length, 3, 'attempt + 2 retries, then a human: never a 4th call');
  assert.strictEqual(g.ledger.status, 'human-review');
}
{
  let calls = 0;
  const g = guard(async () => (calls++, {text: 'not json', cost_usd: 0.01, isError: false, usage: {input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0}}));
  await assert.rejects(repairBoard(g, broken), HumanReviewRequired);
  assert.strictEqual(calls, 3, 'a garbled reply counts as a failed attempt');
}
{
  let calls = 0;
  const g = guard(async () => (calls++, {text: '', cost_usd: 0, isError: false, usage: {input_tokens: 0, output_tokens: 0, cache_write_tokens: 0, cache_read_tokens: 0}}));
  const noProof: Board = {...good, meta: {...good.meta, proof: undefined}};
  await assert.rejects(repairBoard(g, noProof), HumanReviewRequired);
  assert.strictEqual(calls, 0, 'an error with no line to fix goes straight to a human, at no cost');
}
assert.throws(() => applyPatches(broken, JSON.stringify({patches: [{scene: 5, vo: 'x'}]}), placed.targets), /was not asked for/);
assert.throws(() => applyPatches(broken, JSON.stringify({patches: [{scene: 2, vo: 'two\nlines'}]}), placed.targets), /plain one-line/);
assert.deepStrictEqual(await repairBoard(guard(reply('', 0)), good).then((r) => r.attempts), 0, 'a passing board costs nothing');

console.log('costguard ok: $0.25 warns and $0.40 aborts; 6 calls, 5 minutes, 6000-token prompts and 2 retries are hard; the Critic is locked behind the free gates and runs once; a failing line is repaired by a micro-call, never a restart');
