// A format style's motion and texture (composer/style.ts FormatStyle): the camera on every shot, the filter on the picture and
// the overlay drawn over the whole frame. All of it is a pure function of the frame, so renders stay deterministic.
// Captions sit outside the camera so they never move off their band; the overlay sits outside [data-scene], so the text probe
// never measures it.
import {noise2D} from '@remotion/noise';
import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {TYPE} from '../theme';
import {alpha, useTheme, type Theme} from '../themes';
import type {FormatStyle} from './style';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const OUT = Easing.out(Easing.cubic);

// The camera rests a little zoomed out (REST) so its biggest move only reaches full size: text that fills the safe area at
// scale 1 never leaves it. ponytail: the shot's own dot grid stops REST short of the frame edge; nobody has noticed yet.
const REST = 0.95;
// the camera's transform at frame f of a shot. beats: frames that get a hit (power words strong, every 4th word light)
export const cameraTransform = (mode: FormatStyle['cameraMode'] | undefined, f: number, dur: number, strong: number[], light: number[], i: number) => {
  if (mode === '3d-tilt') {
    const side = i % 2 ? 1 : -1; // alternate the side each shot swings in from
    const inE = interpolate(f, [0, 16], [1, 0], {...clamp, easing: OUT});
    const outE = interpolate(f, [dur - 8, dur], [0, 1], {...clamp, easing: Easing.in(Easing.cubic)});
    const rx = 12 * inE - 8 * outE + Math.sin(f / 38) * 1.6;
    const ry = side * (16 * inE + 10 * outE) + Math.cos(f / 47) * 2;
    return `perspective(1900px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${REST - 0.05 * inE})`;
  }
  if (mode === 'kinetic-punch') {
    const hit = (bs: number[], amp: number, decay: number) => bs.reduce((a, b) => (f >= b ? a + amp * Math.exp(-(f - b) / decay) : a), 0);
    const z = REST + Math.min(1 - REST, hit(strong, 0.05, 6) + hit(light, 0.02, 5));
    const last = [...strong, ...light].filter((b) => b <= f).length;
    const rot = hit(strong, 1, 6) * (last % 2 ? 0.8 : -0.8);
    return `scale(${z}) rotate(${rot}deg)`;
  }
  if (mode === 'handheld-doc') {
    const x = noise2D('hx', f / 50, i) * 8, y = noise2D('hy', f / 55, i) * 7, r = noise2D('hr', f / 70, i) * 0.4;
    return `translate(${x}px, ${y}px) rotate(${r}deg) scale(${REST + 0.02 * (f / Math.max(1, dur))})`;
  }
  return undefined; // still, whip-pan (whip-pan is the transitions: the Composer turns every cut into one)
};

// the filter and offset on the picture under the overlay
export const pictureStyle = (fx: FormatStyle['fxOverlay'] | undefined, th: Theme, f: number): React.CSSProperties => {
  if (fx === 'crt') return {filter: `drop-shadow(3px 0 0 ${alpha(th.alert, 0.4)}) drop-shadow(-3px 0 0 ${alpha(th.flow, 0.4)}) drop-shadow(0 0 7px ${alpha(th.ink, 0.35)})`};
  if (fx === 'print') return {filter: `drop-shadow(5px 3px 0 ${alpha(th.accent, 0.5)})`}; // the second plate, off register
  if (fx === 'film') return {filter: `contrast(1.08) brightness(${0.94 + 0.08 * random(`fl${f}`)})`, transform: `translate(${(random(`wx${f}`) - 0.5) * 3}px, ${(random(`wy${f}`) - 0.5) * 4}px)`};
  return {};
};

const Grain: React.FC<{seed: number; opacity: number}> = ({seed, opacity}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply', opacity}}>
    <filter id={`grain-${seed}`}>
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
  </svg>
);

const vignette = (th: Theme, a: number) => ({position: 'absolute' as const, inset: 0, background: `radial-gradient(ellipse at center, transparent 55%, ${alpha(th.shadow, a)} 100%)`});

const Crt: React.FC<{f: number; th: Theme}> = ({f, th}) => (
  <>
    <div style={{position: 'absolute', inset: 0, background: `repeating-linear-gradient(0deg, ${alpha(th.shadow, 0.3)} 0 2px, transparent 2px 5px)`}} />
    <div style={{position: 'absolute', left: 0, right: 0, top: ((f * 9) % 2200) - 200, height: 160, background: `linear-gradient(transparent, ${alpha(th.ink, 0.07)}, transparent)`}} />
    <div style={{position: 'absolute', inset: 0, background: alpha(th.ink, 0.015 + 0.02 * random(`cf${f}`))}} />
    <div style={vignette(th, 0.7)} />
  </>
);

