// Visual worlds for composite scenes: the same plate and prop, drawn in a different medium, frame and frame rate.
// A world decides the plate treatment (an SVG filter), how the prop is cut, the format of the frame around the shot
// (torn paper card, blueprint sheet, letterboxed film, riso print, pixel game screen, polaroid on a desk) and its stepping
// rate. Every colour is a theme token, so the style's palette still drives it. Captions stay the Composer's.
import {noise2D} from '@remotion/noise';
import React from 'react';
import {interpolate, spring} from 'remotion';
import {FPS} from '../lib/timing';
import {alpha, type Theme, useTheme} from '../themes';
import type {Atmos} from './CinematicComposite';
import type {WorldId} from './worldmap';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export type FrameProps = {t: number; d: number; seed: number; children: React.ReactNode};
export type World = {
  fps: number; // the picture steps at this rate
  chrome: boolean; // draw the case tag / timecode / citation bar
  atmos: Atmos[];
  plate?: string; // CSS filter replacing the style's grade
  prop: (th: Theme) => string; // CSS filter on the prop
  Frame: React.FC<FrameProps>;
};

const Fill: React.FC<{style?: React.CSSProperties; children?: React.ReactNode}> = ({style, children}) => <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>;

// ---- papercut: a torn paper card on a coloured sheet, stepped like stop-motion, props cut as stickers ----
const torn = (seed: number, x0: number, y0: number, x1: number, y1: number) => {
  const pts: string[] = [];
  const j = (k: number) => Math.round(noise2D('torn', k * 0.9, seed) * 14);
  const n = 16;
  for (let i = 0; i <= n; i++) pts.push(`${x0 + ((x1 - x0) * i) / n}px ${y0 + j(i)}px`);
  for (let i = 1; i <= n; i++) pts.push(`${x1 + j(i + 40)}px ${y0 + ((y1 - y0) * i) / n}px`);
  for (let i = n - 1; i >= 0; i--) pts.push(`${x0 + ((x1 - x0) * i) / n}px ${y1 + j(i + 80)}px`);
  for (let i = n - 1; i >= 1; i--) pts.push(`${x0 + j(i + 120)}px ${y0 + ((y1 - y0) * i) / n}px`);
  return `polygon(${pts.join(',')})`;
};
const Papercut: React.FC<FrameProps> = ({children, seed, t}) => {
  const th = useTheme();
  const lift = interpolate(t, [0, 0.25], [40, 0], clamp);
  return (
    <Fill style={{background: th.accent}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="w-pc"><feGaussianBlur stdDeviation="3" /><feComponentTransfer><feFuncR type="discrete" tableValues="0 .2 .4 .6 .8 1" /><feFuncG type="discrete" tableValues="0 .2 .4 .6 .8 1" /><feFuncB type="discrete" tableValues="0 .2 .4 .6 .8 1" /></feComponentTransfer></filter>
      </svg>
      <Fill style={{background: alpha(th.shadow, 0.18), clipPath: torn(seed + 7, 70, 250, 1010, 1560), transform: 'rotate(-1.6deg)'}} />
      <Fill style={{transform: `translateY(${lift}px)`, filter: `drop-shadow(0 16px 0 ${alpha(th.shadow, 0.55)})`}}>
        <Fill style={{clipPath: torn(seed, 56, 230, 1024, 1540), background: th.bg}}>{children}</Fill>
      </Fill>
    </Fill>
  );
};

// ---- blueprint: the plate traced to white line on blue, a drafting grid, a sheet that draws itself in ----
const Blueprint: React.FC<FrameProps> = ({children, t}) => {
  const th = useTheme();
  const reveal = interpolate(t, [0, 0.9], [100, 0], clamp);
  return (
    <Fill style={{background: th.bg}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="w-bp" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 1 0" result="g" />
          <feGaussianBlur in="g" stdDeviation="2.2" result="b" />
          <feConvolveMatrix in="b" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" bias="0.5" preserveAlpha="true" result="c" />
          <feComponentTransfer in="c" result="d"><feFuncR type="table" tableValues="1 .5 0 .5 1" /></feComponentTransfer>
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 4 0 0 0 -0.35" result="e" />
          <feFlood floodColor={th.ink} result="f" />
          <feComposite in="f" in2="e" operator="in" />
        </filter>
        <filter id="w-bpp"><feMorphology in="SourceAlpha" operator="dilate" radius="5" result="d" /><feComposite in="d" in2="SourceAlpha" operator="out" result="ring" /><feFlood floodColor={th.ink} /><feComposite in2="ring" operator="in" /></filter>
      </svg>
      <Fill style={{backgroundImage: `linear-gradient(${alpha(th.ink, 0.13)} 2px, transparent 2px), linear-gradient(90deg, ${alpha(th.ink, 0.13)} 2px, transparent 2px)`, backgroundSize: '90px 90px'}} />
      <Fill style={{clipPath: `inset(0 ${reveal}% 0 0)`}}>{children}</Fill>
      <Fill style={{left: `${100 - reveal}%`, width: 4, right: 'auto', background: reveal > 0.5 ? th.ink : 'transparent'}} />
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} fill="none" stroke={th.ink} strokeWidth={3}>
        <path d="M60 220v-50h50M1020 220v-50h-50M60 1560v50h50M1020 1560v50h-50" />
        <path d="M60 1650h960M60 1636v28M1020 1636v28M540 1636v28" opacity={0.7} />
        <circle cx={540} cy={900} r={60} opacity={0.45} /><path d="M540 820v160M460 900h160" opacity={0.45} />
      </svg>
    </Fill>
  );
};

// ---- newsreel: 4:3 film window between black bars, gate weave, flicker, scratches ----
const Newsreel: React.FC<FrameProps> = ({children, t, seed}) => {
  const th = useTheme();
  const f = Math.round(t * FPS);
  const flick = 0.9 + 0.1 * noise2D('fl', f * 0.7, seed);
  return (
    <Fill style={{background: th.shadow}}>
      <Fill style={{top: 330, bottom: 700, overflow: 'hidden', filter: `brightness(${flick})`}}>
        <Fill style={{top: -330, transform: `translate(${noise2D('wx', f * 0.4, seed) * 6}px, ${noise2D('wy', f * 0.5, seed) * 6}px)`, height: 1920}}>{children}</Fill>
        {[0, 1, 2].map((i) => {
          const on = noise2D('sc', f * 0.9, i * 9 + seed) > 0.25;
          return on ? <div key={i} style={{position: 'absolute', top: 0, bottom: 0, left: `${(noise2D('sx', f * 0.3, i + seed) + 1) * 50}%`, width: 3, background: alpha(th.ink, 0.35)}} /> : null;
        })}
        <Fill style={{boxShadow: `inset 0 0 160px 40px ${alpha(th.shadow, 0.8)}`}} />
      </Fill>
    </Fill>
  );
};

// ---- halftone: a risograph print: dot screen, one spot colour, off-register ink, registration marks ----
const Halftone: React.FC<FrameProps> = ({children, t}) => {
  const th = useTheme();
  const shift = 10 + Math.sin(t * 3) * 3;
  return (
    <Fill style={{background: th.bg}}>
      <Fill style={{top: 120, bottom: 360, left: 50, right: 50, overflow: 'hidden', border: `10px solid ${th.ink}`}}>
        <Fill style={{top: -110, left: -40, height: 1920, width: 1080}}>{children}</Fill>
        <Fill style={{background: th.accent, mixBlendMode: 'multiply', opacity: 0.55, transform: `translate(${shift}px, ${shift * 0.6}px)`}} />
        <Fill style={{backgroundImage: `radial-gradient(circle, ${th.bg} 38%, transparent 40%)`, backgroundSize: '15px 15px', mixBlendMode: 'screen', opacity: 0.55}} />
      </Fill>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}} stroke={th.ink} strokeWidth={4} fill="none">
        {[[50, 90], [1030, 90], [50, 1590], [1030, 1590]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={14} /><path d={`M${x - 24} ${y}h48M${x} ${y - 24}v48`} /></g>)}
      </svg>
    </Fill>
  );
};

