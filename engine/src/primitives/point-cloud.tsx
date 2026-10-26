import React from 'react';
import {interpolate, random, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {alpha, useTheme} from '../themes';
import {clamp, type PrimitiveProps, Shot, springFrom, STAGE} from './atoms';

const N = 520;
const R = 300;
const SCAN_FRAMES = 45; // one scan pass; density.ts counts each pass as a beat (same number there)
// points on a sphere (golden spiral) with a little height noise, like a scanned site
const PTS = Array.from({length: N}, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / N;
  const r = Math.sqrt(1 - y * y);
  const t = i * 2.399963;
  const h = 1 + (random(`pc${i}`) - 0.5) * 0.12;
  return {x: Math.cos(t) * r * h, y: y * h, z: Math.sin(t) * r * h};
});

// A rotating point cloud under a scan line; on the cue a reticle locks onto one point and reads out its value.
export const PointCloud: React.FC<PrimitiveProps<{label: string; value: string}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const lockAt = cues[0] ?? Math.round(dur * 0.45);
  const a = f * 0.025;
  const scanY = STAGE.cy - R + ((f % SCAN_FRAMES) / SCAN_FRAMES) * 2 * R;
  const lock = springFrom(f, lockAt, {damping: 14, stiffness: 200});
  const target = {x: 540 + 120, y: STAGE.cy - 90};
  const read = interpolate(f, [lockAt + 6, lockAt + 22], [0, 1], clamp);
  return (
    <Shot dur={dur} push={0.04}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {PTS.map((q, i) => {
          const x = q.x * Math.cos(a) - q.z * Math.sin(a);
          const z = q.x * Math.sin(a) + q.z * Math.cos(a);
          const k = 1 / (1.9 - z * 0.6);
          const px = 540 + x * R * k * 1.4, py = STAGE.cy + q.y * R * k * 1.4;
          const lit = Math.abs(py - scanY) < 18;
          return <circle key={i} cx={px} cy={py} r={lit ? 4.5 : 2 + z * 1.2} fill={lit ? th.accent : th.flow} opacity={lit ? 1 : 0.35 + 0.45 * (z + 1) / 2} />;
        })}
        <line x1={160} x2={920} y1={scanY} y2={scanY} stroke={alpha(th.accent, 0.7)} strokeWidth={2} />
        {f >= lockAt ? (
          <g transform={`translate(${target.x} ${target.y}) scale(${2.4 - 1.4 * lock}) rotate(${45 * (1 - lock)})`} opacity={Math.min(1, lock * 2)}>
            <rect x={-44} y={-44} width={88} height={88} fill="none" stroke={th.alert} strokeWidth={4} />
            <line x1={-70} x2={-48} y1={0} y2={0} stroke={th.alert} strokeWidth={4} />
            <line x1={48} x2={70} y1={0} y2={0} stroke={th.alert} strokeWidth={4} />
          </g>
        ) : null}
      </svg>
      {f >= lockAt ? (
        <div style={{position: 'absolute', left: target.x + 80, top: target.y - 70, opacity: read, transform: `translateX(${(1 - read) * 30}px)`, borderLeft: `4px solid ${th.alert}`, paddingLeft: 18}}>
          <div data-tb="label" style={{fontFamily: TYPE.data, fontSize: 26, fontWeight: 700, letterSpacing: '0.08em', color: th.muted, whiteSpace: 'nowrap'}}>{p.label}</div>
          <div data-tb="value" style={{fontFamily: TYPE.display, fontSize: 64, fontWeight: 900, color: th.ink, whiteSpace: 'nowrap'}}>{p.value}</div>
        </div>
      ) : null}
      <Sfx at={lockAt} name="ding" />
    </Shot>
  );
};
