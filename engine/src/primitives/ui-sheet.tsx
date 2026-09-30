import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {alpha, useTheme} from '../themes';
import {Cursor, type Mode, Tag, UiShot, Window, WIN} from '../host/ui';
import {clamp, cuesOr, type PrimitiveProps} from './atoms';

const TYPE_FRAMES = 7; // frames to type one cell by hand

// A spreadsheet filling up. manual: a cursor types cell by cell (amber while typing). auto: each row lands whole (lime flash).
export const UiSheet: React.FC<PrimitiveProps<{file: string; columns: string[]; rows: string[][]; mode: Mode}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const n = p.columns.length;
  const ROW_H = Math.min(120, (WIN.h - WIN.bar - 44) / (p.rows.length + 1)); // header + rows fill the window
  const at = cuesOr(cues, p.rows.length, 12, dur - 18 - (p.mode === 'manual' ? n * TYPE_FRAMES : 0));
  const colW = (WIN.w - 44 - 110) / n;
  const cellX = (j: number) => 22 + j * colW;
  const rowTop = (i: number) => 22 + (i + 1) * ROW_H;
  const cellAt = (i: number, j: number) => at[i] + (p.mode === 'manual' ? j * TYPE_FRAMES : 0);
  return (
    <UiShot dur={dur} mode={p.mode} moodAt={at[at.length - 1]}>
      <Window title={p.file} icon="sheet" mode={p.mode}>
        {p.columns.map((c, j) => (
          <div key={j} style={{position: 'absolute', left: cellX(j) + 14, top: 22, height: ROW_H, display: 'flex', alignItems: 'center', fontFamily: TYPE.data, fontSize: 25, fontWeight: 700, letterSpacing: '0.06em', color: th.muted}}>{c}</div>
        ))}
        {p.rows.map((r, i) => (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: 22, right: 22, top: rowTop(i), height: 2, background: th.rule}} />
            {p.mode === 'auto' ? <div style={{position: 'absolute', left: 22, right: 22, top: rowTop(i) + 4, height: ROW_H - 8, borderRadius: 12, background: alpha(th.accent, 0.35 * interpolate(f, [at[i], at[i] + 4, at[i] + 20], [0, 1, 0], clamp))}} /> : null}
            {r.map((cell, j) => {
              const t0 = cellAt(i, j);
              const chars = p.mode === 'manual' ? Math.floor(interpolate(f, [t0, t0 + TYPE_FRAMES - 1], [0, cell.length], clamp)) : f >= t0 ? cell.length : 0;
              const typing = p.mode === 'manual' && f >= t0 && f < t0 + TYPE_FRAMES + 3;
              return (
                <div key={j} style={{position: 'absolute', left: cellX(j) + 4, top: rowTop(i) + 10, width: colW - 8, height: ROW_H - 20, padding: '0 10px', borderRadius: 10, display: 'flex', alignItems: 'center', background: typing ? alpha(th.warn, 0.22) : 'transparent', outline: typing ? `3px solid ${th.warn}` : 'none', fontFamily: TYPE.data, fontSize: 32, fontWeight: 700, color: th.ink, whiteSpace: 'nowrap'}}>
                  {cell.slice(0, chars)}
                  {typing ? <span style={{width: 3, height: 38, marginLeft: 2, background: th.warn}} /> : null}
                </div>
              );
            })}
            <div style={{position: 'absolute', right: 30, top: rowTop(i) + ROW_H / 2 - 18}}>
              <Tag label={p.mode === 'auto' ? 'ADDED ✓' : 'TYPED'} mode={p.mode} p={interpolate(f, [cellAt(i, n - 1) + 4, cellAt(i, n - 1) + 10], [0, 1], clamp)} />
            </div>
            {p.mode === 'auto' ? <Sfx at={at[i]} name="pop" volume={0.3} /> : null}
          </React.Fragment>
        ))}
      </Window>
      {p.mode === 'manual'
        ? <Cursor targets={p.rows.flatMap((_, i) => p.columns.map((__, j) => ({x: WIN.x + cellX(j) + colW / 2, y: WIN.y + WIN.bar + rowTop(i) + 40, at: cellAt(i, j)})))} />
        : null}
    </UiShot>
  );
};
