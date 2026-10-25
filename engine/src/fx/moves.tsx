// The ten named moves (Motion Graphics starter kit, page 7), ported to Remotion: Rise, Pop, Count-up, Checklist tick,
// Typewriter, Slide-in, Blur-in, Punch-in, Reframe, Bar fill. Each has fixed timing and easing from the style block
// (blocks.tsx); a scene changes only its parameters. Sound only where it carries meaning (the kit's rule): a tick per list item,
// the counter while a number rolls, the fill under a bar, a chime when asked (the last card). Never on slides in or out.
import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {k} from '../films/kit';
import {FPS} from '../lib/timing';
import {useTheme} from '../themes';
import {arrive, backOut, power, stagger, useBlock} from './blocks';

const SFX_VOLUME = 0.1; // about 20 dB under the voice
export type Kit = 'tick' | 'counter' | 'fill' | 'chime' | 'pop' | 'snap' | 'success' | 'switch' | 'star';
export const Sfx: React.FC<{at: number; name: Kit; volume?: number}> = ({at, name, volume = SFX_VOLUME}) => (
  <Sequence from={Math.max(0, Math.round(at * FPS))} layout="none">
    <Audio src={staticFile(`sfx/kit/${name}.wav`)} volume={volume} />
  </Sequence>
);

type M = {t: number; at?: number; chime?: boolean; children?: React.ReactNode; style?: React.CSSProperties};
const Chime: React.FC<{on?: boolean; at: number}> = ({on, at}) => (on ? <Sfx at={at} name="chime" /> : null);

// Rise: fades in while moving up 40 px (30 px and a slight scale in a calm block).
export const Rise: React.FC<M> = ({t, at = 0, chime, children, style}) => {
  const b = useBlock();
  const p = arrive(b, t, at);
  const calm = b.card === 'glass';
  return (
    <div style={{opacity: Math.min(1, p * 1.4), translate: `0 ${(1 - p) * (calm ? 30 : 40)}px`, scale: calm ? String(0.96 + 0.04 * p) : undefined, ...style}}>
      {children}
      <Chime on={chime} at={at} />
    </div>
  );
};

// Pop: scales from 0.6 to 1 with a little overshoot (more in a bouncy block, none in a calm one).
export const Pop: React.FC<M> = ({t, at = 0, chime, children, style}) => {
  const b = useBlock();
  const p = k(t, [at, at + Math.max(0.35, b.dur)], [0, 1], b.card === 'glass' || b.card === 'paper' ? b.ease : backOut(b.bounce || 1.7));
  return (
    <div style={{opacity: Math.min(1, p * 3), scale: String(0.6 + 0.4 * p), ...style}}>
      {children}
      <Chime on={chime} at={at} />
    </div>
  );
};

// Count-up: a number rolls from `from` to `to` (Indian grouping for rupees), with the counter sound while it rolls.
export const CountUp: React.FC<M & {from?: number; to: number; dur?: number; prefix?: string; suffix?: string; grouping?: 'en-IN' | 'en-US'}> = ({t, at = 0, from = 0, to, dur = 1.1, prefix = '', suffix = '', grouping = 'en-IN', chime, style}) => {
  const b = useBlock();
  const v = from + (to - from) * k(t, [at, at + dur], [0, 1], power(3)); // a number never overshoots, whatever the block
  return (
    <div style={{fontVariantNumeric: 'tabular-nums', ...style}}>
      {prefix}
      {Math.round(v).toLocaleString(grouping)}
      {suffix}
      <Sfx at={at} name="counter" />
      <Chime on={chime} at={at + dur} />
    </div>
  );
};

// Checklist tick: each line gets a tick, one after the other, a tick sound with each.
export const Checklist: React.FC<M & {items: string[]; every?: number}> = ({t, at = 0, items, every = 0.35, chime, style}) => {
  const b = useBlock();
  const th = useTheme();
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 28, ...style}}>
      {items.map((x, i) => {
        const ti = at + stagger(b, i, every);
        const p = arrive(b, t, ti, 0.3);
        return (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: 28, opacity: 0.55 + 0.45 * p}}>
            <svg width={64} height={64} viewBox="0 0 64 64">
              <rect x={3} y={3} width={58} height={58} rx={b.card === 'pop' ? 8 : 16} fill="none" stroke={th.ink} strokeWidth={4} />
              <path d="M16 33 L28 45 L49 20" fill="none" stroke={th.ok} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
            </svg>
            <span>{x}</span>
            <Sfx at={ti} name="tick" />
          </div>
        );
      })}
      <Chime on={chime} at={at + stagger(b, items.length - 1, every) + 0.3} />
    </div>
  );
};

