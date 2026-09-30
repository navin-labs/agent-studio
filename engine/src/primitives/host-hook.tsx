import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {parseAccent} from '../lib/text';
import {TYPE} from '../theme';
import {useTheme} from '../themes';
import {Host, HostStage} from '../host/Host';
import {Highlight, LINEAR, type PrimitiveProps, prog, springFrom} from './atoms';

// Host format, recipe scene 1: the hook as huge type (words slam up, accent word highlighted),
// the host below reacting to the pain on cue 0 (default: when the accent lands).
export const HostHook: React.FC<PrimitiveProps<{text: string}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const words = parseAccent(p.text);
  const accentIdx = words.findIndex((w) => w.accent);
  const hit = cues[0] ?? 8 + Math.max(0, accentIdx) * 3;
  return (
    <HostStage dur={dur}>
      <div data-tb="headline" style={{position: 'absolute', top: 300, left: 70, right: 70, height: 480, display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', columnGap: 26, fontFamily: TYPE.display, fontSize: 118, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.02, color: th.ink}}>
        {words.map((w, i) => {
          const s = springFrom(f, 1 + i * 3, {damping: 13, stiffness: 190});
          return (
            <span key={i} style={{display: 'inline-block', opacity: s, transform: `translateY(${(1 - s) * 80}px) scale(${0.9 + 0.1 * s})`}}>
              {w.accent ? <Highlight p={prog(f, i === accentIdx ? hit : 8 + i * 3, 8, LINEAR)}>{w.w}</Highlight> : w.w}
            </span>
          );
        })}
      </div>
      <Host x={540} y={1290} scale={0.62} mood="pain" moodAt={hit} />
      <Sfx at={hit} name="pop" volume={0.4} />
    </HostStage>
  );
};
