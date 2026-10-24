// Self-test for studio/direction.ts: a sound direction passes; each kind of mistake fails with its reason; word timing.
import assert from 'node:assert';
import {wordTime} from '../engine/src/fx/direction.ts';
import {boardDirectionErrors} from './direction.ts';

const style = {format: 'memory-windows', look: 'dream-3d', suit: 'gold-dream'};
const good = {
  film: 'memory-windows',
  scenes: [{vo: 'In 1859, a storm on the sun set telegraph paper on fire.'}, {vo: 'Auroras lit the sky.'}, {}],
  direction: {style, shots: [{plate: 'fonts/OFL-Anton.txt', windows: [{photo: 'fonts/OFL-Anton.txt', at: 'telegraph', x: 540, y: 700, w: 400, h: 400}]}, {plate: 'fonts/OFL-Anton.txt'}]},
};
assert.deepStrictEqual(boardDirectionErrors(good), []);
const bad = {...good, film: 'memory-windows', direction: {style: {...style, format: 'doodle-footage'}, shots: [{plate: 'nope.jpg', windows: [{photo: 'fonts/OFL-Anton.txt', at: 'satellite', x: 1400, y: 700, w: 400, h: 400}]}]}};
const e = boardDirectionErrors(bad);
for (const want of ['must be the film', '1 shots for 2 voice lines', 'public/nope.jpg is missing', '"satellite" is not a word of line 1', 'outside the 1080 x 1920 frame']) assert.ok(e.some((x) => x.includes(want)), `must fail on "${want}"; got:\n${e.join('\n')}`);
// a word's time is its share of the line's voice window
assert.strictEqual(wordTime({vo: [1, 3], start: 0.8, text: 'one two three four'}, 'three'), 2);
console.log(`direction ok: a sound direction passes; a broken one fails on ${e.length} exact reasons; words are timed`);
