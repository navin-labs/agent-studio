import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {parseAccent} from '../lib/text';
import {SIDE, TYPE} from '../theme';
import {useTheme} from '../themes';
import {cuesOr, Highlight, LINEAR, type PrimitiveProps, prog, Shot, springFrom, STAGE} from './atoms';

// A statement rises in; each run of *accent* words gets the highlighter on its cue.
export const HighlighterSwipe: React.FC<PrimitiveProps<{text: string}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const words = parseAccent(p.text);
  let k = -1;
  const span = words.map((w, i) => (w.accent ? (words[i - 1]?.accent ? k : ++k) : -1)); // which accent run each word is in
  const at = cuesOr(cues, k + 1, 12, dur - 10);
  const s = springFrom(f, 0, {damping: 16, stiffness: 160});
  return (
    <Shot dur={dur}>
      <div data-tb="statement" style={{position: 'absolute', top: STAGE.top, bottom: 1920 - STAGE.bottom, left: SIDE + 20, right: SIDE + 20, /* +20: headroom for the push-in zoom */ display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', columnGap: 22, fontFamily: TYPE.display, fontSize: 96, fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.08, color: th.ink, opacity: s, transform: `translateY(${(1 - s) * 50}px)`}}>
        {words.map((w, i) => (
          <span key={i} style={{display: 'inline-block'}}>
            {w.accent ? <Highlight p={prog(f, at[span[i]], 8, LINEAR)}>{w.w}</Highlight> : w.w}
          </span>
        ))}
      </div>
      {at.map((a, i) => <Sfx key={i} at={a} name="tick" volume={0.25} />)}
    </Shot>
  );
};
