// Kinetic Type, the hero effect of the kinetic block: the text is the whole video. Huge all-caps words slam in on the exact
// moment they are spoken (Kokoro's word times, scripts/tts_local.py), in short screens cut on the rhythm of the words; one key
// word per screen in the accent with a glow. The After Effects tools the references use, done in code: Deepglow = stacked
// text-shadows in the accent; TextExploder = per-letter spans that split apart and close; Flow = the block's easing curves.
import React from 'react';
import {k} from '../films/kit';
import {useTheme} from '../themes';
import {useBlock} from './blocks';
import {Sfx} from './moves';

export type Word = {w: string; s: number; e: number}; // seconds on the film's timeline
export type Screen = {words: Word[]; key?: number}; // key: index of the accent word
type Variant = 'slide' | 'stretch' | 'split';
const VARIANTS: Variant[] = ['slide', 'stretch', 'split'];

// group a line's words into screens of at most `max` words, breaking after punctuation first
export const screensOf = (words: Word[], keys: string[], max = 3): Screen[] => {
  const out: Screen[] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    if (cur.length >= max || /[.,!?;:]$/.test(w.w) || i === words.length - 1) {
      const key = cur.findIndex((x) => keys.includes(x.w.toLowerCase().replace(/[^a-z0-9]/g, '')));
      out.push({words: cur, key: key >= 0 ? key : undefined});
      cur = [];
    }
  });
  return out;
};

// one word slamming in: from the side, stretched from squashed, or split into letters that close together
const Slam: React.FC<{t: number; word: Word; v: Variant; accent: boolean; size: number; side: number}> = ({t, word, v, accent, size, side}) => {
  const b = useBlock();
  const th = useTheme();
  const p = k(t, [word.s - 0.04, word.s - 0.04 + b.dur], [0, 1], b.ease);
  if (t < word.s - 0.04) return <div style={{height: size * 0.92}} />;
  const text = word.w.replace(/[.,!?;:]+$/, '').toUpperCase();
  const glow = accent ? `0 0 18px ${th.accent}, 0 0 46px color-mix(in srgb, ${th.accent} 55%, transparent)` : undefined;
  const base: React.CSSProperties = {fontSize: size, lineHeight: 0.92, color: accent ? th.accent : th.ink, textShadow: glow, whiteSpace: 'nowrap'};
  if (v === 'split')
    return (
      <div style={base}>
        {[...text].map((c, i, a) => (
          <span key={i} style={{display: 'inline-block', translate: `${(i - (a.length - 1) / 2) * 60 * (1 - p)}px 0`, opacity: Math.min(1, p * 2)}}>{c}</span>
        ))}
      </div>
    );
  const style = v === 'slide' ? {translate: `${side * 1100 * (1 - p)}px 0`} : {scale: `1 ${0.08 + 0.92 * p}`, transformOrigin: '50% 100%'};
  return <div style={{...base, ...style}}>{text}</div>;
};

// A whole kinetic film body: screens in order, each exits fast just before the next one hits.
export const KineticType: React.FC<{t: number; screens: Screen[]; end: number; snap?: boolean}> = ({t, screens, end, snap = true}) => {
  const i = screens.filter((s) => t >= s.words[0].s - 0.06).length - 1;
  if (i < 0) return null;
  const sc = screens[i];
  const next = screens[i + 1]?.words[0].s ?? end;
  const out = k(t, [next - 0.16, next - 0.06], [1, 0]);
  const longest = Math.max(...sc.words.map((w) => w.w.replace(/[^A-Za-z0-9]/g, '').length));
  const size = Math.min(340, 900 / (Math.max(3, longest) * 0.64)); // the longest word fills most of the width
  return (
    <div style={{position: 'absolute', left: 112, right: 124, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: size * 0.08, opacity: out, scale: String(1 + 0.06 * (1 - out))}}>
      {sc.words.map((w, j) => (
        // the very first word is already landing on frame 0 (a film never opens on an empty frame)
        <Slam key={j} t={t} word={i === 0 && j === 0 ? {...w, s: w.s - 0.2} : w} v={i === 0 && j === 0 ? 'stretch' : VARIANTS[(i + j) % 3]} accent={j === sc.key} size={size} side={(i + j) % 2 ? 1 : -1} />
      ))}
      {snap && sc.key !== undefined ? <Sfx at={sc.words[sc.key].s} name="snap" volume={0.08} /> : null}
    </div>
  );
};
