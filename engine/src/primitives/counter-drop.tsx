import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {card, useTheme} from '../themes';
import {Icon} from '../ui/Icon';
import {clamp, EASE, type PrimitiveProps, Shot, springFrom, STAGE} from './atoms';

type P = {label: string; icon: string; from: number; to: number; tone: 'alert' | 'ok'};

// A status card; its number ticks from `from` to `to` starting on cue 0. tone ok: the icon turns ok once counting starts.
export const CounterDrop: React.FC<PrimitiveProps<P>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const start = cues[0] ?? 14;
  const end = Math.max(start + 1, Math.min(start + 45, dur - 10));
  const n = Math.round(interpolate(f, [start, end], [p.from, p.to], {...clamp, easing: EASE}));
  const appear = springFrom(f, 0, {damping: 14, stiffness: 180});
  const col = p.tone === 'ok' && f >= start ? th.ok : th.alert;
  const ticks = Math.abs(p.to - p.from);
  const step = Math.max(1, Math.ceil(ticks / 12)); // at most ~12 tick sounds
  return (
    <Shot dur={dur}>
      <div style={{position: 'absolute', top: STAGE.cy - 110, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: appear, transform: `translateY(${(1 - appear) * -40}px) scale(1.6)`}}>
        <div data-box style={{...card(th), display: 'flex', alignItems: 'center', gap: 18, padding: '12px 28px 12px 14px', borderRadius: 18}}>
          <div style={{width: 56, height: 56, borderRadius: 12, border: `3px solid ${th.ink}`, background: col, color: th.surface, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Icon name={p.icon} size={30} stroke={2.5} />
          </div>
          <div style={{fontFamily: TYPE.data, fontSize: 28, fontWeight: 700, color: th.ink}}>{p.label}</div>
          <div style={{fontFamily: TYPE.display, fontSize: 64, fontWeight: 900, letterSpacing: '-0.04em', color: th.ink, minWidth: 110, textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>{n}</div>
        </div>
        <div style={{marginTop: 14, fontFamily: TYPE.data, fontSize: 20, fontWeight: 600, color: th.muted}}>EXAMPLE DATA</div>
      </div>
      {Array.from({length: Math.floor(ticks / step)}, (_, i) => (
        <Sfx key={i} at={start + Math.round(((end - start) * (i + 1) * step) / Math.max(1, ticks))} name="tick" volume={0.2} />
      ))}
    </Shot>
  );
};
