// Recipe: picks the shape of each video slot for a channel's week (theme, shots, transitions, hook pattern). Code, not AI; seeded,
// so the same inputs give the same week. Draws a candidate, checks the novelty rules, redraws; if nothing passes it throws,
// it never hands the Writer a recipe that breaks a rule.
//
// node studio/recipe.ts <channel> <week> [--seed s] [--overwrite]   -> recipes/<channel>/<week>.json (history: every other recipes/**/*.json)
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {boardFormat, HOOK_PATTERNS, LENGTH} from '../engine/src/composer/storyboard.ts';
import {SPECS} from '../engine/src/primitives/specs.ts';
import {addDays, checkNovelty, type Fingerprint, type Violation, weekStart} from './novelty.ts';

export type Channel = {id: string; themes?: string[]; style?: string; host?: string; cadence?: {posts_per_week: number}};
export type Style = {id: string; channel: string; theme: string; transitions: string[]; version: number; about: string; expect?: string};
const ROOT = path.join(import.meta.dirname, '..');
// A styled channel's look comes from its preset (styles/<id>.json, docs/MOTION.md); an unstyled one lists its themes.
export const loadStyle = (id: string, dir = path.join(ROOT, 'styles')): Style => JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
export const channelThemes = (ch: Channel, style: Style | null = ch.style ? loadStyle(ch.style) : null) => (style ? [style.theme] : (ch.themes ?? []));
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
  style?: string;
  guidance?: Guidance;
};
// What Learn found wins, for the Writer (agents/writer/FORGE_WEEKLY_WRITER.md "Learn guidance"); only fields with evidence.
export type Guidance = {caption?: string; cta?: string; seconds?: [number, number]; evidence: string[]};

// Video shapes: one pool of primitives per beat, and the channels each shape is for. host = the Chiku format (ADR 15, night theme,
// C1); explainer = C1's composed manual-pain-to-automatic-flow video (8 beats, 40 to 60 s); composed = the same in 6 beats for C3;
// reach = C2 Backstory's history stories (archive only).
const PAIN = ['ui-inbox', 'ui-sheet', 'ui-chat', 'pile-drop', 'counter-drop', 'phone-buzz', 'zoom-dive'];
export const FORMATS = {
  host: {
    channels: ['c1-automation'],
    themes: ['night', 'night-signal'],
    transitions: ['cut', 'whip-pan', 'pixel-wipe', 'fold'],
    beats: [['host-hook'], PAIN, PAIN, ['ui-diff', 'highlighter-swipe', 'word-stack-slam', 'before-after-split', 'maze-to-line'], ['flow-run', 'flow-build', 'conveyor'], ['ui-sheet', 'ui-chat', 'ui-inbox', 'stamp-hit', 'chat-pop'], ['host-payoff'], ['host-cta']],
  },
  // C1's composed explainer, 8 beats so it reaches the 40 s floor: hook, two pains, the contrast, the flow, the result, the payoff, follow
  explainer: {
    channels: ['c1-automation'],
    themes: ['night', 'night-signal'],
    transitions: ['cut', 'whip-pan', 'ink-wipe', 'fold'],
    beats: [['word-stack-slam', 'pile-drop', 'counter-drop', 'highlighter-swipe', 'chat-pop', 'split-flap', 'phone-buzz', 'zoom-dive'], ['pile-drop', 'ui-inbox', 'ui-sheet', 'phone-buzz', 'zoom-dive', 'chat-pop'], ['ui-chat', 'ui-sheet', 'ui-inbox', 'pile-drop', 'counter-drop', 'conveyor'], ['before-after-split', 'maze-to-line', 'highlighter-swipe', 'ui-diff'], ['flow-run', 'flow-build', 'conveyor'], ['ui-sheet', 'ui-inbox', 'ui-chat', 'stamp-hit', 'counter-drop'], ['word-stack-slam', 'highlighter-swipe', 'split-flap', 'counter-drop'], ['end-card']],
  },
  composed: {
    channels: ['c3-studio'],
    themes: ['paper', 'ink', 'mono', 'studio'],
    transitions: ['cut', 'whip-pan', 'ink-wipe'],
    beats: [['word-stack-slam', 'pile-drop', 'counter-drop', 'highlighter-swipe', 'chat-pop', 'split-flap', 'phone-buzz', 'zoom-dive'], ['pile-drop', 'counter-drop', 'conveyor', 'chat-pop', 'word-stack-slam', 'phone-buzz'], ['highlighter-swipe', 'word-stack-slam', 'flow-build', 'before-after-split', 'maze-to-line'], ['flow-run', 'flow-build', 'conveyor'], ['stamp-hit', 'chat-pop', 'counter-drop', 'split-flap'], ['end-card']],
  },
  reach: {
    channels: ['c2-reach'],
    themes: ['archive', 'archive-gold'],
    transitions: ['cut', 'whip-pan', 'ink-wipe'],
    // Backstory's sixty-second story (docs/FORMATS_PROPOSAL.md, locked 2026-10-03): hook, the world before, the turn, one idea shown,
    // why it matters today, follow. No modern UI chrome (chat-pop, phone-buzz): it breaks the period feel.
    beats: [['word-stack-slam', 'zoom-dive', 'split-flap', 'highlighter-swipe', 'counter-drop'], ['pile-drop', 'conveyor', 'counter-drop', 'before-after-split'], ['split-flap', 'highlighter-swipe', 'word-stack-slam'], ['maze-to-line', 'before-after-split', 'conveyor', 'zoom-dive'], ['counter-drop', 'word-stack-slam', 'split-flap'], ['end-card']],
  },
} as const;
export const EXPERIMENT_SHARE = 0.3; // 70% proven, 30% experiments (Learn fills in what "proven" means in B6)
// A shot list must be able to reach the channel's length floor (storyboard.ts LENGTH: C1 40 s): its shots' maximum seconds add up to
// the floor plus headroom, since no line may run past its shot's maximum and real lines rarely fill every shot to the last frame.
export const FILL = 0.9;
export const reachable = (channel: string, primitives: string[]) => primitives.reduce((a, p) => a + SPECS[p].seconds[1], 0) * FILL >= LENGTH[boardFormat({format: 'storyboard', id: '', channel, scenes: []})][0];
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

