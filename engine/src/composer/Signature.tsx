// Signature building blocks, switched on by a style preset (composer/style.ts, docs/MOTION.md). Openers: `arrow-fold` (the C1 mark
// assembles and flies through the camera) and `year-flap` (the story's year lands in split-flap tiles, turns to the reveal colour,
// and the board drops away). Transition: `fold` (the arrow's chevron sweeps forward). Overlay: `thread` (a timeline under the
// story, in the reveal colour; `thread-paper` in paper) whose node flares at each reveal (the year lands, a name is highlighted).
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {clamp, EXPO, IN, OUT} from '../primitives/atoms';
import {TYPE} from '../theme';
import {alpha, card, useTheme} from '../themes';

// The C1 mark (brand/c1-automation), traced from public/brand/mark.png in its 600 x 600 box: three folded arrows.
const ARMS = [
  {arm: '356,24 429,62 272,152 478,260 425,302 347,269 196,192 189,118', flap: '198,195 258,228 267,366 210,338', hinge: [228, 211], from: [40, -170]},
  {arm: '140,261 204,288 210,340 224,518 166,556 28,477 27,397 154,468', flap: '333,386 340,442 227,517 220,454', hinge: [224, 485], from: [-190, 140]},
  {arm: '503,338 575,372 573,536 509,574 507,420 308,537 299,472', flap: '370,281 501,338 445,376 405,359 320,320', hinge: [473, 357], from: [190, 120]},
];
export const OPEN_FRAMES = 19;

// 0 to 0.6 s: the three arrows fly in (staggered), their flaps fold shut, then the mark flies through the camera into the hook.
export const ArrowFold: React.FC = () => {
  const th = useTheme();
  const f = useCurrentFrame();
  if (f >= OPEN_FRAMES) return null;
  const through = interpolate(f, [13, OPEN_FRAMES], [0, 1], {...clamp, easing: IN});
  return (
    <AbsoluteFill style={{background: alpha(th.bg, 1 - interpolate(f, [15, OPEN_FRAMES], [0, 1], clamp)), alignItems: 'center', justifyContent: 'center'}}>
      <svg viewBox="0 0 600 600" style={{width: 560, height: 560, overflow: 'visible', transform: `scale(${1 + through * 5})`}}>
        {ARMS.map(({arm, flap, hinge, from}, i) => {
          const a = interpolate(f, [i * 2, i * 2 + 7], [0, 1], {...clamp, easing: EXPO});
          const s = interpolate(f, [6 + i, 11 + i], [0, 1], {...clamp, easing: OUT});
          return (
            <g key={i} style={{transformOrigin: '300px 300px', transform: `translate(${(1 - a) * from[0]}px, ${(1 - a) * from[1]}px) rotate(${(1 - a) * -30}deg)`, opacity: a}}>
              <polygon points={flap} fill={th.muted} style={{transformOrigin: `${hinge[0]}px ${hinge[1]}px`, transform: `scale(${s})`}} />
              <polygon points={arm} fill={th.ink} />
            </g>
          );
        })}
      </svg>
      <Sfx at={0} name="whoosh" volume={0.3} />
      <Sfx at={7} name="tick" volume={0.3} />
    </AbsoluteFill>
  );
};

// The `fold` transition: the incoming scene is revealed behind a chevron edge sweeping left to right (forward), paper edge
// with the fold's grey shade behind it. e: 0 to 1.
const DEPTH = 420;
export const foldEdge = (e: number) => -DEPTH + e * (1080 + 2 * DEPTH);
export const foldClip = (e: number) => {
  const x = foldEdge(e);
  return `polygon(0 0, ${x - DEPTH}px 0, ${x}px 960px, ${x - DEPTH}px 1920px, 0 1920px)`;
};
export const FoldBand: React.FC<{e: number}> = ({e}) => {
  const th = useTheme();
  const x = foldEdge(e);
  const pts = (dx: number) => `${x - DEPTH + dx},-40 ${x + dx},960 ${x - DEPTH + dx},1960`;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <polyline points={pts(-34)} fill="none" stroke={th.muted} strokeWidth={30} strokeLinejoin="miter" />
      <polyline points={pts(0)} fill="none" stroke={th.ink} strokeWidth={36} strokeLinejoin="miter" />
    </svg>
  );
};

