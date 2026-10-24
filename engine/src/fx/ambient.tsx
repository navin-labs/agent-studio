// Format G, Ambient Scenes (docs/CREATIVE_BIBLE.md section 14; references Video-65602, Video-40696): one atmospheric scene per
// line, almost still; light and weather carry the motion. Scenes are painted or pixel plates from the asset pipeline (Stitch in
// the look's medium); code lights them: lamps that switch on and flicker, screens that glow and ping, fog, rain, sunrise.
import {noise2D} from '@remotion/noise';
import React from 'react';
import {Img, staticFile} from 'remotion';
import {IN, k, OUT, rng} from '../films/kit';
import {useTheme} from '../themes';

const mix = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;

// The plate: cover the frame, a very slow push and a breath of sideways drift; dips to black at its edges (the cut).
export const Plate: React.FC<{t: number; a: number; b: number; src: string; dim?: number; push?: number; origin?: string; children?: React.ReactNode}> = ({t, a, b, src, dim = 0, push = 0.08, origin = '50% 50%', children}) => {
  if (t < a - 0.3 || t > b + 0.3) return null;
  const o = Math.min(k(t, [a - 0.3, a + 0.2], [0, 1], OUT), k(t, [b - 0.2, b + 0.3], [1, 0], IN));
  const s = 1.02 + k(t, [a, b], [0, push]);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: o}}>
      <div style={{position: 'absolute', inset: 0, scale: String(s), transformOrigin: origin, translate: `${Math.sin(t * 0.35) * 8}px 0`}}>
        <Img src={staticFile(src)} style={{width: 1080, height: 1920, objectFit: 'cover', filter: dim ? `brightness(${1 - dim})` : undefined}} />
        {children}
      </div>
    </div>
  );
};

// A light that switches on at `on` (a short stutter, then steady with a faint flicker): a warm pool and an optional cone.
export const Lamp: React.FC<{t: number; on: number; x: number; y: number; r?: number; cone?: number; color?: string}> = ({t, on, x, y, r = 260, cone = 0, color}) => {
  const th = useTheme();
  const c = color ?? th.accent;
  const stutter = t < on ? 0 : t < on + 0.35 ? (Math.sin((t - on) * 70) > 0 ? 1 : 0.25) : 1;
  const flick = 0.92 + noise2D('lamp', t * 3, x) * 0.08;
  const p = stutter * flick * k(t, [on, on + 0.1], [0, 1]);
  if (p <= 0) return null;
  return (
    <>
      <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `radial-gradient(circle, ${mix(c, 70 * p)} 0%, ${mix(c, 22 * p)} 35%, transparent 70%)`, mixBlendMode: 'screen'}} />
      {cone > 0 && <div style={{position: 'absolute', left: x - cone / 2, top: y, width: cone, height: cone * 1.6, clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)', background: `linear-gradient(${mix(c, 38 * p)}, transparent)`, mixBlendMode: 'screen'}} />}
    </>
  );
};

// A screen that glows and breathes; `ping` sends rings out from it (a notification arriving), one per time given.
export const ScreenGlow: React.FC<{t: number; x: number; y: number; w: number; h: number; pings?: number[]; color?: string}> = ({t, x, y, w, h, pings = [], color}) => {
  const th = useTheme();
  const c = color ?? th.flow;
  const breathe = 0.75 + Math.sin(t * 2.4) * 0.15;
  return (
    <>
      <div style={{position: 'absolute', left: x - w, top: y - h, width: w * 2, height: h * 2, borderRadius: '50%', background: `radial-gradient(ellipse, ${mix(c, 55 * breathe)} 0%, transparent 65%)`, mixBlendMode: 'screen'}} />
      {pings.map((p, i) => {
        const d = t - p;
        if (d < 0 || d > 1.4) return null;
        const r = 40 + d * 420;
        return <div key={i} style={{position: 'absolute', left: x - r, top: y - r * 0.6, width: r * 2, height: r * 1.2, borderRadius: '50%', border: `4px solid ${mix(c, 80 * (1 - d / 1.4))}`}} />;
      })}
    </>
  );
};

// Fog: two soft bands drifting slowly across the lower part of the frame.
export const Fog: React.FC<{t: number; y?: number; amount?: number}> = ({t, y = 1250, amount = 0.35}) => {
  const th = useTheme();
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} style={{position: 'absolute', left: -600 + ((t * (22 + i * 14) + i * 500) % 1400), top: y + i * 180, width: 1600, height: 420, borderRadius: '50%', background: `radial-gradient(ellipse, ${mix(th.muted, 100 * amount)} 0%, transparent 70%)`, filter: 'blur(30px)'}} />
      ))}
    </>
  );
};

// Rain: thin slanted streaks falling, seeded; `amount` 0..1.
export const Rain: React.FC<{t: number; amount?: number}> = ({t, amount = 0.6}) => {
  const th = useTheme();
  const r = rng(21);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      {Array.from({length: Math.round(140 * amount)}, (_, i) => {
        const x0 = r() * 1180, sp = 1600 + r() * 900, ph = r();
        const y = ((t * sp + ph * 2200) % 2200) - 200;
        return <line key={i} x1={x0 - y * 0.12} y1={y} x2={x0 - (y + 46) * 0.12} y2={y + 46} stroke={th.ink} strokeOpacity={0.22} strokeWidth={2} />;
      })}
    </svg>
  );
};

// Sunrise: a warm wash that climbs from the horizon and lifts the plate's brightness.
export const Sunrise: React.FC<{t: number; from: number; to: number; y?: number}> = ({t, from, to, y = 760}) => {
  const th = useTheme();
  const p = k(t, [from, to], [0, 1], OUT);
  return <div style={{position: 'absolute', inset: 0, background: `radial-gradient(70% 40% at 50% ${y / 19.2}%, ${mix(th.accent, 55 * p)} 0%, transparent 70%)`, mixBlendMode: 'screen'}} />;
};

// The words: one calm line at a time, low in the frame, fading in word by word with a soft shadow for any plate.
export const Whisper: React.FC<{t: number; at: number; end: number; text: string; dur: number}> = ({t, at, end, text, dur}) => {
  const th = useTheme();
  if (t < at - 0.1 || t > end) return null;
  const words = text.split(' ');
  const o = k(t, [end - 0.25, end], [1, 0]);
  return (
    <div style={{position: 'absolute', left: 90, right: 90, top: 1440, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 52, lineHeight: 1.25, color: th.ink, textShadow: `0 2px 18px ${mix(th.shadow, 90)}`, opacity: o}}>
      {words.map((w, i) => (
        <span key={i} style={{opacity: k(t, [at + (i / words.length) * dur, at + (i / words.length) * dur + 0.2], [0, 1]), marginRight: '0.28em'}}>{w}</span>
      ))}
    </div>
  );
};
