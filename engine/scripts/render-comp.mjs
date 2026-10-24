// Render any composition by id to an mp4 (test renders of demos and proofs; nothing here is ever dispatched).
// usage (from engine/): node scripts/render-comp.mjs <composition id> <out.mp4> [--scale 0.5]
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import path from 'node:path';

const [id, out] = process.argv.slice(2);
const scale = process.argv.includes('--scale') ? Number(process.argv[process.argv.indexOf('--scale') + 1]) : 1;
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id});
await renderMedia({serveUrl, composition, codec: 'h264', scale, outputLocation: out, chromiumOptions: {gl: 'angle'}}); // three.js and p5.brush need WebGL
console.log(id, '->', out);
