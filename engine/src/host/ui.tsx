// UI mockup building blocks for host-format shots: an app window drawn in divs, a fake cursor, and the host's place beside it.
// Manual (wasteful) steps use the warn token (amber); automatic steps use the accent (lime).
import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {clamp, lerp, prog, springFrom} from '../primitives/atoms';
import {SIDE, TYPE} from '../theme';
import {alpha, useTheme} from '../themes';
import {Icon} from '../ui/Icon';
import {Host, HostStage, type Mood} from './Host';

export type Mode = 'manual' | 'auto';
export const WIN = {x: SIDE, y: 290, w: 1080 - 2 * SIDE, h: 660, bar: 70}; // the window sits above the host and the captions

export const Window: React.FC<{title: string; icon: string; mode: Mode; children: React.ReactNode}> = ({title, icon, mode, children}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const a = springFrom(f, 0, {damping: 15, stiffness: 170});
  return (
    <div data-box style={{position: 'absolute', left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, background: th.surface, border: `2px solid ${th.rule}`, borderRadius: 28, overflow: 'hidden', opacity: a, transform: `translateY(${(1 - a) * 60}px) scale(${0.94 + 0.06 * a})`, boxShadow: `0 30px 80px ${alpha(th.shadow, 0.6)}`}}>
      <div style={{height: WIN.bar, display: 'flex', alignItems: 'center', gap: 14, padding: '0 26px', borderBottom: `2px solid ${th.rule}`}}>
        {[0, 1, 2].map((k) => (
          <div key={k} style={{width: 14, height: 14, borderRadius: 7, background: th.rule}} />
        ))}
        <div style={{marginLeft: 10, color: th.muted, display: 'flex'}}>
          <Icon name={icon} size={26} stroke={2.4} />
        </div>
        <div style={{fontFamily: TYPE.data, fontSize: 24, fontWeight: 700, letterSpacing: '0.08em', color: th.muted}}>{title}</div>
        <div style={{marginLeft: 'auto', fontFamily: TYPE.data, fontSize: 20, fontWeight: 700, padding: '6px 14px', borderRadius: 999, background: mode === 'auto' ? th.accent : alpha(th.warn, 0.18), color: mode === 'auto' ? th.onAccent : th.warn}}>
          {mode === 'auto' ? 'AUTOMATIC' : 'BY HAND'}
        </div>
      </div>
      <div style={{position: 'relative', height: WIN.h - WIN.bar}}>{children}</div>
    </div>
  );
};

// A fake cursor gliding to each target just before its frame, with a click pop and ring on arrival.
export const Cursor: React.FC<{targets: {x: number; y: number; at: number}[]; until?: number}> = ({targets, until}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  if (!targets.length) return null;
  let x = targets[0].x + 140;
  let y = targets[0].y + 160;
  targets.forEach((t) => {
    const p = prog(f, t.at - 8, 8);
    x = lerp(x, t.x, p);
    y = lerp(y, t.y, p);
  });
  const last = [...targets].reverse().find((t) => f >= t.at);
  const click = last ? interpolate(f - last.at, [0, 3, 10], [0, 1, 0], clamp) : 0;
  const ring = last ? (f - last.at) / 14 : 1;
  const end = until ?? targets[targets.length - 1].at + 20;
  const on = prog(f, targets[0].at - 16, 6) * (1 - prog(f, end, 8));
  if (on <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 80, opacity: on}}>
      {ring < 1 ? <div style={{position: 'absolute', left: -40 * (0.4 + ring), top: -40 * (0.4 + ring), width: 80 * (0.4 + ring), height: 80 * (0.4 + ring), borderRadius: '50%', border: `4px solid ${th.warn}`, opacity: 1 - ring}} /> : null}
      <svg width={54} height={60} viewBox="0 0 24 26" style={{transform: `scale(${1 - 0.15 * click})`, transformOrigin: '0 0', filter: `drop-shadow(0 6px 10px ${alpha(th.shadow, 0.6)})`}}>
        <path d="M2 1 L2 20 L7 15.5 L10.5 23 L14 21.5 L10.5 14 L17 14 Z" fill={th.ink} stroke={th.bg} strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
      {targets.map((t, k) => <Sfx key={k} at={t.at} name="tick" volume={0.35} />)}
    </div>
  );
};

// A pill tag on a row: amber for manual work, lime for automatic.
export const Tag: React.FC<{label: string; mode: Mode; p: number}> = ({label, mode, p}) => {
  const th = useTheme();
  return p <= 0 ? null : (
    <div style={{fontFamily: TYPE.data, fontSize: 22, fontWeight: 800, padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap', background: mode === 'auto' ? th.accent : alpha(th.warn, 0.2), color: mode === 'auto' ? th.onAccent : th.warn, opacity: Math.min(1, p * 2), transform: `scale(${0.7 + 0.3 * p})`}}>
      {label}
    </div>
  );
};

// Every UI shot: night stage, the window, and the host bottom-right leaning toward it (a groan when manual, a hop when auto).
export const UiShot: React.FC<{dur: number; mode: Mode; moodAt: number; children: React.ReactNode}> = ({dur, mode, moodAt, children}) => {
  const mood: Mood = mode === 'auto' ? 'happy' : 'pain';
  return (
    <HostStage dur={dur}>
      {children}
      <Host x={880} y={1300} scale={0.4} look={-1} mood={mood} moodAt={moodAt} />
    </HostStage>
  );
};
