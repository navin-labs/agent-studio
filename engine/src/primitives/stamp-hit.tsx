import React from 'react';
import {interpolate, random, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {useTheme} from '../themes';
import {clamp, cuesOr, DonePill, type PrimitiveProps, Shot, springFrom, STAGE} from './atoms';

// Done badges stamp down one per cue, each with a ring burst, and stay.
export const StampHit: React.FC<PrimitiveProps<{label: string; count: number}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const at = cuesOr(cues, p.count, 6, dur - 12);
  const spots = at.map((_, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const rows = Math.ceil(p.count / 2);
    return {x: (p.count === 1 ? 540 : col ? 740 : 340) + (random(`sx${i}`) - 0.5) * 60, y: STAGE.cy + (row - (rows - 1) / 2) * 230, r: (random(`sr${i}`) - 0.5) * 16};
  });
  return (
    <Shot dur={dur}>
      {spots.map((s, i) => {
        if (f < at[i]) return null;
        const hit = springFrom(f, at[i], {damping: 10, stiffness: 260, mass: 0.6});
        const t = interpolate(f - at[i], [0, 20], [0, 1], clamp);
        return (
          <div key={i} style={{position: 'absolute', left: s.x, top: s.y}}>
            <div style={{position: 'absolute', left: -60 * (1 + t), top: -60 * (1 + t), width: 120 * (1 + t), height: 120 * (1 + t), borderRadius: '50%', border: `${8 * (1 - t)}px solid ${th.ok}`, opacity: 1 - t}} />
            <div style={{transform: `translate(-50%, -50%) rotate(${s.r}deg) scale(${1.8 + 1.4 * (1 - hit)})`, opacity: Math.min(1, hit * 2)}}>
              <DonePill label={p.label} />
            </div>
          </div>
        );
      })}
      {at.map((a, i) => <Sfx key={i} at={a} name={i ? 'pop' : 'ding'} />)}
    </Shot>
  );
};
