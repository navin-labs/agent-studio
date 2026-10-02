import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {alpha, card, useTheme} from '../themes';
import {Icon} from '../ui/Icon';
import {clamp, cuesOr, type PrimitiveProps, Shot, springFrom, STAGE} from './atoms';

type Note = {icon: string; from: string; text: string};
type P = {time: string; notes: Note[]};

const W = 600;
const H = STAGE.bottom - STAGE.top;
const NOTE_H = 108;

// A phone lock screen fills with notifications, one per cue, newest on top; the phone buzzes on each and the badge counts up.
export const PhoneBuzz: React.FC<PrimitiveProps<P>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const at = cuesOr(cues, p.notes.length, 8, dur - 14);
  const shown = at.filter((t) => f >= t).length;
  const last = shown ? at[shown - 1] : -99;
  const buzz = f - last < 8 ? Math.sin((f - last) * 2.6) * (8 - (f - last)) * 1.6 : 0;
  const appear = springFrom(f, 0, {damping: 15, stiffness: 170});
  return (
    <Shot dur={dur}>
      <div data-box style={{...card(th), position: 'absolute', top: STAGE.top, left: (1080 - W) / 2, width: W, height: H, borderRadius: 56, boxSizing: 'border-box', overflow: 'hidden', background: th.surface, opacity: appear, transform: `translateY(${(1 - appear) * 60}px) translateX(${buzz}px) rotate(${buzz * 0.25}deg)`}}>
        <div style={{position: 'absolute', top: 18, left: '50%', width: 120, height: 30, marginLeft: -60, borderRadius: 15, background: th.ink}} />
        <div style={{position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center', fontFamily: TYPE.display, fontSize: 96, fontWeight: 900, letterSpacing: '-0.04em', color: th.ink}}>{p.time}</div>
        {shown ? (
          <div style={{position: 'absolute', top: 82, right: 34, minWidth: 54, height: 54, borderRadius: 27, background: th.alert, color: th.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPE.data, fontSize: 30, fontWeight: 800}}>{shown}</div>
        ) : null}
        {p.notes.map((n, i) => {
          if (f < at[i]) return null;
          const slot = shown - 1 - i; // newest on top
          const inP = interpolate(f, [at[i], at[i] + 6], [0, 1], clamp);
          const y = 190 + slot * (NOTE_H + 10);
          return (
            <div key={i} style={{position: 'absolute', left: 22, right: 22, top: y, height: NOTE_H, borderRadius: 22, background: alpha(th.ink, 0.07), border: `2px solid ${th.rule}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 18px', boxSizing: 'border-box', opacity: inP, transform: `translateY(${(1 - inP) * -30}px) scale(${0.9 + inP * 0.1})`}}>
              <div style={{width: 56, height: 56, flex: 'none', borderRadius: 14, background: th.flow, color: th.surface, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <Icon name={n.icon} size={30} stroke={2.4} />
              </div>
              <div style={{minWidth: 0}}>
                <div style={{fontFamily: TYPE.title, fontSize: 32, fontWeight: 800, color: th.ink, whiteSpace: 'nowrap'}}>{n.from}</div>
                <div style={{fontFamily: TYPE.title, fontSize: 28, fontWeight: 600, color: th.muted, whiteSpace: 'nowrap'}}>{n.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      {at.map((t, i) => (
        <Sfx key={i} at={t} name="tick" volume={0.3} />
      ))}
    </Shot>
  );
};
