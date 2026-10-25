// Style blocks (from the Motion Graphics starter kit's four styles, re-skinned as our suits in themes.ts): the same script and
// the same moves, a different block. A block is a suit + type + a motion feel (easing, duration, bounce, timing imperfection)
// + a background + a card. Moves (moves.tsx) read the block, so a film never hand-tunes a move.
import React, {createContext, useContext} from 'react';
import {Grain, k} from '../films/kit';
import {type ThemeName, THEMES, useTheme} from '../themes';

// easings by their usual names (GSAP's curves, written out)
export const power = (n: number) => (x: number) => 1 - Math.pow(1 - x, n + 1);
export const backOut = (s: number) => (x: number) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);

export type BlockId = 'kinetic' | 'glass' | 'grain' | 'pop-bold';
export type Block = {
  id: BlockId;
  theme: ThemeName;
  display: string; // headline face
  body: string;
  caps: boolean;
  ease: (x: number) => number; // how things arrive
  dur: number; // seconds a move takes
  bounce: number; // 0 = nothing bounces; else the back.out strength
  jitter: number; // 0..1: how uneven staggers are (editorial imperfection)
  card: 'none' | 'glass' | 'paper' | 'pop';
};
export const BLOCKS: Record<BlockId, Block> = {
  kinetic: {id: 'kinetic', theme: 'kinetic', display: '"Archivo Black", sans-serif', body: 'Inter, sans-serif', caps: true, ease: power(4), dur: 0.3, bounce: 0, jitter: 0, card: 'none'},
  glass: {id: 'glass', theme: 'glass', display: 'Inter, sans-serif', body: 'Inter, sans-serif', caps: false, ease: power(3), dur: 0.6, bounce: 0, jitter: 0, card: 'glass'},
  grain: {id: 'grain', theme: 'grain', display: '"Instrument Serif", serif', body: 'Inter, sans-serif', caps: false, ease: power(2), dur: 0.75, bounce: 0, jitter: 0.35, card: 'paper'},
  'pop-bold': {id: 'pop-bold', theme: 'pop-bold', display: '"Bricolage Grotesque", sans-serif', body: '"Bricolage Grotesque", sans-serif', caps: false, ease: backOut(2.5), dur: 0.45, bounce: 2.5, jitter: 0, card: 'pop'},
};
const BlockCtx = createContext<Block>(BLOCKS.kinetic);
export const useBlock = () => useContext(BlockCtx);
export const BlockProvider: React.FC<{id: BlockId; children: React.ReactNode}> = ({id, children}) => <BlockCtx.Provider value={BLOCKS[id]}>{children}</BlockCtx.Provider>;
export const blockTheme = (id: BlockId) => THEMES[BLOCKS[id].theme];

// a stagger that is even, or a little uneven in a block that wants it (seeded, so it renders the same every time)
export const stagger = (b: Block, i: number, step: number) => i * step * (1 + b.jitter * (Math.sin(i * 12.9898) * 0.5));

const mix = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;

// The block's ground: flat black (kinetic); drifting blurred blobs (glass); paper with moving grain (grain); flat page with
// slowly spinning stickers (pop-bold).
export const Ground: React.FC<{t: number}> = ({t}) => {
  const b = useBlock();
  const th = useTheme();
  return (
    <div style={{position: 'absolute', inset: 0, background: th.bg, overflow: 'hidden'}}>
      {b.card === 'glass' &&
        [th.flow, th.warn, th.alert].map((c, i) => (
          <div key={i} style={{position: 'absolute', width: 900, height: 900, borderRadius: '50%', background: c, filter: 'blur(120px)', opacity: 0.85, left: -200 + i * 380 + Math.sin(t * 0.25 + i * 2) * 120, top: 200 + i * 520 + Math.cos(t * 0.2 + i) * 140}} />
        ))}
      {b.card === 'paper' && <Grain opacity={0.12} />}
      {b.card === 'pop' &&
        [0, 1, 2].map((i) => (
          <svg key={i} width={180} height={180} viewBox="-50 -50 100 100" style={{position: 'absolute', left: [70, 830, 120][i], top: [260, 520, 1500][i], rotate: `${t * 25 * (i % 2 ? -1 : 1)}deg`}}>
            {i === 1 ? <circle r={40} fill={th.flow} stroke={th.ink} strokeWidth={4} /> : <polygon points="0,-46 12,-14 46,-14 18,6 28,40 0,20 -28,40 -18,6 -46,-14 -12,-14" fill={i ? th.alert : th.accent} stroke={th.ink} strokeWidth={4} />}
          </svg>
        ))}
    </div>
  );
};

// The block's card: frosted glass, a slightly turned paper cut-out, a flat block with outline and hard shadow, or nothing.
export const Card: React.FC<{children: React.ReactNode; style?: React.CSSProperties; tone?: 'surface' | 'accent' | 'flow' | 'alert'; seed?: number}> = ({children, style, tone = 'surface', seed = 0}) => {
  const b = useBlock();
  const th = useTheme();
  const look: React.CSSProperties =
    b.card === 'glass'
      ? {background: mix(th.surface, 80), backdropFilter: 'blur(30px)', border: `2px solid ${mix(th.surface, 90)}`, borderRadius: 32, boxShadow: `0 24px 60px ${mix(th.shadow, 14)}`}
      : b.card === 'paper'
        ? {background: th.surface, rotate: `${(Math.sin(seed * 3.1) * 2.4).toFixed(2)}deg`, boxShadow: `0 2px 0 ${th.rule}`}
        : b.card === 'pop'
          ? {background: th[tone], border: `4px solid ${th.ink}`, borderRadius: 18, boxShadow: `8px 8px 0 ${th.shadow}`}
          : {};
  return <div style={{padding: '40px 48px', color: th.ink, fontFamily: b.display, ...look, ...style}}>{children}</div>;
};

// k() with the block's easing over the block's duration, starting at `at`
export const arrive = (b: Block, t: number, at: number, dur = b.dur) => k(t, [at, at + dur], [0, 1], b.ease);