// Typewriter: a sentence types itself letter by letter, with a caret while it types.
export const Typewriter: React.FC<M & {text: string; cps?: number}> = ({t, at = 0, text, cps = 22, chime, style}) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((t - at) * cps)));
  const caret = n < text.length || Math.floor(t * 2) % 2 === 0;
  return (
    <div style={{whiteSpace: 'pre-wrap', ...style}}>
      {text.slice(0, n)}
      <span style={{opacity: caret ? 1 : 0}}>|</span>
      <Chime on={chime} at={at + text.length / cps} />
    </div>
  );
};

// Slide-in: arrives from the right (or the left), no sound.
export const SlideIn: React.FC<M & {from?: 'right' | 'left'}> = ({t, at = 0, from = 'right', children, style}) => {
  const b = useBlock();
  const p = arrive(b, t, at);
  return <div style={{translate: `${(1 - p) * (from === 'right' ? 1100 : -1100)}px 0`, ...style}}>{children}</div>;
};

// Blur-in: goes from blurry to sharp.
export const BlurIn: React.FC<M> = ({t, at = 0, children, style}) => {
  const b = useBlock();
  const p = arrive(b, t, at, b.dur * 1.4);
  return <div style={{filter: `blur(${((1 - p) * 24).toFixed(2)}px)`, opacity: Math.min(1, p * 2), ...style}}>{children}</div>;
};

// Punch-in: the whole frame zooms in 15% fast, then holds. Wrap the frame's content in it.
export const PunchIn: React.FC<M & {amount?: number; origin?: string}> = ({t, at = 0, amount = 0.15, origin = '50% 50%', children}) => (
  <div style={{position: 'absolute', inset: 0, scale: String(1 + amount * k(t, [at, at + 0.22], [0, 1])), transformOrigin: origin}}>{children}</div>
);

// Reframe: a full-screen panel shrinks into a rounded card in the bottom half while new content arrives on top.
export const Reframe: React.FC<M & {panel: React.ReactNode; top: React.ReactNode}> = ({t, at = 0, panel, top}) => {
  const b = useBlock();
  const p = arrive(b, t, at, Math.max(0.5, b.dur));
  const lerp = (a: number, z: number) => a + (z - a) * p;
  return (
    <>
      <div style={{position: 'absolute', left: lerp(0, 90), top: lerp(0, 980), width: lerp(1080, 900), height: lerp(1920, 560), borderRadius: lerp(0, 36), overflow: 'hidden'}}>{panel}</div>
      <div style={{position: 'absolute', left: 90, right: 150, top: 300, opacity: k(t, [at + 0.25, at + 0.6], [0, 1]), translate: `0 ${(1 - p) * 40}px`}}>{top}</div>
    </>
  );
};

// Bar fill: a progress bar fills to `to` percent, with the fill sound under it.
export const BarFill: React.FC<M & {to?: number; dur?: number; label?: string}> = ({t, at = 0, to = 100, dur = 1.2, label, chime, style}) => {
  const b = useBlock();
  const th = useTheme();
  const p = k(t, [at, at + dur], [0, to], power(3)); // nor does a bar
  const pop = b.card === 'pop';
  return (
    <div style={{width: '100%', ...style}}>
      {label && <div style={{marginBottom: 18, display: 'flex', justifyContent: 'space-between'}}><span>{label}</span><span style={{fontVariantNumeric: 'tabular-nums'}}>{Math.round(p)}%</span></div>}
      <div style={{height: 44, borderRadius: pop ? 10 : 22, background: th.rule, border: pop ? `4px solid ${th.ink}` : undefined, overflow: 'hidden'}}>
        <div style={{width: `${p}%`, height: '100%', background: th.accent}} />
      </div>
      <Sfx at={at} name="fill" />
      <Chime on={chime} at={at + dur} />
    </div>
  );
};

export const MOVES = {rise: Rise, pop: Pop, 'count-up': CountUp, checklist: Checklist, typewriter: Typewriter, 'slide-in': SlideIn, 'blur-in': BlurIn, 'punch-in': PunchIn, reframe: Reframe, 'bar-fill': BarFill} as const;
