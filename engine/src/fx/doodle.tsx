// Format F, Doodle on Footage (docs/CREATIVE_BIBLE.md section 14; reference Video-90405): real moving footage in an old-film
// frame, one hand-drawn doodle character that talks and changes expression on the beat, handwritten words. The doodle is the
// look, so code draws it; every line boils (redrawn with fresh jitter 8 times a second) like a hand-drawn loop.
import React from 'react';
import {OffthreadVideo, Sequence, staticFile, useVideoConfig} from 'remotion';
import {BACK, k, rng} from '../films/kit';
import {useTheme} from '../themes';

const BOIL = 8; // redraws per second
const jit = (t: number, i: number, amp: number) => (rng(Math.floor(t * BOIL) * 977 + i * 31 + 1)() - 0.5) * 2 * amp;

// a closed wobbly ring (head, envelope corners) as an SVG path that boils
const ring = (t: number, cx: number, cy: number, rx: number, ry: number, seed: number, amp = 4) =>
  Array.from({length: 29}, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return `${i ? 'L' : 'M'}${cx + Math.cos(a) * rx + jit(t, seed + (i % 28), amp)},${cy + Math.sin(a) * ry + jit(t, seed + 50 + (i % 28), amp)}`;
  }).join(' ');
// the doodle is drawn in the suit's darker of ink/bg on paper of the lighter, so it reads as pen on paper in any suit
const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11;
const penPaper = (th: {ink: string; bg: string}) => (lum(th.ink) > lum(th.bg) ? {pen: th.bg, paper: th.ink} : {pen: th.ink, paper: th.bg});
const line = (t: number, pts: [number, number][], seed: number, amp = 3) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x + jit(t, seed + i, amp)},${y + jit(t, seed + 20 + i, amp)}`).join(' ');

// Footage plate graded like faded film (jump cuts: at film time `at`, play the footage from second `from`), inside a rounded old-film frame with grain-free scratches and a soft vignette.
export const FilmPlate: React.FC<{t: number; src: string; rate?: number; cuts?: {at: number; from: number}[]}> = ({t, src, rate = 1, cuts = [{at: 0, from: 0}]}) => {
  const th = useTheme();
  const {fps, durationInFrames} = useVideoConfig();
  const r = rng(Math.floor(t * 12) + 3);
  return (
    <>
      <div style={{position: 'absolute', inset: 36, borderRadius: 70, overflow: 'hidden', boxShadow: `inset 0 0 160px ${th.shadow}`}}>
        {cuts.map((c, i) => {
          const from = Math.round(c.at * fps);
          return (
            <Sequence key={i} from={from} durationInFrames={Math.round((cuts[i + 1]?.at ?? durationInFrames / fps) * fps) - from}>
              <OffthreadVideo src={staticFile(src)} muted playbackRate={rate} startFrom={Math.round(c.from * fps)} style={{width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(0.35) saturate(0.8) contrast(1.06) brightness(0.96)'}} />
            </Sequence>
          );
        })}
        <div style={{position: 'absolute', inset: 0, borderRadius: 70, boxShadow: `inset 0 0 180px ${th.shadow}`}} />
        {Array.from({length: 3}, (_, i) => (r() > 0.55 ? <div key={i} style={{position: 'absolute', top: 0, bottom: 0, left: r() * 1000, width: 2, background: th.surface, opacity: 0.35}} /> : null))}
      </div>
    </>
  );
};

export type Face = 'tired' | 'shock' | 'calm' | 'happy';

// The character: a round head with hands; `talk` opens the mouth with the voice, `face` sets eyes, mouth and hands.
export const Doodle: React.FC<{t: number; x: number; y: number; face: Face; talk: boolean; pop?: number}> = ({t, x, y, face, talk, pop = 0}) => {
  const th = useTheme();
  const {pen, paper} = penPaper(th);
  const s = k(t, [0.1, 0.45], [0, 1], BACK) * (1.25 + 0.15 * Math.max(0, 1 - Math.abs(t - pop) * 5));
  const open = talk ? 6 + 20 * Math.abs(Math.sin(t * 13)) : 0;
  const st = {fill: 'none', stroke: pen, strokeWidth: 8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  const eyes = {
    tired: <><path d={line(t, [[-70, -20], [-25, -20]], 1)} {...st} /><path d={line(t, [[25, -20], [70, -20]], 2)} {...st} /></>,
    shock: <><path d={ring(t, -48, -25, 20, 26, 3, 2)} {...st} fill={paper} /><path d={ring(t, 48, -25, 20, 26, 4, 2)} {...st} fill={paper} /></>,
    calm: <><path d={line(t, [[-70, -18], [-48, -28], [-26, -18]], 5)} {...st} /><path d={line(t, [[26, -18], [48, -28], [70, -18]], 6)} {...st} /></>,
    happy: <><path d={line(t, [[-70, -14], [-48, -36], [-26, -14]], 5)} {...st} /><path d={line(t, [[26, -14], [48, -36], [70, -14]], 6)} {...st} /></>,
  }[face];
  const mouth = face === 'shock' ? ring(t, 0, 60, 22, 26 + open * 0.4, 7, 2) : face === 'tired' ? line(t, [[-40, 62 - open / 2], [-12, 56], [12, 66], [40, 60 + open / 2]], 8) : line(t, [[-50, 45], [-20, 70 + open], [20, 70 + open], [50, 45]], 9);
  // hands: up beside the face in shock, holding the chin when tired, folded low when calm or happy
  const hands: [number, number][] = face === 'shock' ? [[-215, -40], [215, -40]] : face === 'tired' ? [[-40, 205], [60, 205]] : [[-150, 230], [150, 230]];
  return (
    <svg width={600} height={640} viewBox="-300 -300 600 640" style={{position: 'absolute', left: x - 300, top: y - 300, overflow: 'visible', scale: String(s), translate: `${Math.sin(t * 9) * 4}px ${Math.abs(Math.sin(t * 4.5)) * -14}px`, rotate: `${Math.sin(t * 2.2) * 4}deg`}}>
      <path d={ring(t, 0, 0, 175, 165, 10)} {...st} fill={paper} />
      {eyes}
      <path d={mouth} {...st} />
      {hands.map(([hx, hy], i) => (
        <g key={i}>
          <path d={line(t, [[i ? 120 : -120, 130], [hx * 0.8, hy + 20], [hx, hy]], 30 + i * 5)} {...st} />
          <path d={ring(t, hx, hy, 34, 30, 40 + i * 9, 3)} {...st} fill={paper} />
        </g>
      ))}
    </svg>
  );
};

// A doodled envelope (an email) that pops in at `at`; `tick` draws a check over it, `fly` sends it up and away.
export const Envelope: React.FC<{t: number; x: number; y: number; at: number; tick?: number; fly?: number; seed?: number}> = ({t, x, y, at, tick, fly, seed = 0}) => {
  const th = useTheme();
  const {pen, paper} = penPaper(th);
  if (t < at) return null;
  const p = k(t, [at, at + 0.3], [0, 1], BACK);
  const f = fly !== undefined ? k(t, [fly, fly + 0.8], [0, 1]) : 0;
  const st = {fill: 'none', stroke: pen, strokeWidth: 6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  return (
    <svg width={160} height={120} viewBox="-80 -60 160 120" style={{position: 'absolute', left: x - 80, top: y - 60 - f * 900, overflow: 'visible', scale: String(p), rotate: `${f * 40}deg`, opacity: 1 - f}}>
      <path d={line(t, [[-60, -40], [60, -40], [60, 40], [-60, 40], [-60, -40]], seed)} {...st} fill={paper} />
      <path d={line(t, [[-60, -40], [0, 8], [60, -40]], seed + 9)} {...st} />
      {tick !== undefined && t >= tick && <path d={line(t, [[-30, 10], [-6, 36], [44, -26]], seed + 14, 2)} {...st} stroke={th.ok} strokeWidth={11} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k(t, [tick, tick + 0.2], [0, 1])} />}
    </svg>
  );
};

// Handwritten words: each word lands as it is spoken, slightly tilted, ink with a paper halo so it reads on any footage.
export const Hand: React.FC<{t: number; at: number; end: number; text: string; dur: number; y?: number; size?: number}> = ({t, at, end, text, dur, y = 1430, size = 74}) => {
  const th = useTheme();
  if (t < at - 0.1 || t > end) return null;
  const words = text.split(' ');
  return (
    <div style={{position: 'absolute', left: 90, right: 90, top: y, textAlign: 'center', fontFamily: '"Bradley Hand", "Chalkboard SE", cursive', fontWeight: 700, fontSize: size, lineHeight: 1.12, color: th.ink, textShadow: `0 0 10px ${th.surface}, 0 0 4px ${th.surface}, 0 0 2px ${th.surface}`, opacity: k(t, [end - 0.2, end], [1, 0])}}>
      {words.map((w, i) => {
        const wt = at + (i / words.length) * dur;
        return <span key={i} style={{display: 'inline-block', marginRight: '0.24em', opacity: t >= wt ? 1 : 0, rotate: `${jit(wt, i, 4)}deg`, scale: String(k(t, [wt, wt + 0.15], [1.25, 1], BACK))}}>{w}</span>;
      })}
    </div>
  );
};

// A big handwritten figure circled by a scribble that draws itself.
export const Scribble: React.FC<{t: number; at: number; until: number; text: string; x: number; y: number}> = ({t, at, until, text, x, y}) => {
  const th = useTheme();
  if (t < at || t > until) return null;
  return (
    <div style={{position: 'absolute', left: x - 260, top: y - 150, width: 520, height: 300, scale: String(k(t, [at, at + 0.3], [0.6, 1], BACK))}}>
      <svg width={520} height={300} viewBox="-260 -150 520 300" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <path d={ring(t, 0, 0, 240, 125, 60, 6)} fill="none" stroke={th.alert} strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - k(t, [at + 0.2, at + 0.7], [0, 1])} />
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: '"Bradley Hand", cursive', fontWeight: 700, fontSize: 170, color: th.ink, textShadow: `0 0 12px ${th.surface}, 0 0 4px ${th.surface}`, rotate: '-4deg'}}>{text}</div>
    </div>
  );
};
