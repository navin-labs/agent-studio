import {evolvePath} from '@remotion/paths';
import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {useTheme} from '../themes';
import {clamp, cuesOr, type PrimitiveProps, Shot} from './atoms';

// stops zig-zag down the stage, left and right
const stop = (i: number, n: number) => ({x: i % 2 ? 760 : 320, y: 360 + (i * 640) / Math.max(1, n - 1)});

// One continuous hand-drawn line travels from stop to stop; each label is circled and written as the line reaches it (one per cue).
export const LineDraw: React.FC<PrimitiveProps<{steps: string[]}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const n = p.steps.length;
  const at = cuesOr(cues, n, 8, dur - 16);
  const pts = p.steps.map((_, i) => stop(i, n));
  const d = pts.map((q, i) => (i ? `C ${pts[i - 1].x} ${(pts[i - 1].y + q.y) / 2 + 40} ${q.x} ${(pts[i - 1].y + q.y) / 2 - 40} ${q.x} ${q.y}` : `M ${q.x - 120} ${q.y - 60} L ${q.x} ${q.y}`)).join(' ');
  // the pen reaches stop i at its cue
  const reached = interpolate(f, [0, ...at], [0, ...at.map((_, i) => (i + 1) / n)], clamp);
  const line = evolvePath(reached, d);
  return (
    <Shot dur={dur} push={0.03}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <path d={d} fill="none" stroke={th.ink} strokeWidth={7} strokeLinecap="round" strokeDasharray={line.strokeDasharray} strokeDashoffset={line.strokeDashoffset} />
        {pts.map((q, i) => {
          const c = interpolate(f, [at[i], at[i] + 12], [0, 1], clamp);
          const ring = evolvePath(c, `M ${q.x + 46} ${q.y} A 46 40 0 1 1 ${q.x + 44} ${q.y - 14}`);
          return f >= at[i] ? <path key={i} d={`M ${q.x + 46} ${q.y} A 46 40 0 1 1 ${q.x + 44} ${q.y - 14}`} fill="none" stroke={th.flow} strokeWidth={6} strokeLinecap="round" strokeDasharray={ring.strokeDasharray} strokeDashoffset={ring.strokeDashoffset} /> : null;
        })}
      </svg>
      {pts.map((q, i) => {
        const w = interpolate(f, [at[i] + 4, at[i] + 16], [0, 1], clamp);
        const right = q.x < 540;
        return f >= at[i] ? (
          <div key={i} data-tb="step" style={{position: 'absolute', top: q.y - 34, ...(right ? {left: q.x + 80} : {right: 1080 - q.x + 80}), fontFamily: TYPE.title, fontSize: 52, fontWeight: 800, color: th.ink, whiteSpace: 'nowrap', clipPath: `inset(0 ${right ? (1 - w) * 100 : 0}% 0 ${right ? 0 : (1 - w) * 100}%)`}}>
            {p.steps[i]}
          </div>
        ) : null;
      })}
      {at.map((a, i) => <Sfx key={i} at={a} name="tick" />)}
    </Shot>
  );
};
