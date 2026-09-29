import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, REEL, ZONES} from '../theme';

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 40;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 2px, transparent 2px)',
          backgroundSize: '44px 44px',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 45%, #000 30%, transparent 80%)',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 45%, #000 30%, transparent 80%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1500,
          height: 1500,
          left: -210 + drift,
          top: -520,
          background: 'radial-gradient(circle, rgba(47,128,237,0.24) 0%, rgba(47,128,237,0.06) 38%, transparent 62%)',
        }}
      />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.35) 100%)'}} />
    </AbsoluteFill>
  );
};

// Story-style segmented progress bar, just below Instagram's top UI.
export const ProgressBar: React.FC<{frames: number[]}> = ({frames}) => {
  const frame = useCurrentFrame();
  let acc = 0;
  return (
    <div style={{position: 'absolute', top: ZONES.progressY, left: REEL.side, right: REEL.side, display: 'flex', gap: 10}}>
      {frames.map((d, i) => {
        const start = acc;
        acc += d;
        const p = interpolate(frame, [start, start + d], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <div key={i} style={{flex: d, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.16)', overflow: 'hidden'}}>
            <div style={{width: `${p * 100}%`, height: '100%', background: 'rgba(255,255,255,0.9)'}} />
          </div>
        );
      })}
    </div>
  );
};

export const Kicker: React.FC<{kicker?: string; title?: string}> = ({kicker, title}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = interpolate(frame, [1, 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const t = interpolate(frame, [4, 11], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  void fps;
  if (!kicker && !title) return null;
  return (
    <div style={{position: 'absolute', top: ZONES.kickerY, left: REEL.side, right: REEL.side, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, fontFamily: FONT}}>
      {kicker ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 24px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: '2px solid rgba(255,255,255,0.08)',
            opacity: k,
            transform: `translateY(${(1 - k) * 12}px)`,
          }}
        >
          <div style={{width: 14, height: 14, borderRadius: 7, background: C.accent, boxShadow: `0 0 16px ${C.accent}`}} />
          <span style={{fontSize: 26, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.muted}}>{kicker}</span>
        </div>
      ) : null}
      {title ? (
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.08,
            color: C.text,
            textAlign: 'center',
            textWrap: 'balance',
            maxWidth: 888,
            opacity: t,
            transform: `translateY(${(1 - t) * 16}px)`,
          }}
        >
          {title}
        </div>
      ) : null}
    </div>
  );
};
