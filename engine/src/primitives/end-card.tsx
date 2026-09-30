import React from 'react';
import {AbsoluteFill, Easing, Img, staticFile, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {parseAccent} from '../lib/text';
import {FONT, HANDLE, TYPE} from '../theme';
import {useTheme} from '../themes';
import {LINEAR, type PrimitiveProps, prog, springFrom} from './atoms';

// Brand end card, entered with an ink wipe from the bottom: logo, CTA with highlighted *accent*, promise line, authorship.
export const EndCard: React.FC<PrimitiveProps<{text: string; sub?: string}>> = ({p}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const wipe = prog(f, 0, 14, Easing.bezier(0.7, 0, 0.3, 1));
  const logo = springFrom(f, 8, {damping: 14, stiffness: 180});
  const textP = springFrom(f, 12, {damping: 14, stiffness: 180});
  const hl = prog(f, 20, 8, LINEAR);
  const subP = springFrom(f, 24);
  const byP = springFrom(f, 30);
  return (
    <AbsoluteFill style={{background: th.bg}}>
      <AbsoluteFill style={{clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`, background: th.ink}}>
        <Img src={staticFile('brand/mark.png')} style={{position: 'absolute', left: 540 - 120, top: 470, width: 240, height: 240, opacity: logo, transform: `scale(${0.6 + 0.4 * logo}) rotate(${(1 - logo) * -120}deg)`}} />
        <div style={{position: 'absolute', top: 780, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 30, fontFamily: TYPE.display, fontWeight: 900, fontSize: 150, letterSpacing: '-0.04em', color: th.bg, opacity: textP, transform: `translateY(${(1 - textP) * 40}px)`}}>
          {parseAccent(p.text).map((w, i) =>
            w.accent ? (
              <span key={i} style={{position: 'relative', display: 'inline-block', padding: '0 14px'}}>
                <span style={{position: 'absolute', inset: '10% 0 4% 0', background: th.accent, transformOrigin: '0 50%', transform: `scaleX(${hl})`, borderRadius: 8}} />
                <span style={{position: 'relative', color: hl > 0.5 ? th.onAccent : th.bg}}>{w.w}</span>
              </span>
            ) : (
              <span key={i}>{w.w}</span>
            ),
          )}
        </div>
        {p.sub ? (
          <div style={{position: 'absolute', top: 1000, left: 110, right: 110, textAlign: 'center', fontFamily: FONT, fontSize: 44, fontWeight: 700, lineHeight: 1.25, color: th.bg, opacity: subP * 0.85, transform: `translateY(${(1 - subP) * 16}px)`}}>{p.sub}</div>
        ) : null}
        <div style={{position: 'absolute', top: 1160, left: 0, right: 0, textAlign: 'center', fontFamily: TYPE.data, fontSize: 28, fontWeight: 600, color: th.bg, opacity: byP * 0.75}}>Made by Navin Rana · {HANDLE}</div>
      </AbsoluteFill>
      <Sfx at={0} name="whoosh" volume={0.35} />
      <Sfx at={14} name="pop" />
    </AbsoluteFill>
  );
};
