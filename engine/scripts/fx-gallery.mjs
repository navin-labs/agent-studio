// Effect gallery: renders each effect alone with its example props (composition fx-<id>, src/Root.tsx) at half size, plus a
// filmstrip, so every effect is seen before a Director uses it.
// usage (from engine/): node scripts/fx-gallery.mjs [id ...]   default: the engine's own effects (prim:* only when named)
//   out: test/out/fx-gallery/<id>.mp4 and <id>.strip.png
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import {filmstrip} from './film.mjs';

const want = process.argv.slice(2).map((id) => `fx-${id.replace(':', '-')}`);
const out = path.resolve('test/out/fx-gallery');
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const comps = (await getCompositions(serveUrl)).filter((c) => (want.length ? want.includes(c.id) : c.id.startsWith('fx-') && !c.id.startsWith('fx-prim-')));
if (want.length && comps.length !== want.length) throw new Error(`unknown effect: ${want.filter((w) => !comps.some((c) => c.id === w)).join(', ')}`);
for (const composition of comps) {
  const mp4 = path.join(out, `${composition.id.slice(3)}.mp4`);
  await renderMedia({serveUrl, composition, codec: 'h264', scale: 0.5, outputLocation: mp4, inputProps: composition.defaultProps, chromiumOptions: {gl: 'angle'}}); // three.js and p5.brush need WebGL
  filmstrip(mp4, mp4.replace(/\.mp4$/, '.strip.png'));
  console.log(composition.id, '->', path.relative(process.cwd(), mp4));
}
