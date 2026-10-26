// Self-test for engine/src/host/power.ts: an emphasised word pops to 1.2x when spoken and settles back; markers never reach the screen text.
import assert from 'node:assert';
import {parseAccent, plain} from '../engine/src/lib/text.ts';
import {POWER_SCALE, powerScale} from '../engine/src/host/power.ts';

assert.strictEqual(powerScale(9, 10, 20, 30), 1, 'before the word is spoken: normal size');
const peak = Math.max(...Array.from({length: 10}, (_, k) => powerScale(10 + k, 10, 40, 30)));
assert.ok(peak >= POWER_SCALE - 0.001 && peak < POWER_SCALE + 0.12, `pops to about 1.2x (peak ${peak.toFixed(3)})`);
assert.ok(Math.abs(powerScale(39, 10, 40, 30) - POWER_SCALE) < 0.01, 'holds while the word is active');
assert.ok(Math.abs(powerScale(40 + 6, 10, 40, 30) - 1) < 0.001, 'back to normal 6 frames after the next word starts');
assert.ok(powerScale(25, 10, undefined, 30) > 1.19, 'the last word of a line holds');
assert.ok(parseAccent('Still chasing *payments* by *hand?*').every((w) => !w.w.includes('*')), 'no asterisks reach the caption text');
assert.strictEqual(plain('Still chasing *payments* by hand?'), 'Still chasing payments by hand?');
console.log(`power ok: pops to ${peak.toFixed(2)}x, holds, eases back; markers stripped`);
