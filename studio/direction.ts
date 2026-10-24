// Checks a format film's direction (engine/src/fx/direction.ts) before it renders: one shot per voice line, every word anchor
// in its line, every file present, everything inside the frame. Self-test: node studio/direction.test.ts
//   node studio/direction.ts <board.json>     ok, or each problem
import fs from 'node:fs';
import path from 'node:path';
import {directionErrors} from '../engine/src/fx/direction.ts';

const PUBLIC = path.join(import.meta.dirname, '../engine/public');
export const boardDirectionErrors = (doc: Parameters<typeof directionErrors>[0]) => directionErrors(doc, (p) => fs.existsSync(path.join(PUBLIC, p)));

if (import.meta.main) {
  const f = process.argv[2];
  if (!f) (console.error('usage: node studio/direction.ts <board.json>'), process.exit(2));
  const e = boardDirectionErrors(JSON.parse(fs.readFileSync(f, 'utf8')));
  e.forEach((x) => console.log(`FAIL ${x}`));
  console.log(e.length ? `${e.length} problems` : 'ok');
  process.exit(e.length ? 1 : 0);
}