// ---- comic: two slanted panels with ink borders and a dot screen; the second is a close-up that slams in ----
const Comic: React.FC<FrameProps> = ({children, t}) => {
  const th = useTheme();
  const slam = spring({frame: Math.round((t - 0.35) * FPS), fps: FPS, config: {damping: 9, stiffness: 200, mass: 0.7}});
  const dots = {backgroundImage: `radial-gradient(circle, ${alpha(th.shadow, 0.35)} 28%, transparent 30%)`, backgroundSize: '13px 13px', mixBlendMode: 'multiply'} as const;
  return (
    <Fill style={{background: th.accent}}>
      <Fill style={{filter: `drop-shadow(0 0 0 ${th.ink}) drop-shadow(10px 10px 0 ${alpha(th.shadow, 0.8)})`}}>
        <Fill style={{clipPath: 'polygon(40px 130px, 1040px 130px, 1040px 900px, 40px 1010px)', background: th.ink}}>
          <Fill style={{clipPath: 'polygon(52px 142px, 1028px 142px, 1028px 888px, 52px 996px)'}}>
            <Fill style={{top: -40}}>{children}</Fill>
            <Fill style={dots} />
          </Fill>
        </Fill>
        <Fill style={{clipPath: 'polygon(40px 1050px, 1040px 940px, 1040px 1530px, 40px 1530px)', background: th.ink, opacity: t < 0.35 ? 0 : 1, transform: `scale(${0.85 + 0.15 * Math.min(1.1, slam)})`, transformOrigin: '540px 1240px'}}>
          <Fill style={{clipPath: 'polygon(52px 1062px, 1028px 962px, 1028px 1518px, 52px 1518px)'}}>
            <Fill style={{transform: 'scale(1.9)', transformOrigin: '540px 760px', top: 0}}>{children}</Fill>
            <Fill style={dots} />
          </Fill>
        </Fill>
      </Fill>
    </Fill>
  );
};

