// Theme gate. Run: npm run gate:themes  (exit 1 on any fail)
// 1. every theme passes WCAG AA for its text pairs
// 2. no raw colour in src/ outside themes.ts, so every clip renders in every theme
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {isLight, THEMES, type Theme} from '../src/themes.ts';

const AA = 4.5; // normal text

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Text pairs that must be readable. Text on the highlighter uses onAccent (ADR 8).
const PAIRS: [keyof Theme, keyof Theme][] = [
  ['ink', 'bg'], ['ink', 'surface'], ['onAccent', 'accent'], ['muted', 'bg'], ['muted', 'surface'],
];

// Self-check of the maths against known WCAG values.
assert.ok(Math.abs(ratio('#000000', '#FFFFFF') - 21) < 0.01, 'black/white must be 21');
assert.ok(Math.abs(ratio('#777777', '#FFFFFF') - 4.48) < 0.01, '#777 on white must be 4.48');
assert.ok(isLight('#F4F1EA') && !isLight('#0B0B10') && !isLight('#2B4BFF'), 'isLight broken');

let fails = 0;
for (const [name, t] of Object.entries(THEMES)) {
  if (!Object.values(t).every((v) => /^#[0-9A-F]{6}$/i.test(v))) {
    console.log(`FAIL ${name}: every token must be #RRGGBB`);
    fails++;
  }
  for (const [fg, bg] of [...PAIRS, ...(t.reveal ? [['onAccent', 'reveal'] as [keyof Theme, keyof Theme]] : [])]) {
    const r = ratio(t[fg]!, t[bg]!);
    const ok = r >= AA;
    if (!ok) fails++;
    console.log(`${ok ? 'pass' : 'FAIL'} ${name.padEnd(6)} ${fg} on ${bg}`.padEnd(34) + r.toFixed(2));
  }
}

// ponytail: regex scan, catches hex/rgb/hsl and quoted white/black; a CSS-in-JS parser if named colours ever slip through
const RAW = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(|['"](white|black)['"]/i;
const SRC = path.join(import.meta.dirname, '..', 'src');
const raw: string[] = [];
for (const f of fs.readdirSync(SRC, {recursive: true}) as string[]) {
  if (!/\.(ts|tsx)$/.test(f) || f === 'themes.ts') continue;
  fs.readFileSync(path.join(SRC, f), 'utf8').split('\n').forEach((line, i) => {
    if (RAW.test(line)) raw.push(`src/${f}:${i + 1}: ${line.trim().slice(0, 90)}`);
  });
}
assert.ok(RAW.test("fill='#FFF'") && RAW.test('rgba(0,0,0,.5)') && !RAW.test('th.ink'), 'raw-colour regex broken');
raw.forEach((r) => console.log(`FAIL raw colour outside themes.ts: ${r}`));
fails += raw.length;

console.log(fails ? `\n${fails} failure(s)` : '\nall themes pass WCAG AA; no raw colours outside themes.ts');
process.exit(fails ? 1 : 0);