// A preset narrows each format's transitions to its own (fold is a signature: only a preset that lists it gets it).
const formatsFor = (ch: Channel, style?: Style | null) =>
  (Object.keys(FORMATS) as (keyof typeof FORMATS)[])
    .map((name) => {
      const tr = FORMATS[name].transitions.filter((t) => (style ? style.transitions.includes(t) : t !== 'fold'));
      return {name, ...FORMATS[name], themes: FORMATS[name].themes.filter((t) => channelThemes(ch, style).includes(t)), transitions: tr.length ? tr : ['cut']};
    })
    .filter((f) => (f.channels as readonly string[]).includes(ch.id) && f.themes.length && (f.name !== 'host' || ch.host));

// proven (from Learn): the 70% draw from proven primitives; the 30% experiments must include at least one unproven one.
// leaks (Learn, scene retention): primitives that lose viewers are kept out of the opening shot while another opener is available.
export const generateWeek = (ch: Channel, week: string, history: Fingerprint[], opts: {bench?: string[]; proven?: string[]; leaks?: string[]; seed?: string; style?: Style | null; hooks?: string[]; removed?: string[]; guidance?: Guidance | null} = {}): Recipe[] => {
  const r = rng(opts.seed ?? `${ch.id}|${week}`);
  const style = opts.style !== undefined ? opts.style : ch.style ? loadStyle(ch.style) : null;
  const n = ch.cadence?.posts_per_week ?? 7;
  // removed: primitives Navin took out of this channel's grammar (a Tier 2 tap, studio/improve.ts); bench: Learn's 2-week rest
  const allowed = (p: string) => SPECS[p]?.channels.includes(ch.id as never) && !opts.bench?.includes(p) && !opts.removed?.includes(p);
  const formats = formatsFor(ch, style);
  if (!formats.length) throw new Error(`${ch.id}: no video format fits its themes (${channelThemes(ch, style).join(', ')})`);
  const experiments = new Set<number>();
  while (experiments.size < Math.round(n * EXPERIMENT_SHARE)) experiments.add(1 + Math.floor(r() * n));
  const short = ch.id.split('-')[0];
  const out: Recipe[] = [];
  for (let slot = 1; slot <= n; slot++) {
    let last: Violation[] = [];
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const f = pick(r, formats);
      const primitives: string[] = [];
      const proven = opts.proven?.length ? opts.proven : null;
      const exp = experiments.has(slot);
      for (const beat of f.beats) {
        const all_ = beat.filter((p) => allowed(p) && !primitives.includes(p));
        const kept = primitives.length ? all_ : all_.filter((p) => !opts.leaks?.includes(p));
        const pool = kept.length ? kept : all_;
        const best = proven && !exp && attempt < ATTEMPTS / 2 ? pool.filter((p) => proven.includes(p)) : []; // a preference: if proven picks cannot pass novelty, the second half draws from the whole pool
        if (!pool.length) break;
        primitives.push(pick(r, best.length ? best : pool)); // no proven option in this beat: fall back to the whole pool
      }
      if (primitives.length !== f.beats.length) continue; // a beat had nothing left (bench or channel filter)
      if (!reachable(ch.id, primitives)) continue; // too short to reach the length floor even with every line at its maximum
      if (proven && exp && f.beats.every((b, i) => b.length === 1 || proven.includes(primitives[i]))) continue; // an experiment must try something unproven
      const theme = pick(r, f.themes);
      // hooks (Learn): hook patterns that win; the 70% prefer them while novelty allows, experiments draw from all
      const hooks = opts.hooks?.length && !exp && attempt < ATTEMPTS / 2 ? opts.hooks : HOOK_PATTERNS;
      const hook = pick(r, hooks);
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
        ...(style ? {style: style.id} : {}),
        ...(opts.guidance ? {guidance: opts.guidance} : {}),
      };
      last = checkNovelty(toFingerprint(rec), [...history, ...out.map(toFingerprint)], {themes: channelThemes(ch, style).length});
      if (!last.length) {
        out.push(rec);
        break;
      }
    }
    if (out.length !== slot) throw new Error(`${ch.id} ${week} slot ${slot}: no recipe passes the novelty rules after ${ATTEMPTS} draws. Last: ${last.map((x) => x.error).join('; ')}`);
  }
  return out;
};

