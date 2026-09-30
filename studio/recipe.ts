// Recipe: picks the shape of each video slot for a channel's week (theme, shots, transitions, hook pattern). Code, not AI; seeded,
// so the same inputs give the same week. Draws a candidate, checks the novelty rules, redraws; if nothing passes it throws,
// it never hands the Writer a recipe that breaks a rule.
//
// node studio/recipe.ts <channel> <week> [--seed s]   -> recipes/<channel>/<week>.json (history: every other recipes/**/*.json)
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {HOOK_PATTERNS} from '../engine/src/composer/storyboard.ts';
import {SPECS} from '../engine/src/primitives/specs.ts';
import {addDays, checkNovelty, type Fingerprint, type Violation, weekStart} from './novelty.ts';

export type Channel = {id: string; themes: string[]; host?: string; cadence?: {posts_per_week: number}};
export type Recipe = {
  id: string;
  channel: string;
  week: string;
  slot: number;
  theme: string;
  opening: string;
  primitives: string[];
  transitions: string[];
  rhythm: string;
  hook_pattern: string;
  fingerprint: string;
  experiment: boolean;
};

// Video shapes: one pool of primitives per beat. host = the Chiku format (ADR 15, night theme); composed = the older kinetic boards.
const PAIN = ['ui-inbox', 'ui-sheet', 'ui-chat', 'pile-drop', 'counter-drop'];
export const FORMATS = {
  host: {
    themes: ['night'],
    transitions: ['cut', 'whip-pan', 'pixel-wipe'],
    beats: [['host-hook'], PAIN, PAIN, ['ui-diff', 'highlighter-swipe', 'word-stack-slam'], ['flow-run', 'flow-build', 'conveyor'], ['ui-sheet', 'ui-chat', 'ui-inbox', 'stamp-hit', 'chat-pop'], ['host-payoff'], ['host-cta']],
  },
  composed: {
    themes: ['paper', 'ink', 'mono', 'studio'],
    transitions: ['cut', 'whip-pan', 'ink-wipe'],
    beats: [['word-stack-slam', 'pile-drop', 'counter-drop', 'highlighter-swipe', 'chat-pop'], ['pile-drop', 'counter-drop', 'conveyor', 'chat-pop', 'word-stack-slam'], ['highlighter-swipe', 'word-stack-slam', 'flow-build'], ['flow-run', 'flow-build', 'conveyor'], ['stamp-hit', 'chat-pop', 'counter-drop'], ['end-card']],
  },
} as const;
export const EXPERIMENT_SHARE = 0.3; // 70% proven, 30% experiments (Learn fills in what "proven" means in B6)
const ATTEMPTS = 3000;

// mulberry32 on a string seed: small, fast, repeatable.
export const rng = (seed: string) => {
  let a = createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

export const recipeHash = (theme: string, primitives: string[], hook: string) => createHash('sha1').update(`${theme}|${primitives.join('>')}|${hook}`).digest('hex').slice(0, 12);
export const recipeDate = (r: Pick<Recipe, 'week' | 'slot'>) => addDays(weekStart(r.week), r.slot - 1);
export const toFingerprint = (r: Recipe): Fingerprint => ({id: r.id, channel: r.channel, date: recipeDate(r), primitives: r.primitives, opening: r.opening, theme: r.theme, hook_pattern: r.hook_pattern, hash: r.fingerprint});

const formatsFor = (ch: Channel) =>
  (Object.keys(FORMATS) as (keyof typeof FORMATS)[])
    .map((name) => ({name, ...FORMATS[name], themes: FORMATS[name].themes.filter((t) => ch.themes.includes(t))}))
    .filter((f) => f.themes.length && (f.name !== 'host' || ch.host));

export const generateWeek = (ch: Channel, week: string, history: Fingerprint[], opts: {bench?: string[]; seed?: string} = {}): Recipe[] => {
  const r = rng(opts.seed ?? `${ch.id}|${week}`);
  const n = ch.cadence?.posts_per_week ?? 7;
  const allowed = (p: string) => SPECS[p]?.channels.includes(ch.id as never) && !opts.bench?.includes(p);
  const formats = formatsFor(ch);
  if (!formats.length) throw new Error(`${ch.id}: no video format fits its themes (${ch.themes.join(', ')})`);
  const experiments = new Set<number>();
  while (experiments.size < Math.round(n * EXPERIMENT_SHARE)) experiments.add(1 + Math.floor(r() * n));
  const short = ch.id.split('-')[0];
  const out: Recipe[] = [];
  for (let slot = 1; slot <= n; slot++) {
    let last: Violation[] = [];
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const f = pick(r, formats);
      const primitives: string[] = [];
      for (const beat of f.beats) {
        const pool = beat.filter((p) => allowed(p) && !primitives.includes(p));
        if (!pool.length) break;
        primitives.push(pick(r, pool));
      }
      if (primitives.length !== f.beats.length) continue; // a beat had nothing left (bench or channel filter)
      const theme = pick(r, f.themes);
      const hook = pick(r, HOOK_PATTERNS);
      const rec: Recipe = {
        id: `${short}-${week.toLowerCase()}-${slot}`,
        channel: ch.id,
        week,
        slot,
        theme,
        opening: primitives[0],
        primitives,
        transitions: primitives.map((_, i) => (i ? pick(r, f.transitions) : 'cut')),
        rhythm: 'TBD',
        hook_pattern: hook,
        fingerprint: recipeHash(theme, primitives, hook),
        experiment: experiments.has(slot),
      };
      last = checkNovelty(toFingerprint(rec), [...history, ...out.map(toFingerprint)]);
      if (!last.length) {
        out.push(rec);
        break;
      }
    }
    if (out.length !== slot) throw new Error(`${ch.id} ${week} slot ${slot}: no recipe passes the novelty rules after ${ATTEMPTS} draws. Last: ${last.map((x) => x.error).join('; ')}`);
  }
  return out;
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const [chId, week] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--seed');
  if (!chId || !/^\d{4}-W\d{2}$/.test(week ?? '')) {
    console.error('usage: node studio/recipe.ts <channel> <YYYY-Www> [--seed s]');
    process.exit(2);
  }
  const ROOT = path.join(import.meta.dirname, '..');
  const ch: Channel = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels', chId, 'channel.json'), 'utf8'));
  const dir = path.join(ROOT, 'recipes');
  const target = path.join(dir, chId, `${week}.json`);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir, {recursive: true, encoding: 'utf8'}).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f)) : [];
  const history = files.filter((f) => f !== target).flatMap((f) => (JSON.parse(fs.readFileSync(f, 'utf8')) as Recipe[]).map(toFingerprint));
  const seed = args.includes('--seed') ? args[args.indexOf('--seed') + 1] : undefined;
  const week_ = generateWeek(ch, week, history, {seed});
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, JSON.stringify(week_, null, 2) + '\n');
  for (const x of week_) console.log(`${x.id.padEnd(16)} ${recipeDate(x)} ${x.theme.padEnd(6)} ${x.hook_pattern.padEnd(12)} ${x.experiment ? 'exp ' : '    '}${x.primitives.join(' > ')}`);
  console.log(`-> ${path.relative(ROOT, target)}`);
}