// The story's thread: it draws itself along with the story, paper ticks mark each beat, and each reveal frame flares its node in
// the reveal colour for about 0.6 s. Sits under the captions, inside every platform's safe area.
export const THREAD_Y = 1470;
export const Thread: React.FC<{total: number; beats: number[]; reveals: number[]; paper?: boolean}> = ({total, beats, reveals, paper}) => {
  const th = useTheme();
  const gold = th.reveal ?? th.accent;
  const f = useCurrentFrame();
  const [x0, x1] = [150, 930];
  const X = (fr: number) => x0 + (x1 - x0) * Math.min(1, fr / total);
  const grow = interpolate(f, [0, 10], [0, 1], {...clamp, easing: OUT});
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <line x1={x0} x2={x0 + (x1 - x0) * grow} y1={THREAD_Y} y2={THREAD_Y} stroke={th.muted} strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
      <line x1={x0} x2={X(f)} y1={THREAD_Y} y2={THREAD_Y} stroke={paper ? th.ink : gold} strokeOpacity={0.85} strokeWidth={6} strokeLinecap="round" />
      {beats.map((b, i) => <circle key={i} cx={X(b)} cy={THREAD_Y} r={f >= b ? 9 : 7} fill={f >= b ? th.ink : th.muted} />)}
      {reveals.map((r, i) => {
        const lit = interpolate(f, [r, r + 4, r + 18], [0, 1, 0], clamp);
        const shown = f >= r;
        return shown ? (
          <g key={`r${i}`}>
            <circle cx={X(r)} cy={THREAD_Y} r={12 + 30 * lit} fill={alpha(th.reveal ?? th.accent, 0.3 * lit)} />
            <circle cx={X(r)} cy={THREAD_Y} r={11 + 5 * lit} fill={lit > 0.05 ? th.reveal ?? th.accent : th.ink} />
          </g>
        ) : null;
      })}
      <circle cx={X(f)} cy={THREAD_Y} r={8} fill={th.ink} />
    </svg>
  );
};

// 0 to 0.7 s: the story's year lands in split-flap tiles left to right, turns to the reveal colour as the last tile lands, then the
// board drops away into the hook. The year comes from the storyboard (meta.year); make.mjs refuses a year-flap board without one.
export const YEAR_FRAMES = 21;
export const YearFlap: React.FC<{year: string}> = ({year}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  if (f >= YEAR_FRAMES) return null;
  const chars = [...year];
  const settle = (i: number) => 5 + i * 2 + 4; // each tile flips for 4 frames, staggered by 2
  const landed = f >= settle(chars.length - 1);
  const away = interpolate(f, [16, YEAR_FRAMES], [0, 1], {...clamp, easing: IN});
  const appear = interpolate(f, [0, 4], [0, 1], {...clamp, easing: OUT});
  return (
    <AbsoluteFill style={{background: alpha(th.bg, 1 - away), alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', gap: 14, opacity: appear * (1 - away), transform: `translateY(${away * 160 + (1 - appear) * -30}px)`}}>
        {chars.map((c, i) => {
          // a flipping tile is blank with its flap falling: never a random digit (it could read as a real, wrong year)
          const done = f >= settle(i);
          const flap = !done && f >= 5 + i * 2 ? ((f - 5 - i * 2) % 2) / 2 : 0;
          return (
            <div key={i} data-tb-skip style={{...card(th), position: 'relative', overflow: 'hidden', width: 150, height: 214, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPE.display, fontSize: 132, fontWeight: 900, color: landed ? gold(th) : th.ink, fontVariantNumeric: 'tabular-nums'}}>
              {done ? c : ''}
              <div style={{position: 'absolute', left: 0, right: 0, top: '50%', height: 3, background: th.bg}} />
              {flap ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: '50%', background: th.rule, transformOrigin: '50% 100%', transform: `scaleY(${1 - flap * 2})`}} /> : null}
            </div>
          );
        })}
      </div>
      {chars.map((_, i) => <Sfx key={i} at={5 + i * 2} name="tick" volume={0.22} />)}
    </AbsoluteFill>
  );
};
const gold = (th: ReturnType<typeof useTheme>) => th.reveal ?? th.accent;
