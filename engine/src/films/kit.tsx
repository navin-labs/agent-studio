// Film kit: the pieces an authored film shares with every other film. Only what proved itself across different films lives here
// (docs/FILMS.md). Everything that makes a film look like itself stays in that film's own file.
// Timing: a film is a pure function of t (seconds). Voice beats come from the Composer (measured clips), never hard-coded.
import {noise2D} from '@remotion/noise';
import * as brushLib from 'p5.brush/standalone';
import React, {createContext, useContext, useLayoutEffect, useMemo, useRef} from 'react';
import {Audio, continueRender, delayRender, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import rough from 'roughjs';
import type {Storyboard, Timing} from '../composer/storyboard';
import {FPS, LEAD} from '../lib/timing';

// ---------- easing and time ----------
export const OUT = Easing.bezier(0.16, 1, 0.3, 1); // arrives and settles
export const IN = Easing.bezier(0.7, 0, 0.84, 0); // leaves with intent
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1); // camera moves
export const BACK = Easing.bezier(0.34, 1.56, 0.64, 1); // overshoot, then settle
// seconds-based clamped interpolate: k(t, [0.2, 0.6], [0, 1], OUT)
export const k = (t: number, [a, b]: [number, number], [x, y]: [number, number], easing = OUT) =>
  interpolate(t, [a, b], [x, y], {easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
// a damped spring settling to 0 from 1 after t0: overshoot and weight without a physics engine
export const settle = (t: number, t0: number, freq = 3.2, damp = 1.1) => (t < t0 ? 1 : Math.exp(-(t - t0) * damp * 3) * Math.cos((t - t0) * freq * Math.PI * 2));

// ---------- the film's context: beats (voice lines), total length, CTA ----------
export type Beat = {start: number; end: number; vo: [number, number] | null; text: string; words?: {w: string; s: number; e: number}[]}; // words: film seconds
export type Film = {t: number; beats: Beat[]; total: number; script: Storyboard; cta: {text: string; sub: string; handle: string}};
export const FilmCtx = createContext<Film | null>(null);
export const useFilm = (): Film => {
  const f = useContext(FilmCtx);
  if (!f) throw new Error('a film renders inside the Composer (storyboard "film")');
  return f;
};
export const filmContext = (script: Storyboard, frames: number[], timing: Timing | undefined, frame: number): Film => {
  let at = 0;
  const beats = script.scenes.map((sc, i) => {
    const start = at / FPS;
    at += frames[i];
    const d = timing?.durations?.[i];
    const text = (sc.vo ?? '').replace(/\*/g, '');
    const ws = timing?.words?.[i];
    const words = sc.vo && ws ? ws.map((w) => ({w: w.w, s: start + LEAD / FPS + w.s, e: start + LEAD / FPS + w.e})) : undefined;
    return {start, end: at / FPS, vo: sc.vo ? ([start + LEAD / FPS, start + LEAD / FPS + (d ?? (at / FPS - start - 0.4))] as [number, number]) : null, text, words};
  });
  const closer = script.scenes.at(-1)?.params ?? {};
  return {t: frame / FPS, beats, total: at / FPS, script, cta: {text: String(closer.text ?? '').replace(/\*/g, ''), sub: String(closer.sub ?? ''), handle: script.handle ?? ''}};
};

// ---------- camera ----------
// World-space camera: keys [t, x, y, zoom, rotateDeg?]; (x, y) is the world point centred in frame. Eased INOUT between keys.
// Apply the result to one wrapper around the whole world: <div style={{transform: cam(t, KEYS), transformOrigin: '0 0'}}>.
export type Key = [t: number, x: number, y: number, zoom: number, rot?: number];
export const camAt = (t: number, keys: Key[]) => {
  const i = Math.max(0, keys.findIndex((q) => q[0] > t) - 1);
  const a = keys[t >= keys.at(-1)![0] ? keys.length - 1 : i];
  const b = keys[Math.min(keys.indexOf(a) + 1, keys.length - 1)];
  const p = a === b ? 1 : INOUT(Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))));
  const z = Math.exp(Math.log(a[3]) + (Math.log(b[3]) - Math.log(a[3])) * p); // geometric zoom: even speed in and out
  return {x: a[1] + (b[1] - a[1]) * p, y: a[2] + (b[2] - a[2]) * p, z, r: (a[4] ?? 0) + ((b[4] ?? 0) - (a[4] ?? 0)) * p};
};
export const cam = (t: number, keys: Key[]) => {
  const c = camAt(t, keys);
  return `translate(540px, 960px) rotate(${c.r}deg) scale(${c.z}) translate(${-c.x}px, ${-c.y}px)`;
};
// Drift: a few px and a fraction of a degree of slow noise, so a locked-off frame breathes. Camera only, never objects.
export const drift = (t: number, amp = 5): string =>
  `translate(${noise2D('dx', t * 0.3, 0) * amp}px, ${noise2D('dy', 0, t * 0.3) * amp}px) rotate(${noise2D('dr', t * 0.2, 1) * amp * 0.03}deg)`;

