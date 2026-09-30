// Primitive check: every spec's example (its test storyboard) validates, then renders a contact sheet.
// usage: npm run primitives [-- --theme ink | --all-themes] [--only flow-run]   -> out/primitives/<id>-<theme>.png
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {SPECS, validateParams} from '../src/primitives/specs.ts';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const themes = args.includes('--all-themes') ? ['paper', 'ink', 'mono', 'studio'] : [opt('--theme') ?? 'paper'];
const ids = opt('--only') ? [opt('--only')] : Object.keys(SPECS);

// the validator must reject a broken example, or this whole check means nothing
assert.ok(validateParams('chat-pop', {app: 'X'.repeat(13), text: 'hi'}).length === 1, 'validator broken');

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
