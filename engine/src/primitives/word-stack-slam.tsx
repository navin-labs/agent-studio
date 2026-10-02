import React from 'react';
import {useCurrentFrame} from 'remotion';
import {parseAccent} from '../lib/text';
import {SIDE, TYPE} from '../theme';
import {useTheme} from '../themes';
import {Highlight, LINEAR, type PrimitiveProps, prog, Shot, springFrom, STAGE} from './atoms';

// Headline words slam up one by one (3 frames apart); *accent* words get the highlighter.
export const WordStackSlam: React.FC<PrimitiveProps<{text: string}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const words = parseAccent(p.text);
  const firstAccent = words.findIndex((w) => w.accent);
  return (
    <Shot dur={dur}>
      <div data-tb="headline" style={{position: 'absolute', top: STAGE.top, bottom: 1920 - STAGE.bottom, left: SIDE + 30, right: SIDE + 30, /* +30: headroom for the 6% push-in zoom (needs 24+) */ display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', columnGap: 28, fontFamily: TYPE.display, fontSize: 136, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.02, color: th.ink}}>
        {words.map((w, i) => {
          const s = springFrom(f, 1 + i * 3, {damping: 14, stiffness: 180});
          const at = i === firstAccent && cues[0] !== undefined ? cues[0] : 8 + i * 3;
          return (
            <span key={i} style={{display: 'inline-block', opacity: s, transform: `translateY(${(1 - s) * 70}px)`}}>
              {w.accent ? <Highlight p={prog(f, at, 8, LINEAR)}>{w.w}</Highlight> : w.w}
            </span>
          );
        })}
      </div>
    </Shot>
  );
};
