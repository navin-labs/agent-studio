import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {TYPE} from '../theme';
import {alpha, card, useTheme} from '../themes';
import {Icon} from '../ui/Icon';
import {clamp, cuesOr, EASE, type PrimitiveProps, Shot, STAGE} from './atoms';

type Layer = {icon: string; label: string; sub?: string};

const S = 760; // a layer's card when it fills the frame
const R = 3.2; // each layer is R times smaller than its parent: it sits in the parent's centre box

// Camera dive through nested layers (inbox > email > attachment > the one number): each cue lands the camera on the next layer.
// A layer's text fades out as the camera passes through it, so nothing oversized ever reaches the frame edge.
export const ZoomDive: React.FC<PrimitiveProps<{layers: Layer[]}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const n = p.layers.length;
  const at = cuesOr(cues, n, 6, dur - 12);
  // camera depth z: 0 = first layer fills the frame, i = layer i does; eased between arrivals
  const z = at.slice(1).reduce((acc, t, i) => acc + interpolate(f, [t - 14, t], [0, 1], {...clamp, easing: EASE}), 0);
  return (
    <Shot dur={dur} push={0}>
      {p.layers.map((l, i) => {
        const scale = R ** (z - i);
        if (scale > R * 1.4 || scale < 1 / (R * 1.6)) return null;
        const text = interpolate(scale, [1.08, 1.4], [1, 0], clamp);
        const gone = interpolate(scale, [1.15, 1.9], [1, 0], clamp); // the layer we passed through fades away, edges and all
        const last = i === n - 1;
        return (
          <div key={i} data-box={text > 0.5 ? '' : undefined} style={{...card(th), position: 'absolute', left: 540 - S / 2, top: STAGE.cy - S / 2, width: S, height: S, boxSizing: 'border-box', borderRadius: 36, opacity: gone, transform: `scale(${scale})`, transformOrigin: 'center'}}>
            <div style={{opacity: text}}>
              {last ? (
                <div data-tb={`layer-${i}`} style={{position: 'absolute', inset: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28}}>
                  <div style={{width: 96, height: 96, borderRadius: 22, background: th.accent, color: th.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Icon name={l.icon} size={54} stroke={2.4} />
                  </div>
                  <div style={{fontFamily: TYPE.display, fontSize: Math.min(100, Math.floor(1150 / Math.max(1, l.label.length))), fontWeight: 900, letterSpacing: '-0.04em', color: th.ink, whiteSpace: 'nowrap'}}>{l.label}</div>
                  {l.sub ? <div style={{fontFamily: TYPE.data, fontSize: 34, fontWeight: 700, color: th.muted, whiteSpace: 'nowrap'}}>{l.sub}</div> : null}
                </div>
              ) : (
                <>
                  <div data-tb={`layer-${i}`} style={{position: 'absolute', top: 44, left: 48, right: 48, display: 'flex', alignItems: 'center', gap: 20}}>
                    <div style={{width: 76, height: 76, flex: 'none', borderRadius: 18, background: th.flow, color: th.surface, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <Icon name={l.icon} size={42} stroke={2.4} />
                    </div>
                    <div style={{minWidth: 0, fontFamily: TYPE.title, fontSize: 48, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.05, color: th.ink}}>{l.label}</div> {/* wraps to 2 lines; room above the centre box */}
                  </div>
                  {l.sub ? <div style={{position: 'absolute', bottom: 48, left: 48, right: 48, textAlign: 'center', fontFamily: TYPE.data, fontSize: 32, fontWeight: 700, color: th.muted, whiteSpace: 'nowrap'}}>{l.sub}</div> : null}
                </>
              )}
            </div>
            {last ? null : <div style={{position: 'absolute', left: (S - S / R) / 2, top: (S - S / R) / 2, width: S / R, height: S / R, borderRadius: 20, border: `4px dashed ${th.accent}`, background: alpha(th.accent, 0.12), boxSizing: 'border-box'}} />}
          </div>
        );
      })}
      {at.slice(1).map((t, i) => (
        <Sfx key={i} at={t - 14} name="whoosh" volume={0.3} />
      ))}
      <Sfx at={at[n - 1]} name="ding" volume={0.3} />
    </Shot>
  );
};
