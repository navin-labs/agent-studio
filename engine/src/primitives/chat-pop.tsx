import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {Bubble, type PrimitiveProps, Shot, springFrom, STAGE} from './atoms';

// A chat bubble pops in on cue 0 (default frame 8): app name, message, read ticks.
export const ChatPop: React.FC<PrimitiveProps<{app: string; text: string}>> = ({p, dur, cues}) => {
  const f = useCurrentFrame();
  const at = cues[0] ?? 8;
  return (
    <Shot dur={dur}>
      <div style={{position: 'absolute', left: 540, top: STAGE.cy, transform: 'translate(-50%, -50%) scale(1.7)'}}>
        <Bubble app={p.app} text={p.text} p={springFrom(f, at, {damping: 12, stiffness: 160})} style={{position: 'relative', width: 380}} />
      </div>
      <Sfx at={at} name="pop" />
    </Shot>
  );
};
