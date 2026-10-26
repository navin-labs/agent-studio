// Self-test for the Composer's sound identity: the music ducks under the voice, the closing scene holds the 2 s bumper, and the
// four generated files exist, are the right length and differ per channel.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {BRAND_AUDIO, BUMPER_FRAMES} from '../engine/src/composer/brand-audio.ts';
import {sceneFrames} from '../engine/src/composer/storyboard.ts';
import {FPS} from '../engine/src/lib/timing.ts';
import {scoreDb} from '../engine/src/lib/score.ts';

// ducking: -10 dB while a line speaks (from 0.25 s before it starts), back up within ~0.4 s after it ends
const talk: [number, number][] = [[2, 5]];
const opts = {base: -20, duck: 10, talk};
assert.strictEqual(scoreDb(1, opts), -20, 'music at its base level in a gap');
assert.ok(Math.abs(scoreDb(3, opts) - -30) < 0.01, 'ducked 10 dB while the voice speaks');
assert.ok(scoreDb(5.05, opts) > -30 && scoreDb(5.3, opts) > scoreDb(5.05, opts) && scoreDb(6, opts) === -20, 'rises again after the line ends');
assert.ok(scoreDb(1.9, opts) < -20 && scoreDb(1.9, opts) > -30, 'starts ducking just before the voice');
assert.ok(scoreDb(0, {...opts, shape: [[0, -12], [0.8, 0]]}) === -32 && scoreDb(0.8, {...opts, shape: [[0, -12], [0.8, 0]]}) === -20, 'the fade-in shape applies');

// the closing scene is long enough for the voice plus the whole bumper (channel boards only; a film keeps its own timing)
const mk = (extra = {}) => ({format: 'storyboard', id: 't', channel: 'c1-automation', ...extra, scenes: [
  {primitive: 'word-stack-slam', vo: 'Hello there.', params: {text: 'Hello'}},
  {primitive: 'end-card', vo: 'Follow for more.', params: {cta: 'Follow *now*', promise: 'p', author: 'a'}},
]}) as never;
const timing = {durations: [1.5, 1.5]};
const plain = sceneFrames(mk(), timing);
const withBumper = sceneFrames(mk({bumper: true}), timing);
assert.deepStrictEqual(withBumper.slice(0, 1), plain.slice(0, 1), 'earlier scenes are untouched');
assert.ok(withBumper[1] >= 4 + Math.ceil(1.5 * FPS) + BUMPER_FRAMES && withBumper[1] > plain[1], `the closer holds the bumper (${plain[1]} -> ${withBumper[1]} frames)`);
assert.deepStrictEqual(sceneFrames(mk({bumper: true, film: 'x'}), timing), plain, 'a film keeps its own timing');

// the generated files
const dir = path.join(import.meta.dirname, '..', 'engine', 'public');
const wavSeconds = (f: string) => { const b = fs.readFileSync(path.join(dir, f)); return (b.length - 44) / b.readUInt32LE(28); };
for (const [channel, a] of Object.entries(BRAND_AUDIO)) {
  assert.ok(Math.abs(wavSeconds(a.bumper) - 2) < 0.05, `${channel} bumper is 2 s`);
  assert.ok(wavSeconds(a.bed) >= 60, `${channel} bed covers a 60 s video`);
}
assert.notDeepStrictEqual(fs.readFileSync(path.join(dir, BRAND_AUDIO['c1-automation'].bumper)), fs.readFileSync(path.join(dir, BRAND_AUDIO['c2-reach'].bumper)), 'each channel has its own bumper');
console.log('score ok: music ducks 10 dB under the voice; the closer holds the 2 s bumper; 4 channel files present');
