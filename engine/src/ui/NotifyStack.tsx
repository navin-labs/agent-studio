import React from 'react';
import {interpolate, useVideoConfig} from 'remotion';
import {Sfx, springAt, useF} from '../lib/frame';
import {AVATAR_COLORS, C, FONT} from '../theme';
import type {Notif} from '../types';
import {Icon} from './Icon';

const H = 184;
const GAP = 20;

export const NotifyStack: React.FC<{items: Notif[]; startAt?: number; width?: number; pace?: number}> = ({items, startAt = 8, width = 888, pace}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const n = items.length;
  const STAGGER = pace ? Math.max(14, Math.min(36, Math.round((pace * 0.6) / n))) : 16;
  const at = items.map((_, i) => startAt + i * STAGGER);
  const prog = at.map((a) => springAt(frame, a, fps, {damping: 15, stiffness: 170}));

  return (
    <div style={{position: 'relative', width, height: n * H + (n - 1) * GAP, fontFamily: FONT}}>
      {items.map((it, i) => {
        const p = prog[i];
        // notifications stack top-down in the order they happen
        const y = i * (H + GAP);
        const color = it.color ?? AVATAR_COLORS[i % AVATAR_COLORS.length];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: y,
              height: H,
              borderRadius: 44,
              background: 'rgba(246,247,249,0.97)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
              display: 'flex',
              gap: 24,
              padding: '28px 30px',
              alignItems: 'flex-start',
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [-50, 0])}px) scale(${0.94 + 0.06 * p})`,
            }}
          >
            <div style={{width: 76, height: 76, borderRadius: 20, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <Icon name={it.icon ?? 'bell'} size={40} color="#fff" />
            </div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                <span style={{fontSize: 22, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.cardMuted}}>{it.app}</span>
                <div style={{flex: 1}} />
                <span style={{fontSize: 22, color: C.cardMuted, fontWeight: 600}}>now</span>
              </div>
              <div style={{fontSize: 33, fontWeight: 800, color: C.cardText, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                {it.title}
              </div>
              {it.body ? (
                <div style={{fontSize: 27, color: '#4B5563', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{it.body}</div>
              ) : null}
            </div>
          </div>
        );
      })}
      {at.map((a, i) => (
        <Sfx key={i} at={a} name="ding" volume={0.18} />
      ))}
    </div>
  );
};
