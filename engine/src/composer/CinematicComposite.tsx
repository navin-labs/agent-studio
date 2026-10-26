// Cinematic composite: one documentary shot built from four layers, the way a motion designer stacks a frame.
//   1. plate: a full-bleed photo or clip (engine/src/lib/mediaHub.ts puts it in public/media) moved by a camera rig and graded
//   2. atmosphere: light and texture over the plate (vignette, anamorphic flare, scanlines, ink, grain)
//   3. hero: an oversized stat (30-40% of the frame) or one verbatim artifact, a short quote pinned like evidence
//   4. chrome: case tag, running timecode, citation bar (source + plate credit), power-word captions
// Optional children draw between the atmosphere and the hero (an illustrated overlay: a waveform, a beam, a lens).
// Every colour is a theme token, so the active style re-grades the whole shot. Text stays inside x 116..960, y 250..1500,
// the safe area shared by Instagram and YouTube (composer/textcheck.ts).
import {noise2D} from '@remotion/noise';
import React from 'react';
import {Easing, Img, interpolate, OffthreadVideo, random, spring, staticFile} from 'remotion';
import {parseAccent} from '../lib/text';
import {FPS} from '../lib/timing';
import {POWER_SCALE} from '../host/power';
import {TYPE} from '../theme';
import {alpha, type Theme, useTheme} from '../themes';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);

export type PlateRef = {src: string; kind: 'image' | 'video'; credit?: string};
export type Move = 'ken-burns' | 'tilt' | 'push' | 'drift';
export type Grade = 'noir' | 'teal-orange' | 'cold' | 'warm-archive' | 'mono-tint';
export type Atmos = 'flare' | 'scanlines' | 'ink' | 'grain';
export type Hero = {value: string; unit?: string; label?: string};
export type Artifact = {quote: string; source: string};
export type Chrome = {caseTag: string; citation: string; at: number}; // at: film seconds, for the running timecode
export type CaptionLine = {vo: string; from: number; to: number; words?: {s: number}[]}; // scene seconds; words: measured starts

// ---------- layer 1: the plate ----------
const rig = (move: Move, t: number, d: number, seed: number) => {
  const u = interpolate(t, [0, d], [0, 1], clamp);
  if (move === 'tilt') return `perspective(1600px) rotateX(${interpolate(u, [0, 1], [9, 2])}deg) rotateY(${interpolate(u, [0, 1], [-7, 5])}deg) scale(${1.22 - 0.06 * u})`;
  if (move === 'push') return `scale(${1.08 + 0.28 * Easing.in(Easing.cubic)(u)})`;
  if (move === 'drift') return `translate(${noise2D('px', t / 3, seed) * 26}px, ${noise2D('py', t / 3.4, seed) * 20}px) rotate(${noise2D('pr', t / 4, seed) * 0.8}deg) scale(1.14)`;
  return `scale(${1.1 + 0.14 * u}) translate(${(random(`kb${seed}`) - 0.5) * 60 * u}px, ${-30 * u}px)`; // ken burns
};
const gradeFilter: Record<Grade, string> = {
  noir: 'grayscale(1) contrast(1.35) brightness(0.72)',
  'teal-orange': 'saturate(1.25) contrast(1.18) brightness(0.8)',
  cold: 'saturate(0.6) contrast(1.15) brightness(0.72)',
  'warm-archive': 'sepia(0.65) contrast(1.15) brightness(0.78)',
  'mono-tint': 'grayscale(1) contrast(1.3) brightness(0.78)',
};
// the tint laid over the graded plate, from the theme
const gradeTint = (g: Grade, th: Theme): React.CSSProperties =>
  g === 'teal-orange'
    ? {background: `linear-gradient(160deg, ${alpha(th.flow, 0.45)}, transparent 55%, ${alpha(th.warn, 0.4)})`, mixBlendMode: 'soft-light'}
    : g === 'mono-tint'
      ? {background: th.accent, mixBlendMode: 'color', opacity: 0.75}
      : g === 'cold'
        ? {background: alpha(th.flow, 0.35), mixBlendMode: 'color'}
        : g === 'warm-archive'
          ? {background: alpha(th.warn, 0.25), mixBlendMode: 'multiply'}
          : {background: alpha(th.accent, 0.18), mixBlendMode: 'soft-light'};

