import React from 'react';
import {interpolate, useVideoConfig} from 'remotion';
import {Sfx, springAt, useF} from '../lib/frame';
import {C, FONT} from '../theme';
import type {Step} from '../types';
import {clamp01} from './common';
import {Icon} from './Icon';

export const StepsList: React.FC<{steps: Step[]; strike?: boolean; startAt?: number; width?: number; pace?: number; strikeAt?: number}> = ({
  steps,
  strike,
  startAt = 6,
  width = 888,
  pace,
  strikeAt,
}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const n = steps.length;
  const STAGGER = pace ? Math.max(10, Math.min(24, Math.round((pace * 0.6) / n))) : 10;
  const rowH = n > 5 ? 100 : 124;
  const strikeStart = Math.max(startAt + n * STAGGER + 10, strikeAt ?? 0);

  return (
    <div style={{width, display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT}}>
      {steps.map((s, i) => {
        const at = startAt + i * STAGGER;
        const p = springAt(frame, at, fps, {damping: 16, stiffness: 190});
        const st = strike ? clamp01((frame - (strikeStart + i * 6)) / 8) : 0;
        return (
          <div
            key={i}
            style={{
              height: rowH,
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              padding: '0 28px',
              borderRadius: 26,
              background: C.panel,
              border: `2px solid ${st > 0 ? `rgba(229,72,77,${0.5 * st})` : C.panelLine}`,
              opacity: p * (1 - 0.45 * st),
              transform: `translateX(${interpolate(p, [0, 1], [-60, 0])}px)`,
            }}
          >
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: 22,
                background: st > 0 ? `rgba(229,72,77,${0.18 * st})` : 'rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {s.icon ? (
                <Icon name={s.icon} size={40} color={st > 0.5 ? '#FF7B7F' : C.text} />
              ) : (
                <span style={{fontSize: 30, fontWeight: 800, color: C.text}}>{i + 1}</span>
              )}
            </div>
            <div style={{position: 'relative', flex: 1}}>
              <span style={{fontSize: 46, fontWeight: 800, color: C.text, letterSpacing: '-0.015em'}}>{s.label}</span>
              {st > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: -6,
                    top: '52%',
                    height: 6,
                    borderRadius: 3,
                    background: C.red,
                    width: `calc(${st * 100}% + 12px)`,
                    maxWidth: 'calc(100% + 12px)',
                  }}
                />
              ) : null}
            </div>
            <span style={{fontSize: 24, fontWeight: 700, color: C.faint}}>{String(i + 1).padStart(2, '0')}</span>
          </div>
        );
      })}
      {steps.map((_, i) => (
        <Sfx key={i} at={startAt + i * STAGGER} name="pop" volume={0.16} />
      ))}
      {strike ? <Sfx at={strikeStart} name="whoosh" volume={0.2} /> : null}
    </div>
  );
};
