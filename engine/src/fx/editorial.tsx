// Format A, Editorial Object (docs/CREATIVE_BIBLE.md sections 9 and 11; reference Video-93990): a magazine page that moves.
// Off-white paper, black and greys, one deep red. Real cut-outs (black and white) land on huge condensed type and act on it;
// a magnifier's lens reveals words that exist only inside it; red pen and laser marks; editorial marks (a definition, crop
// marks, dimension lines) make it feel designed. Transitions are focus pulls. Everything is a pure function of t.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {Grain, IN, k, OUT, rng, settle} from '../films/kit';
import {useTheme} from '../themes';

const SANS = 'Inter, sans-serif';
const DISPLAY = 'Anton, sans-serif';
const SERIF = '"Instrument Serif", serif';

// The page: paper, a soft vignette, grain; a focus pull blurs the whole page in and out at the given cuts.
export const Page: React.FC<{t: number; pulls?: number[]; children: React.ReactNode}> = ({t, pulls = [], children}) => {
  const th = useTheme();
  const blur = Math.max(0, ...pulls.map((c) => (t < c ? k(t, [c - 0.18, c], [0, 14], IN) : k(t, [c, c + 0.32], [14, 0], OUT))));
  const last = Math.max(0, ...pulls.filter((c) => c <= t));
  const push = 1 + Math.min(0.14, (t - last) * 0.05);
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(90% 70% at 50% 45%, ${th.surface} 0%, ${th.bg} 70%, color-mix(in srgb, ${th.bg} 88%, ${th.ink}) 100%)`}}>
      <div style={{position: 'absolute', inset: 0, scale: String(push), filter: blur > 0.2 ? `blur(${blur}px)` : undefined}}>{children}</div>
      <Grain opacity={0.08} blend="multiply" />
    </div>
  );
};

// Big condensed display type that rises out of a blur, letter by letter; grey by default, deep red when it is the key word.
// The colour-split edge (a hairline of red and teal) is the reference's slight chromatic aberration.
export const Display: React.FC<{t: number; at: number; out?: number; text: string; x?: number; y: number; size?: number; red?: boolean; align?: 'left' | 'center'}> = ({t, at, out = 1e9, text, x = 540, y, size = 240, red, align = 'center'}) => {
  const th = useTheme();
  const o = k(t, [out, out + 0.2], [1, 0]);
  if (t < at - 0.05 || o <= 0) return null;
  const color = red ? th.accent : th.muted;
  const split = `-2px 0 color-mix(in srgb, ${th.alert} 55%, transparent), 2px 0 color-mix(in srgb, ${th.flow} 45%, transparent)`;
  return (
    <div style={{position: 'absolute', left: align === 'center' ? 0 : x, right: align === 'center' ? 0 : undefined, top: y, textAlign: align, fontFamily: DISPLAY, fontSize: size, lineHeight: 0.9, color, textShadow: split, opacity: o, whiteSpace: 'nowrap'}}>
      {[...text].map((c, i) => {
        const p = k(t, [at + i * 0.035, at + i * 0.035 + 0.3], [0, 1], OUT);
        return <span key={i} style={{display: 'inline-block', opacity: p, filter: p < 0.98 ? `blur(${(1 - p) * 12}px)` : undefined, transform: `translateY(${(1 - p) * 30}px)`}}>{c === ' ' ? '\u00A0' : c}</span>;
      })}
    </div>
  );
};

// Small editorial voices: a grotesk line and a serif italic line that fade up word by word.
export const Line: React.FC<{t: number; at: number; out?: number; text: string; y: number; size?: number; italic?: boolean; x?: number; align?: 'left' | 'center'}> = ({t, at, out = 1e9, text, y, size = 64, italic, x = 90, align = 'center'}) => {
  const th = useTheme();
  const o = k(t, [out, out + 0.2], [1, 0]);
  if (t < at - 0.05 || o <= 0) return null;
  return (
    <div style={{position: 'absolute', left: align === 'center' ? 0 : x, right: align === 'center' ? 0 : undefined, top: y, textAlign: align, fontFamily: italic ? SERIF : SANS, fontStyle: italic ? 'italic' : 'normal', fontWeight: italic ? 400 : 500, fontSize: size, letterSpacing: italic ? 0 : '-0.02em', color: th.ink, opacity: o}}>
      {text.split(' ').map((w, i) => {
        const p = k(t, [at + i * 0.07, at + i * 0.07 + 0.3], [0, 1], OUT);
        return <span key={i} style={{display: 'inline-block', marginRight: '0.28em', opacity: p, transform: `translateY(${(1 - p) * 12}px)`}}>{w}</span>;
      })}
    </div>
  );
};

// A real cut-out in black and white that flies in with motion blur and settles with a spring, casting a soft shadow.
export const Obj: React.FC<{t: number; at: number; out?: number; src: string; x: number; y: number; w: number; h: number; from?: [number, number]; rot?: number}> = ({t, at, out = 1e9, src, x, y, w, h, from = [0, -700], rot = 0}) => {
  const th = useTheme();
  if (t < at || t > out + 0.3) return null;
  const p = k(t, [at, at + 0.45], [0, 1], OUT);
  const wob = settle(t, at + 0.45, 2.4, 1.2) * 4;
  const speed = 1 - p;
  const leave = k(t, [out, out + 0.3], [0, 1], IN);
  return (
    <div style={{position: 'absolute', left: x + from[0] * (1 - p), top: y + from[1] * (1 - p) - leave * 120, width: w, height: h, rotate: `${rot + wob + (1 - p) * 12}deg`, opacity: 1 - leave, filter: speed > 0.05 ? `blur(${speed * 10}px)` : undefined}}>
      <Img src={staticFile(src)} style={{width: w, height: h, objectFit: 'contain', filter: `grayscale(1) contrast(1.18) drop-shadow(0 28px 26px color-mix(in srgb, ${th.shadow} 30%, transparent))`}} />
    </div>
  );
};

// A magnifier whose lens shows words that are not on the page: the hidden layer is drawn magnified and clipped to the lens.
export const LensReveal: React.FC<{t: number; at: number; out?: number; src: string; cx: number; cy: number; r: number; w: number; h: number; lens: [number, number]; hidden: React.ReactNode}> = ({t, at, out = 1e9, src, cx, cy, r, w, h, lens, hidden}) => {
  if (t < at || t > out + 0.3) return null;
  const slide = k(t, [at, at + 0.7], [820, 0], OUT);
  const leave = k(t, [out, out + 0.3], [0, 1], IN);
  const px = cx + slide, py = cy - leave * 900;
  // the magnifier photo first, then the hidden words on its glass (the glass in the photo is opaque, so they go on top)
  return (
    <>
      <Obj t={t} at={at} src={src} x={px - lens[0] * w} y={py - lens[1] * h} w={w} h={h} from={[0, 0]} />
      <div style={{position: 'absolute', left: px - r, top: py - r, width: r * 2, height: r * 2, borderRadius: '50%', overflow: 'hidden', opacity: k(t, [at + 0.5, at + 0.8], [0, 1])}}>
        <div style={{position: 'absolute', left: -(px - r), top: -(py - r), width: 1080, height: 1920, scale: '1.35', transformOrigin: `${px}px ${py}px`}}>{hidden}</div>
      </div>
    </>
  );
};

// The red laser line struck through a word, with a soft glow.
export const Strike: React.FC<{t: number; at: number; y: number; x0?: number; x1?: number}> = ({t, at, y, x0 = 60, x1 = 1020}) => {
  const th = useTheme();
  const p = k(t, [at, at + 0.22], [0, 1], OUT);
  if (p <= 0) return null;
  return <div style={{position: 'absolute', left: x0, top: y, width: (x1 - x0) * p, height: 5, background: th.alert, boxShadow: `0 0 18px 4px color-mix(in srgb, ${th.alert} 55%, transparent)`}} />;
};

// Editorial marks: a tiny justified definition at the top, crop marks in the corners, a dimension line with labels and a
// row of braille-like dots. They draw on once and stay; they are what make the page look designed.
export const Marks: React.FC<{t: number; at?: number; note: string}> = ({t, at = 0, note}) => {
  const th = useTheme();
  const o = k(t, [at, at + 0.5], [0, 0.85]);
  const r = rng(3);
  const crop = (x: number, y: number, sx: number, sy: number) => <path d={`M ${x} ${y + sy * 40} L ${x} ${y} L ${x + sx * 40} ${y}`} stroke={th.ink} strokeWidth={2} fill="none" />;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o}}>
      <div style={{position: 'absolute', left: 250, right: 250, top: 120, fontFamily: SANS, fontSize: 17, lineHeight: 1.3, textAlign: 'justify', color: th.ink}}>{note}</div>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {crop(70, 260, 1, 1)}
        {crop(1010, 260, -1, 1)}
        {crop(70, 1640, 1, -1)}
        {crop(1010, 1640, -1, -1)}
        <line x1={170} x2={910} y1={1700} y2={1700} stroke={th.ink} strokeWidth={1.5} />
        <line x1={170} x2={170} y1={1688} y2={1712} stroke={th.ink} strokeWidth={1.5} />
        <line x1={910} x2={910} y1={1688} y2={1712} stroke={th.ink} strokeWidth={1.5} />
        <text x={540} y={1690} textAnchor="middle" fontFamily={SANS} fontSize={18} fill={th.ink} letterSpacing={3}>X2 · 1941 · X4</text>
        {Array.from({length: 22}, (_, i) => (r() > 0.4 ? <circle key={i} cx={360 + i * 16} cy={1760 + (i % 3) * 7} r={3} fill={th.ink} /> : null))}
      </svg>
    </div>
  );
};


// Foreground flyers: real cut-outs passing close to the lens, big and out of focus (the reference's hashtags and glass
// shards). Depth and constant life without touching the composition behind them.
export type Flyer = {at: number; dur: number; from: [number, number]; to: [number, number]; size: number; spin?: number};
export const Flyers: React.FC<{t: number; src: string; items: Flyer[]}> = ({t, src, items}) => (
  <>
    {items.map((f, i) => {
      const p = (t - f.at) / f.dur;
      if (p < 0 || p > 1) return null;
      const e = k(p, [0, 1], [0, 1], OUT);
      return (
        <Img key={i} src={staticFile(src)} style={{position: 'absolute', left: f.from[0] + (f.to[0] - f.from[0]) * e - f.size / 2, top: f.from[1] + (f.to[1] - f.from[1]) * e - f.size / 2, width: f.size, height: f.size, objectFit: 'contain', rotate: `${(f.spin ?? 90) * p}deg`, filter: 'grayscale(1) contrast(1.2) blur(14px)', opacity: 0.85}} />
      );
    })}
  </>
);
