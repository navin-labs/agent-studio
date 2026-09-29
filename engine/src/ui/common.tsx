import React from 'react';
import {C, FONT} from '../theme';

export const cardStyle: React.CSSProperties = {
  background: C.card,
  borderRadius: 34,
  boxShadow: '0 40px 90px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
  overflow: 'hidden',
  color: C.cardText,
  fontFamily: FONT,
};

export const panelStyle: React.CSSProperties = {
  background: C.panel,
  border: `2px solid ${C.panelLine}`,
  borderRadius: 30,
  fontFamily: FONT,
  color: C.text,
};

export const Badge: React.FC<{children: React.ReactNode; tone?: 'neutral' | 'amber' | 'blue' | 'green' | 'red'; dark?: boolean}> = ({
  children,
  tone = 'neutral',
  dark,
}) => {
  const tones = {
    neutral: dark ? ['rgba(255,255,255,0.08)', C.muted] : ['#E9EDF2', '#5B6573'],
    amber: dark ? ['rgba(245,165,36,0.16)', C.amber] : [C.amberSoft, '#B7791F'],
    blue: dark ? ['rgba(47,128,237,0.18)', '#6FA8F5'] : [C.blueSoft, C.accent],
    green: dark ? ['rgba(45,164,78,0.18)', '#4CC46F'] : [C.greenSoft, C.green],
    red: dark ? ['rgba(229,72,77,0.18)', '#FF7B7F'] : [C.redSoft, C.red],
  } as const;
  const [bg, fg] = tones[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontFamily: FONT,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
};

export const statusTone = (text: string): 'red' | 'green' | 'amber' | 'blue' | null => {
  if (/overdue|late|failed|missing|unpaid|delayed|error/i.test(text)) return 'red';
  if (/paid|done|sent|delivered|complete|received|approved|ok\b/i.test(text)) return 'green';
  if (/pending|due|waiting|draft|in transit|open|new/i.test(text)) return 'amber';
  if (/updated|changed|revised|scheduled/i.test(text)) return 'blue';
  return null;
};

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
