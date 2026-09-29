import React from 'react';
import {interpolate, useVideoConfig} from 'remotion';
import {Sfx, springAt, useF} from '../lib/frame';
import {C} from '../theme';
import type {FlowNode} from '../types';
import {cardStyle, clamp01} from './common';
import {Icon} from './Icon';

const NODE_H = 132;
const GAP = 56;

export const FlowDiagram: React.FC<{nodes: FlowNode[]; startAt?: number; width?: number; pace?: number}> = ({nodes, startAt = 6, width = 820, pace}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const n = nodes.length;
  // spread activations across the voiceover so each node lights up roughly when it is spoken
  const step = pace ? Math.max(20, Math.min(60, Math.round((pace * 0.78) / n))) : 20;
  const TRAVEL = Math.min(18, step - 4);
  const first = pace ? Math.max(startAt + 8, Math.round(pace * 0.12)) : startAt + 10;
  // node i activates at act[i]; connector i runs from act[i] toward act[i+1]
  const act = nodes.map((_, i) => first + i * step);
  const appear = nodes.map((_, i) => (i === 0 ? startAt : act[i] - TRAVEL + 2));

  return (
    <div style={{width, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      {nodes.map((node, i) => {
        const p = springAt(frame, appear[i], fps, {damping: 16, stiffness: 180});
        const a = springAt(frame, act[i], fps, {damping: 14, stiffness: 200});
        const last = i === n - 1;
        const connP = i < n - 1 ? clamp01((frame - (act[i + 1] - TRAVEL)) / TRAVEL) : 0;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                ...cardStyle,
                width,
                height: NODE_H,
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                padding: '0 30px',
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px) scale(${0.96 + 0.04 * p})`,
                boxShadow:
                  last && a > 0
                    ? `0 0 0 ${4 * a}px ${C.accent}, 0 30px 90px rgba(47,128,237,${0.35 * a})`
                    : cardStyle.boxShadow,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 22,
                  flexShrink: 0,
                  background: a > 0.5 ? C.accent : '#EEF2F7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${1 + 0.08 * Math.sin(Math.PI * a)})`,
                }}
              >
                <Icon name={node.icon ?? 'zap'} size={42} color={a > 0.5 ? '#fff' : '#5B6573'} />
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                {node.sub ? (
                  <div style={{fontSize: 21, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: a > 0.5 ? C.accent : C.cardMuted}}>
                    {node.sub}
                  </div>
                ) : null}
                <div style={{fontSize: 38, fontWeight: 800, letterSpacing: '-0.01em', marginTop: 2}}>{node.label}</div>
              </div>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  border: `4px solid ${a > 0.5 ? C.green : '#D5DAE1'}`,
                  background: a > 0.5 ? C.green : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${0.7 + 0.3 * Math.max(a, 0.001)})`,
                }}
              >
                {a > 0.5 ? (
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M5 12.5l4.2 4.2L19 7" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </div>
            </div>
            {i < n - 1 ? (
              <div style={{position: 'relative', width: 8, height: GAP, opacity: springAt(frame, appear[i + 1] - 4, fps)}}>
                <div style={{position: 'absolute', inset: 0, borderRadius: 4, background: 'rgba(255,255,255,0.14)'}} />
                <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: `${connP * 100}%`, borderRadius: 4, background: C.accent}} />
                {connP > 0 && connP < 1 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: -8,
                      top: `calc(${connP * 100}% - 12px)`,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      background: '#fff',
                      boxShadow: `0 0 24px 6px ${C.accent}`,
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </React.Fragment>
        );
      })}
      {act.map((a, i) => (
        <Sfx key={i} at={a} name={i === n - 1 ? 'ding' : 'pop'} volume={i === n - 1 ? 0.26 : 0.16} />
      ))}
    </div>
  );
};

export const flowHeight = (n: number) => n * NODE_H + (n - 1) * GAP;
