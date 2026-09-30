// Shared building blocks for primitives: timing helpers, the shot frame, and brand props (cards, nodes, highlighter).
// ponytail: visuals copied from story/Story.tsx; the copy goes away when the Composer replaces Story.tsx (A4).
import {Check} from 'lucide-react';
import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame} from 'remotion';
import {cuesOr, FPS} from '../lib/timing';

export {cuesOr};
import {FONT, TYPE} from '../theme';
import {alpha, card, useTheme} from '../themes';
import {Icon} from '../ui/Icon';

export type Item = {title: string; id: string; pill: string; amount: boolean};
export type Node = {icon: string; label: string; sub: string};
export type PrimitiveProps<P> = {p: P; dur: number; cues: number[]}; // frames, relative to shot start

// ---- timing ----
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const EASE = Easing.bezier(0.65, 0, 0.35, 1);
export const LINEAR = (t: number) => t;
export const prog = (f: number, a: number, dur: number, e: (t: number) => number = EASE) => interpolate(f, [a, a + dur], [0, 1], {...clamp, easing: e});
export const springFrom = (f: number, a: number, config = {}) => (f < a ? 0 : spring({frame: f - a, fps: FPS, config: {damping: 14, stiffness: 150, mass: 0.8, ...config}}));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- the shot: backdrop dot grid + a camera at `zoom` pushing by `push` (negative = pull back) around the stage centre ----
export const STAGE = {top: 280, bottom: 1080, cy: 680};

