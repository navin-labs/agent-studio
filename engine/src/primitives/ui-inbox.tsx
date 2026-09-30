import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {TYPE} from '../theme';
import {alpha, useTheme} from '../themes';
import {Cursor, type Mode, Tag, UiShot, Window, WIN} from '../host/ui';
import {clamp, cuesOr, type PrimitiveProps, springFrom} from './atoms';

type Row = {from: string; subject: string};

// An inbox. manual: a cursor opens each email in turn (amber, OPENED). auto: each email is read on its own (lime, READ).
export const UiInbox: React.FC<PrimitiveProps<{title: string; rows: Row[]; mode: Mode}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const at = cuesOr(cues, p.rows.length, 16, dur - 16);
  const ROW_H = Math.min(136, (WIN.h - WIN.bar - 44) / p.rows.length); // rows fill the window
  const rowY = (i: number) => WIN.y + WIN.bar + 22 + i * ROW_H;
  return (
    <UiShot dur={dur} mode={p.mode} moodAt={at[at.length - 1]}>
      <Window title={p.title} icon="inbox" mode={p.mode}>
        {p.rows.map((r, i) => {
          const a = springFrom(f, 4 + i * 3, {damping: 15, stiffness: 180});
          const done = interpolate(f, [at[i], at[i] + 6], [0, 1], clamp);
          const tint = p.mode === 'auto' ? th.accent : th.warn;
          return (
            <div key={i} style={{position: 'absolute', left: 22, right: 22, top: 22 + i * ROW_H, height: ROW_H - 12, display: 'flex', alignItems: 'center', gap: 20, padding: '0 20px', borderRadius: 18, opacity: a, transform: `translateX(${(1 - a) * 60}px)`, background: done > 0 ? alpha(tint, 0.1 * done) : 'transparent', borderLeft: `6px solid ${done > 0.5 ? tint : 'transparent'}`}}>
              <div style={{width: 72, height: 72, borderRadius: 36, flexShrink: 0, background: th.flow, color: th.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPE.title, fontWeight: 800, fontSize: 32}}>{r.from.slice(0, 1)}</div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontFamily: TYPE.title, fontSize: 36, fontWeight: 800, color: th.ink, whiteSpace: 'nowrap'}}>{r.from}</div>
                <div style={{fontFamily: TYPE.caption, fontSize: 29, fontWeight: 600, color: th.muted, whiteSpace: 'nowrap', marginTop: 2}}>{r.subject}</div>
              </div>
              <Tag label={p.mode === 'auto' ? 'READ ✓' : 'OPENED'} mode={p.mode} p={done} />
            </div>
          );
        })}
      </Window>
      {p.mode === 'manual' ? <Cursor targets={at.map((t, i) => ({x: WIN.x + WIN.w - 190, y: rowY(i) + 40, at: t}))} /> : null}
    </UiShot>
  );
};
