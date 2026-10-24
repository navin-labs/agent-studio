// Self-test for studio/styles.ts: every catalogue suit is a real theme, choices never repeat a recent look, suit or format,
// and a long run of films spreads across many looks and every format.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {CATALOGUE, chooseStyle, combos, type Style, styleErrors} from './styles.ts';

const themes = fs.readFileSync(path.join(import.meta.dirname, '../engine/src/themes.ts'), 'utf8');
for (const [id, l] of Object.entries(CATALOGUE.looks)) for (const s of l.suits) assert.ok(themes.includes(`'${s}'`) || themes.includes(`  ${s}: {`), `look ${id}: suit ${s} is not a theme in themes.ts`);
assert.ok(combos().length > 100, `the catalogue should offer over 100 combinations, has ${combos().length}`);

const recent: Style[] = [];
for (let i = 0; i < 60; i++) {
  const s = chooseStyle(recent, i % 2 ? 'history' : 'automation', i + 1);
  assert.deepStrictEqual(styleErrors(s, recent), [], `film ${i}: ${JSON.stringify(s)}`);
  recent.push(s);
}
const looks = new Set(recent.map((s) => s.look)), formats = new Set(recent.map((s) => s.format)), suits = new Set(recent.map((s) => s.suit));
assert.ok(looks.size >= 12, `60 films should use at least 12 looks, used ${looks.size}`);
assert.strictEqual(formats.size, Object.keys(CATALOGUE.formats).length, `60 films should use every format, used ${[...formats].join(', ')}`);
assert.match(styleErrors({format: 'network-line', look: 'pencil-sketch', suit: 'linen'}, []).join(), /not made for format/);
assert.match(styleErrors(recent.at(-1)!, recent).join(), /last 6 films/);
const base: Style = {format: 'ambient-scenes', look: 'pixel-night', suit: 'indigo-pixel', hook: 'number', structure: 'story', cta: 'none'};
assert.match(styleErrors({...base, look: 'painted-night', suit: 'sodium-night', format: 'ambient-scenes'}, [base, {format: 'network-line', look: 'light-network', suit: 'signal'}]).join(), /fingerprint: shares format, hook, structure, cta/);
assert.match(styleErrors({...base, format: 'network-line', look: 'light-network', suit: 'signal'}, [base]).join(), /hook number was used/);
const part2 = chooseStyle([{...base, series: 'night-shift'}], 'automation', 1, CATALOGUE, {hook: 'question', structure: 'before-after', cta: 'follow-series', series: 'night-shift'});
assert.deepStrictEqual([part2.format, part2.look, part2.suit], [base.format, base.look, base.suit], 'part 2 of a series stays in its world');
console.log(`styles ok: ${combos().length} combinations; 60 films used ${looks.size} looks, ${suits.size} suits, all ${formats.size} formats, no repeats inside the windows`);
