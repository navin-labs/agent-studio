import React from 'react';
import {interpolate, useVideoConfig} from 'remotion';
import {Sfx, springAt, useF} from '../lib/frame';
import {C} from '../theme';
import type {MathLine} from '../types';
import {Badge, clamp01, panelStyle} from './common';

// "₹1,20,000 a year" -> animates the number from 0 using Indian digit grouping.
const countUp = (value: string, t: number) => {
  const m = value.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return value;
  const target = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(target)) return value;
  const cur = Math.round(target * t);
  return `${m[1]}${cur.toLocaleString('en-IN')}${m[3]}`;
};

export const MathCard: React.FC<{lines: MathLine[]; total: MathLine; note?: string; startAt?: number; width?: number}> = ({
  lines,
  total,
  note = 'Hypothetical example. Your numbers will differ.',
  startAt = 6,
  width = 888,
}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const totalAt = startAt + 12 + lines.length * 12 + 6;
  const tp = springAt(frame, totalAt, fps);
  const count = clamp01((frame - totalAt) / 24);
  const eased = 1 - Math.pow(1 - count, 3);

  return (
    <div style={{...panelStyle, width, padding: '40px 44px'}}>
      <Badge tone="amber" dark>
        Example
      </Badge>
      <div style={{marginTop: 26}}>
        {lines.map((l, i) => {
          const p = springAt(frame, startAt + 12 + i * 12, fps);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 20,
                padding: '20px 0',
                borderBottom: `2px solid ${C.panelLine}`,
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)`,
              }}
            >
              <span style={{fontSize: 38, fontWeight: 600, color: '#C9D1DC', flex: 1}}>{l.label}</span>
              <span style={{fontSize: 42, fontWeight: 800, color: C.text}}>{l.value}</span>
            </div>
          );
        })}
      </div>
      <div style={{marginTop: 30, opacity: tp, transform: `translateY(${interpolate(tp, [0, 1], [20, 0])}px)`}}>
        <div style={{fontSize: 30, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em'}}>{total.label}</div>
        <div style={{fontSize: 92, fontWeight: 900, color: C.accent, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 6}}>
          {countUp(total.value, eased)}
        </div>
        <div style={{fontSize: 25, color: C.faint, marginTop: 14, fontWeight: 500}}>{note}</div>
      </div>
      {lines.map((_, i) => (
        <Sfx key={i} at={startAt + 12 + i * 12} name="tick" volume={0.2} />
      ))}
      <Sfx at={totalAt} name="ding" />
    </div>
  );
};
