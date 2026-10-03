import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {SIDE, TYPE} from '../theme';
import {card, useTheme} from '../themes';
import {clamp, type PrimitiveProps, Shot, springFrom, STAGE} from './atoms';

type P = {label: string; text: string; sub?: string};

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
// Which glyph tile i shows on flip k: a fixed scramble, the same every render.
const scramble = (i: number, k: number) => GLYPHS[(i * 7 + k * 13 + ((i * k) % 5)) % GLYPHS.length];

// Airport board: each tile flips through letters and lands on its character, left to right; the last one lands on cue 0.
// With a reveal colour (archive-gold) the whole word turns to it the moment the last tile lands.
export const SplitFlap: React.FC<PrimitiveProps<P>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const chars = [...p.text.toUpperCase()];
  const flips = (i: number) => 5 + i * 2; // later tiles flip longer, so the word settles left to right
  // the last tile lands on cue 0 (default: 20 frames before the cut); flipping starts as early as needed to get there
  const end = Math.min(cues[0] ?? dur - 20, dur - 8);
  const STEP = Math.max(1, Math.min(3, Math.floor((end - 4) / flips(chars.length - 1)))); // frames per flip
  const start = Math.max(4, end - flips(chars.length - 1) * STEP);
  const settle = (i: number) => start + flips(i) * STEP;
  const W = Math.min(110, Math.floor((1080 - 2 * (SIDE + 30) - (chars.length - 1) * 10) / chars.length));
  const H = Math.round(W * 1.45);
  const appear = springFrom(f, 0, {damping: 14, stiffness: 180});
  const subIn = interpolate(f, [settle(chars.length - 1), settle(chars.length - 1) + 8], [0, 1], clamp);
  return (
    <Shot dur={dur}>
      <div style={{position: 'absolute', top: STAGE.cy - H / 2 - 90, left: SIDE + 30, right: SIDE + 30, /* +30: headroom for the 6% push-in zoom (needs 24+) */ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: appear, transform: `translateY(${(1 - appear) * -30}px)`}}>
        <div data-tb="label" style={{fontFamily: TYPE.data, fontSize: 40, fontWeight: 700, letterSpacing: '0.12em', color: th.muted}}>{p.label}</div>
        <div style={{display: 'flex', gap: 10}}>
          {chars.map((c, i) => {
            const k = Math.floor((f - start) / STEP);
            const done = c === ' ' || f >= settle(i);
            const shown = f < start ? ' ' : done ? c : scramble(i, k);
            const phase = done || f < start ? 1 : ((f - start) % STEP) / STEP; // the top flap falls during each flip
            return (
              <div key={i} data-box style={{...card(th), position: 'relative', width: W, height: H, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c === ' ' ? th.bg : th.surface}}>
                <div style={{fontFamily: TYPE.display, fontSize: Math.round(W * 0.82), fontWeight: 900, color: th.reveal && f >= settle(chars.length - 1) ? th.reveal : th.ink, fontVariantNumeric: 'tabular-nums'}}>{shown.trim()}</div>
                <div style={{position: 'absolute', left: 0, right: 0, top: H / 2 - 2, height: 4, background: th.rule}} />
                {phase < 1 ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: H / 2, background: th.surface, transformOrigin: 'bottom', transform: `scaleY(${1 - phase})`, borderBottom: `2px solid ${th.rule}`}} /> : null}
              </div>
            );
          })}
        </div>
        {p.sub ? <div data-tb="sub" style={{fontFamily: TYPE.data, fontSize: 40, fontWeight: 600, color: th.ink, opacity: subIn, textAlign: 'center'}}>{p.sub}</div> : null}
      </div>
      {chars.map((c, i) => (c === ' ' ? null : <Sfx key={i} at={settle(i)} name="tick" volume={0.25} />))}
    </Shot>
  );
};