// ---- scrapbook: a polaroid on a desk: the shot is a photo in a card that drops in, tilted, taped ----
const Scrapbook: React.FC<FrameProps> = ({children, t, seed}) => {
  const th = useTheme();
  const drop = spring({frame: Math.round(t * FPS), fps: FPS, config: {damping: 10, stiffness: 120, mass: 0.8}});
  const tilt = (seed % 2 ? 1 : -1) * (2 + (seed % 3));
  return (
    <Fill style={{background: th.shadow}}>
      <Fill style={{backgroundImage: `repeating-linear-gradient(${tilt * 10}deg, ${alpha(th.ink, 0.05)} 0 2px, transparent 2px 26px)`}} />
      <div style={{position: 'absolute', left: 110, top: 170, width: 788, height: 700, padding: '36px 36px 150px', background: th.ink, transform: `translateY(${(1 - drop) * -900}px) rotate(${tilt * drop}deg)`, boxShadow: `0 40px 60px ${alpha(th.shadow, 0.55)}`}}>
        <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}>
          <Fill style={{width: 1080, height: 1920, left: -146, top: -510}}>{children}</Fill>
        </div>
        <div style={{position: 'absolute', left: '50%', top: -30, width: 190, height: 56, marginLeft: -95, background: alpha(th.warn, 0.72), transform: 'rotate(-3deg)'}} />
      </div>
    </Fill>
  );
};

