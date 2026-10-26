// Creative memory and the uniqueness gate for authored films (agents/director/DIRECTOR.md).
// The ledger (state/films.jsonl, append-only, latest line per id wins, order = first appearance) remembers every film's brief,
// render facts and creative review, approved or not: tomorrow's film must differ from today's even before anyone approves it.
// Pure rules below; QA (qa.ts) re-checks them on the finished film. Self-test: node studio/creative.test.ts
//   node studio/creative.ts history [n]                  recent creative directions, newest last (the Director reads this first)
//   node studio/creative.ts check <board.json>           the board's brief against recent films: pass, or each rule it breaks
//   node studio/creative.ts brief <board.json>           check, then record the brief (status briefed)
//   node studio/creative.ts review <board.json> <review.json>   record the creative review (bound to the film's source)
//   node studio/creative.ts style <board.json>           a format film: choose its style (studio/styles.ts), write it into the board, record it
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {Storyboard} from '../engine/src/composer/storyboard.ts';
import {type Brief, COORDS, type Coords} from '../engine/src/films/brief.ts';
import {appendJsonl, PATHS, readJsonl} from './ledger.ts';
import {topicSimilarity} from './novelty.ts';
import {hookType, scriptErrors} from './script.ts';
import {chooseStyle, readyCatalogue, type Style, styleErrors} from './styles.ts';

const ROOT = path.join(import.meta.dirname, '..');
export const SCORES = ['first_frame', 'hook_3s', 'visual_storytelling', 'composition', 'typography', 'motion', 'cinematography', 'metaphor', 'transitions', 'originality', 'authored', 'premium', 'sound', 'restraint', 'memorability'] as const;
export const ANTI_SLOP = ['not_generic_ai_tool', 'not_canva_template', 'composition_not_reusable', 'metaphor_specific_to_story', 'opening_not_common', 'has_memorable_moment', 'works_muted', 'works_without_captions'] as const;
export type Review = {scores: Record<(typeof SCORES)[number], number>; anti_slop: Record<(typeof ANTI_SLOP)[number], boolean>; generic: string; exceptional: string; remove: string; verdict: 'pass' | 'fail'; film_sha?: string};
// an authored film has a brief; a format film (fx/direction.ts) has a style instead
export type FilmEntry = {id: string; channel: string; film: string; theme: string; brief?: Brief; style?: Style; status: 'poc' | 'briefed' | 'reviewed' | 'rejected'; review?: Review; at: string};

export const LIMITS = {minDiffPrev: 5, maxSameRecent: 6, recent: 5, hookRun: 2, textSim: 0.5, textWindow: 10, musicSim: 0.6, musicWindow: 3, minScore: 6, minMean: 7.5};

export const filmsFile = (p = PATHS) => path.join(p.state, 'films.jsonl');
// newest state per id, in the order films were first briefed
export const readFilms = (p = PATHS): FilmEntry[] => {
  const latest = new Map<string, FilmEntry>();
  for (const e of readJsonl<FilmEntry>(filmsFile(p))) latest.set(e.id, e);
  return [...latest.values()];
};

const keys = Object.keys(COORDS) as (keyof Coords)[];
export const sameCoords = (a: Coords, b: Coords) => keys.filter((k) => a[k] === b[k]);

