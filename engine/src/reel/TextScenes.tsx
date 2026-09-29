import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useVideoConfig} from 'remotion';
import {Sfx, springAt, useF} from '../lib/frame';
import {parseAccent, splitWords} from '../lib/text';
import {C, FONT, HANDLE, REEL} from '../theme';
import {Badge, clamp01, panelStyle} from '../ui/common';
import {HeroText} from './HeroText';

// Centre of the usable area between Instagram's top and bottom UI.
const CENTER_TOP = REEL.safeTop + 40;
const CENTER_BOTTOM = REEL.h - REEL.safeBottom - 60;

const Centered: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{top: CENTER_TOP, height: CENTER_BOTTOM - CENTER_TOP, alignItems: 'center', justifyContent: 'center', padding: `0 ${REEL.side}px`}}>
    {children}
  </AbsoluteFill>
);

export const HookScene: React.FC<{text: string; sub?: string; starts: number[]; lastWord: number; calm?: boolean}> = ({text, sub, starts, lastWord, calm}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const subP = springAt(frame, lastWord + 6, fps);
  return (
    <Centered>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
        {calm ? <div style={{width: 72, height: 8, borderRadius: 4, background: C.accent, opacity: clamp01(frame / 6)}} /> : null}
        <HeroText text={text} starts={starts} size={calm ? undefined : undefined} />
        {sub ? (
          <div
            style={{
              fontFamily: FONT,
              fontSize: 42,
              fontWeight: 600,
              color: C.muted,
              textAlign: 'center',
              maxWidth: 820,
              lineHeight: 1.3,
              opacity: subP,
              transform: `translateY(${(1 - subP) * 16}px)`,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </Centered>
  );
};

export const MythScene: React.FC<{myth: string; reality: string; vo: string; starts: number[]; span: number}> = ({myth, reality, vo, starts, span}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const words = splitWords(vo).map((w) => w.toLowerCase().replace(/[^a-z]/g, ''));
  const cue = words.findIndex((w) => ['reality', 'actually', 'truth', 'but', 'instead'].includes(w));
  const realityAt = cue > 0 ? starts[cue] : Math.round(starts[0] + span * 0.45);
  const mythP = springAt(frame, 2, fps);
  const strike = clamp01((frame - (realityAt - 10)) / 9);
  const realP = springAt(frame, realityAt, fps);
  const card = (label: string, tone: 'red' | 'green', text: string, p: number, extra: React.CSSProperties) => (
    <div
      style={{
        ...panelStyle,
        width: 888,
        padding: '40px 44px 48px',
        opacity: p * (extra.opacity === undefined ? 1 : (extra.opacity as number)),
        transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)`,
        borderColor: tone === 'green' && p > 0 ? `rgba(45,164,78,${0.7 * p})` : C.panelLine,
      }}
    >
      <Badge tone={tone} dark>
        {label}
      </Badge>
      <div style={{position: 'relative', marginTop: 24, fontSize: 58, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.025em'}}>
        {text}
        {tone === 'red' && strike > 0 ? (
          <div style={{position: 'absolute', left: -8, top: '50%', height: 8, borderRadius: 4, background: C.red, width: `calc(${strike * 100}% + 16px)`}} />
        ) : null}
      </div>
    </div>
  );
  return (
    <Centered>
      <div style={{display: 'flex', flexDirection: 'column', gap: 36, fontFamily: FONT, color: C.text}}>
        {card('Myth', 'red', myth, mythP, {opacity: 1 - 0.45 * strike})}
        {card('Reality', 'green', reality, realP, {})}
      </div>
      <Sfx at={realityAt - 10} name="whoosh" />
      <Sfx at={realityAt} name="ding" />
    </Centered>
  );
};

export const CtaScene: React.FC<{text: string; sub?: string}> = ({text, sub}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  const logoP = springAt(frame, 0, fps, {damping: 12, stiffness: 120});
  const textP = springAt(frame, 8, fps);
  const pillP = springAt(frame, 14, fps, {damping: 10, stiffness: 180});
  const subP = springAt(frame, 24, fps);
  const handleP = springAt(frame, 30, fps);
  const pulse = frame > 30 ? ((frame - 30) % 40) / 40 : 0;
  const words = parseAccent(text);
  return (
    <Centered>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FONT, color: C.text}}>
        <Img
          src={staticFile('brand/mark.png')}
          style={{width: 200, height: 200, opacity: logoP, transform: `scale(${0.6 + 0.4 * logoP}) rotate(${(1 - logoP) * -90}deg)`}}
        />
        <div style={{display: 'flex', alignItems: 'center', gap: 28, marginTop: 56, opacity: textP, transform: `translateY(${(1 - textP) * 30}px)`}}>
          {words.map((w, i) =>
            w.accent ? (
              <div key={i} style={{position: 'relative'}}>
                {pulse > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 32,
                      border: `4px solid ${C.accent}`,
                      transform: `scale(${1 + pulse * 0.25})`,
                      opacity: 1 - pulse,
                    }}
                  />
                ) : null}
                <div
                  style={{
                    background: C.accent,
                    borderRadius: 32,
                    padding: '10px 36px 18px',
                    fontSize: 124,
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    transform: `scale(${0.7 + 0.3 * pillP})`,
                    boxShadow: '0 20px 60px rgba(47,128,237,0.45)',
                  }}
                >
                  {w.w}
                </div>
              </div>
            ) : (
              <span key={i} style={{fontSize: 124, fontWeight: 900, letterSpacing: '-0.03em'}}>
                {w.w}
              </span>
            ),
          )}
        </div>
        {sub ? (
          <div style={{marginTop: 48, fontSize: 44, fontWeight: 600, color: C.muted, textAlign: 'center', maxWidth: 820, lineHeight: 1.3, opacity: subP, transform: `translateY(${(1 - subP) * 16}px)`}}>
            {sub}
          </div>
        ) : null}
        <div style={{marginTop: 70, display: 'flex', alignItems: 'center', gap: 16, opacity: handleP}}>
          <Img src={staticFile('brand/avatar.png')} style={{width: 64, height: 64, borderRadius: 32, border: '2px solid rgba(255,255,255,0.15)'}} />
          <span style={{fontSize: 34, fontWeight: 700, color: C.text}}>{HANDLE}</span>
        </div>
      </div>
      <Sfx at={14} name="ding" />
    </Centered>
  );
};