export const Shot: React.FC<{dur: number; zoom?: number; push?: number; children: React.ReactNode}> = ({dur, zoom = 1, push = 0.06, children}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const z = zoom * (1 + push * prog(f, 0, dur, LINEAR));
  return (
    <AbsoluteFill style={{background: th.bg, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: -200,
          backgroundImage: `radial-gradient(${alpha(th.ink, 0.09)} 2.5px, transparent 2.5px)`,
          backgroundSize: '48px 48px',
          backgroundPosition: `${(f * 0.15) % 48}px 0`,
          transform: `scale(${1 + (z - 1) * 0.35})`,
        }}
      />
      <AbsoluteFill style={{transformOrigin: `540px ${STAGE.cy}px`, transform: `scale(${z})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---- brand props ----
export const Highlight: React.FC<{p: number; children: React.ReactNode}> = ({p, children}) => {
  const th = useTheme();
  return (
    <span style={{position: 'relative', display: 'inline-block'}}>
      <span style={{position: 'absolute', left: -8, right: -8, top: '18%', bottom: '6%', background: th.accent, transformOrigin: '0 50%', transform: `scaleX(${p}) skewX(-6deg)`, borderRadius: 4, zIndex: 0}} />
      <span style={{position: 'relative', zIndex: 1, color: p > 0.5 ? th.onAccent : undefined}}>{children}</span>
    </span>
  );
};

const AMOUNT = (i: number) => (8000 + Math.round(random(`amt${i}`) * 520) * 100).toLocaleString('en-IN');

// A paper document card (invoice, order, bill...). (x, y) is its centre.
export const ItemCard: React.FC<{item: Item; n: number; x: number; y: number; rot: number; scale?: number; opacity?: number; z?: number}> = ({item, n, x, y, rot, scale = 1, opacity = 1, z}) => {
  const th = useTheme();
  return (
    <div
      data-tb-skip // decorative document prop: tiny text, flies in from off-screen
      style={{
        position: 'absolute',
        left: x - 75,
        top: y - 95,
        width: 150,
        height: 190,
        zIndex: z,
        opacity,
        transform: `rotate(${rot}deg) scale(${scale})`,
        background: th.surface,
        border: `3px solid ${th.ink}`,
        borderRadius: 16,
        boxShadow: `6px 6px 0 ${th.shadow}`,
        padding: '14px 13px',
        color: th.ink,
      }}
    >
      <div style={{fontFamily: TYPE.title, fontSize: 17, fontWeight: 900, letterSpacing: '0.06em'}}>{item.title}</div>
      <div style={{fontFamily: TYPE.data, fontSize: 12, color: th.muted, fontWeight: 600, marginTop: 3}}>{item.id}{n}</div>
      {[1, 0.75, 0.9].map((w, k) => (
        <div key={k} style={{height: 6, width: `${w * 100}%`, borderRadius: 3, background: th.rule, marginTop: k ? 8 : 14}} />
      ))}
      {item.amount ? <div style={{fontFamily: TYPE.data, fontSize: 19, fontWeight: 700, marginTop: 14}}>₹{AMOUNT(n)}</div> : <div style={{height: 6, width: '60%', borderRadius: 3, background: th.rule, marginTop: 8}} />}
      <div style={{position: 'absolute', right: 10, bottom: 10, background: th.alert, color: th.surface, fontFamily: TYPE.data, fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6}}>{item.pill}</div>
    </div>
  );
};

export const NODE_W = 410;
export const NODE_H = 118;
const SPIN = new Set(['hourglass', 'refresh', 'repeat', 'clock', 'timer']);

// An automation step card. (x, y) is its centre. active = working (flow tint), green = done (ok tint).
export const NodeCard: React.FC<{node: Node; x: number; y: number; appear: number; active: number; green: number; z?: number}> = ({node, x, y, appear, active, green, z}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const on = Math.max(active, green) > 0.5;
  const tint = green > 0.5 ? th.ok : th.flow;
  return (
    <div
      data-box
      style={{
        ...card(th),
        position: 'absolute',
        left: x - NODE_W / 2,
        top: y - NODE_H / 2,
        width: NODE_W,
        height: NODE_H,
        zIndex: z,
        boxShadow: `${on ? 10 : 8}px ${on ? 10 : 8}px 0 ${th.shadow}`,
        opacity: appear,
        transform: `scale(${0.55 + 0.45 * appear}) translate(${on ? -2 : 0}px, ${on ? -2 : 0}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '0 24px',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 16,
          flexShrink: 0,
          border: `3px solid ${th.ink}`,
          background: on ? tint : th.surface,
          color: on ? th.surface : th.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: SPIN.has(node.icon) && active > 0.5 ? `rotate(${((f % 40) / 40) * 180}deg)` : undefined,
        }}
      >
        <Icon name={node.icon} size={38} stroke={2.5} />
      </div>
      <div>
        <div style={{fontFamily: TYPE.title, fontSize: 33, fontWeight: 800, color: th.ink, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>{node.label}</div>
        <div style={{fontFamily: TYPE.data, fontSize: 19, fontWeight: 600, color: th.muted, marginTop: 4}}>{node.sub}</div>
      </div>
    </div>
  );
};

// Zig-zag positions for 2 to 4 steps, centred in the stage.
export const nodeLayout = (n: number) => {
  const gap = 190;
  const y0 = STAGE.cy - ((n - 1) * gap) / 2;
  return Array.from({length: n}, (_, k) => ({x: k % 2 ? 600 : 480, y: y0 + k * gap}));
};
export const linkPath = (a: {x: number; y: number}, b: {x: number; y: number}) =>
  `M ${a.x} ${a.y + NODE_H / 2} C ${a.x} ${a.y + NODE_H / 2 + 45} ${b.x} ${b.y - NODE_H / 2 - 45} ${b.x} ${b.y - NODE_H / 2}`;

// A pill badge with a check, e.g. PAID / DONE.
export const DonePill: React.FC<{label: string; style?: React.CSSProperties}> = ({label, style}) => {
  const th = useTheme();
  return (
    <div data-box style={{background: th.ok, color: th.surface, border: `3px solid ${th.ink}`, borderRadius: 999, padding: '4px 14px', fontFamily: TYPE.data, fontWeight: 900, fontSize: 24, display: 'flex', alignItems: 'center', gap: 6, ...style}}>
      <Check size={22} strokeWidth={3.5} /> {label}
    </div>
  );
};

// Chat bubble: app label, message, read ticks. p = 0..1 pop progress.
export const Bubble: React.FC<{app: string; text: string; p: number; style?: React.CSSProperties}> = ({app, text, p, style}) => {
  const th = useTheme();
  return p <= 0 ? null : (
    <div
      data-box
      style={{
        ...card(th),
        position: 'absolute',
        borderRadius: '24px 24px 6px 24px',
        opacity: Math.min(1, p * 1.5),
        transform: `scale(${0.6 + 0.4 * p})`,
        transformOrigin: '100% 100%',
        color: th.ink,
        padding: '14px 18px 10px',
        ...style,
      }}
    >
      <div style={{fontFamily: TYPE.data, fontSize: 14, fontWeight: 700, color: th.muted}}>{app} · EXAMPLE</div>
      <div style={{fontFamily: FONT, fontSize: 23, fontWeight: 600, lineHeight: 1.3, marginTop: 6}}>{text}</div>
      <div style={{display: 'flex', justifyContent: 'flex-end', color: th.flow, marginTop: 2}}>
        <Check size={20} strokeWidth={3} />
        <Check size={20} strokeWidth={3} style={{marginLeft: -12}} />
      </div>
    </div>
  );
};
