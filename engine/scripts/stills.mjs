// Visual regression and review stills.
// usage (from engine/): node scripts/stills.mjs <outDir> [theme]              8 frames of 3 reference stories
//                       node scripts/stills.mjs <outDir> [theme] --board <file>  per scene: mid-transition + mid-shot
//                       node scripts/stills.mjs <outDir> --comp <id> --frames 0,30,90   given frames of any composition
//                       node scripts/stills.mjs <outDir> --sheet <board> [--style=<id>]  pre-render contact sheet: every scene's
//                         mid frame (hook first, payoff last) on one PNG, silent timing, before any voice or MP4 (npm run sheet)
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {sceneFrames} from '../src/composer/storyboard.ts';
import {resolvePlates} from '../src/lib/mediaHub.ts';
import {history as routerHistory, pick as routerPick} from '../../studio/router.ts';

const args = process.argv.slice(2);
const board = args.includes('--board') ? args[args.indexOf('--board') + 1] : null;
const sheet = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null;
const styleId = args.find((a) => a.startsWith('--style='))?.slice(8);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const [out, theme] = args.filter((a, i) => !a.startsWith('--') && !['--board', '--comp', '--frames', '--sheet'].includes(args[i - 1]));
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});

const shoot = async (id, script, frames, name) => {
  if (theme) script.theme = theme;
  const inputProps = {script};
  const comp = await selectComposition({serveUrl, id, inputProps});
  for (const frame of frames) await renderStill({serveUrl, composition: comp, inputProps, frame: Math.min(frame, comp.durationInFrames - 1), output: `${out}/${name}-${String(frame).padStart(4, '0')}.png`});
  console.log(name, comp.durationInFrames, 'frames');
};

if (sheet) {
  const t0 = Date.now();
  const script = JSON.parse(fs.readFileSync(sheet, 'utf8'));
  // a channel board gets the router's look, exactly as make.mjs gives it
  if (script.channel && !script.film && !(styleId ?? script.formatStyle)) script.rig = routerPick(script.meta?.idea ?? script.caption ?? script.id, new Date().toISOString().slice(0, 10), routerHistory());
  const id = styleId ?? script.formatStyle ?? script.rig?.style;
  if (id) {
    const sf = path.resolve('styles', `${id}.json`);
    if (!fs.existsSync(sf)) throw new Error(`format style ${id} not found (engine/styles/)`);
    script.skin = JSON.parse(fs.readFileSync(sf, 'utf8'));
    script.theme = script.skin.theme;
  }
  if (script.scenes.some((sc) => sc.primitive === 'composite')) script.plates = await resolvePlates(script);
  const inputProps = {script};
  const comp = await selectComposition({serveUrl, id: 'BoardSheet', inputProps});
  const file = `${out}/${script.id}${id ? `.${id}` : ''}.sheet.png`;
  await renderStill({serveUrl, composition: comp, inputProps, frame: 0, output: file});
  console.log(file, `${script.scenes.length} scenes, still ${((Date.now() - t0) / 1000).toFixed(1)}s after bundling`);
} else if (opt('--comp')) {
  const comp = await selectComposition({serveUrl, id: opt('--comp'), inputProps: {}});
  for (const f of opt('--frames').split(',').map(Number)) await renderStill({serveUrl, composition: comp, frame: f, scale: 0.4, output: `${out}/${opt('--comp')}-${String(f).padStart(4, '0')}.png`});
} else if (board) {
  const script = JSON.parse(fs.readFileSync(board, 'utf8'));
  const fr = sceneFrames(script);
  const starts = fr.map((_, i) => fr.slice(0, i).reduce((a, b) => a + b, 0));
  await shoot('Composer', script, starts.flatMap((s, i) => [s + 6, s + Math.round(fr[i] / 2)]), script.id);
} else {
  for (const f of ['story-order-emails', 'story-invoice-chase', '2026-10-02-dispatch-lr-updates']) {
    const script = JSON.parse(fs.readFileSync(`test/stories/${f}.json`, 'utf8'));
    const n = 8;
    const comp = await selectComposition({serveUrl, id: 'Story', inputProps: {script: theme ? {...script, theme} : script}});
    await shoot('Story', script, Array.from({length: n}, (_, i) => Math.round((i / (n - 1)) * (comp.durationInFrames - 1))), f);
  }
}
