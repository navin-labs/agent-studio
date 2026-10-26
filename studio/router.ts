// Format and style router: picks the format style (engine/styles/) for a video from its topic, so a feed never shows the same
// look twice in a row. Deterministic: the same topic, date and history give the same answer. Rules:
//   - fit: the topic's kind (security, history, data, culture) prefers its own family of styles; any style may still win
//   - no shared DNA with the previous video: different camera rig, texture, display face and palette
//   - no style again inside the last WINDOW videos
// It also hands the composite its per-shot rig (plate move and grade) and the pace, rotated per scene.
//   node studio/router.ts pick "<topic>" [date]     pick for this topic against state/router.jsonl, and record it
// Self-test: node studio/router.test.ts
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {worldOf} from '../engine/src/composer/worldmap.ts';

const ENGINE = path.join(import.meta.dirname, '..', 'engine');
const LEDGER = path.join(import.meta.dirname, '..', 'state', 'router.jsonl');
export const WINDOW = 8;

type StyleFile = {id: string; theme: string; cameraMode: string; fxOverlay: string; pace: string; fonts: {display: string}};
export const STYLES: StyleFile[] = fs
  .readdirSync(path.join(ENGINE, 'styles'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ENGINE, 'styles', f), 'utf8')));

export const FAMILIES: Record<string, {words: RegExp; styles: string[]}> = {
  security: {words: /\b(hack|backdoor|cve|exploit|breach|malware|ssh|linux|server|encrypt|password|cyber|vulnerab|leak|attack|spy)/i, styles: ['terminal-dark', 'hud', 'investigation', 'orbit-intel', 'ops-board', 'blueprint', 'dark-keynote', 'sixties-titles']},
  history: {words: /\b(1[0-9]{3}|history|invent|founded|war|vintage|archive|century|era|ancient|patent)/i, styles: ['newsreel', 'light-table', 'engraving', 'woodcut', 'constructivist', 'art-deco', 'sixties-titles', 'screenprint']},
  data: {words: /\b(percent|%|million|billion|market|stock|price|growth|study|survey|data|rate|record|count|stat)/i, styles: ['data-story', 'countdown', 'swiss-motion', 'headline-bar', 'news-desk', 'pictogram', 'isometric', 'ops-board']},
  culture: {words: /\b(game|music|food|sport|kids|art|movie|fun|meme|travel|festival|toy|team)/i, styles: ['halftone', 'risograph', 'screenprint', 'paper-cut', 'game-show', 'whiteboard', 'line-draw', 'telestrator']},
};
export const family = (topic: string) => Object.entries(FAMILIES).find(([, f]) => f.words.test(topic))?.[0] ?? 'data';

export type RouterPick = {topic: string; date: string; style: string; family: string; camera: string; fx: string; display: string; theme: string; pace: string; world: string; moves: string[]; grade: string};
type Dna = Pick<RouterPick, 'camera' | 'fx' | 'display' | 'theme'>;

// the composite's rig for a style: how plates move, how they are graded
const MOVES: Record<string, string[]> = {'kinetic-punch': ['push', 'ken-burns'], '3d-tilt': ['tilt', 'ken-burns'], 'handheld-doc': ['drift', 'ken-burns'], 'whip-pan': ['ken-burns', 'push'], still: ['ken-burns']};
const GRADES: Record<string, string> = {crt: 'mono-tint', film: 'warm-archive', print: 'warm-archive', tactical: 'cold', none: 'teal-orange'};

const hash = (s: string) => parseInt(crypto.createHash('sha1').update(s).digest('hex').slice(0, 8), 16);
export const shares = (a: Dna, b: Dna) => (['camera', 'fx', 'display', 'theme'] as const).filter((k) => a[k] === b[k]);

export const pick = (topic: string, date: string, recent: RouterPick[], scenes = 7): RouterPick => {
  const fam = family(topic);
  const last = recent.at(-1);
  const banned = new Set(recent.slice(-WINDOW).map((r) => r.style));
  const dna = (s: StyleFile): Dna => ({camera: s.cameraMode, fx: s.fxOverlay, display: s.fonts.display, theme: s.theme});
  // no shared DNA, and a different visual world (papercut, blueprint, newsreel, halftone, comic, scrapbook) from the last video
  const ok = (s: StyleFile) => !banned.has(s.id) && (!last || (shares(dna(s), last).length === 0 && (worldOf(s.id) === 'clean' || worldOf(s.id) !== worldOf(last.style))));
  // fitting styles first, each family list rotated by the seed; then every other style; the first that breaks no rule wins
  const seed = hash(`${topic}|${date}`);
  const fits = FAMILIES[fam].styles;
  const order = [...fits.map((_, i) => fits[(i + seed) % fits.length]), ...STYLES.map((s) => s.id).filter((id) => !fits.includes(id)).sort((a, b) => hash(a + seed) - hash(b + seed))];
  const chosen = order.map((id) => STYLES.find((s) => s.id === id)!).find(ok) ?? STYLES.find((s) => !banned.has(s.id))!; // the second rule relaxes before a video is left without a style
  const moves = MOVES[chosen.cameraMode] ?? MOVES.still;
  return {topic, date, style: chosen.id, family: fam, ...dna(chosen), pace: chosen.pace, world: worldOf(chosen.id), grade: GRADES[chosen.fxOverlay] ?? 'teal-orange', moves: Array.from({length: scenes}, (_, i) => moves[(i + seed) % moves.length])};
};

export const history = (): RouterPick[] => (fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

export const record = (p: RouterPick) => {
  fs.mkdirSync(path.dirname(LEDGER), {recursive: true});
  fs.appendFileSync(LEDGER, JSON.stringify(p) + '\n');
};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename) && process.argv[2] === 'pick') {
  const p = pick(process.argv[3] ?? '', process.argv[4] ?? new Date().toISOString().slice(0, 10), history());
  record(p);
  console.log(JSON.stringify(p, null, 1));
}
