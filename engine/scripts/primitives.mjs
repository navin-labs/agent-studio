// Primitive check: every spec's example (its test storyboard) validates, then renders a contact sheet.
// usage: npm run primitives [-- --theme ink | --all-themes] [--only flow-run]   -> out/primitives/<id>-<theme>.png
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {blinkAt, mouthFromAmplitude, mouthFromWords} from '../src/host/acting.ts';
import {lengthIssue} from '../src/composer/storyboard.ts';
import {PIXEL, pixelWipePath} from '../src/lib/pixels.ts';
import {cuesOr} from '../src/lib/timing.ts';
import {SPECS, validateParams} from '../src/primitives/specs.ts';
import {THEMES} from '../src/themes.ts';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const themes = args.includes('--all-themes') ? Object.keys(THEMES) : [opt('--theme') ?? 'paper'];
const ids = opt('--only') ? [opt('--only')] : Object.keys(SPECS);

// the validator must reject a broken example, or this whole check means nothing
assert.ok(validateParams('chat-pop', {app: 'X'.repeat(13), text: 'hi'}).length === 1, 'validator broken');
// cue fill: given cues kept, missing ones always land after the last given cue, in order
assert.ok(!lengthIssue({host: 'chiku'}, 43.8) && lengthIssue({host: 'chiku'}, 38) && lengthIssue({}, 50) && !lengthIssue({}, 24), 'length limits per format');
assert.deepEqual(cuesOr([], 2, 0, 100), [25, 75]);
assert.deepEqual(cuesOr([90], 4, 6, 100), [90, 97, 98, 99]); // late single cue: the rest follow it, never before
for (const c of [cuesOr([90], 4, 6, 100), cuesOr([10, 20, 30], 4, 10, 80), cuesOr([50, 60], 2, 0, 10)]) assert.ok(c.every((v, i) => !i || v >= c[i - 1]), `cues out of order: ${c}`);
// pixel wipe: nothing at 0, every block at 1, more blocks as it progresses, same order every render
const blocks = (e) => (pixelWipePath(e).match(/M/g) || []).length;
assert.equal(pixelWipePath(0), 'M0 0z', 'no blocks at the start');
assert.equal(blocks(1), Math.ceil(1080 / PIXEL) * Math.ceil(1920 / PIXEL), 'every block at the end');
assert.ok(blocks(0.3) < blocks(0.6) && blocks(0.6) <= blocks(0.95), 'blocks only ever get added');
assert.equal(pixelWipePath(0.5), pixelWipePath(0.5), 'deterministic');
// host acting: mouth pulses per word, blink cadence, loudness floor
assert.equal(mouthFromWords(0, [10, 20]), 0, 'shut before the first word');
assert.ok(mouthFromWords(13, [10, 20]) > 0.5, 'open mid-word');
assert.equal(mouthFromWords(19, [10, 20]), 0, 'shut between words');
assert.equal(mouthFromWords(40, [10, 20]), 0, 'shut after the last word');
assert.equal(blinkAt(0), 0, 'eyes open at frame 0');
const blinks = Array.from({length: 300}, (_, f) => blinkAt(f) > 0.5).filter((b, f, a) => b && !a[f - 1]).length;
assert.ok(blinks >= 3 && blinks <= 4, `about one blink per 3 s, got ${blinks} in 10 s`);
assert.equal(mouthFromAmplitude(0.01), 0, 'silence keeps the mouth shut');
assert.equal(mouthFromAmplitude(0.9), 1, 'loud caps at fully open');

let fails = 0;
for (const id of ids) {
  const s = SPECS[id];
  const errs = validateParams(id, s.example);
  if (s.seconds[0] <= 0 || s.seconds[0] > s.seconds[1]) errs.push(`seconds ${s.seconds} is not a valid range`);
  if (!s.channels.length) errs.push('no channels');
  errs.forEach((e) => console.log(`FAIL ${id}: ${e}`));
  fails += errs.length;
}
if (fails) process.exit(1);

const out = path.resolve('out/primitives');
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
for (const theme of themes)
  for (const id of ids) {
    const inputProps = {id, theme};
    try {
      const composition = await selectComposition({serveUrl, id: 'ContactSheet', inputProps});
      await renderStill({serveUrl, composition, inputProps, output: `${out}/${id}-${theme}.png`});
      console.log(`ok   ${id} ${theme}`);
    } catch (e) {
      console.log(`FAIL ${id} ${theme}: ${String(e.message).split('\n')[0]}`);
      fails++;
    }
  }
console.log(fails ? `\n${fails} failure(s)` : `\n${ids.length * themes.length} contact sheet(s) in out/primitives/`);
process.exit(fails ? 1 : 0);
