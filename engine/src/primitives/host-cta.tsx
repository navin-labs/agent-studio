import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {parseAccent} from '../lib/text';
import {FONT, HANDLE, TYPE} from '../theme';
import {useTheme} from '../themes';
import {Host, HostStage} from '../host/Host';
import {LINEAR, type PrimitiveProps, prog, springFrom} from './atoms';

// Host format closing card: CTA with highlighted accent, the offer line, then the brand line in the pixel font. The host waves.
export const HostCta: React.FC<PrimitiveProps<{text: string; sub?: string}>> = ({p, dur}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const card = springFrom(f, 0, {damping: 14, stiffness: 170});
  const hl = prog(f, 14, 8, LINEAR);
  const sub = springFrom(f, 22);
  const brand = springFrom(f, 32);
  return (
    <HostStage dur={dur}>
      <div data-box style={{position: 'absolute', left: 80, right: 80, top: 330, padding: '56px 40px 50px', borderRadius: 36, background: th.surface, border: `2px solid ${th.rule}`, textAlign: 'center', opacity: card, transform: `translateY(${(1 - card) * 70}px) scale(${0.92 + 0.08 * card})`}}>
        <div data-tb="cta" style={{display: 'flex', justifyContent: 'center', gap: 26, fontFamily: TYPE.display, fontSize: 132, fontWeight: 900, letterSpacing: '-0.04em', color: th.ink}}>
          {parseAccent(p.text).map((w, i) =>
            w.accent ? (
              <span key={i} style={{position: 'relative', display: 'inline-block', padding: '0 14px'}}>
                <span style={{position: 'absolute', inset: '10% 0 4% 0', background: th.accent, transformOrigin: '0 50%', transform: `scaleX(${hl})`, borderRadius: 10}} />
                <span style={{position: 'relative', color: hl > 0.5 ? th.onAccent : th.ink}}>{w.w}</span>
              </span>
            ) : (
              <span key={i}>{w.w}</span>
            ),
          )}
        </div>
        {p.sub ? <div data-tb="sub" style={{marginTop: 26, fontFamily: FONT, fontSize: 40, fontWeight: 700, lineHeight: 1.25, color: th.muted, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)`}}>{p.sub}</div> : null}
      </div>
      <div data-tb="brand" style={{position: 'absolute', left: 0, right: 0, top: 880, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, opacity: brand, transform: `translateY(${(1 - brand) * 20}px)`}}>
        <Img src={staticFile('brand/mark.png')} style={{width: 64, height: 64}} />
        <div style={{fontFamily: TYPE.pixel, fontSize: 46, letterSpacing: '0.04em', color: th.accent}}>{HANDLE}</div>
      </div>
      <Host x={540} y={1290} scale={0.5} mood="happy" moodAt={16} />
      <Sfx at={14} name="ding" volume={0.4} />
    </HostStage>
  );
};
