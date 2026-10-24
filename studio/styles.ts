// Style rotation (docs/CREATIVE_BIBLE.md section 12): every film is one format x one look x one colour suit from
// studio/looks.json, chosen to fit the story and unlike the channel's recent films, so a feed never repeats. Pure functions;
// the Director calls chooseStyle (or proposes its own and checks it with styleErrors). Self-test: node studio/styles.test.ts
//   node studio/styles.ts choose <channel> <fit> [seed]   a fresh combination for this channel, from the films ledger
import fs from 'node:fs';
import path from 'node:path';
import {FORMAT_FILMS} from '../engine/src/fx/direction.ts';

// seeded draw (the same Park-Miller generator the film kit uses), so a choice is reproducible
const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// format/look/suit are chosen here; hook, structure and cta come from the script (studio/script.ts); a series keeps its world
export type Style = {format: string; look: string; suit: string; hook?: string; structure?: string; cta?: string; series?: string};
const AXES = ['format', 'look', 'suit', 'hook', 'structure', 'cta'] as const;
type Look = {medium: string; grade: string; texture: string; motion: string; formats: string[]; suits: string[]; fit: string[]};
export type Catalogue = {formats: Record<string, {name: string}>; looks: Record<string, Look>; rules: {lookWindow: number; suitWindow: number; formatWindow: number; hookWindow: number; structureWindow: number; ctaWindow: number; fingerprintWindow: number; fingerprintMax: number}};
export const CATALOGUE: Catalogue = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'looks.json'), 'utf8'));

// only the formats that have a renderer (engine/src/films/<format>.tsx), for films made unattended
export const readyCatalogue = (c = CATALOGUE): Catalogue => {
  const ready = new Set(FORMAT_FILMS as readonly string[]);
  const looks = Object.fromEntries(Object.entries(c.looks).map(([id, l]) => [id, {...l, formats: l.formats.filter((f) => ready.has(f))}]).filter(([, l]) => (l as Look).formats.length));
  return {...c, formats: Object.fromEntries(Object.entries(c.formats).filter(([f]) => ready.has(f))), looks};
};

// every allowed combination
export const combos = (c = CATALOGUE): Style[] =>
  Object.entries(c.looks).flatMap(([look, l]) => l.formats.flatMap((format) => l.suits.map((suit) => ({format, look, suit}))));

// what a choice breaks against the channel's recent films (newest last)
export const styleErrors = (s: Style, recent: Style[], c = CATALOGUE): string[] => {
  const e: string[] = [];
  const l = c.looks[s.look];
  if (!l) return [`look "${s.look}" is not in studio/looks.json`];
  if (!c.formats[s.format]) e.push(`format "${s.format}" is not in studio/looks.json`);
  if (!l.formats.includes(s.format)) e.push(`look ${s.look} is not made for format ${s.format} (${l.formats.join(', ')})`);
  if (!l.suits.includes(s.suit)) e.push(`look ${s.look} does not wear suit ${s.suit} (${l.suits.join(', ')})`);
  // a small catalogue (only the formats with a renderer) gets windows it can satisfy: a look or suit may return after the rest
  const n = (k: 'looks' | 'suits') => (k === 'looks' ? Object.keys(c.looks).length : new Set(Object.values(c.looks).flatMap((x) => x.suits)).size);
  const r = {...c.rules, lookWindow: Math.min(c.rules.lookWindow, n('looks') - 2), suitWindow: Math.min(c.rules.suitWindow, n('suits') - 2)};
  // a series keeps one world (its format, look and suit) across parts; the idea changes, the world is the brand
  const world = recent.filter((x) => !(s.series && x.series === s.series));
  if (world.slice(-r.lookWindow).some((x) => x.look === s.look)) e.push(`look ${s.look} was used in the channel's last ${r.lookWindow} films`);
  if (world.slice(-r.suitWindow).some((x) => x.suit === s.suit)) e.push(`suit ${s.suit} was used in the channel's last ${r.suitWindow} films`);
  if (world.slice(-r.formatWindow).some((x) => x.format === s.format)) e.push(`format ${s.format} ran in the previous film`);
  for (const [a, w] of [['hook', r.hookWindow], ['structure', r.structureWindow], ['cta', r.ctaWindow]] as const)
    if (s[a] && recent.slice(-w).some((x) => x[a] === s[a])) e.push(`${a} ${s[a]} was used in the channel's last ${w} films`);
  // fingerprint: never ship a film that matches a recent one on most axes (change at least two)
  for (const x of recent.slice(-r.fingerprintWindow)) {
    const same = AXES.filter((a) => s[a] && s[a] === x[a]);
    if (same.length > r.fingerprintMax) e.push(`fingerprint: shares ${same.join(', ')} with a film in the last ${r.fingerprintWindow}`);
  }
  return e;
};

// a fresh combination: allowed, not recent, fitting the story (a look that fits the story's kind beats one that fits "any"),
// and of the least-used format and look lately; ties broken by a seeded draw so the choice is reproducible
export const chooseStyle = (recent: Style[], fit: string, seed = 1, c = CATALOGUE, story: Omit<Style, 'format' | 'look' | 'suit'> = {}): Style => {
  const ok = combos(c).map((s) => ({...s, ...story})).filter((s) => !styleErrors(s, recent, c).length);
  if (!ok.length) throw new Error('no style combination is free: widen studio/looks.json or relax its rules');
  // the next part of a series stays in the series' world when it may
  const prev = story.series ? [...recent].reverse().find((x) => x.series === story.series) : undefined;
  const same = prev ? ok.filter((s) => s.format === prev.format && s.look === prev.look && s.suit === prev.suit) : [];
  if (same.length) return same[0];
  // looks that suit this story or suit anything; a look made for this kind of story is preferred, never required
  const pool = ok.filter((s) => c.looks[s.look].fit.includes(fit) || c.looks[s.look].fit.includes('any'));
  // spread: prefer the formats and looks used least lately, so the whole catalogue comes round
  const score = (s: Style) => recent.slice(-8).filter((x) => x.format === s.format).length + 2 * recent.slice(-24).filter((x) => x.look === s.look).length + (c.looks[s.look].fit.includes(fit) ? 0 : 1);
  const from = pool.length ? pool : ok;
  const least = Math.min(...from.map(score));
  const final = from.filter((s) => score(s) === least);
  return final[Math.floor(rng(seed * 7919 + 13)() * final.length)];
};

if (process.argv[1] === import.meta.filename) {
  const [cmd, channel, fit = 'any', seed = '1'] = process.argv.slice(2);
  if (cmd !== 'choose' || !channel) throw new Error('usage: node studio/styles.ts choose <channel> <fit> [seed]');
  const {readFilms} = await import('./creative.ts');
  const recent = readFilms().filter((f) => f.channel === channel && (f as {style?: Style}).style).map((f) => (f as {style?: Style}).style!);
  console.log(JSON.stringify(chooseStyle(recent, fit, Number(seed))));
}
