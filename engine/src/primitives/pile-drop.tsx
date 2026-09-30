import {noise2D} from '@remotion/noise';
import React from 'react';
import {interpolate, random, spring, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {FPS} from '../lib/timing';
import {clamp, type Item, ItemCard, type PrimitiveProps, Shot} from './atoms';

// Cards rain onto a desk and pile up; the camera shakes when the pile is buried (cue 0, default near the end).
export const PileDrop: React.FC<PrimitiveProps<{item: Item; count: number; start: number}>> = ({p, dur, cues}) => {
  const f = useCurrentFrame();
  const buried = cues[0] ?? dur - 15;
  const cards = Array.from({length: p.count}, (_, i) => {
    const u = i / Math.max(1, p.count - 1);
    const spread = 600 * Math.pow(1 - u, 1.3) + 110;
    return {
      x: 540 + (random(`x${i}`) - 0.5) * spread,
      y: 860 - 290 * u + (random(`y${i}`) - 0.5) * 50,
      r: (random(`r${i}`) - 0.5) * 50,
      drop: Math.round(Math.pow(u, 0.62) * Math.max(1, buried - 12)),
    };
  });
  const mid = cards.reduce((a, c) => a + c.x, 0) / cards.length - 540; // random spread is lopsided: re-centre the pile
  cards.forEach((c) => (c.x -= mid));
  const shake = interpolate(f, [buried - 20, buried, buried + 18], [0, 9, 0], clamp);
  return (
    <Shot dur={dur} zoom={1.3} push={-0.08}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${shake * noise2D('px', f * 0.45, 0)}px, ${shake * noise2D('py', 0, f * 0.45)}px)`}}>
        {cards.map((c, i) => {
          if (f < c.drop) return null;
          const s = spring({frame: f - c.drop, fps: FPS, config: {damping: 12, stiffness: 120, mass: 0.9}});
          return <ItemCard key={i} item={p.item} n={p.start + i} x={c.x} y={c.y - (1 - s) * 1100} rot={c.r + (1 - s) * (i % 2 ? 70 : -70)} z={10 + i} />;
        })}
      </div>
      {cards.filter((_, i) => i < 4 || i % 3 === 0).map((c, i) => <Sfx key={i} at={c.drop + 10} name="tick" volume={0.3} />)}
      <Sfx at={buried} name="pop" volume={0.5} />
    </Shot>
  );
};
