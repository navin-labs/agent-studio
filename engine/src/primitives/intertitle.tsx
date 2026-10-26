import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {useTheme} from '../themes';
import {clamp, type PrimitiveProps, Shot, STAGE} from './atoms';

// beats inside the card: frame of the line, then fractions of the shot (density.ts uses the same numbers)
const INTERTITLE_BEATS = {text: 8, sub: 0.4, flourish: 0.72};

// A silent-film title card: an iris opens on a double-ruled frame, the line appears, the sub line follows, then a flourish draws.
export const Intertitle: React.FC<PrimitiveProps<{text: string; sub?: string}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const iris = interpolate(f, [0, 10], [0, 140], clamp);
  const subAt = cues[0] ?? Math.round(dur * INTERTITLE_BEATS.sub);
  const flAt = Math.round(dur * INTERTITLE_BEATS.flourish);
  const text = interpolate(f, [INTERTITLE_BEATS.text, INTERTITLE_BEATS.text + 8], [0, 1], clamp);
  const sub = interpolate(f, [subAt, subAt + 8], [0, 1], clamp);
  const fl = interpolate(f, [flAt, flAt + 14], [0, 1], clamp);
  return (
    <Shot dur={dur} push={0.02}>
      <div style={{position: 'absolute', inset: 0, clipPath: `circle(${iris}% at 540px ${STAGE.cy}px)`}}>
        <div style={{position: 'absolute', left: 90, right: 90, top: 340, bottom: 1920 - 1020, border: `4px solid ${th.ink}`, outline: `2px solid ${th.ink}`, outlineOffset: 14, background: th.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 70px', textAlign: 'center'}}>
          <div data-tb="title" style={{fontFamily: TYPE.display, fontSize: 76, lineHeight: 1.15, color: th.ink, opacity: text}}>{p.text}</div>
          {p.sub ? <div data-tb="sub" style={{marginTop: 34, fontFamily: TYPE.data, fontSize: 34, color: th.muted, opacity: sub}}>{p.sub}</div> : null}
          <div style={{marginTop: 40, width: 360 * fl, height: 4, background: th.ink}} />
          <div style={{marginTop: 10, width: 220 * fl, height: 2, background: th.ink}} />
        </div>
      </div>
      <Sfx at={0} name="whoosh" volume={0.25} />
      {p.sub ? <Sfx at={subAt} name="tick" /> : null}
    </Shot>
  );
};
