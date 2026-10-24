// Attention effects (docs/CREATIVE_BIBLE.md section 3): built type, pen marks, particle bursts, world flips, pop captions and
// camera shake. Each is a pure function of time t in seconds; colours come from the theme.
import React from 'react';
import {evolvePath} from '@remotion/paths';
import {BACK, IN, k, OUT, rng} from '../films/kit';
import {useTheme} from '../themes';

const TYPE = '"Inter Tight", Inter, sans-serif';

// glyph advance in px for a CSS font string (fonts are loaded before render, src/fonts.ts)
const widths = new Map<string, number>();
const measure = (c: string, font: string) => {
  const key = font + c;
  if (!widths.has(key)) {
    const g = document.createElement('canvas').getContext('2d')!;
    g.font = font;
    widths.set(key, g.measureText(c).width);
  }
  return widths.get(key)!;
};

// Letters fly together from scattered, spinning, blurred pieces and lock into the word. at = when the first letter starts.
export const Letters: React.FC<{t: number; text: string; at?: number; x?: number; y?: number; size?: number; color?: string; seed?: number; spread?: number; stagger?: number; fly?: number; out?: number}> = ({t, text, at = 0, x = 540, y = 960, size = 150, color, seed = 7, spread = 900, stagger = 0.035, fly = 0.34, out}) => {
  const th = useTheme();
  const r = rng(seed);
  const chars = [...text];
  const font = `900 ${size}px "Inter Tight"`;
  const adv = chars.map((c) => measure(c, font) - size * 0.02);
  const total = adv.reduce((a, b) => a + b, 0);
  const left = adv.map((_, i) => adv.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, pointerEvents: 'none'}}>
      {chars.map((c, i) => {
        const a = at + i * stagger;
        const dx = (r() - 0.5) * spread, dy = (r() - 0.5) * spread * 1.4, rot = (r() - 0.5) * 540, sc = 0.3 + r() * 2.2;
        const p = k(t, [a, a + fly], [0, 1], OUT);
        const leave = out != null ? k(t, [out + i * 0.012, out + i * 0.012 + 0.16], [0, 1], IN) : 0;
        const blur = (1 - p) * 18 + leave * 14;
        const tx = x - total / 2 + left[i] + dx * (1 - p) + leave * dx * 0.7;
        const ty = y + dy * (1 - p) - leave * 260;
        return (
          <span key={i} style={{position: 'absolute', left: tx, top: ty - size / 2, fontFamily: TYPE, fontWeight: 900, fontSize: size, lineHeight: 1, color: color ?? th.ink, transform: `rotate(${rot * (1 - p)}deg) scale(${sc + (1 - sc) * p})`, opacity: Math.min(1, p * 3) * (1 - leave), filter: blur > 0.3 ? `blur(${blur}px)` : undefined, whiteSpace: 'pre'}}>
            {c}
          </span>
        );
      })}
    </div>
  );
};

// A hand-drawn pen ellipse that snaps around a point, slightly overshooting its start like a real stroke.
export const PenCircle: React.FC<{t: number; at: number; out?: number; cx: number; cy: number; rx: number; ry: number; color?: string; width?: number}> = ({t, at, out = 1e9, cx, cy, rx, ry, color, width = 14}) => {
  const th = useTheme();
  const d = `M ${cx + rx * 0.2} ${cy - ry} C ${cx + rx * 1.15} ${cy - ry * 1.05}, ${cx + rx * 1.1} ${cy + ry * 1.1}, ${cx} ${cy + ry} C ${cx - rx * 1.15} ${cy + ry}, ${cx - rx * 1.12} ${cy - ry * 1.05}, ${cx + rx * 0.05} ${cy - ry * 1.02} C ${cx + rx * 0.4} ${cy - ry * 1.0}, ${cx + rx * 0.55} ${cy - ry * 0.9}, ${cx + rx * 0.62} ${cy - ry * 0.78}`;
  const p = k(t, [at, at + 0.24], [0, 1], OUT);
  if (p <= 0 || t > out + 0.2) return null;
  const ev = evolvePath(p, d);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: k(t, [out, out + 0.2], [1, 0])}}>
      <path d={d} fill="none" stroke={color ?? th.alert} strokeWidth={width} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
    </svg>
  );
};