const PlateLayer: React.FC<{plate: PlateRef; move: Move; grade: Grade; t: number; d: number; seed: number}> = ({plate, move, grade, t, d, seed}) => {
  const th = useTheme();
  const media: React.CSSProperties = {position: 'absolute', inset: 0, width: 1080, height: 1920, objectFit: 'cover', filter: gradeFilter[grade]};
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: th.bg}}>
      <div style={{position: 'absolute', inset: 0, transform: rig(move, t, d, seed), transformOrigin: '540px 860px'}}>
        {plate.kind === 'video' ? <OffthreadVideo src={staticFile(plate.src)} muted style={media} /> : <Img src={staticFile(plate.src)} style={media} />}
        <div style={{position: 'absolute', inset: 0, ...gradeTint(grade, th)}} />
      </div>
    </div>
  );
};

// ---------- layer 2: atmosphere ----------
const Atmosphere: React.FC<{fx: Atmos[]; t: number; d: number; flareY: number}> = ({fx, t, d, flareY}) => {
  const th = useTheme();
  const f = Math.round(t * FPS);
  const fx_ = new Set(fx);
  const flareX = interpolate(t, [0, d], [-200, 1280], clamp);
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      {/* the base light: a darker floor for captions, a vignette for the eye */}
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(transparent 52%, ${alpha(th.shadow, 0.85)} 82%, ${alpha(th.shadow, 0.95)})`}} />
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(${alpha(th.shadow, 0.7)}, transparent 22%)`}} />
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 42%, transparent 45%, ${alpha(th.shadow, 0.75)} 100%)`}} />
      {fx_.has('flare') ? (
        <>
          <div style={{position: 'absolute', left: 0, right: 0, top: flareY - 3, height: 6, background: `linear-gradient(90deg, transparent, ${alpha(th.flow, 0.9)} ${(flareX / 1080) * 100}%, transparent)`, filter: 'blur(2px)'}} />
          <div style={{position: 'absolute', left: flareX - 260, top: flareY - 260, width: 520, height: 520, borderRadius: '50%', background: `radial-gradient(${alpha(th.ink, 0.55)}, ${alpha(th.flow, 0.18)} 30%, transparent 65%)`, mixBlendMode: 'screen'}} />
          <div style={{position: 'absolute', left: 1080 - flareX - 40, top: flareY + 120, width: 80, height: 80, borderRadius: '50%', border: `3px solid ${alpha(th.flow, 0.25)}`}} />
        </>
      ) : null}
      {fx_.has('scanlines') ? <div style={{position: 'absolute', inset: 0, background: `repeating-linear-gradient(0deg, ${alpha(th.shadow, 0.32)} 0 2px, transparent 2px 5px)`}} /> : null}
      {fx_.has('ink') ? <div style={{position: 'absolute', inset: 0, boxShadow: `inset 0 0 220px 60px ${alpha(th.shadow, 0.9)}`}} /> : null}
      {fx_.has('grain') || fx_.has('ink') ? (
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.35}}>
          <filter id={`cc-grain-${f % 8}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={f % 8} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#cc-grain-${f % 8})`} />
        </svg>
      ) : null}
    </div>
  );
};

