// Remotion entries for one primitive on its own: a full video, and a contact sheet (8 frozen frames on one still).
import React from 'react';
import {AbsoluteFill, Freeze} from 'remotion';
import {TYPE} from '../theme';
import {THEMES, ThemeCtx, type ThemeName} from '../themes';
import {PRIMITIVES} from './index';
import {SPECS} from './specs';

export type PreviewProps = {id: string; theme?: ThemeName; params?: Record<string, unknown>; seconds?: number; cues?: number[]};

export const shotFrames = (p: PreviewProps) => {
  const [lo, hi] = SPECS[p.id].seconds;
  return Math.round((p.seconds ?? (lo + hi) / 2) * 30);
};

const Shot: React.FC<PreviewProps> = (p) => {
  const C = PRIMITIVES[p.id];
  return <C p={p.params ?? SPECS[p.id].example} dur={shotFrames(p)} cues={p.cues ?? []} />;
};

export const PrimitiveVideo: React.FC<PreviewProps> = (p) => (
  <ThemeCtx.Provider value={THEMES[p.theme ?? 'paper']}>
    <Shot {...p} />
  </ThemeCtx.Provider>
);

export const SHEET = {w: 1120, h: 1100};
export const sheetFrames = (dur: number) => Array.from({length: 8}, (_, i) => Math.round((i / 7) * (dur - 1)));

export const ContactSheet: React.FC<PreviewProps> = (p) => {
  const th = THEMES[p.theme ?? 'paper'];
  const dur = shotFrames(p);
  return (
    <ThemeCtx.Provider value={th}>
      <AbsoluteFill style={{background: th.surface, padding: 16, color: th.ink, fontFamily: TYPE.data}}>
        <div style={{fontSize: 26, fontWeight: 700, height: 44}}>
          {p.id} · {p.theme ?? 'paper'} · {(dur / 30).toFixed(1)}s · {SPECS[p.id].family}
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 262px)', gap: 12}}>
          {sheetFrames(dur).map((fr) => (
            <div key={fr}>
              <div style={{width: 262, height: 466, overflow: 'hidden', border: `2px solid ${th.ink}`, position: 'relative'}}>
                <div style={{width: 1080, height: 1920, transform: 'scale(0.2426)', transformOrigin: '0 0', position: 'absolute'}}>
                  <Freeze frame={fr}>
                    <Shot {...p} />
                  </Freeze>
                </div>
              </div>
              <div style={{fontSize: 18, marginTop: 4}}>f{fr}</div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </ThemeCtx.Provider>
  );
};
