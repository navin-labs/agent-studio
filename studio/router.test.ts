// Self-test for studio/router.ts: deterministic, fits the topic, never shares camera / texture / display face / palette with
// the previous video, never repeats a style inside the window, and a long run uses the whole library.
import assert from 'node:assert';
import {family, type RouterPick, pick, shares, STYLES, WINDOW} from './router.ts';

assert.strictEqual(family('The xz backdoor in Linux SSH'), 'security');
assert.strictEqual(family('Bubble wrap was invented in 1957'), 'history');
assert.deepStrictEqual(pick('xz backdoor', '2026-10-27', []), pick('xz backdoor', '2026-10-27', []), 'same input, same pick');

const topics = ['xz backdoor in SSH', 'Bubble wrap invented in 1957', 'Stock market fell 7 percent', 'The game that broke the internet', 'A password leak at a bank', 'The 1920s radio boom', 'Survey: 40 percent of invoices are late', 'Festival food trucks'];
const run: RouterPick[] = [];
for (let i = 0; i < 120; i++) {
  const p = pick(topics[i % topics.length], `2026-11-${String((i % 28) + 1).padStart(2, '0')}-${i}`, run);
  const prev = run.at(-1);
  if (prev) assert.deepStrictEqual(shares(p, prev), [], `video ${i} (${p.style}) shares ${shares(p, prev).join(', ')} with ${prev.style}`);
  assert.ok(!run.slice(-WINDOW).some((r) => r.style === p.style), `video ${i}: ${p.style} repeats inside ${WINDOW}`);
  assert.strictEqual(p.moves.length, 7);
  run.push(p);
}
const used = new Set(run.map((p) => p.style));
const fit = run.filter((p) => p.family === 'security').filter((p) => ['terminal-dark', 'hud', 'investigation', 'orbit-intel', 'ops-board', 'blueprint', 'dark-keynote', 'sixties-titles'].includes(p.style)).length / run.filter((p) => p.family === 'security').length;
assert.ok(used.size >= 24, `120 videos should use most of the ${STYLES.length} styles, used ${used.size}`);
assert.ok(fit >= 0.6, `security topics should mostly get security styles, got ${(fit * 100).toFixed(0)}%`);
console.log(`router ok: 120 videos, ${used.size} of ${STYLES.length} styles, no shared camera/texture/face/palette back to back, no repeat inside ${WINDOW}, ${(fit * 100).toFixed(0)}% topic fit`);
