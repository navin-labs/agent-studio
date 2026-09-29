import React from 'react';
import {CheckCheck} from 'lucide-react';
import {useVideoConfig} from 'remotion';
import {Sfx, springAt, useF, useIsStatic} from '../lib/frame';
import {initials} from '../lib/text';
import {C} from '../theme';
import type {ChatMsg} from '../types';
import {cardStyle} from './common';
import {Icon} from './Icon';

const TYPING = 16;

export const ChatCard: React.FC<{contact: string; status?: string; messages: ChatMsg[]; startAt?: number; width?: number; height?: number; pace?: number}> = ({
  contact,
  status = 'online',
  messages,
  startAt = 8,
  width = 888,
  height = 700,
  pace,
}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const isStatic = useIsStatic();

  // schedule: 'them' messages get a typing indicator first
  const base = messages.reduce((a, m) => a + (m.from === 'them' ? TYPING + 10 : 14), 0);
  const stretch = pace ? Math.max(1, Math.min(2.2, (pace * 0.8) / base)) : 1;
  let t = startAt;
  const sched = messages.map((m) => {
    const typingAt = m.from === 'them' ? t : null;
    if (m.from === 'them') t += TYPING;
    const at = Math.round(t);
    t += (m.from === 'them' ? 10 : 14) * stretch;
    return {typingAt, at};
  });

  return (
    <div style={{...cardStyle, width, height, display: 'flex', flexDirection: 'column'}}>
      <div style={{height: 104, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18, padding: '0 28px', background: '#FFFFFF', borderBottom: `2px solid ${C.cardLine}`}}>
        <div style={{width: 64, height: 64, borderRadius: 32, background: '#128C7E', color: '#fff', fontSize: 26, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {initials(contact)}
        </div>
        <div>
          <div style={{fontSize: 32, fontWeight: 800}}>{contact}</div>
          <div style={{fontSize: 22, color: C.cardMuted, fontWeight: 600}}>{status}</div>
        </div>
        <div style={{flex: 1}} />
        <Icon name="phone" size={32} color={C.cardMuted} />
      </div>
      <div
        style={{
          flex: 1,
          background: '#EFEAE2',
          padding: '24px 26px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: 14,
          overflow: 'hidden',
        }}
      >
        {messages.map((m, i) => {
          const {typingAt, at} = sched[i];
          const p = springAt(frame, at, fps, {damping: 15, stiffness: 210});
          const showTyping = !isStatic && typingAt !== null && frame >= typingAt && frame < at;
          const me = m.from === 'me';
          if (showTyping) {
            return (
              <div key={i} style={{alignSelf: 'flex-start', background: '#fff', borderRadius: 24, padding: '22px 26px', display: 'flex', gap: 10}}>
                {[0, 1, 2].map((d) => (
                  <div
                    key={d}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      background: '#9CA3AF',
                      transform: `translateY(${Math.sin((frame - d * 4) / 3) * 5}px)`,
                    }}
                  />
                ))}
              </div>
            );
          }
          if (frame < at) return null;
          return (
            <div
              key={i}
              style={{
                alignSelf: me ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                maxHeight: 60 + 400 * p,
                overflow: 'hidden',
                background: me ? '#D9FDD3' : '#FFFFFF',
                borderRadius: me ? '24px 24px 6px 24px' : '24px 24px 24px 6px',
                padding: '16px 22px 12px',
                boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                opacity: p,
                transform: `scale(${0.85 + 0.15 * p})`,
                transformOrigin: me ? 'bottom right' : 'bottom left',
              }}
            >
              <div style={{fontSize: 30, lineHeight: 1.3, color: C.cardText, fontWeight: 500}}>{m.text}</div>
              <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 4}}>
                <span style={{fontSize: 19, color: '#667781'}}>{m.time ?? ''}</span>
                {me ? <CheckCheck size={24} color="#53BDEB" strokeWidth={2.4} /> : null}
              </div>
            </div>
          );
        })}
      </div>
      {sched.map((s, i) => (
        <Sfx key={i} at={s.at} name="pop" />
      ))}
    </div>
  );
};
