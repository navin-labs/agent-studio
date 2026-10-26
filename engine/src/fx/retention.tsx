// Retention kit: what keeps a viewer past second three. A film that holds one plate for six seconds under small fading type is
// flat however good the plate is, so every plate-based format shares two things:
//   ReframePlate: the plate is re-framed (wide, tight on a corner, medium, tight elsewhere) every ~1.5 s, each cut landing on a
//     spoken word with a punch-in, a short settle and a flash. One generated picture reads as four shots.
//   PunchLine: the voice line as big bold type, two or three words at a time, the current word popping, *marked* words in the
//     accent colour, on a face chosen per video so no two videos set type alike.
// Pure functions of t (seconds), like every film.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {parseAccent} from '../lib/text';
import {IN, k, OUT} from '../films/kit';
import {alpha, useTheme} from '../themes';

export const hash = (s: string) => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

const lastIndex = <T,>(xs: T[], f: (x: T) => boolean) => {
  for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i;
  return -1;
};

// ---------- cuts ----------
export type Cut = {t: number; scale: number; origin: string; rot: number};
const SCALES = [1.04, 1.5, 1.2, 1.55, 1.1, 1.45];
const ANCHORS = ['30% 32%', '70% 38%', '50% 66%', '34% 60%', '66% 28%', '50% 45%'];
export const CUT_EVERY = 1.5;

// Cut times for one plate window [a, b]: roughly every CUT_EVERY seconds, snapped to the nearest spoken word start within 0.4 s
// (a cut on a word feels intended), never within 0.9 s of the end.
export const planCuts = (a: number, b: number, wordStarts: number[], seed: number): Cut[] => {
  const cuts: Cut[] = [{t: a, scale: SCALES[seed % SCALES.length] > 1.3 ? 1.04 : SCALES[seed % SCALES.length], origin: '50% 50%', rot: 0}];
  let at = a + CUT_EVERY;
  let n = 1;
  while (at < b - 0.9) {
    const near = wordStarts.filter((w) => Math.abs(w - at) < 0.4 && w > cuts.at(-1)!.t + 1).sort((x, y) => Math.abs(x - at) - Math.abs(y - at))[0];
    const t = near ?? at;
    cuts.push({t, scale: SCALES[(seed + n) % SCALES.length], origin: ANCHORS[(seed + n * 2) % ANCHORS.length], rot: ((seed + n) % 2 ? 1 : -1) * 1.6});
    at = t + CUT_EVERY;
    n++;
  }
  return cuts;
};

export const ReframePlate: React.FC<{t: number; a: number; b: number; src: string; cuts: Cut[]; seed: number; children?: React.ReactNode}> = ({t, a, b, src, cuts, seed, children}) => {
  const th = useTheme();
  if (t < a - 0.3 || t > b + 0.3) return null;
  const o = Math.min(k(t, [a - 0.3, a + 0.2], [0, 1], OUT), k(t, [b - 0.2, b + 0.3], [1, 0], IN));
  const j = Math.max(0, lastIndex(cuts, (c) => c.t <= t));
  const c = cuts[j];
  const end = cuts[j + 1]?.t ?? b;
  const u = k(t, [c.t, end], [0, 1], (x) => x); // linear push through the shot
  const since = t - c.t;
  const punch = j ? k(since, [0, 0.16], [0.1, 0], OUT) : 0; // the cut lands with a punch-in that settles
  const rot = j ? k(since, [0, 0.22], [c.rot, 0], OUT) : 0;
  const flash = j ? k(since, [0, 0.12], [0.22, 0], OUT) : 0;
  const drift = Math.sin(t * 0.9 + seed) * 10;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, scale: String(c.scale * (1 + 0.1 * u) + punch), rotate: `${rot}deg`, transformOrigin: c.origin, translate: `${drift}px ${drift * 0.5}px`}}>
        <Img src={staticFile(src)} style={{width: 1080, height: 1920, objectFit: 'cover'}} />
        {children}
      </div>
      {flash > 0 ? <div style={{position: 'absolute', inset: 0, background: alpha(th.ink, flash)}} /> : null}
    </div>
  );
};

