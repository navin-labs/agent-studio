import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {FONT, TYPE} from '../theme';
import {useTheme} from '../themes';
import {Cursor, type Mode, Tag, UiShot, Window, WIN} from '../host/ui';
import {cuesOr, type PrimitiveProps, springFrom} from './atoms';

type Msg = {from: 'me' | 'them'; text: string};

// A chat thread. Messages pop in on cues; theirs show typing dots first. manual: the cursor hits Send for each of yours.
// auto: yours carry an AUTO tag (sent by the automation).
export const UiChat: React.FC<PrimitiveProps<{contact: string; messages: Msg[]; mode: Mode}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const at = cuesOr(cues, p.messages.length, 14, dur - 14);
  const sendBtn = {x: WIN.x + WIN.w - 90, y: WIN.y + WIN.h - 60};
  // messages stack upward from the input bar; each takes its own measured-by-layout height
  return (
    <UiShot dur={dur} mode={p.mode} moodAt={at[at.length - 1]}>
      <Window title={p.contact} icon="chat" mode={p.mode}>
        <div data-tb-scroll style={{position: 'absolute', left: 22, right: 22, bottom: 100, display: 'flex', flexDirection: 'column', gap: 14}}> {/* old messages scroll off the top, like a real chat */}
          {p.messages.map((m, i) => {
            const a = springFrom(f, at[i], {damping: 13, stiffness: 190});
            const typing = m.from === 'them' && f >= at[i] - 14 && f < at[i];
            if (a <= 0.01 && !typing) return null;
            const me = m.from === 'me';
            return (
              <div key={i} style={{alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: me ? 'flex-end' : 'flex-start', gap: 6}}>
                <div data-box style={{background: me ? th.flow : th.rule, color: th.ink, borderRadius: me ? '26px 26px 6px 26px' : '26px 26px 26px 6px', padding: '18px 26px', fontFamily: FONT, fontSize: 34, fontWeight: 600, lineHeight: 1.28, opacity: typing ? 1 : a, transform: `scale(${typing ? 1 : 0.7 + 0.3 * a})`, transformOrigin: me ? '100% 100%' : '0 100%'}}>
                  {typing ? <span style={{letterSpacing: '0.3em', color: th.muted}}>{'•'.repeat(1 + (Math.floor(f / 5) % 3))}</span> : m.text}
                </div>
                {me && !typing ? <Tag label={p.mode === 'auto' ? 'AUTO ✓' : 'SENT BY HAND'} mode={p.mode} p={a} /> : null}
              </div>
            );
          })}
        </div>
        <div style={{position: 'absolute', left: 22, right: 22, bottom: 22, height: 64, borderRadius: 32, background: th.bg, display: 'flex', alignItems: 'center', padding: '0 24px', fontFamily: TYPE.data, fontSize: 21, color: th.muted}}>
          Type a message
          <div style={{marginLeft: 'auto', width: 48, height: 48, borderRadius: 24, background: p.mode === 'auto' ? th.accent : th.warn}} />
        </div>
      </Window>
      {p.mode === 'manual' ? <Cursor targets={p.messages.flatMap((m, i) => (m.from === 'me' ? [{...sendBtn, at: at[i]}] : []))} /> : null}
      {at.map((t, i) => <Sfx key={i} at={t} name="pop" volume={0.3} />)}
    </UiShot>
  );
};
