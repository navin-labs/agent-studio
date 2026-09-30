import {CameraMotionBlur} from '@remotion/motion-blur';
import {getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
import React from 'react';
import {Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {useTheme} from '../themes';
import {clamp, type Item, ItemCard, lerp, type Node, NODE_W, NodeCard, type PrimitiveProps, prog, Shot} from './atoms';

const PILE = {x: 330, y: 930};
const NODE = {x: 620, y: 420};
const INTAKE = {x: NODE.x - NODE_W / 2 + 20, y: NODE.y};

// Cards leave a pile top-first and fly along a curve into one step (with motion blur); the step works while they arrive.
export const Conveyor: React.FC<PrimitiveProps<{item: Item; node: Node; count: number}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const start = cues[0] ?? 8;
  const gap = Math.max(2, Math.min(6, Math.floor((dur - start - 24) / p.count)));
  const cards = Array.from({length: p.count}, (_, i) => ({
    x: PILE.x + (random(`cx${i}`) - 0.5) * 120,
    y: PILE.y - i * 7,
    r: (random(`cr${i}`) - 0.5) * 30,
    fly: start + (p.count - 1 - i) * gap, // top of the pile leaves first
  }));
  const path = (a: {x: number; y: number}) => `M ${a.x} ${a.y} C ${a.x + 180} ${a.y - 520} ${INTAKE.x - 300} ${INTAKE.y - 220} ${INTAKE.x} ${INTAKE.y}`;
  const working = interpolate(f, [start + 18, start + 24, cards[0].fly + 20, cards[0].fly + 30], [0, 1, 1, 0], clamp);
  const flying = cards.filter((c) => f >= c.fly && f < c.fly + 20);
  return (
    <Shot dur={dur}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <path d={path(PILE)} stroke={th.muted} strokeWidth={3} strokeDasharray="10 14" fill="none" style={{opacity: prog(f, 0, 12)}} />
      </svg>
      <NodeCard node={p.node} x={NODE.x} y={NODE.y} appear={1} active={working} green={0} z={2} />
      {cards.map((c, i) => (f < c.fly ? <ItemCard key={i} item={p.item} n={1001 + i} x={c.x} y={c.y} rot={c.r} z={10 + i} /> : null))}
      {flying.length ? (
        <div style={{position: 'absolute', inset: 0, zIndex: 90}}>
          <CameraMotionBlur samples={6} shutterAngle={200}>
            {flying.map((c) => {
              const i = cards.indexOf(c);
              const d = path(c);
              const t = prog(f, c.fly, 20, Easing.bezier(0.45, 0, 0.3, 1));
              const len = getLength(d);
              const pt = getPointAtLength(d, len * t);
              const tan = getTangentAtLength(d, len * t);
              if (!pt || !tan) return null; // degenerate (zero-length) path: skip this card rather than crash
              const ang = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
              return <ItemCard key={i} item={p.item} n={1001 + i} x={pt.x} y={pt.y} rot={lerp(c.r, ang * 0.25, Math.min(1, t * 2))} scale={lerp(1, 0.32, t)} opacity={interpolate(t, [0.82, 1], [1, 0], clamp)} />;
            })}
          </CameraMotionBlur>
        </div>
      ) : null}
      <Sfx at={start} name="whoosh" volume={0.25} />
    </Shot>
  );
};