// ---------- type ----------
// Bold faces already loaded in src/fonts.ts; `caps` faces are condensed display faces set in capitals.
const FACES: {family: string; weight: number; caps: boolean; width: number}[] = [
  {family: 'Bricolage Grotesque', weight: 800, caps: false, width: 0.54},
  {family: 'Archivo Black', weight: 400, caps: true, width: 0.66},
  {family: 'Anton', weight: 400, caps: true, width: 0.46},
  {family: 'Bebas Neue', weight: 400, caps: true, width: 0.42},
  {family: 'Oswald', weight: 700, caps: true, width: 0.5},
  {family: 'Space Grotesk', weight: 700, caps: false, width: 0.56},
];
export const faceFor = (id: string) => FACES[hash(id) % FACES.length];

// Captions that are not read: only the words that carry the line show, one or two at a time, big, each landing as it is spoken.
// Marked words, numbers and long content words stay; filler (the, a, of, so, and ...) is spoken but never shown.
const FILLER = new Set('a an the of to in on at by for from with and or but so yet as is are was were be been it its this that these those he she they we you i his her their our your my me him them who which what when then than there here do did does has have had will would can could not no just also very into about over after before while if'.split(' '));
export const keyWords = (words: {w: string; accent: boolean}[]): number[] => {
  const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9%$.,']/g, '').replace(/[.,]+$/, '');
  const keep = words.map((x, i) => (x.accent || /\d/.test(x.w) || (!FILLER.has(bare(x.w)) && bare(x.w).length >= 5) ? i : -1)).filter((i) => i >= 0);
  return keep.length ? keep : words.map((_, i) => i).filter((i) => !FILLER.has(bare(words[i].w))).slice(0, 3);
};

// One voice line, from `at` to `end`; `starts` are the measured word starts (film seconds) when they match the words.
export const PunchLine: React.FC<{t: number; at: number; end: number; vo: string; starts?: number[]; dur: number; face: ReturnType<typeof faceFor>; y?: number}> = ({t, at, end, vo, starts, dur, face, y = 1150}) => {
  const th = useTheme();
  const words = parseAccent(vo);
  if (!words.length || t < at - 0.05 || t > end) return null;
  const st = starts?.length === words.length ? starts : words.map((_, i) => at + (dur * i) / words.length);
  const keys = keyWords(words);
  // a short word right before a key word joins it ("US PATENT"); otherwise one key word alone
  const groups: number[][] = [];
  for (const i of keys) {
    const prev = groups.at(-1);
    if (prev && prev.length === 1 && i - prev[0] === 1 && words[prev[0]].w.length <= 6 && words[i].w.length <= 8 && !/[.,!?;:]$/.test(words[prev[0]].w)) prev.push(i);
    else groups.push([i]);
  }
  const gi = lastIndex(groups, (g) => st[g[0]] <= t);
  if (gi < 0) return null;
  const g = groups[gi];
  const next = groups[gi + 1];
  const gone = Math.min(st[g[0]] + 1.1, next ? st[next[0]] : end); // a word clears before the next lands, or after 1.1 s
  if (t > gone) return null;
  const chars = g.reduce((a, i) => a + words[i].w.length + 1, 0);
  const size = Math.max(70, Math.min(140, Math.round(700 / (chars * face.width))));
  const born = t - st[g[0]];
  const pop = 1 + 0.12 * Math.max(0, 1 - born / 0.2); // lands big, settles (kept small: the pop must stay inside the safe area)
  return (
    <div data-tb="caption" style={{position: 'absolute', left: 120, right: 124, top: y, minHeight: size * 1.2, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', columnGap: size * 0.26, fontFamily: `'${face.family}', sans-serif`, fontWeight: face.weight, fontSize: size, lineHeight: 1.02, textTransform: face.caps ? 'uppercase' : 'none', letterSpacing: face.caps ? '0.01em' : '-0.02em', opacity: k(t, [gone - 0.12, gone], [1, 0]), transform: `scale(${pop})`}}>
      {g.map((i) => (
        <span key={i} style={{display: 'inline-block', color: words[i].accent ? th.accent : th.ink, WebkitTextStroke: `${Math.round(size * 0.07)}px ${th.bg}`, paintOrder: 'stroke fill', textShadow: `0 8px 30px ${alpha(th.shadow, 0.7)}`}}>
          {words[i].w.replace(/[.,!?;:]+$/, '')}
        </span>
      ))}
    </div>
  );
};