// Plan one channel's week from disk: history = every other recipe file, Learn's active benches and proven list. Never overwrites.
export const planWeek = (chId: string, week: string, o: {seed?: string; recipes?: string; state?: string; channels?: string; styles?: string; overwrite?: boolean} = {}) => {
  const ch: Channel = JSON.parse(fs.readFileSync(path.join(o.channels ?? path.join(ROOT, 'channels'), chId, 'channel.json'), 'utf8'));
  const style = ch.style ? loadStyle(ch.style, o.styles) : null;
  const dir = o.recipes ?? process.env.STUDIO_RECIPES ?? path.join(ROOT, 'recipes');
  const target = path.join(dir, chId, `${week}.json`);
  if (fs.existsSync(target) && !o.overwrite) throw new Error(`${path.relative(ROOT, target)} already exists (Forge may be writing from it)`);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir, {recursive: true, encoding: 'utf8'}).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f)) : [];
  const history = files.filter((f) => f !== target).flatMap((f) => (JSON.parse(fs.readFileSync(f, 'utf8')) as Recipe[]).map(toFingerprint));
  // what Learn decided for this week (studio/learn.ts): active benches and the proven list
  const stateDir = o.state ?? process.env.STUDIO_STATE ?? path.join(ROOT, 'state');
  const lf = path.join(stateDir, 'learn', chId, 'learn.json');
  const learned = fs.existsSync(lf) ? JSON.parse(fs.readFileSync(lf, 'utf8')) : {bench: [], proven: []};
  const bench = (learned.bench as {primitive: string; until: string}[]).filter((b) => b.until > week).map((b) => b.primitive);
  // retention holds join the proven list (preferred); leaks stay out of the opening shot
  const proven = [...new Set<string>([...learned.proven, ...(learned.retention?.holds ?? [])])];
  // grammar removals Navin approved (studio/improve.ts, Tier 2); never the only primitive of a beat
  const gf = path.join(stateDir, 'learn', chId, 'grammar.json');
  const removed: string[] = fs.existsSync(gf) ? JSON.parse(fs.readFileSync(gf, 'utf8')).removed ?? [] : [];
  const recipes = generateWeek(ch, week, history, {seed: o.seed, bench, proven, leaks: learned.retention?.leaks ?? [], style, hooks: learned.guidance?.hooks ?? [], removed, guidance: learned.guidance?.writer ?? null});
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, JSON.stringify(recipes, null, 2) + '\n');
  return {recipes, target, bench, proven};
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const [chId, week] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--seed');
  if (!chId || !/^\d{4}-W\d{2}$/.test(week ?? '')) {
    console.error('usage: node studio/recipe.ts <channel> <YYYY-Www> [--seed s] [--overwrite]');
    process.exit(2);
  }
  const seed = args.includes('--seed') ? args[args.indexOf('--seed') + 1] : undefined;
  const r = planWeek(chId, week, {seed, overwrite: args.includes('--overwrite')});
  if (r.bench.length || r.proven.length) console.log(`learn: bench ${r.bench.join(', ') || 'none'}; proven ${r.proven.join(', ') || 'none'}`);
  for (const x of r.recipes) console.log(`${x.id.padEnd(16)} ${recipeDate(x)} ${x.theme.padEnd(6)} ${x.hook_pattern.padEnd(12)} ${x.experiment ? 'exp ' : '    '}${x.primitives.join(' > ')}`);
  console.log(`-> ${path.relative(path.join(import.meta.dirname, '..'), r.target)}`);
}
