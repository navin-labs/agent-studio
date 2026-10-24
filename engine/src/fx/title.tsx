// title: a kinetic headline. Each word drops in with weight (overshoot and settle), one after another; *marked* words get the
// accent highlighter swept behind them once they land. Set big: a phone reads it in a feed.
import React from 'react';
import {BACK, k} from '../films/kit';
import {useTheme} from '../themes';
import type {FxProps} from './registry';

type P = {text: string; size?: number};

export const Title: React.FC<FxProps<P>> = ({t, p}) => {
  const th = useTheme();
  const words = p.text.split(/\s+/).map((w) => ({w: w.replace(/\*/g, ''), mark: /^\*.*\*[.,!?]?$/.test(w)}));
  const size = p.size ?? 118;
  const GAP = 0.13;
  return (
    <div style={{position: 'absolute', left: 140, right: 140, top: 560, display: 'flex', flexWrap: 'wrap', gap: '0 28px', fontFamily: '"Inter Tight", Inter, sans-serif', fontWeight: 900, fontSize: size, lineHeight: 1.02, letterSpacing: '-0.035em', color: th.ink}}>
      {words.map(({w, mark}, i) => {
        const at = -0.2 + i * GAP; // the first word is already landing on frame 0
        const y = k(t, [at, at + 0.38], [70, 0], BACK);
        const o = k(t, [at, at + 0.12], [0, 1]);
        const hl = k(t, [at + 0.3, at + 0.62], [0, 1]);
        return (
          <span key={i} style={{position: 'relative', transform: `translateY(${y}px)`, opacity: o, display: 'inline-block'}}>
            {mark && <span style={{position: 'absolute', left: -8, right: -8, top: '18%', bottom: '8%', background: th.accent, transform: `scaleX(${hl})`, transformOrigin: 'left', zIndex: -1}} />}
            <span style={{color: mark ? th.onAccent : th.ink, position: 'relative'}}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};
