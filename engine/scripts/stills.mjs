// Visual regression: render 8 evenly spaced frames of 3 reference stories.
// usage (from engine/): node scripts/stills.mjs <outDir> [theme]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
const [out, theme] = process.argv.slice(2);
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
for (const f of ['story-order-emails', 'story-invoice-chase', '2026-10-02-dispatch-lr-updates']) {
  const script = JSON.parse(fs.readFileSync(`content/stories/${f}.json`, 'utf8'));
  if (theme) script.theme = theme;
  const inputProps = {script};
  const comp = await selectComposition({serveUrl, id: 'Story', inputProps});
  for (let i = 0; i < 8; i++) {
    const frame = Math.min(comp.durationInFrames - 1, Math.round((i / 7) * (comp.durationInFrames - 1)));
    await renderStill({serveUrl, composition: comp, inputProps, frame, output: `${out}/${f}-${String(i)}.png`});
  }
  console.log(f, comp.durationInFrames, 'frames');
}
