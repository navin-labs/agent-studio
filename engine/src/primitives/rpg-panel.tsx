import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {useTheme} from '../themes';
import {cuesOr, type PrimitiveProps, Shot} from './atoms';

type Stat = {label: string; value: number};
const SEGMENTS = 10;

// An 8-bit status screen: stepped stat bars fill one per cue in 10 blocks, then a dialogue box types its lines on twos.
// Everything moves in 2-frame steps, like an old console.
export const RpgPanel: React.FC<PrimitiveProps<{title: string; stats: Stat[]; lines: string[]}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const s = f - (f % 2);
  const at = cuesOr(cues, p.stats.length, 6, Math.round(dur * 0.45));
  const talk = at.at(-1)! + 14;
  const text = p.lines.join(' ');
  const typed = Math.max(0, Math.min(text.length, Math.floor((s - talk) / 2) * 2));
  const box = {border: `6px solid ${th.ink}`, outline: `6px solid ${th.surface}`, boxShadow: `0 0 0 12px ${th.ink}`, background: th.surface} as const;
  return (
    <Shot dur={dur} push={0}>
      <div style={{position: 'absolute', left: 90, right: 90, top: 330, padding: '30px 36px', ...box}}>
        <div data-tb="title" style={{fontFamily: TYPE.display, fontSize: 40, color: th.ink, letterSpacing: '0.04em', marginBottom: 26, whiteSpace: 'nowrap'}}>{p.title}</div>
        {p.stats.map((st, i) => {
          const filled = s < at[i] ? 0 : Math.min(Math.round((st.value / 99) * SEGMENTS), Math.floor((s - at[i]) / 2) + 1);
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: i ? 18 : 0}}>
              <div style={{width: 150, fontFamily: TYPE.data, fontSize: 30, fontWeight: 700, color: th.muted, whiteSpace: 'nowrap'}}>{st.label}</div>
              <div style={{display: 'flex', gap: 6}}>
                {Array.from({length: SEGMENTS}, (_, k) => <div key={k} style={{width: 40, height: 34, background: k < filled ? (i % 2 ? th.flow : th.accent) : th.rule}} />)}
              </div>
              <div style={{width: 70, textAlign: 'right', fontFamily: TYPE.data, fontSize: 30, fontWeight: 700, color: th.ink}}>{s < at[i] ? '--' : Math.round((st.value * Math.min(filled, SEGMENTS)) / Math.max(1, Math.round((st.value / 99) * SEGMENTS)))}</div>
            </div>
          );
        })}
      </div>
      {s >= talk ? (
        <div style={{position: 'absolute', left: 90, right: 90, top: 770, minHeight: 220, padding: '28px 34px', ...box}}>
          <div data-tb="dialogue" style={{fontFamily: TYPE.data, fontSize: 36, fontWeight: 700, lineHeight: 1.35, color: th.ink}}>
            {text.slice(0, typed)}
            {typed >= text.length && Math.floor(f / 10) % 2 ? <span style={{color: th.accent}}> ▼</span> : null}
          </div>
        </div>
      ) : null}
      {at.map((a, i) => <Sfx key={i} at={a} name="tick" />)}
      <Sfx at={talk} name="pop" />
    </Shot>
  );
};