const Print: React.FC<{f: number; th: Theme}> = ({f, th}) => (
  <>
    <div style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply', backgroundImage: `radial-gradient(${alpha(th.ink, 0.13)} 1.3px, transparent 1.9px)`, backgroundSize: '9px 9px'}} />
    <Grain seed={Math.floor(f / 3) % 12} opacity={0.22} />
    <div style={vignette(th, 0.18)} />
  </>
);

const Film: React.FC<{f: number; th: Theme}> = ({f, th}) => {
  const specks = Array.from({length: 10}, (_, k) => ({x: random(`dx${f}-${k}`) * 1080, y: random(`dy${f}-${k}`) * 1920, r: 1.5 + random(`dr${f}-${k}`) * 4, on: random(`do${f}-${k}`) < 0.6}));
  const scratch = random(`sc${Math.floor(f / 3)}`) < 0.35 ? 80 + random(`sx${Math.floor(f / 3)}`) * 920 : null;
  return (
    <>
      <Grain seed={f % 24} opacity={0.18} />
      {specks.filter((s) => s.on).map((s, k) => <div key={k} style={{position: 'absolute', left: s.x, top: s.y, width: s.r, height: s.r * (k % 3 ? 1 : 5), borderRadius: s.r, background: alpha(k % 2 ? th.shadow : th.ink, 0.55)}} />)}
      {scratch !== null ? <div style={{position: 'absolute', left: scratch, top: 0, bottom: 0, width: 2, background: alpha(th.ink, 0.25)}} /> : null}
      <div style={{position: 'absolute', inset: 0, background: alpha(th.shadow, 0.03 + 0.07 * random(`ff${f}`))}} />
      <div style={vignette(th, 0.75)} />
    </>
  );
};

const Tactical: React.FC<{f: number; th: Theme}> = ({f, th}) => {
  const line = alpha(th.flow, 0.13);
  const bracket = (x: number, y: number, sx: number, sy: number) => <div style={{position: 'absolute', left: x, top: y, width: 70, height: 70, borderLeft: sx ? `4px solid ${alpha(th.flow, 0.8)}` : undefined, borderRight: sx ? undefined : `4px solid ${alpha(th.flow, 0.8)}`, borderTop: sy ? `4px solid ${alpha(th.flow, 0.8)}` : undefined, borderBottom: sy ? undefined : `4px solid ${alpha(th.flow, 0.8)}`}} />;
  const t = (f / 30).toFixed(1).padStart(5, '0');
  return (
    <>
      <div style={{position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`, backgroundSize: '60px 60px'}} />
      <div style={{position: 'absolute', left: 540, top: 0, bottom: 0, width: 1, background: alpha(th.flow, 0.18)}} />
      {bracket(40, 250, 1, 1)}
      {bracket(970, 250, 0, 1)}
      {bracket(40, 1050, 1, 0)}
      {bracket(970, 1050, 0, 0)}
      <div style={{position: 'absolute', left: 850, top: 70, width: 170, height: 170, borderRadius: '50%', border: `2px solid ${alpha(th.flow, 0.6)}`, background: `conic-gradient(from ${f * 5}deg, ${alpha(th.flow, 0.45)}, transparent 60deg, transparent)`}} />
      <div style={{position: 'absolute', left: 900, top: 120, width: 70, height: 70, borderRadius: '50%', border: `1px solid ${alpha(th.flow, 0.45)}`}} />
      <div style={{position: 'absolute', left: 60, top: 90, fontFamily: TYPE.data, fontSize: 24, letterSpacing: '0.1em', color: alpha(th.flow, 0.85)}}>
        T+{t} · REC {f % 30 < 18 ? '●' : ' '}
      </div>
      <div style={{position: 'absolute', left: 60, top: 128, fontFamily: TYPE.data, fontSize: 20, letterSpacing: '0.1em', color: alpha(th.muted, 0.9)}}>
        GRID {String(4000 + ((f * 37) % 997)).padStart(4, '0')} · LOCK {Math.min(100, Math.round((f / 3) % 120))}%
      </div>
    </>
  );
};

const OVERLAYS = {crt: Crt, print: Print, film: Film, tactical: Tactical} as const;

export const StyleOverlay: React.FC<{fx?: FormatStyle['fxOverlay']}> = ({fx}) => {
  const f = useCurrentFrame();
  const th = useTheme();
  const O = fx && fx !== 'none' ? OVERLAYS[fx] : null;
  return O ? (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <O f={f} th={th} />
    </AbsoluteFill>
  ) : null;
};
