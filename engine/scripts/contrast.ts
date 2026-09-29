// WCAG AA contrast gate for every theme. Run: node scripts/contrast.ts  (exit 1 on any fail)
import assert from 'node:assert';
import {THEMES, type Theme} from '../src/themes.ts';

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

let fails = 0;
for (const [name, t] of Object.entries(THEMES)) {
  if (!Object.values(t).every((v) => /^#[0-9A-F]{6}$/i.test(v))) {
    console.log(`FAIL ${name}: every token must be #RRGGBB`);
    fails++;
  }
  for (const [fg, bg] of PAIRS) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= AA;
    if (!ok) fails++;
    console.log(`${ok ? 'pass' : 'FAIL'} ${name.padEnd(6)} ${fg} on ${bg}`.padEnd(34) + r.toFixed(2));
  }
}
console.log(fails ? `\n${fails} failing pair(s)` : '\nall themes pass WCAG AA');
process.exit(fails ? 1 : 0);
