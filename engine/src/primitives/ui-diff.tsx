import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {alpha, useTheme} from '../themes';
import {type Mode, Tag, UiShot, Window, WIN} from '../host/ui';
import {clamp, cuesOr, type PrimitiveProps} from './atoms';

type Line = {op: 'add' | 'del' | 'same'; text: string};

// A before/after view. Lines reveal on cues: removed manual steps are struck through in amber, added automatic steps glow lime.
export const UiDiff: React.FC<PrimitiveProps<{file: string; lines: Line[]}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const at = cuesOr(cues, p.lines.length, 10, dur - 16);
  const LINE_H = Math.min(100, (WIN.h - WIN.bar - 44) / p.lines.length); // lines fill the window
  const mode: Mode = 'auto';
  return (
    <UiShot dur={dur} mode={mode} moodAt={at[at.length - 1]}>
      <Window title={p.file} icon="file" mode={mode}>
        {p.lines.map((l, i) => {
          const a = interpolate(f, [at[i], at[i] + 6], [0, 1], clamp);
          const strike = l.op === 'del' ? interpolate(f, [at[i] + 4, at[i] + 12], [0, 1], clamp) : 0;
          const col = l.op === 'add' ? th.accent : l.op === 'del' ? th.warn : th.muted;
          return (
            <div key={i} style={{position: 'absolute', left: 22, right: 22, top: 22 + i * LINE_H, height: LINE_H - 8, display: 'flex', alignItems: 'center', gap: 18, padding: '0 18px', borderRadius: 12, opacity: a, transform: `translateX(${(1 - a) * -40}px)`, background: l.op === 'same' ? 'transparent' : alpha(col, 0.12)}}>
              <div style={{width: 26, fontFamily: TYPE.data, fontSize: 38, fontWeight: 800, color: col}}>{l.op === 'add' ? '+' : l.op === 'del' ? '−' : ' '}</div>
              <div style={{position: 'relative', fontFamily: TYPE.data, fontSize: 32, fontWeight: 700, color: l.op === 'same' ? th.muted : th.ink, whiteSpace: 'nowrap'}}>
                {l.text}
                {l.op === 'del' ? <div style={{position: 'absolute', left: 0, top: '52%', height: 4, width: `${strike * 100}%`, background: th.warn}} /> : null}
              </div>
              {l.op === 'add' ? <div style={{marginLeft: 'auto'}}><Tag label="AUTO" mode="auto" p={a} /></div> : null}
            </div>
          );
        })}
      </Window>
      {at.map((t, i) => (p.lines[i].op === 'same' ? null : <Sfx key={i} at={t} name={p.lines[i].op === 'add' ? 'pop' : 'tick'} volume={0.3} />))}
    </UiShot>
  );
};