export type Violation = {rule: string; error: string};
// The brief against the films before it (oldest first; rejected films do not count, they were never made).
export const checkCreative = (brief: Brief, theme: string, before: FilmEntry[]): Violation[] => {
  const v: Violation[] = [];
  const made = before.filter((f) => f.status !== 'rejected' && f.brief) as (FilmEntry & {brief: Brief})[];
  const prev = made.at(-1);
  const recent = made.slice(-LIMITS.recent);
  if (prev) {
    const same = sameCoords(brief.coords, prev.brief.coords);
    if (keys.length - same.length < LIMITS.minDiffPrev) v.push({rule: 'distance', error: `only ${keys.length - same.length} of ${keys.length} coordinates differ from the previous film ${prev.id} (needs ${LIMITS.minDiffPrev}); same: ${same.join(', ')}`});
    if (theme === prev.theme) v.push({rule: 'palette', error: `theme ${theme} is the previous film's (${prev.id}); give this film its own palette`});
  }
  for (const f of recent) {
    const c = f.brief.coords;
    if (c.luminance === brief.coords.luminance && c.rendering === brief.coords.rendering && c.space === brief.coords.space)
      v.push({rule: 'look', error: `same look as ${f.id}: ${c.luminance} ${c.rendering} ${c.space}`});
    const same = sameCoords(brief.coords, c);
    if (f !== prev && same.length > LIMITS.maxSameRecent) v.push({rule: 'family', error: `${same.length} of ${keys.length} coordinates equal ${f.id} (max ${LIMITS.maxSameRecent})`});
  }
  const hooks = made.slice(-LIMITS.hookRun).filter((f) => f.brief.coords.hook === brief.coords.hook);
  if (hooks.length) v.push({rule: 'hook', error: `hook mechanism "${brief.coords.hook}" was used by ${hooks.map((f) => f.id).join(', ')}`});
  for (const f of made.slice(-LIMITS.textWindow))
    for (const field of ['metaphor', 'world'] as const) {
      const s = topicSimilarity(brief[field], f.brief[field]);
      if (s >= LIMITS.textSim) v.push({rule: field, error: `${field} is ${Math.round(s * 100)}% like ${f.id}'s ("${f.brief[field]}")`});
    }
  for (const f of made.slice(-LIMITS.musicWindow)) {
    const s = topicSimilarity(brief.music.caption, f.brief.music.caption);
    if (s >= LIMITS.musicSim && Math.abs(brief.music.bpm - f.brief.music.bpm) < 10) v.push({rule: 'music', error: `music is ${Math.round(s * 100)}% like ${f.id}'s at a similar tempo; change instrumentation or tempo`});
  }
  return v;
};

// A review is valid only for the film it reviewed: the film's code and its board, byte for byte.
export const filmSha = (doc: Storyboard, root = ROOT) => {
  const src = path.join(root, 'engine/src/films', `${doc.film}.tsx`);
  return createHash('sha256').update(fs.existsSync(src) ? fs.readFileSync(src) : '').update(JSON.stringify({...doc, brief: doc.brief})).digest('hex').slice(0, 16);
};
export const reviewErrors = (r: Review | undefined, sha: string): string[] => {
  if (!r) return ['no creative review recorded (node studio/creative.ts review <board> <review.json>)'];
  const e: string[] = [];
  if (r.film_sha !== sha) e.push('the film or its board changed after the review: review it again');
  const low = SCORES.filter((s) => !(r.scores?.[s] >= LIMITS.minScore));
  if (low.length) e.push(`scores under ${LIMITS.minScore}: ${low.join(', ')}`);
  const mean = SCORES.reduce((a, s) => a + (r.scores?.[s] ?? 0), 0) / SCORES.length;
  if (mean < LIMITS.minMean) e.push(`mean score ${mean.toFixed(1)} < ${LIMITS.minMean}`);
  const slop = ANTI_SLOP.filter((s) => r.anti_slop?.[s] !== true);
  if (slop.length) e.push(`anti-slop fails: ${slop.join(', ')}`);
  if (r.verdict !== 'pass') e.push('the reviewer did not pass it');
  return e;
};