// ---------- layer 3: hero stat or verbatim artifact ----------
const HeroStat: React.FC<{hero: Hero; t: number; at: number; y: number}> = ({hero, t, at, y}) => {
  const th = useTheme();
  const s = t < at ? 0 : spring({frame: Math.round((t - at) * FPS), fps: FPS, config: {damping: 14, stiffness: 160, mass: 0.9}});
  // fit the safe width (844 px): a display digit is about 0.66 em wide, the unit about 0.21 em per letter plus its gap
  const size = Math.min(380, Math.round(800 / (0.66 * hero.value.length + (hero.unit ? 0.21 * hero.unit.length + 0.12 : 0))));
  return (
    <div style={{position: 'absolute', left: 116, right: 120, top: y, textAlign: 'center', opacity: Math.min(1, s * 1.5), transform: `translateY(${(1 - s) * 60}px) scale(${0.9 + 0.1 * s})`}}>
      {hero.label ? <div data-tb="label" style={{fontFamily: TYPE.data, fontSize: 34, fontWeight: 700, letterSpacing: '0.24em', color: th.muted, textTransform: 'uppercase'}}>{hero.label}</div> : null}
      <div data-tb="hero" style={{fontFamily: TYPE.display, fontSize: size, fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.05em', color: th.ink, textShadow: `0 20px 80px ${alpha(th.shadow, 0.9)}`, whiteSpace: 'nowrap'}}>
        {hero.value}
        {hero.unit ? <span style={{fontSize: size * 0.32, letterSpacing: 0, color: th.accent, marginLeft: 12}}>{hero.unit}</span> : null}
      </div>
    </div>
  );
};

const Evidence: React.FC<{artifact: Artifact; t: number; at: number; y: number}> = ({artifact, t, at, y}) => {
  const th = useTheme();
  const shown = Math.max(0, Math.min(artifact.quote.length, Math.floor((t - at) * 38)));
  const e = interpolate(t, [at - 0.2, at + 0.2], [0, 1], {...clamp, easing: OUT});
  return (
    <div style={{position: 'absolute', left: 140, right: 140, top: y, opacity: e, transform: `rotate(${-1.5 + (1 - e) * -3}deg) translateY(${(1 - e) * 30}px)`}}>
      <div style={{position: 'absolute', left: -12, top: -26, width: 120, height: 36, background: alpha(th.warn, 0.75), transform: 'rotate(-4deg)'}} />
      <div style={{padding: '34px 38px 26px', background: alpha(th.surface, 0.88), borderLeft: `8px solid ${th.accent}`, boxShadow: `0 30px 80px ${alpha(th.shadow, 0.8)}`}}>
        <div data-tb="quote" style={{fontFamily: TYPE.data, fontSize: 40, fontWeight: 700, lineHeight: 1.3, color: th.ink}}>
          “{artifact.quote.slice(0, shown)}
          {shown < artifact.quote.length ? <span style={{color: th.accent}}>▍</span> : '”'}
        </div>
        <div data-tb="source" style={{marginTop: 18, fontFamily: TYPE.data, fontSize: 24, letterSpacing: '0.08em', color: th.muted}}>{artifact.source}</div>
      </div>
    </div>
  );
};

// ---------- layer 4: broadcast chrome ----------
const tc = (s: number) => {
  const f = Math.floor(s * FPS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(f / (FPS * 3600)))}:${p(Math.floor(f / (FPS * 60)) % 60)}:${p(Math.floor(f / FPS) % 60)}:${p(f % FPS)}`;
};
const ChromeLayer: React.FC<{chrome: Chrome; credit?: string; t: number}> = ({chrome, credit, t}) => {
  const th = useTheme();
  const rec = Math.floor(chrome.at * 2) % 2 === 0;
  const e = interpolate(t, [0, 0.3], [0, 1], clamp);
  return (
    <>
      <div style={{position: 'absolute', left: 120, top: 262, display: 'flex', alignItems: 'center', gap: 14, opacity: e}}>
        <div style={{width: 16, height: 16, borderRadius: 8, background: th.alert, opacity: rec ? 1 : 0.25}} />
        <div data-tb="case" style={{fontFamily: TYPE.data, fontSize: 26, fontWeight: 700, letterSpacing: '0.16em', color: th.ink, whiteSpace: 'nowrap'}}>{chrome.caseTag}</div>
      </div>
      <div data-tb="timecode" style={{position: 'absolute', right: 124, top: 262, fontFamily: TYPE.data, fontSize: 26, fontWeight: 700, letterSpacing: '0.08em', color: th.muted, opacity: e}}>{tc(chrome.at)}</div>
      <div style={{position: 'absolute', left: 120, right: 124, top: 1430, borderTop: `2px solid ${alpha(th.ink, 0.35)}`, paddingTop: 10, opacity: e}}>
        <div data-tb="citation" style={{fontFamily: TYPE.data, fontSize: 20, letterSpacing: '0.06em', color: th.muted, lineHeight: 1.35}}>
          {chrome.citation}
          {credit ? <span style={{opacity: 0.7}}> · {credit}</span> : null}
        </div>
      </div>
    </>
  );
};

// power-word captions: about four words at a time; *marked* words take the accent and spring to 1.2x as they are spoken
const PowerCaptions: React.FC<{line: CaptionLine; t: number}> = ({line, t}) => {
  const th = useTheme();
  const words = parseAccent(line.vo);
  if (!words.length || t < line.from || t > line.to + 0.3) return null;
  const starts = line.words?.length === words.length ? line.words.map((w) => w.s) : words.map((_, i) => line.from + ((line.to - line.from) * i) / words.length);
  const groups: number[][] = [];
  words.forEach((w, i) => {
    const g = groups.at(-1);
    if (!g || g.length >= 4 || /[.,!?;:]$/.test(words[i - 1]?.w ?? '')) groups.push([i]);
    else g.push(i);
  });
  const gi = groups.reduce((a, g, i) => (starts[g[0]] <= t ? i : a), 0);
  const f = Math.round(t * FPS);
  return (
    <div data-tb="caption" style={{position: 'absolute', left: 120, right: 124, top: 1270, minHeight: 130, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', columnGap: 18, fontFamily: TYPE.title, fontSize: 'calc(64px * var(--caption-scale, 1))', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em', textTransform: 'var(--caption-case, none)' as React.CSSProperties['textTransform'], textShadow: `0 6px 30px ${th.shadow}`}}>
      {groups[gi].map((i) => {
        const w = words[i];
        const s0 = Math.round(starts[i] * FPS), s1 = starts[i + 1] !== undefined ? Math.round(starts[i + 1] * FPS) : undefined;
        const pop = w.accent && f >= s0 ? 1 + (POWER_SCALE - 1) * spring({frame: f - s0, fps: FPS, config: {damping: 12, stiffness: 220, mass: 0.7}}) * (s1 === undefined ? 1 : 1 - interpolate(f - s1, [0, 6], [0, 1], clamp)) : 1;
        return (
          <span key={i} style={{display: 'inline-block', transform: `scale(${pop})`, color: w.accent ? th.accent : th.ink, opacity: f >= s0 ? 1 : 0.4}}>
            {w.w}
          </span>
        );
      })}
    </div>
  );
};

export type CompositeProps = {
  t: number; // seconds into the shot
  d: number; // shot length
  seed: number;
  plate: PlateRef;
  move?: Move;
  grade?: Grade;
  atmos?: Atmos[];
  hero?: Hero & {at?: number; y?: number};
  artifact?: Artifact & {at?: number; y?: number};
  chrome: Chrome;
  caption?: CaptionLine;
  flareY?: number;
  children?: React.ReactNode;
};

export const CinematicComposite: React.FC<CompositeProps> = ({t, d, seed, plate, move = 'ken-burns', grade = 'teal-orange', atmos = ['grain'], hero, artifact, chrome, caption, flareY = 700, children}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <PlateLayer plate={plate} move={move} grade={grade} t={t} d={d} seed={seed} />
    <Atmosphere fx={atmos} t={t} d={d} flareY={flareY} />
    {children}
    {hero ? <HeroStat hero={hero} t={t} at={hero.at ?? 0.35} y={hero.y ?? 560} /> : null}
    {artifact ? <Evidence artifact={artifact} t={t} at={artifact.at ?? 0.5} y={artifact.y ?? 820} /> : null}
    <ChromeLayer chrome={chrome} credit={plate.credit} t={t} />
    {caption ? <PowerCaptions line={caption} t={t} /> : null}
  </div>
);