// ---------- surface ----------
// Grain: fractal noise re-seeded every 2 frames (boils at 15 fps like film). multiply on light grounds, screen on dark.
export const Grain: React.FC<{opacity?: number; blend?: 'multiply' | 'screen' | 'overlay'; freq?: number}> = ({opacity = 0.1, blend = 'multiply', freq = 0.85}) => {
  const f = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, mixBlendMode: blend, opacity, pointerEvents: 'none'}}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={2} seed={Math.floor(f / 2)} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={1080} height={1920} filter="url(#grain)" />
    </svg>
  );
};
// Ink: a fixed displacement that roughens clean vector edges like print or a nib. Use filter="url(#ink)" (or url(#ink-strong)).
export const InkDefs: React.FC<{seed?: number}> = ({seed = 3}) => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <filter id="ink"><feTurbulence type="fractalNoise" baseFrequency={0.04} numOctaves={3} seed={seed} /><feDisplacementMap in="SourceGraphic" scale={3.5} /></filter>
    <filter id="ink-strong"><feTurbulence type="fractalNoise" baseFrequency={0.02} numOctaves={4} seed={seed} /><feDisplacementMap in="SourceGraphic" scale={9} /></filter>
  </svg>
);

// ---------- hand-made marks ----------
// Sketch: Rough.js shapes as plain SVG paths (no DOM needed), deterministic by seed, so they can be animated per frame.
// <Sketch shape={sketch.rectangle(0, 0, 200, 80, {seed: 4, roughness: 1.4})} draw={0.6} />   draw: 0..1 of the stroke drawn on.
export const sketch = rough.generator();
type Drawable = ReturnType<typeof sketch.rectangle>;
export const Sketch: React.FC<{shape: Drawable; draw?: number; color?: string; fill?: string; width?: number; style?: React.CSSProperties}> = ({shape, draw = 1, color, fill, width, style}) => (
  <g style={style}>
    {sketch.toPaths(shape).map((p, i) => {
      const isFill = p.stroke === 'none' || (p.fill && p.fill !== 'none');
      return (
        <path
          key={i}
          d={p.d}
          pathLength={1}
          fill={isFill && p.fill !== 'none' ? (fill ?? p.fill) : 'none'}
          stroke={p.stroke === 'none' ? 'none' : isFill && p.fill !== 'none' ? 'none' : (color ?? p.stroke)}
          strokeWidth={width ?? p.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={draw < 1 ? '1 1' : undefined}
          strokeDashoffset={draw < 1 ? 1 - draw : undefined}
          opacity={isFill && draw < 1 ? draw : 1}
        />
      );
    })}
  </g>
);

// Painted: a p5.brush plate (pencil, charcoal, ink, watercolour fills, hatching) painted once per render tab, deterministic by seed.
// Needs WebGL2: make.mjs renders with gl 'angle'. It is a still plate: animate it with the camera, masks and light, never by repainting per frame (slow, and it would boil).
export type Brush = typeof brushLib;
export const Painted: React.FC<{paint: (b: Brush) => void; seed?: number; w?: number; h?: number; style?: React.CSSProperties}> = ({paint, seed = 1, w = 1080, h = 1920, style}) => {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const handle = delayRender('painting plate');
    host.current!.innerHTML = '';
    brushLib.createCanvas(w, h, {parent: host.current!, pixelDensity: 1} as never);
    brushLib.seed(seed);
    brushLib.noiseSeed(seed);
    brushLib.push();
    brushLib.translate(-w / 2, -h / 2); // the standalone build draws from the canvas centre; films think in top-left pixels
    paint(brushLib);
    brushLib.pop();
    brushLib.render();
    continueRender(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, w, h]);
  return <div ref={host} style={{position: 'absolute', left: 0, top: 0, width: w, height: h, ...style}} />;
};

