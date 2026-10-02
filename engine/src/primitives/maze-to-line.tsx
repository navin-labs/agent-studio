import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {SIDE, TYPE} from '../theme';
import {card, useTheme} from '../themes';
import {clamp, EASE, lerp, type PrimitiveProps, Shot, STAGE} from './atoms';

type P = {from: string; to: string};

const N = 24; // path points
const L = SIDE + 70; // line ends, inside the side margins
const R = 1080 - SIDE - 70;
const MID = STAGE.bottom - 260; // the straight line; the tangle lives above it, the labels below
// The tangle: a fixed zig-zag across the stage (same every render), from the left end to the right end.
const TANGLE = Array.from({length: N}, (_, i) => {
  if (i === 0) return {x: L, y: MID};
  if (i === N - 1) return {x: R, y: MID};
  const x = L + (((i * 7) % 11) / 10) * (R - L);
  const y = STAGE.top + 40 + (((i * 5) % 9) / 8) * (MID - 30 - STAGE.top - 40);
  return {x, y};
});
const LINE = TANGLE.map((_, i) => ({x: L + (i / (N - 1)) * (R - L), y: MID}));

const pointAt = (pts: {x: number; y: number}[], t: number) => {
  const s = Math.min(N - 1.001, Math.max(0, t * (N - 1)));
  const i = Math.floor(s);
  return {x: lerp(pts[i].x, pts[i + 1].x, s - i), y: lerp(pts[i].y, pts[i + 1].y, s - i)};
};

// A tangled path (the manual way) snaps into one straight line on cue 0; a dot that was crawling through the tangle zips to the end.
export const MazeToLine: React.FC<PrimitiveProps<P>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const snap = cues[0] ?? Math.round(dur * 0.45);
  const k = interpolate(f, [snap, snap + 12], [0, 1], {...clamp, easing: EASE});
  const pts = TANGLE.map((a, i) => ({x: lerp(a.x, LINE[i].x, k), y: lerp(a.y, LINE[i].y, k)}));
  const draw = interpolate(f, [0, 14], [0, 1], clamp);
  const crawl = interpolate(f, [6, snap], [0, 0.35], clamp); // slow and lost before the snap
  const dotT = f < snap ? crawl : interpolate(f, [snap + 10, snap + 26], [crawl, 1], {...clamp, easing: EASE});
  const dot = pointAt(pts, dotT);
  const arrived = f >= snap + 26;
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' ');
  const label = (text: string, on: boolean, side: 'left' | 'right') => (
    <div data-box style={{...card(th), position: 'absolute', top: MID + 54, [side]: SIDE + 30, padding: '10px 18px', borderRadius: 14, fontFamily: TYPE.data, fontSize: 32, fontWeight: 800, color: th.ink, background: on ? th.accent : th.surface, whiteSpace: 'nowrap'}}>
      {text}
    </div>
  );
  return (
    <Shot dur={dur}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <path d={d} fill="none" stroke={k < 1 ? th.warn : th.flow} strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        <circle cx={L} cy={MID} r={18} fill={th.ink} />
        <circle cx={R} cy={MID} r={18} fill={arrived ? th.ok : th.ink} />
        <circle cx={dot.x} cy={dot.y} r={22} fill={th.flow} stroke={th.surface} strokeWidth={6} />
      </svg>
      {label(p.from, false, 'left')}
      {label(p.to, arrived, 'right')}
      <Sfx at={snap} name="whoosh" volume={0.35} />
      <Sfx at={snap + 26} name="ding" volume={0.3} />
    </Shot>
  );
};