// ---- painted worlds: ink wash, watercolor, crayon, impasto. The plate is repainted by SVG filters (tone steps, displaced edges,
// paper or wax grain, paint relief) and blooms in from a point or sweeps in like a stroke ----
const Grain: React.FC<{id: string; freq: number; blend: React.CSSProperties['mixBlendMode']; opacity: number; seed?: number}> = ({id, freq, blend, opacity, seed = 3}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, mixBlendMode: blend, opacity, pointerEvents: 'none'}}>
    <filter id={id}><feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={3} seed={seed} /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width="100%" height="100%" filter={`url(#${id})`} />
  </svg>
);
const levels = (n: number) => Array.from({length: n}, (_, i) => (i / (n - 1)).toFixed(2)).join(' ');
const bloomMask = (t: number, rate: number, cx = 50, cy = 46): React.CSSProperties => {
  const r = interpolate(t, [0, 1.2 / rate], [6, 92], clamp);
  const m = `radial-gradient(ellipse at ${cx}% ${cy}%, black ${r * 0.55}%, transparent ${r}%)`;
  return {maskImage: m, WebkitMaskImage: m};
};
const boil = (t: number, n: number) => 1 + (Math.floor(t * 8) % n);

const InkWash: React.FC<FrameProps> = ({children, t}) => {
  const th = useTheme();
  return (
    <Fill style={{background: th.bg}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="w-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feColorMatrix in="SourceGraphic" type="matrix" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 1 0" result="g" />
          <feComponentTransfer in="g" result="tone"><feFuncR type="table" tableValues="0 .12 .5 .88 1" /><feFuncG type="table" tableValues="0 .12 .5 .88 1" /><feFuncB type="table" tableValues="0 .12 .5 .88 1" /></feComponentTransfer>
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={3} seed={boil(t, 3)} result="n" />
          <feDisplacementMap in="tone" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <Fill style={{...bloomMask(t, 1), mixBlendMode: 'multiply'}}><Fill style={{top: 120, bottom: 360, left: 40, right: 40}}>{children}</Fill></Fill>
      <Grain id="w-ink-p" freq={0.8} blend="multiply" opacity={0.3} />
      <div style={{position: 'absolute', right: 90, top: 1560, width: 74, height: 74, background: th.alert, borderRadius: 6, opacity: interpolate(t, [0.9, 1.1], [0, 0.9], clamp)}} />
    </Fill>
  );
};

const Watercolor: React.FC<FrameProps> = ({children, t}) => {
  const th = useTheme();
  return (
    <Fill style={{background: th.bg}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="w-wc" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b" />
          <feComponentTransfer in="b" result="p"><feFuncR type="discrete" tableValues={levels(9)} /><feFuncG type="discrete" tableValues={levels(9)} /><feFuncB type="discrete" tableValues={levels(9)} /></feComponentTransfer>
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={4} seed={4} result="n" />
          <feDisplacementMap in="p" in2="n" scale="24" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <Fill style={bloomMask(t, 0.8, 50, 42)}><Fill style={{top: 100, bottom: 330, left: 30, right: 30}}>{children}</Fill></Fill>
      <Grain id="w-wc-p" freq={0.6} blend="multiply" opacity={0.35} seed={9} />
    </Fill>
  );
};

const Crayon: React.FC<FrameProps> = ({children, t, seed}) => {
  const th = useTheme();
  return (
    <Fill style={{background: th.bg}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="w-cr" x="-5%" y="-5%" width="110%" height="110%">
          <feComponentTransfer in="SourceGraphic" result="p"><feFuncR type="discrete" tableValues={levels(7)} /><feFuncG type="discrete" tableValues={levels(7)} /><feFuncB type="discrete" tableValues={levels(7)} /></feComponentTransfer>
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={boil(t, 4)} result="n" />
          <feDisplacementMap in="p" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <Fill style={{clipPath: torn(seed + 3, 40, 160, 1040, 1530), background: th.accent, transform: 'rotate(0.8deg)'}} />
      <Fill style={{clipPath: torn(seed, 62, 182, 1018, 1508)}}>{children}</Fill>
      <Grain id="w-cr-p" freq={0.9} blend="overlay" opacity={0.55} seed={boil(t, 4)} />
    </Fill>
  );
};

const Impasto: React.FC<FrameProps> = ({children, t}) => {
  const th = useTheme();
  const sweep = interpolate(t, [0, 0.9], [0, 130], clamp);
  return (
    <Fill style={{background: th.shadow}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="w-im" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves={3} seed={6} result="n" />
          <feDisplacementMap in="b" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feDiffuseLighting in="n" surfaceScale="5" diffuseConstant="1.15" result="l"><feDistantLight azimuth="225" elevation="58" /></feDiffuseLighting>
          <feComposite in="d" in2="l" operator="arithmetic" k1="1.15" k2="0.1" k3="0" k4="0" />
        </filter>
      </svg>
      <Fill style={{left: 46, right: 46, top: 150, bottom: 360, border: `34px solid ${th.warn}`, boxShadow: `inset 0 0 0 6px ${th.shadow}, inset 0 0 40px 10px ${alpha(th.shadow, 0.6)}, 0 30px 60px ${alpha(th.shadow, 0.7)}`, overflow: 'hidden'}}>
        <Fill style={{left: -80, right: -80, clipPath: `polygon(0 0, ${sweep}% 0, ${sweep - 30}% 100%, 0 100%)`}}><Fill style={{top: -110, left: 40, width: 1080, height: 1920}}>{children}</Fill></Fill>
      </Fill>
    </Fill>
  );
};

const Clean: React.FC<FrameProps> = ({children}) => <>{children}</>;
const sticker = (th: Theme) => `drop-shadow(7px 0 0 ${th.ink}) drop-shadow(-7px 0 0 ${th.ink}) drop-shadow(0 7px 0 ${th.ink}) drop-shadow(0 -7px 0 ${th.ink})`;

export const WORLDS: Record<WorldId, World> = {
  clean: {fps: FPS, chrome: true, atmos: ['grain', 'flare'], prop: () => '', Frame: Clean},
  papercut: {fps: 12, chrome: false, atmos: ['grain'], plate: 'url(#w-pc) saturate(1.4) brightness(1.3)', prop: sticker, Frame: Papercut},
  blueprint: {fps: FPS, chrome: false, atmos: [], plate: 'url(#w-bp)', prop: () => 'url(#w-bpp)', Frame: Blueprint},
  newsreel: {fps: 15, chrome: false, atmos: ['grain'], plate: 'grayscale(1) sepia(0.45) contrast(1.25)', prop: () => 'grayscale(1) sepia(0.5) contrast(1.2)', Frame: Newsreel},
  halftone: {fps: FPS, chrome: false, atmos: [], plate: 'grayscale(1) contrast(1.7) brightness(1.1)', prop: (th) => `grayscale(1) contrast(1.5) drop-shadow(8px 8px 0 ${th.accent})`, Frame: Halftone},
  comic: {fps: 12, chrome: false, atmos: [], plate: 'contrast(1.3) saturate(1.6)', prop: (th) => `drop-shadow(8px 8px 0 ${th.shadow})`, Frame: Comic},
  inkwash: {fps: 24, chrome: false, atmos: [], plate: 'url(#w-ink)', prop: () => 'url(#w-ink) grayscale(1)', Frame: InkWash},
  watercolor: {fps: 12, chrome: false, atmos: [], plate: 'url(#w-wc) saturate(0.85) brightness(1.35) contrast(0.9)', prop: () => 'url(#w-wc)', Frame: Watercolor},
  crayon: {fps: 8, chrome: false, atmos: [], plate: 'url(#w-cr) saturate(1.2) brightness(1.25)', prop: () => 'url(#w-cr)', Frame: Crayon},
  impasto: {fps: 15, chrome: false, atmos: [], plate: 'url(#w-im) saturate(1.4)', prop: () => 'url(#w-im)', Frame: Impasto},
  scrapbook: {fps: 12, chrome: false, atmos: ['grain'], prop: sticker, Frame: Scrapbook},
};
