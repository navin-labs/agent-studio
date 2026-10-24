// Saves a Stitch image download (mcp__stitch__download_file) to a file. The tool's result is too large for a session's
// context, so the session gets it saved as JSON {image: <base64>}; this writes the image out.
//   node scripts/stitch-save.mjs <saved tool result> <out.jpg>
import fs from 'node:fs';
import path from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) (console.error('usage: node scripts/stitch-save.mjs <saved tool result> <out.jpg>'), process.exit(2));
const raw = fs.readFileSync(src, 'utf8');
const j = JSON.parse(raw.startsWith('[') ? JSON.parse(raw)[0].text : raw); // some clients wrap the result as [{type, text}]
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, Buffer.from(j.image, 'base64'));
console.log(`${out} (${j.imageMetadata?.mimeType ?? 'image'}, ${Math.round(fs.statSync(out).size / 1024)} KB)`);
