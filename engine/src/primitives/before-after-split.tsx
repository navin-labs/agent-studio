import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {SIDE, TYPE} from '../theme';
import {alpha, card, useTheme} from '../themes';
import {Icon} from '../ui/Icon';
import {clamp, cuesOr, EASE, OUT, type PrimitiveProps, SceneCtx, Shot, STAGE} from './atoms';

type Half = {title: string; lines: string[]};
type P = {before: Half; after: Half};

const GAP = 40;
const PANEL_H = (STAGE.bottom - STAGE.top - GAP) / 2;

// Split screen: the manual way fills the top half (cue 0), a divider sweeps across and the automatic way fills the bottom (cue 1).
export const BeforeAfterSplit: React.FC<PrimitiveProps<P>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const [a, b] = cues.length ? cuesOr(cues, 2, 8, dur - 30) : [4, Math.round(dur * 0.45)]; // no cues: before at once, after just before the middle
  const halves = [
    {h: p.before, at: a, col: th.warn, icon: 'hourglass', top: STAGE.top},
    {h: p.after, at: b, col: th.ok, icon: 'check', top: STAGE.top + PANEL_H + GAP},
  ];
  const sweep = interpolate(f, [b - 8, b + 4], [0, 1], {...clamp, easing: EASE});
  // style preset `strike` (C1): the manual steps are struck through as the divider sweeps, then one `ok` pulse marks the after half
  const signal = React.useContext(SceneCtx).strike;
  const strike = (i: number) => (signal ? interpolate(f, [b - 8 + i * 3, b - 2 + i * 3], [0, 1], {...clamp, easing: OUT}) : 0);
  const pulse = signal ? interpolate(f, [b + 4, b + 7, b + 22], [0, 1, 0], clamp) : 0;
  return (
    <Shot dur={dur}>
      {halves.map(({h, at, col, icon, top}, k) => {
        const inP = interpolate(f, [at, at + 8], [0, 1], {...clamp, easing: EASE});
        return (
          <div key={k} data-box style={{...card(th), position: 'absolute', top, left: SIDE + 30, right: SIDE + 30, height: PANEL_H, padding: '26px 30px', boxSizing: 'border-box', opacity: inP, transform: `translateX(${(1 - inP) * (k ? 60 : -60)}px)`, ...(k && pulse ? {borderColor: th.ok, boxShadow: `8px 8px 0 ${th.shadow}, 0 0 ${48 * pulse}px ${alpha(th.ok, 0.6 * pulse)}`} : {})}}>
            <div data-tb="title" style={{display: 'inline-block', padding: '6px 16px', borderRadius: 10, background: alpha(col, 0.18), fontFamily: TYPE.data, fontSize: 34, fontWeight: 800, letterSpacing: '0.08em', color: th.ink}}>{h.title}</div>
            {h.lines.map((l, i) => {
              const lp = interpolate(f, [at + 6 + i * 5, at + 12 + i * 5], [0, 1], clamp);
              return (
                <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 26, opacity: lp, transform: `translateY(${(1 - lp) * 14}px)`}}>
                  <div style={{width: 54, height: 54, flex: 'none', borderRadius: 10, background: col, color: th.surface, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Icon name={icon} size={30} stroke={2.6} />
                  </div>
                  <div style={{position: 'relative', fontFamily: TYPE.title, fontSize: 44, fontWeight: 800, color: k ? th.ink : th.muted, whiteSpace: 'nowrap'}}>
                    {l}
                    {!k && strike(i) ? <div style={{position: 'absolute', left: -4, top: '52%', height: 5, borderRadius: 3, width: `calc(${strike(i) * 100}% + 8px)`, background: th.ink}} /> : null}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div style={{position: 'absolute', top: STAGE.top + PANEL_H + GAP / 2 - 3, left: SIDE + 30, width: `${sweep * (1080 - 2 * (SIDE + 30))}px`, height: 6, borderRadius: 3, background: th.flow}} />
      <Sfx at={a} name="pop" volume={0.3} />
      <Sfx at={b - 8} name="whoosh" volume={0.35} />
      <Sfx at={b + 4} name="ding" volume={0.3} />
    </Shot>
  );
};