// Temporal QA thresholds (calibrated 2026-10-08 on the live renders, which open on a blank frame, and four authored POCs).
export const MOTION = {firstFrameContrast: 12, changeBy03: 1.0, hookActivity: 40, longestStill: 2.5, lufs: [-15.5, -12.5], truePeak: -1.0};
export type MotionFacts = {first_frame_contrast: number; change_by_0_3s: number; hook_activity: number; longest_still: number; longest_still_at: number; lufs: number; true_peak: number};
// hookFloor: a format's own floor for the first 3 s (studio/looks.json band; a calm format opens quieter than the default)
export const motionErrors = (m: MotionFacts | null, hookFloor = MOTION.hookActivity): string[] => {
  if (!m) return ['no motion.json: render the film again'];
  return [
    ...(m.first_frame_contrast >= MOTION.firstFrameContrast ? [] : [`frame 0 is nearly flat (contrast ${m.first_frame_contrast}): the first frame must already show something`]),
    ...(m.change_by_0_3s >= MOTION.changeBy03 ? [] : [`nothing visibly changes by 0.3 s (${m.change_by_0_3s})`]),
    ...(m.hook_activity >= hookFloor ? [] : [`the first 3 s barely move (activity ${m.hook_activity}, needs ${hookFloor})`]),
    ...(m.longest_still <= MOTION.longestStill ? [] : [`${m.longest_still} s with no visible change from ${m.longest_still_at} s (max ${MOTION.longestStill})`]),
    ...(m.lufs >= MOTION.lufs[0] && m.lufs <= MOTION.lufs[1] ? [] : [`loudness ${m.lufs} LUFS, needs ${MOTION.lufs[0]} to ${MOTION.lufs[1]}`]),
    ...(m.true_peak <= MOTION.truePeak ? [] : [`true peak ${m.true_peak} dBTP > ${MOTION.truePeak}`]),
  ];
};

// QA's creative check for a film board: its brief is the one recorded, it was unique when briefed, and it passed review.
export const creativeErrors = (doc: Storyboard, films = readFilms(), root = ROOT): string[] => {
  if (doc.direction) {
    const i = films.findIndex((f) => f.id === doc.id);
    if (i < 0 || JSON.stringify(films[i].style) !== JSON.stringify(doc.direction.style)) return ['the style is not the one recorded (node studio/creative.ts style <board>)'];
    const earlier = films.slice(0, i).filter((f) => f.channel === films[i].channel && f.style && f.status !== 'rejected').map((f) => f.style!);
    return [...styleErrors(doc.direction.style, earlier), ...reviewErrors(films[i].review, filmSha(doc, root))];
  }
  if (!doc.brief) return ['a film board needs its brief'];
  const i = films.findIndex((f) => f.id === doc.id);
  if (i < 0) return ['the brief is not in the creative ledger (node studio/creative.ts brief <board>)'];
  const e = films[i];
  if (JSON.stringify(e.brief) !== JSON.stringify(doc.brief)) return ['the board\'s brief differs from the recorded one: record it again'];
  return [...checkCreative(doc.brief, doc.theme ?? 'paper', films.slice(0, i)).map((x) => `${x.rule}: ${x.error}`), ...reviewErrors(e.review, filmSha(doc, root))];
};

const line = (f: FilmEntry) => {
  if (!f.brief) return `${f.id} [${f.status}] ${Object.values(f.style ?? {}).join(' / ')}`;
  const c = f.brief.coords;
  return `${f.id} [${f.status}${f.review ? ` ${(SCORES.reduce((a, s) => a + f.review!.scores[s], 0) / SCORES.length).toFixed(1)}` : ''}] theme ${f.theme}\n  world: ${f.brief.world}\n  metaphor: ${f.brief.metaphor}\n  hook: ${f.brief.hook}\n  coords: ${keys.map((k) => c[k]).join(' / ')}\n  music: ${f.brief.music.caption} (${f.brief.music.bpm} bpm)`;
};

