// Visual regression and review stills.
// usage (from engine/): node scripts/stills.mjs <outDir> [theme]              8 frames of 3 reference stories
//                       node scripts/stills.mjs <outDir> [theme] --board <file>  per scene: mid-transition + mid-shot
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {sceneFrames} from '../src/composer/storyboard.ts';

const args = process.argv.slice(2);
const board = args.includes('--board') ? args[args.indexOf('--board') + 1] : null;
const [out, theme] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--board');
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});

const shoot = async (id, script, frames, name) => {
  if (theme) script.theme = theme;
  const inputProps = {script};
  const comp = await selectComposition({serveUrl, id, inputProps});
  for (const frame of frames) await renderStill({serveUrl, composition: comp, inputProps, frame: Math.min(frame, comp.durationInFrames - 1), output: `${out}/${name}-${String(frame).padStart(4, '0')}.png`});
  console.log(name, comp.durationInFrames, 'frames');
};

if (board) {
  const script = JSON.parse(fs.readFileSync(board, 'utf8'));
  const fr = sceneFrames(script);
  const starts = fr.map((_, i) => fr.slice(0, i).reduce((a, b) => a + b, 0));
  await shoot('Composer', script, starts.flatMap((s, i) => [s + 6, s + Math.round(fr[i] / 2)]), script.id);
} else {
  for (const f of ['story-order-emails', 'story-invoice-chase', '2026-10-02-dispatch-lr-updates']) {
    const script = JSON.parse(fs.readFileSync(`content/stories/${f}.json`, 'utf8'));
    const n = 8;
    const comp = await selectComposition({serveUrl, id: 'Story', inputProps: {script: theme ? {...script, theme} : script}});
    await shoot('Story', script, Array.from({length: n}, (_, i) => Math.round((i / (n - 1)) * (comp.durationInFrames - 1))), f);
  }
}
