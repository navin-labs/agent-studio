// Format E, Memory Windows (docs/CREATIVE_BIBLE.md section 14; reference Video-84390): one dreamy world (a Stitch plate, pushed
// by ambient.tsx's Plate) with real photos floating in it as inset windows that illustrate each line. Letterbox bars, sparkle
// dust and white-flash cuts give it the reference's lift; the windows carry the facts.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {BACK, IN, k, OUT, rng} from '../films/kit';
import {useTheme} from '../themes';

const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) * 0.3 + parseInt(hex.slice(3, 5), 16) * 0.59 + parseInt(hex.slice(5, 7), 16) * 0.11;

// A real photo in a rounded frame: slides in from a side with a small overshoot, floats, pushes in slowly, then shrinks away.
export const Window: React.FC<{t: number; at: number; until: number; src: string; x: number; y: number; w: number; h: number; from?: 'left' | 'right' | 'below'; tilt?: number; pos?: string}> = ({t, at, until, src, x, y, w, h, from = 'right', tilt = 0, pos}) => {
  const th = useTheme();
  if (t < at || t > until + 0.35) return null;
  const p = k(t, [at, at + 0.55], [0, 1], BACK);
  const out = k(t, [until, until + 0.35], [1, 0], IN);
  const off = (1 - p) * (from === 'left' ? -900 : from === 'right' ? 900 : 0);
  const offY = (1 - p) * (from === 'below' ? 1100 : 0) + Math.sin((t - at) * 1.6) * 10;
  return (
    <div style={{position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: 26, overflow: 'hidden', border: `6px solid ${th.ink}`, boxShadow: `0 30px 70px ${th.shadow}`, opacity: out, translate: `${off}px ${offY}px`, rotate: `${tilt * (1 - k(t, [at, at + 0.8], [0, 0.6], OUT))}deg`, scale: String(0.85 + 0.15 * out)}}>
      <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos, scale: String(1.05 + k(t, [at, until], [0, 0.12]))}} />
    </div>
  );
};

// Cinematic letterbox bars in the suit's darker colour (ink or bg), so a light suit still gets dark bars.
export const Letterbox: React.FC<{h?: number}> = ({h = 170}) => {
  const th = useTheme();
  const bar = lum(th.ink) < lum(th.bg) ? th.ink : th.bg;
  return (
    <>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: h, background: bar}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: bar}} />
    </>
  );
};

// Sparkle dust: soft points that drift up and twinkle, seeded.
export const Sparkles: React.FC<{t: number; n?: number; seed?: number}> = ({t, n = 40, seed = 5}) => {
  const th = useTheme();
  const r = rng(seed);
  return (
    <>
      {Array.from({length: n}, (_, i) => {
        const x = r() * 1080, y0 = r() * 2100, sp = 20 + r() * 50, s = 3 + r() * 6, ph = r() * 6;
        const y = ((y0 - t * sp) % 2100 + 2100) % 2100 - 100;
        const o = 0.3 + 0.7 * Math.max(0, Math.sin(t * 3 + ph));
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: th.accent, boxShadow: `0 0 ${s * 3}px ${th.accent}`, opacity: o}} />;
      })}
    </>
  );
};

// The words: one line at a time in the serif, centred low, each word rising in as it is spoken.
export const DreamLine: React.FC<{t: number; at: number; end: number; text: string; dur: number; y?: number}> = ({t, at, end, text, dur, y = 1460}) => {
  const th = useTheme();
  if (t < at - 0.1 || t > end) return null;
  const words = text.split(' ');
  return (
    // a halo in the suit's background colour keeps the line readable over any plate
    <div data-tb="caption" style={{position: 'absolute', left: 112, right: 124, bottom: 1920 - y, textAlign: 'center', fontFamily: '"Instrument Serif", serif', fontSize: 72, lineHeight: 1.08, color: th.ink, textShadow: `0 0 4px ${th.bg}, 0 0 12px ${th.bg}, 0 0 28px ${th.bg}, 0 0 48px ${th.bg}`, opacity: k(t, [end - 0.2, end], [1, 0])}}>
      {words.map((w, i) => {
        const wt = at + (i / words.length) * dur;
        return <span key={i} style={{display: 'inline-block', marginRight: '0.25em', opacity: k(t, [wt, wt + 0.18], [0, 1]), translate: `0 ${k(t, [wt, wt + 0.3], [24, 0], OUT)}px`}}>{w}</span>;
      })}
    </div>
  );
};
