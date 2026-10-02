import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {parseAccent} from '../lib/text';
import {FONT, SIDE, TYPE} from '../theme';
import {HandleCtx, useTheme} from '../themes';
import {Host, HostStage} from '../host/Host';
import {LINEAR, type PrimitiveProps, prog, springFrom} from './atoms';

// Host format closing card: CTA with highlighted accent, the offer line, then the brand line in the pixel font. The host waves.
export const HostCta: React.FC<PrimitiveProps<{text: string; sub?: string}>> = ({p, dur}) => {
  const th = useTheme();
  const handle = React.useContext(HandleCtx);
  const f = useCurrentFrame();
  const card = springFrom(f, 0, {damping: 14, stiffness: 170});
  const hl = prog(f, 14, 8, LINEAR);
  const sub = springFrom(f, 22);
  const brand = springFrom(f, 32);
  // ponytail: ~0.75 em per capital in Inter Tight 900; the longest word must fit the card's 680 px inner width
  const size = Math.min(132, Math.floor(680 / (0.75 * Math.max(...parseAccent(p.text).map((w) => w.w.length)))));
  return (
    <HostStage dur={dur}>
      <div style={{position: 'absolute', left: SIDE + 30, right: SIDE + 30, top: 330, display: 'flex', flexDirection: 'column', gap: 60}}> {/* brand follows the card, however tall the CTA wraps; +30: zoom headroom */}
      <div data-box style={{padding: '56px 40px 50px', borderRadius: 36, background: th.surface, border: `2px solid ${th.rule}`, textAlign: 'center', opacity: card, transform: `translateY(${(1 - card) * 70}px) scale(${0.92 + 0.08 * card})`}}>
        <div data-tb="cta" style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 26, lineHeight: 1.05, fontFamily: TYPE.display, fontSize: size, fontWeight: 900, letterSpacing: '-0.04em', color: th.ink}}>
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
      <div data-tb="brand" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, opacity: brand, transform: `translateY(${(1 - brand) * 20}px)`}}>
        <Img src={staticFile('brand/mark.png')} style={{width: 64, height: 64}} />
        <div style={{fontFamily: TYPE.pixel, fontSize: 46, letterSpacing: '0.04em', color: th.accent}}>{handle}</div>
      </div>
      </div>
      <Host x={540} y={1400} scale={0.5} mood="happy" moodAt={16} />
      <Sfx at={14} name="ding" volume={0.4} />
    </HostStage>
  );
};