// Confetti/shard burst from a point: chunky squares that fly out, spin, fall a little and shrink.
export const Burst: React.FC<{t: number; at: number; x: number; y: number; n?: number; power?: number; seed?: number; colors?: string[]}> = ({t, at, x, y, n = 28, power = 520, seed = 3, colors}) => {
  const th = useTheme();
  const cs = colors ?? [th.accent, th.alert, th.flow, th.ok, th.warn];
  const dt = t - at;
  if (dt < 0 || dt > 1.1) return null;
  const r = rng(seed);
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const a = r() * Math.PI * 2, v = power * (0.4 + r() * 0.8), s = 10 + r() * 22, spin = (r() - 0.5) * 1400;
        const e = 1 - Math.exp(-dt * 6);
        const px = x + Math.cos(a) * v * e, py = y + Math.sin(a) * v * e + 380 * dt * dt;
        const life = k(dt, [0.55, 1.1], [1, 0]);
        return <div key={i} style={{position: 'absolute', left: px - s / 2, top: py - s / 2, width: s, height: s, background: cs[i % cs.length], transform: `rotate(${spin * dt}deg) scale(${life})`, borderRadius: 2}} />;
      })}
    </>
  );
};

// World flip: a hard cut between the light and dark world reads stronger with one frame of full flash and a quick iris.
export const Flash: React.FC<{t: number; at: number; color?: string}> = ({t, at, color}) => {
  const th = useTheme();
  const o = k(t, [at, at + 0.1], [0.85, 0], IN);
  return o > 0.01 && t >= at ? <div style={{position: 'absolute', inset: 0, background: color ?? th.surface, opacity: o}} /> : null;
};

// Pop caption: one to three words that land with a scale overshoot in the centre band; the key word in the accent box.
export const Pop: React.FC<{t: number; at: number; until: number; text: string; mark?: boolean; y?: number}> = ({t, at, until, text, mark, y = 1340}) => {
  const th = useTheme();
  if (t < at || t > until) return null;
  const s = k(t, [at, at + 0.16], [1.6, 1], BACK);
  const o = k(t, [until - 0.08, until], [1, 0]);
  return (
    <div style={{position: 'absolute', left: 80, right: 80, top: y, display: 'flex', justifyContent: 'center', opacity: o}}>
      <span data-tb="caption" style={{fontFamily: TYPE, fontWeight: 900, fontSize: 92, letterSpacing: '-0.03em', lineHeight: 1, padding: mark ? '6px 18px' : 0, color: mark ? th.onAccent : th.ink, background: mark ? th.accent : undefined, transform: `scale(${s}) rotate(${mark ? -2 : 0}deg)`, display: 'inline-block'}}>
        {text}
      </span>
    </div>
  );
};

// Camera shake after an impact: a decaying jolt, applied to the world wrapper.
export const shake = (t: number, at: number, amp = 26) => {
  const d = t - at;
  if (d < 0 || d > 0.4) return 'none';
  const e = Math.exp(-d * 12) * amp;
  return `translate(${Math.sin(d * 90) * e}px, ${Math.cos(d * 70) * e}px) rotate(${Math.sin(d * 60) * e * 0.04}deg)`;
};

// ---------- calm counterparts (the refined look): the same jobs, quieter ----------
export const SERIF = '"Baskerville", "Hoefler Text", "Big Caslon", serif';

// Words rise a few pixels out of a soft blur, one after another. Editorial, never shouted.
export const Reveal: React.FC<{t: number; at: number; text: string; x?: number; y?: number; size?: number; color?: string; italic?: boolean; out?: number}> = ({t, at, text, x = 110, y = 300, size = 84, color, italic, out}) => {
  const th = useTheme();
  const words = text.split(' ');
  const o = out != null ? k(t, [out, out + 0.3], [1, 0]) : 1;
  return (
    <div style={{position: 'absolute', left: x, right: 110, top: y, fontFamily: SERIF, fontSize: size, lineHeight: 1.12, letterSpacing: '-0.01em', fontStyle: italic ? 'italic' : 'normal', color: color ?? th.ink, opacity: o}}>
      {words.map((w, i) => {
        const p = k(t, [at + i * 0.09, at + i * 0.09 + 0.55], [0, 1], OUT);
        return (
          <span key={i} style={{display: 'inline-block', marginRight: size * 0.26, opacity: p, transform: `translateY(${(1 - p) * 18}px)`, filter: p < 0.98 ? `blur(${(1 - p) * 6}px)` : undefined}}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

// A single hand-drawn line under a word, drawn once, slowly.
export const Underline: React.FC<{t: number; at: number; x: number; y: number; w: number; color?: string}> = ({t, at, x, y, w, color}) => {
  const th = useTheme();
  const d = `M ${x} ${y} C ${x + w * 0.3} ${y + 7}, ${x + w * 0.7} ${y - 5}, ${x + w} ${y + 2}`;
  const p = k(t, [at, at + 0.5], [0, 1], OUT);
  if (p <= 0) return null;
  const ev = evolvePath(p, d);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <path d={d} fill="none" stroke={color ?? th.accent} strokeWidth={7} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
    </svg>
  );
};