// ---------- sound ----------
// Score (levels from the audio POC: ~7 dB under the voice in gaps, ~17 dB under while it speaks): the film's own ACE-Step cue (public/music/<id>.wav, node scripts/film.mjs score), ducked under every voice line, shaped by
// shape [[t, dB]] (linear between points) and cut to silence in hush spans [from, to] (silence is a design tool).
export const Score: React.FC<{src: string; shape?: [number, number][]; hush?: [number, number][]; duck?: number; base?: number}> = ({src, shape = [[0, 0]], hush = [], duck = 10, base = -17}) => {
  const {beats} = useFilm();
  const db = (s: number) => {
    const i = shape.findIndex((p) => p[0] > s);
    const lvl = i < 0 ? shape.at(-1)![1] : i === 0 ? shape[0][1] : interpolate(s, [shape[i - 1][0], shape[i][0]], [shape[i - 1][1], shape[i][1]]);
    const talking = Math.max(0, ...beats.filter((b) => b.vo).map((b) => Math.min(k(s, [b.vo![0] - 0.25, b.vo![0]], [0, 1]), k(s, [b.vo![1], b.vo![1] + 0.4], [1, 0]))));
    const hushed = Math.max(0, ...hush.map(([a, b]) => Math.min(k(s, [a - 0.12, a], [0, 1]), k(s, [b, b + 0.3], [1, 0]))));
    return base + lvl - talking * duck - hushed * 60;
  };
  return <Audio src={staticFile(src)} volume={(f) => Math.pow(10, db(f / FPS) / 20)} />;
};
// Foley: physical sounds (public/sfx/foley/<name>.wav, scripts/foley.py) on story events. No UI blips.
export const FOLEY = ['page', 'flip', 'book', 'cloth', 'tear', 'swish', 'land', 'soft', 'sack', 'press', 'latch', 'catch', 'pop', 'wood', 'plank', 'stamp', 'thump', 'pen', 'chalk', 'switch', 'glass', 'coin', 'drop', 'tin', 'metal', 'bell', 'creak', 'door', 'step', 'knife'] as const; // scripts/foley.py
export type Cue = [at: number, name: (typeof FOLEY)[number], volume?: number];
export const Foley: React.FC<{cues: Cue[]}> = ({cues}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      {cues.map(([at, name, v = 0.6], i) => (
        <Sequence key={i} from={Math.max(0, Math.round(at * fps))} layout="none">
          <Audio src={staticFile(`sfx/foley/${name}.wav`)} volume={v} />
        </Sequence>
      ))}
    </>
  );
};

// ---------- captions ----------
// Each voice line in short phrases, timed by character share of its measured clip. The film art-directs the look (style) and
// may hide captions where the picture already says the words (hide spans). Captions must stay inside y 250..1500, x 60..960
// (platform UI; QA measures every caption).
export const phrases = (line: string, from: number, to: number, max = 4) => {
  const words = line.split(' ').filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; ) {
    let n = Math.min(max, words.length - i);
    const stop = words.slice(i, i + n).findIndex((w) => /[.,!?;:]$/.test(w));
    if (stop >= 0) n = stop + 1;
    chunks.push(words.slice(i, i + n).join(' '));
    i += n;
  }
  const total = chunks.reduce((a, c) => a + c.length + 2, 0);
  let at = from;
  return chunks.map((text) => {
    const d = ((text.length + 2) / total) * (to - from);
    const p = {text, from: at, to: at + d};
    at += d;
    return p;
  });
};
export const Captions: React.FC<{style: React.CSSProperties; hide?: [number, number][]; max?: number; enter?: (p: number) => React.CSSProperties}> = ({style, hide = [], max = 4, enter}) => {
  const {t, beats} = useFilm();
  if (hide.some(([a, b]) => t >= a && t < b)) return null;
  const b = beats.find((x) => x.vo && t >= x.vo[0] && t < x.vo[1] + 0.25);
  const p = b ? phrases(b.text, b.vo![0], b.vo![1], max).find((q) => t >= q.from && t < q.to + (q === undefined ? 0 : 0.0)) ?? null : null;
  if (!p) return null;
  const e = k(t, [p.from, p.from + 0.18], [0, 1]);
  return (
    <div data-tb="caption" style={{position: 'absolute', left: 90, right: 120, textAlign: 'center', ...style, ...(enter ? enter(e) : {opacity: e})}}>
      {p.text}
    </div>
  );
};

// ---------- small helpers ----------
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; // deterministic scatter
export const useMemoOnce = <T,>(make: () => T) => useMemo(make, []); // eslint-disable-line react-hooks/exhaustive-deps