if (import.meta.main) {
  const [cmd, a, b] = process.argv.slice(2);
  const films = readFilms();
  const load = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8')) as Storyboard & {channel: string};
  if (cmd === 'history') {
    console.log(`coords: ${keys.join(' / ')}\n`);
    console.log(films.slice(-Number(a ?? 8)).map(line).join('\n\n') || '(no films yet)');
  } else if ((cmd === 'check' || cmd === 'brief') && a) {
    const doc = load(a);
    if (!doc.brief || !doc.film) (console.error('the board needs "film" and "brief"'), process.exit(2));
    const before = films.filter((f) => f.id !== doc.id);
    const v = checkCreative(doc.brief, doc.theme ?? 'paper', before);
    v.forEach((x) => console.log(`FAIL ${x.rule}: ${x.error}`));
    if (v.length) process.exit(1);
    console.log(`unique: ${doc.id} differs from the last ${Math.min(before.length, LIMITS.textWindow)} films`);
    if (cmd === 'brief') appendJsonl(filmsFile(), [{id: doc.id, channel: doc.channel, film: doc.film, theme: doc.theme ?? 'paper', brief: doc.brief, status: 'briefed', at: new Date().toISOString()} satisfies FilmEntry]);
  } else if (cmd === 'status' && a) {
    // free: which boards would pass QA's creative gate now, and exactly why not (no model call; a stale or missing review needs the Critic)
    const bad = process.argv.slice(3).filter((f) => {
      const errs = creativeErrors(load(f));
      console.log(`${errs.length ? 'FAIL' : 'ok  '} ${path.basename(f)}${errs.length ? `: ${errs.join('; ')}` : ''}`);
      return errs.length;
    });
    process.exit(bad.length ? 1 : 0);
  } else if (cmd === 'review' && a && b) {
    const doc = load(a);
    const e = films.find((f) => f.id === doc.id);
    if (!e) (console.error('record the brief first'), process.exit(2));
    const r = {...(JSON.parse(fs.readFileSync(b, 'utf8')) as Review), film_sha: filmSha(doc)};
    const errs = reviewErrors(r, r.film_sha!);
    appendJsonl(filmsFile(), [{...e, ...(doc.brief ? {brief: doc.brief} : {}), review: r, status: errs.length ? 'briefed' : 'reviewed', at: new Date().toISOString()}]);
    errs.forEach((x) => console.log(`FAIL ${x}`));
    console.log(errs.length ? 'review recorded: NOT passing, keep working' : 'review recorded: passing');
    process.exit(errs.length ? 1 : 0);
  } else if (cmd === 'style' && a) {
    // the story's own axes come from the script; format, look and suit are chosen against the channel's recent films
    const doc = load(a) as Storyboard & {channel: string; meta?: {structure?: string; cta?: string; series?: {name: string}; fit?: string; idea?: string; hook_image?: string; payoff_image?: string}};
    // script first: no direction starts until the words work on their own (the idea, the hook, the payoff picture)
    const words = (s?: string) => (s ?? '').trim().split(/\s+/).filter(Boolean).length;
    const first = [...scriptErrors(doc as never), ...(words(doc.meta?.idea) >= 6 ? [] : ['idea: meta.idea is the film in one plain sentence (6 words or more); write it before any direction']), ...(words(doc.meta?.hook_image) >= 4 ? [] : ['hook_image: name the first frame']), ...(words(doc.meta?.payoff_image) >= 4 ? [] : ['payoff_image: name the closing picture'])];
    if (first.length) (first.forEach((x) => console.log(`FAIL ${x}`)), console.log('script first: fix the board, then run style again'), process.exit(1));
    const before = films.filter((f) => f.id !== doc.id && f.channel === doc.channel && f.style && f.status !== 'rejected').map((f) => f.style!);
    const story = {hook: hookType(doc.scenes.find((s) => s.vo)?.vo ?? ''), structure: doc.meta?.structure, cta: doc.meta?.cta, ...(doc.meta?.series ? {series: doc.meta.series.name} : {})};
    const fit = doc.meta?.fit ?? (doc.channel.startsWith('c2') ? 'history' : 'automation');
    const seed = [...doc.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483646, 7) + 1;
    const cat = readyCatalogue();
    const style = chooseStyle(before, fit, seed, cat, story);
    const out = {...doc, film: style.format, theme: style.suit, direction: {...(doc as {direction?: object}).direction, style, shots: (doc as {direction?: {shots?: unknown[]}}).direction?.shots ?? []}};
    fs.writeFileSync(a, JSON.stringify(out, null, 2) + '\n');
    appendJsonl(filmsFile(), [{id: doc.id, channel: doc.channel, film: style.format, theme: style.suit, style, status: 'briefed', at: new Date().toISOString()} satisfies FilmEntry]);
    const look = cat.looks[style.look];
    console.log(JSON.stringify({style, format: cat.formats[style.format], look}, null, 1));
  } else {
    console.error('usage: node studio/creative.ts history [n] | check <board> | brief <board> | review <board> <review.json> | style <board> | status <board>...');
    process.exit(2);
  }
}
