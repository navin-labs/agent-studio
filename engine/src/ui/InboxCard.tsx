import React from 'react';
import {interpolate, useVideoConfig} from 'remotion';
import {Sfx, springAt, useF} from '../lib/frame';
import {initials} from '../lib/text';
import {AVATAR_COLORS, C} from '../theme';
import type {Email} from '../types';
import {Badge, cardStyle, statusTone} from './common';
import {Icon} from './Icon';

const ROW = 112;
const HEAD = 96;
const STAGGER = 9;

export const InboxCard: React.FC<{emails: Email[]; sorted?: boolean; label?: string; startAt?: number; width?: number}> = ({
  emails,
  sorted,
  label,
  startAt = 6,
  width = 888,
}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const n = emails.length;
  const appear = emails.map((_, i) => startAt + i * STAGGER);
  const prog = appear.map((a) => springAt(frame, a, fps, {damping: 16, stiffness: 200}));
  const arrived = prog.filter((p) => p > 0.5).length;
  const sortStart = startAt + n * STAGGER + 12;
  const sortP = sorted ? springAt(frame, sortStart, fps) : 0;

  return (
    <div style={{...cardStyle, width, height: HEAD + n * ROW + 8, position: 'relative'}}>
      <div
        style={{
          height: HEAD,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 32px',
          borderBottom: `2px solid ${C.cardLine}`,
          background: '#FFFFFF',
        }}
      >
        <Icon name="inbox" size={34} color={C.cardText} />
        <span style={{fontSize: 34, fontWeight: 800}}>Inbox</span>
        <span
          style={{
            minWidth: 44,
            height: 40,
            padding: '0 12px',
            borderRadius: 20,
            background: C.accent,
            color: '#fff',
            fontSize: 24,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {arrived}
        </span>
        <div style={{flex: 1}} />
        {sorted ? (
          <div style={{opacity: sortP, transform: `scale(${0.8 + 0.2 * sortP})`}}>
            <Badge tone="blue">Auto-sorted</Badge>
          </div>
        ) : label ? (
          <span style={{fontSize: 24, color: C.cardMuted, fontWeight: 600}}>{label}</span>
        ) : null}
      </div>

      <div style={{position: 'relative', height: n * ROW}}>
        {emails.map((e, i) => {
          const p = prog[i];
          // newer mail lands on top and pushes older mail down
          const y = prog.slice(i + 1).reduce((acc, q) => acc + q, 0) * ROW;
          const tagP = sorted ? springAt(frame, sortStart + i * 6, fps, {damping: 13, stiffness: 220}) : 0;
          const tone = e.tag ? statusTone(e.tag) : null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: y,
                height: ROW,
                display: 'flex',
                alignItems: 'center',
                gap: 22,
                padding: '0 32px',
                borderBottom: `2px solid ${C.cardLine}`,
                background: p < 0.99 ? `rgba(47,128,237,${0.08 * (1 - p)})` : 'transparent',
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [-24, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {initials(e.from)}
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
                  <span style={{fontSize: 31, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {e.from}
                  </span>
                  <div style={{flex: 1}} />
                  <span style={{fontSize: 22, color: C.cardMuted, fontWeight: 600}}>{e.time ?? ''}</span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 4}}>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 27,
                      color: '#4B5563',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {e.subject}
                  </span>
                  {sorted && e.tag ? (
                    <div style={{opacity: tagP, transform: `scale(${0.6 + 0.4 * tagP})`}}>
                      <Badge tone={tone ?? 'blue'}>{e.tag}</Badge>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {appear.map((a, i) => (
        <Sfx key={i} at={a} name="pop" />
      ))}
      {sorted ? <Sfx at={sortStart} name="ding" /> : null}
    </div>
  );
};
