import React from 'react';
import {interpolate, useVideoConfig} from 'remotion';
import {Sfx, springAt, useF} from '../lib/frame';
import {C} from '../theme';
import {Badge, cardStyle, clamp01, statusTone} from './common';
import {Icon} from './Icon';

const HEAD = 90;
const COLHEAD = 66;
const ROW = 84;

export const SheetCard: React.FC<{
  file?: string;
  columns: string[];
  rows: string[][];
  highlight?: number[];
  fill?: boolean;
  startAt?: number;
  width?: number;
  highlightAt?: number;
}> = ({file = 'Report.xlsx', columns, rows, highlight = [], fill, startAt = 6, width = 888, highlightAt}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const per = fill ? 16 : 6;
  const rowStart = rows.map((_, i) => startAt + 8 + i * per);
  const hlStart = Math.max(startAt + 8 + rows.length * per + 6, highlightAt ?? 0);
  const flex = columns.map((_, i) => (i === 0 ? 1.5 : 1));
  const headP = springAt(frame, startAt, fps);

  const cell = (text: string, ci: number, visibleChars: number) => {
    const shown = text.slice(0, visibleChars);
    const tone = statusTone(text);
    const isStatus = tone && /status|state|payment|stage/i.test(columns[ci] ?? '');
    if (isStatus && visibleChars >= text.length) {
      return <Badge tone={tone!}>{text}</Badge>;
    }
    return (
      <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: ci === 0 ? 700 : 500}}>{shown}</span>
    );
  };

  return (
    <div style={{...cardStyle, width, opacity: headP, transform: `translateY(${(1 - headP) * 30}px)`}}>
      <div
        style={{
          height: HEAD,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 30px',
          background: '#FFFFFF',
          borderBottom: `2px solid ${C.cardLine}`,
        }}
      >
        <div style={{width: 48, height: 48, borderRadius: 12, background: '#1E8E3E', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Icon name="sheet" size={30} color="#fff" />
        </div>
        <span style={{fontSize: 30, fontWeight: 800}}>{file}</span>
        <div style={{flex: 1}} />
        {fill ? <Badge tone="blue">Filling itself</Badge> : <Badge>Sample data</Badge>}
      </div>
      <div style={{display: 'flex', height: COLHEAD, alignItems: 'center', padding: '0 30px', background: C.cardHead, gap: 20}}>
        {columns.map((c, i) => (
          <div
            key={i}
            style={{flex: flex[i], fontSize: 21, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.cardMuted, minWidth: 0}}
          >
            {c}
          </div>
        ))}
      </div>
      {rows.map((r, ri) => {
        const p = springAt(frame, rowStart[ri], fps, {damping: 18, stiffness: 220});
        const hlIndex = highlight.indexOf(ri);
        const hl = hlIndex >= 0 ? springAt(frame, hlStart + hlIndex * 8, fps) : 0;
        const typing = fill ? clamp01((frame - rowStart[ri]) / 12) : 1;
        const active = fill && frame >= rowStart[ri] && frame < rowStart[ri] + 14;
        return (
          <div
            key={ri}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              height: ROW,
              padding: '0 30px',
              gap: 20,
              borderBottom: `2px solid ${C.cardLine}`,
              fontSize: 28,
              background: hl > 0 ? `rgba(229,72,77,${0.1 * hl})` : active ? C.blueSoft : 'transparent',
              opacity: fill ? (frame >= rowStart[ri] ? 1 : 0.0) : p,
              transform: fill ? 'none' : `translateY(${interpolate(p, [0, 1], [16, 0])}px)`,
            }}
          >
            {hl > 0 ? <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 8 * hl, background: C.red}} /> : null}
            {active ? <div style={{position: 'absolute', inset: 0, border: `3px solid ${C.accent}`, borderRadius: 4}} /> : null}
            {r.map((t, ci) => (
              <div key={ci} style={{flex: flex[ci], minWidth: 0, display: 'flex'}}>
                {cell(t, ci, Math.ceil(t.length * typing))}
              </div>
            ))}
          </div>
        );
      })}
      {rowStart.map((s, i) => (
        <Sfx key={i} at={s} name={fill ? 'tick' : 'pop'} volume={fill ? 0.2 : 0.14} />
      ))}
      {highlight.length ? <Sfx at={hlStart} name="pop" volume={0.25} /> : null}
    </div>
  );
};
