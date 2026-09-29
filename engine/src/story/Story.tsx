// "Story" format: one continuous animated world and a camera that moves through it. Faceless Brand Tokens v1 ("Paper & Signal").
// Template "pile-to-flow": a pile of manual work, a whip pan to a 4-step automation that clears it.
// Every label comes from script.world (defaults = the invoice example). Timing: node cues are the *accent* words in scenes 4 and 5.
import {CameraMotionBlur} from '@remotion/motion-blur';
import {noise2D} from '@remotion/noise';
import {evolvePath, getLength, getPointAtLength, getTangentAtLength} from '@remotion/paths';
import {Check} from 'lucide-react';
import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, random, Sequence, spring, staticFile, useCurrentFrame} from 'remotion';
import {ensureFonts} from '../fonts';
import {Sfx, SfxEnabled} from '../lib/frame';
import {parseAccent, splitWords, wordStarts} from '../lib/text';
import {computeFrames, LEAD, voSpanFrames} from '../lib/timing';
import {Captions} from './Captions';
import {FONT, HANDLE, TYPE} from '../theme';
import {alpha, card, THEMES, ThemeCtx, useTheme} from '../themes';
import type {ReelProps, World} from '../types';
import {Icon} from '../ui/Icon';

ensureFonts();

const FPS = 30;
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const EASE = Easing.bezier(0.65, 0, 0.35, 1);
const WHIP = Easing.bezier(0.75, 0, 0.25, 1);
const LINEAR = (t: number) => t;
const prog = (f: number, a: number, dur: number, e: (t: number) => number = EASE) => interpolate(f, [a, a + dur], [0, 1], {...clamp, easing: e});
const springFrom = (f: number, a: number, config = {}) => (f < a ? 0 : spring({frame: f - a, fps: FPS, config: {damping: 14, stiffness: 150, mass: 0.8, ...config}}));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- world layout (world px; zone A = the desk, zone B = the machine, one screen to the right) ----------
const PILE = {x: 540, y: 820};
const CAPTION_TOP = 1120; // captions sit inside the Meta/YouTube safe band (research: keep critical text above y=1250)
const NODES = [
  {x: 1810, y: 380},
  {x: 1930, y: 570},
  {x: 1810, y: 760},
  {x: 1930, y: 950},
];
export const DEFAULT_WORLD: World = {
  item: {title: 'INVOICE', id: 'INV-', start: 1038, pill: 'DUE', amount: true},
  counter: {label: 'UNPAID', icon: 'receipt'},
  nodes: [
    {icon: 'sheet', label: 'Read the sheet', sub: 'Receivables.xlsx'},
    {icon: 'hourglass', label: 'Overdue?', sub: 'Due date passed'},
    {icon: 'whatsapp', label: 'Send reminder', sub: 'WhatsApp + email'},
    {icon: 'check', label: 'Mark as paid', sub: 'When money lands'},
  ],
  message: {app: 'WHATSAPP', text: 'Hi Mehta ji, a gentle reminder: INV-1042 was due on 12 Sep.'},
  done: 'PAID',
};
const SPIN = new Set(['hourglass', 'refresh', 'repeat', 'clock', 'timer']);
const W = React.createContext<World>(DEFAULT_WORLD);
const NODE_W = 410;
const NODE_H = 118;
const LINKS = NODES.slice(0, -1).map((a, i) => {
  const b = NODES[i + 1];
  return `M ${a.x} ${a.y + NODE_H / 2} C ${a.x} ${a.y + NODE_H / 2 + 45} ${b.x} ${b.y - NODE_H / 2 - 45} ${b.x} ${b.y - NODE_H / 2}`;
});
const LINK_LEN = LINKS.map((d) => getLength(d));
const INTAKE = {x: NODES[0].x - NODE_W / 2 + 20, y: NODES[0].y};

const N_INV = 28;
const PENDING_LEFT = 3; // invoices that stay in the pile at the end (not everyone pays on the first reminder)
const HOOK_POS = [
  [300, 880, -14],
  [790, 865, 11],
  [395, 930, 7],
  [700, 935, -9],
];

// ---------- timeline ----------
const buildTimeline = (props: ReelProps, frames: number[]) => {
  const scenes = props.script.scenes;
  const s = frames.map((_, i) => frames.slice(0, i).reduce((a, b) => a + b, 0));
  const sp = frames.map((_, i) => voSpanFrames(props, i));
  const ws = scenes.map((sc, i) => wordStarts(sc.vo, LEAD, sp[i]).map((w) => w + s[i]));
  const voEnd = (i: number) => s[i] + LEAD + sp[i];
  // n-th *accent* span of a scene's vo (the script marks the cue words), else a fixed fraction of the line
  const cue = (i: number, n: number, frac: number) => {
    const acc = parseAccent(scenes[i].vo).map((w) => w.accent);
    const k = acc.map((a, j) => (a && !acc[j - 1] ? j : -1)).filter((j) => j >= 0)[n] ?? -1;
    return k >= 0 ? ws[i][k] : s[i] + LEAD + Math.round(frac * sp[i]);
  };

  const inv = Array.from({length: N_INV}, (_, i) => {
    if (i < 4) {
      const [x, y, r] = HOOK_POS[i];
      return {x, y, r, drop: s[0] + Math.round([0, 0.3, 0.55, 0.78][i] * (sp[0] + LEAD))};
    }
    const u = (i - 4) / (N_INV - 5);
    const spread = 720 * Math.pow(1 - u, 1.3) + 110;
    return {
      x: 540 + (random(`x${i}`) - 0.5) * spread,
      y: 945 - 290 * u + (random(`y${i}`) - 0.5) * 50,
      r: (random(`r${i}`) - 0.5) * 50,
      drop: s[1] + LEAD + Math.round(Math.pow(u, 0.62) * 0.78 * sp[1]),
    };
  });
  const buriedAt = inv[N_INV - 1].drop + 12;

  const whipStart = Math.max(s[2] + 10, Math.min(cue(2, 0, 0.3), s[2] + frames[2] - 60));
  const landAt = whipStart + 16;
  const nodeGap = Math.max(7, Math.min(12, Math.floor((s[2] + frames[2] - 14 - (landAt + 4)) / 4)));
  const nodeAt = NODES.map((_, k) => landAt + 4 + k * nodeGap);

  // invoices leave the pile top-first: 10 during the explanation, the rest during the payoff
  const flights: {idx: number; start: number; dur: number}[] = [];
  for (let j = 0; j < 10; j++) flights.push({idx: N_INV - 1 - j, start: s[3] + 3 + j * 5, dur: 22});
  const rest = N_INV - 10 - PENDING_LEFT;
  for (let j = 0; j < rest; j++) flights.push({idx: N_INV - 11 - j, start: s[4] + 8 + j * 3, dur: 20});
  const flyOf = new Map(flights.map((fl) => [fl.idx, fl]));

  const readCue = cue(3, 0, 0.25);
  const overdueCue = cue(3, 1, 0.55);
  const reminderCue = cue(3, 2, 0.85);
  const paidCue = cue(4, 0, 0.4);
  const byEnd = [...flights].sort((a, b) => a.start + a.dur - (b.start + b.dur));
  const step = Math.max(1, Math.min(3, Math.floor((s[5] - 14 - paidCue) / byEnd.length)));
  const paidAt: number[] = [];
  byEnd.forEach((fl, k) => paidAt.push(Math.max(fl.start + fl.dur + 4, paidCue + 2 + k * step, (paidAt[k - 1] ?? 0) + 1)));
  const lastPaid = paidAt[paidAt.length - 1];
  const pushIn = Math.min(Math.max(paidCue + 30, lastPaid - 10), s[5] - 30);

  return {s, sp, ws, frames, voEnd, inv, buriedAt, whipStart, landAt, nodeAt, flights, flyOf, readCue, overdueCue, reminderCue, paidCue, pushIn, paidAt, lastPaid};
};
type Timeline = ReturnType<typeof buildTimeline>;

// ---------- camera: additive moves, zoom in log space ----------
type Cam = {x: number; y: number; z: number};
const camAt = (f: number, T: Timeline): Cam => {
  let x = 540;
  let y = 900;
  let z = 1.15;
  z *= Math.pow(1.22 / 1.15, prog(f, 0, T.s[1], LINEAR)); // slow push-in during the hook
  let p = prog(f, T.s[1] + 0.05 * T.sp[1], 0.75 * T.sp[1]); // pull back as the pile grows
  y += (880 - 900) * p;
  z *= Math.pow(0.95 / 1.22, p);
  p = prog(f, T.whipStart, 16, WHIP); // whip pan to the automation
  x += (1760 - 540) * p;
  y += (855 - 880) * p;
  z *= Math.pow(0.92 / 0.95, p) * (1 - 0.1 * Math.sin(Math.PI * p));
  p = prog(f, T.s[3], T.frames[3], LINEAR); // slow creep while it works
  z *= Math.pow(1.0, p);
  p = prog(f, T.s[4], 26); // pull back: the invoice stream pouring in
  x += (1600 - 1760) * p;
  y += (730 - 855) * p;
  z *= Math.pow(0.8 / 0.92, p);
  p = prog(f, T.pushIn, 24); // push in on the finished automation
  x += (1880 - 1600) * p;
  y += (893 - 730) * p;
  z *= Math.pow(1.12 / 0.8, p);
  const shake =
    interpolate(f, [T.s[1] + 0.3 * T.sp[1], T.buriedAt, T.buriedAt + 18], [0, 9, 0], clamp) +
    interpolate(f, [T.landAt, T.landAt + 3, T.landAt + 14], [0, 10, 0], clamp);
  x += shake * noise2D('cx', f * 0.45, 0);
  y += shake * noise2D('cy', 0, f * 0.45);
  return {x, y, z};
};

// A layer that follows the camera with a parallax factor (1 = world, <1 = far away, >1 = in front).
const Layer: React.FC<{cam: Cam; k: number; children: React.ReactNode; style?: React.CSSProperties}> = ({cam, k, children, style}) => {
  const z = Math.pow(cam.z, k);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        transformOrigin: '0 0',
        transform: `translate(${540 - cam.x * k * z}px, ${960 - cam.y * k * z}px) scale(${z})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ---------- background: paper with a faint drifting 2% ink dot grid. No blobs, bokeh or glow. ----------
const Backdrop: React.FC<{cam: Cam; f: number}> = ({cam, f}) => {
  const th = useTheme();
  return (
  <AbsoluteFill style={{background: th.bg}}>
    <Layer cam={cam} k={0.35}>
      <div
        style={{
          position: 'absolute',
          left: -1600 + (f * 0.15) % 48,
          top: -1600,
          width: 5600,
          height: 5000,
          backgroundImage: `radial-gradient(${alpha(th.ink, 0.09)} 2.5px, transparent 2.5px)`,
          backgroundSize: '48px 48px',
        }}
      />
    </Layer>
  </AbsoluteFill>
  );
};

// ---------- props in the world: flat white cards, 3px ink outline, hard 8px ink shadow ----------
const AMOUNT = (i: number) => (8000 + Math.round(random(`amt${i}`) * 520) * 100).toLocaleString('en-IN');

const Invoice: React.FC<{i: number; x: number; y: number; rot: number; scale?: number; opacity?: number; z?: number}> = ({i, x, y, rot, scale = 1, opacity = 1, z}) => {
  const th = useTheme();
  const it = React.useContext(W).item;
  return (
  <div
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
    <div style={{fontFamily: TYPE.title, fontSize: 17, fontWeight: 900, letterSpacing: '0.06em'}}>{it.title}</div>
    <div style={{fontFamily: TYPE.data, fontSize: 12, color: th.muted, fontWeight: 600, marginTop: 3}}>{it.id}{(it.start ?? 1001) + i}</div>
    {[1, 0.75, 0.9].map((w, k) => (
      <div key={k} style={{height: 6, width: `${w * 100}%`, borderRadius: 3, background: th.rule, marginTop: k ? 8 : 14}} />
    ))}
    {it.amount ? <div style={{fontFamily: TYPE.data, fontSize: 19, fontWeight: 700, marginTop: 14}}>₹{AMOUNT(i)}</div> : <div style={{height: 6, width: '60%', borderRadius: 3, background: th.rule, marginTop: 8}} />}
    <div style={{position: 'absolute', right: 10, bottom: 10, background: th.alert, color: th.surface, fontFamily: TYPE.data, fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6}}>{it.pill}</div>
  </div>
  );
};

const NodeCard: React.FC<{k: number; appear: number; active: number; green: number}> = ({k, appear, active, green}) => {
  const th = useTheme();
  const n = {...NODES[k], ...React.useContext(W).nodes[k]};
  const f = useCurrentFrame();
  const on = Math.max(active, green) > 0.5;
  const tint = green > 0.5 ? th.ok : th.flow;
  return (
    <div
      style={{
        ...card(th),
        position: 'absolute',
        left: n.x - NODE_W / 2,
        top: n.y - NODE_H / 2,
        width: NODE_W,
        height: NODE_H,
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
          transform: SPIN.has(n.icon) && active > 0.5 ? `rotate(${((f % 40) / 40) * 180}deg)` : undefined,
        }}
      >
        <Icon name={n.icon} size={38} stroke={2.5} />
      </div>
      <div>
        <div style={{fontFamily: TYPE.title, fontSize: 33, fontWeight: 800, color: th.ink, letterSpacing: '-0.02em', whiteSpace: 'nowrap'}}>{n.label}</div>
        <div style={{fontFamily: TYPE.data, fontSize: 19, fontWeight: 600, color: th.muted, marginTop: 4}}>{n.sub}</div>
      </div>
    </div>
  );
};

const Bubble: React.FC<{p: number}> = ({p}) => {
  const th = useTheme();
  const m = React.useContext(W).message;
  return p <= 0 ? null : (
    <div
      style={{
        ...card(th),
        position: 'absolute',
        left: 1255,
        top: 690,
        width: 330,
        zIndex: 40,
        borderRadius: '24px 24px 6px 24px',
        opacity: Math.min(1, p * 1.5),
        transform: `scale(${0.6 + 0.4 * p})`,
        transformOrigin: '100% 100%',
        color: th.ink,
        padding: '14px 18px 10px',
      }}
    >
      <div style={{fontFamily: TYPE.data, fontSize: 14, fontWeight: 700, color: th.muted}}>{m.app} · EXAMPLE</div>
      <div style={{fontFamily: FONT, fontSize: 23, fontWeight: 600, lineHeight: 1.3, marginTop: 6}}>{m.text}</div>
      <div style={{display: 'flex', justifyContent: 'flex-end', color: th.flow, marginTop: 2}}>
        <Check size={20} strokeWidth={3} />
        <Check size={20} strokeWidth={3} style={{marginLeft: -12}} />
      </div>
    </div>
  );
};

// Invoices currently in flight from the pile into the machine (wrapped in motion blur by the caller).
const Flyers: React.FC<{T: Timeline}> = ({T}) => {
  const f = useCurrentFrame();
  return (
    <>
      {T.flights.map((fl) => {
        if (f < fl.start || f >= fl.start + fl.dur) return null;
        const a = T.inv[fl.idx];
        const d = `M ${a.x} ${a.y} C ${a.x + 260} ${a.y - 620} ${INTAKE.x - 420} ${INTAKE.y - 260} ${INTAKE.x} ${INTAKE.y}`;
        const len = getLength(d);
        const t = prog(f, fl.start, fl.dur, Easing.bezier(0.45, 0, 0.3, 1));
        const pt = getPointAtLength(d, len * t);
        const tan = getTangentAtLength(d, len * t);
        const ang = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
        return (
          <Invoice
            key={fl.idx}
            i={fl.idx}
            x={pt.x}
            y={pt.y}
            rot={lerp(a.r, ang * 0.25, Math.min(1, t * 2))}
            scale={lerp(1, 0.32, t)}
            opacity={interpolate(t, [0.82, 1], [1, 0], clamp)}
          />
        );
      })}
    </>
  );
};

const Machine: React.FC<{T: Timeline}> = ({T}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const done = React.useContext(W).done;
  const appear = T.nodeAt.map((a) => springFrom(f, a, {damping: 11, stiffness: 170}));
  const draw = LINKS.map((_, k) => prog(f, T.nodeAt[k + 1] - 2, 10));
  const act = (from: number, until: number) => interpolate(f, [from, from + 6, until, until + 10], [0, 1, 1, 0], clamp);
  const workEnd = T.s[5];
  const active = [act(T.readCue, workEnd), act(T.overdueCue, workEnd), act(T.reminderCue, workEnd), 0];
  const green = [0, 0, 0, act(T.paidCue, workEnd)];
  const intake = prog(f, T.s[3] - 6, 14);
  const intakePath = `M ${PILE.x} ${PILE.y} C ${PILE.x + 260} 180 ${INTAKE.x - 420} ${INTAKE.y - 260} ${INTAKE.x} ${INTAKE.y}`;

  // data tokens travel node to node; the last hop only runs once payments land
  const tokens: React.ReactNode[] = [];
  for (let k = 0; ; k++) {
    const t0 = T.s[3] + 16 + k * 9;
    if (t0 > workEnd) break;
    const t = (f - t0) / 36;
    if (t < 0 || t >= 1) continue;
    const seg = Math.floor(t * 3);
    if (seg === 2 && t0 + 24 < T.paidCue) continue;
    const local = t * 3 - seg;
    const pt = getPointAtLength(LINKS[seg], LINK_LEN[seg] * local);
    tokens.push(<circle key={k} cx={pt.x} cy={pt.y} r={11} fill={seg === 2 ? th.ok : th.flow} stroke={th.ink} strokeWidth={3} />);
  }

  const bursts = T.paidAt.filter((_, k) => k % 2 === 0); // a PAID badge for every other payment keeps it readable
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex: 1}} width={1} height={1}>
        {intake > 0 ? (
          <path d={intakePath} stroke={th.muted} strokeWidth={3} strokeDasharray="10 14" fill="none" style={{opacity: intake}} />
        ) : null}
        {LINKS.map((d, k) => {
          if (draw[k] <= 0) return null;
          const ev = evolvePath(draw[k], d);
          const lit = k === 2 ? green[3] : active[k + 1];
          return (
            <g key={k}>
              <path d={d} stroke={k === 2 && lit > 0.5 ? th.ok : th.flow} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
            </g>
          );
        })}
        {tokens}
      </svg>
      {NODES.map((_, k) => (appear[k] > 0.01 ? <NodeCard key={k} k={k} appear={appear[k]} active={active[k]} green={green[k]} /> : null))}
      {bursts.map((b, k) => {
        const t = (f - b) / 22;
        if (t < 0 || t > 1) return null;
        const n = NODES[3];
        return (
          <div key={k} style={{position: 'absolute', left: 0, top: 0, zIndex: 30}}>
            <div
              style={{
                position: 'absolute',
                left: n.x - NODE_W / 2 + 60 - 50 * (1 + t),
                top: n.y - 50 * (1 + t),
                width: 100 * (1 + t),
                height: 100 * (1 + t),
                borderRadius: '50%',
                border: `${6 * (1 - t)}px solid ${th.ok}`,
                opacity: 1 - t,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: n.x + NODE_W / 2 - 40 + 60 * t,
                top: n.y - 60 - 140 * t + (k % 3) * 30,
                background: th.ok,
                color: th.surface,
                border: `3px solid ${th.ink}`,
                borderRadius: 999,
                padding: '4px 14px',
                fontFamily: TYPE.data,
                fontWeight: 900,
                fontSize: 24,
                opacity: interpolate(t, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
                transform: `scale(${0.7 + 0.3 * Math.min(1, t * 4)})`,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Check size={22} strokeWidth={3.5} /> {done}
            </div>
          </div>
        );
      })}
      <Bubble p={springFrom(f, T.reminderCue, {damping: 12, stiffness: 160}) * (1 - prog(f, T.pushIn - 6, 10))} />
    </>
  );
};

const Pile: React.FC<{T: Timeline}> = ({T}) => {
  const f = useCurrentFrame();
  return (
    <>
      {T.inv.map((v, i) => {
        if (f < v.drop) return null;
        const fl = T.flyOf.get(i);
        if (fl && f >= fl.start) return null;
        const p = spring({frame: f - v.drop, fps: FPS, config: {damping: 12, stiffness: 120, mass: 0.9}});
        return <Invoice key={i} i={i} x={v.x} y={v.y - (1 - p) * 1100} rot={v.r + (1 - p) * (i % 2 ? 70 : -70)} z={i < 4 ? 2 : 10 + i} />;
      })}
    </>
  );
};

const Stage: React.FC<{T: Timeline}> = ({T}) => {
  const f = useCurrentFrame();
  const cam = camAt(f, T);
  const flying = f >= T.s[3] && f < T.s[5];
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Backdrop cam={cam} f={f} />
      <Layer cam={cam} k={1}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 2400, height: 1600}}>
          <Machine T={T} />
          <Pile T={T} />
          <Cursor T={T} />
          {flying ? (
            <div style={{position: 'absolute', left: 0, top: 0, width: 2400, height: 1600, zIndex: 90}}>
              <CameraMotionBlur samples={6} shutterAngle={200}>
                <Flyers T={T} />
              </CameraMotionBlur>
            </div>
          ) : null}
        </div>
      </Layer>
    </AbsoluteFill>
  );
};

// ---------- screen-space overlays ----------
// Highlighter swipe: the one place `signal` appears. Sits behind ink text.
const Highlight: React.FC<{p: number; children: React.ReactNode}> = ({p, children}) => {
  const th = useTheme();
  return (
  <span style={{position: 'relative', display: 'inline-block'}}>
    <span style={{position: 'absolute', left: -8, right: -8, top: '18%', bottom: '6%', background: th.accent, transformOrigin: '0 50%', transform: `scaleX(${p}) skewX(-6deg)`, borderRadius: 4, zIndex: 0}} />
    <span style={{position: 'relative', zIndex: 1, color: p > 0.5 ? th.onAccent : undefined}}>{children}</span>
  </span>
  );
};

const Counter: React.FC<{T: Timeline}> = ({T}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  if (f >= T.s[5] + 6) return null;
  const landed = T.inv.filter((v) => f >= v.drop + 12).length;
  const paid = T.paidAt.filter((a) => f >= a).length; // one tick per payment, synced to the PAID badges
  const unpaid = landed - paid;
  const appear = springFrom(f, T.s[1] - 2, {damping: 14, stiffness: 180});
  const out = prog(f, Math.min(T.lastPaid + 14, T.s[5] - 12), 10);
  const col = paid > 0 ? th.ok : th.alert;
  const cn = React.useContext(W).counter;
  return (
    <div style={{position: 'absolute', top: 290, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: appear * (1 - out)}}>
      <div style={{...card(th), display: 'flex', alignItems: 'center', gap: 18, padding: '12px 28px 12px 14px', borderRadius: 18, transform: `translateY(${(1 - appear) * -30}px)`}}>
        <div style={{width: 56, height: 56, borderRadius: 12, border: `3px solid ${th.ink}`, background: col, color: th.surface, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Icon name={cn.icon} size={30} stroke={2.5} />
        </div>
        <div style={{fontFamily: TYPE.data, fontSize: 28, fontWeight: 700, color: th.ink}}>{cn.label}</div>
        <div style={{fontFamily: TYPE.display, fontSize: 64, fontWeight: 900, letterSpacing: '-0.04em', color: th.ink, minWidth: 76, textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>{unpaid}</div>
      </div>
      <div style={{marginTop: 14, fontFamily: TYPE.data, fontSize: 20, fontWeight: 600, color: th.muted}}>EXAMPLE DATA</div>
    </div>
  );
};

// Night end card, entered with an ink wipe from the bottom. Carries the CTA and the authorship line.
const Cta: React.FC<{T: Timeline; text: string; sub?: string}> = ({T, text, sub}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const start = T.s[5];
  if (f < start) return null;
  const wipe = prog(f, start, 14, Easing.bezier(0.7, 0, 0.3, 1));
  const logo = springFrom(f, start + 8, {damping: 14, stiffness: 180});
  const textP = springFrom(f, start + 12, {damping: 14, stiffness: 180});
  const hl = prog(f, start + 20, 8, LINEAR);
  const subP = springFrom(f, start + 24);
  const byP = springFrom(f, start + 30);
  const words = parseAccent(text);
  return (
    <AbsoluteFill style={{clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)`, background: th.ink}}>
      <Img
        src={staticFile('brand/mark.png')}
        style={{position: 'absolute', left: 540 - 120, top: 470, width: 240, height: 240, opacity: logo, transform: `scale(${0.6 + 0.4 * logo}) rotate(${(1 - logo) * -120}deg)`}}
      />
      <div style={{position: 'absolute', top: 780, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 30, fontFamily: TYPE.display, fontWeight: 900, fontSize: 150, letterSpacing: '-0.04em', color: th.bg, opacity: textP, transform: `translateY(${(1 - textP) * 40}px)`}}>
        {words.map((w, i) =>
          w.accent ? (
            <span key={i} style={{position: 'relative', display: 'inline-block', color: th.ink, padding: '0 14px'}}>
              <span style={{position: 'absolute', inset: '10% 0 4% 0', background: th.accent, transformOrigin: '0 50%', transform: `scaleX(${hl})`, borderRadius: 8}} />
              <span style={{position: 'relative', color: hl > 0.5 ? th.onAccent : th.bg}}>{w.w}</span>
            </span>
          ) : (
            <span key={i}>{w.w}</span>
          ),
        )}
      </div>
      {sub ? (
        <div style={{position: 'absolute', top: 1000, left: 110, right: 110, textAlign: 'center', fontFamily: FONT, fontSize: 44, fontWeight: 700, lineHeight: 1.25, color: th.bg, opacity: subP * 0.85, transform: `translateY(${(1 - subP) * 16}px)`}}>
          {sub}
        </div>
      ) : null}
      <div style={{position: 'absolute', top: 1160, left: 0, right: 0, textAlign: 'center', fontFamily: TYPE.data, fontSize: 28, fontWeight: 600, color: th.bg, opacity: byP * 0.75}}>
        Made by Navin Rana · {HANDLE}
      </div>
    </AbsoluteFill>
  );
};

// A pointer that "builds" the automation: glides to each node as it appears and clicks it.
const Cursor: React.FC<{T: Timeline}> = ({T}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  if (f < T.landAt - 6 || f > T.readCue + 16) return null;
  const pts = NODES.map((n) => ({x: n.x + NODE_W / 2 - 60, y: n.y + 24}));
  let x = pts[0].x + 160;
  let y = pts[0].y - 120;
  T.nodeAt.forEach((a, k) => {
    const p = prog(f, a - 9, 9);
    x = lerp(x, pts[k].x, p);
    y = lerp(y, pts[k].y, p);
  });
  const lastClick = [...T.nodeAt].reverse().find((a) => f >= a);
  const click = lastClick === undefined ? 0 : interpolate(f - lastClick, [0, 3, 10], [0, 1, 0], clamp);
  const ring = lastClick === undefined ? 1 : (f - lastClick) / 14;
  const fade = 1 - prog(f, T.readCue, 14);
  return (
    <div style={{position: 'absolute', left: x, top: y, zIndex: 85, opacity: fade * prog(f, T.landAt - 6, 6)}}>
      {ring < 1 ? (
        <div style={{position: 'absolute', left: -40 * (0.4 + ring), top: -40 * (0.4 + ring), width: 80 * (0.4 + ring), height: 80 * (0.4 + ring), borderRadius: '50%', border: `4px solid ${th.flow}`, opacity: 1 - ring}} />
      ) : null}
      <svg width={54} height={60} viewBox="0 0 24 26" style={{transform: `scale(${1 - 0.15 * click})`, transformOrigin: '0 0', filter: `drop-shadow(0 6px 10px ${alpha(th.shadow, 0.5)})`}}>
        <path d="M2 1 L2 20 L7 15.5 L10.5 23 L14 21.5 L10.5 14 L17 14 Z" fill={th.ink} stroke={th.surface} strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// Kinetic display headline for the first seconds: the scroll-stopper. Keyword gets the signal highlighter.
const HookTitle: React.FC<{T: Timeline; text: string}> = ({T, text}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  if (!text || f > T.s[1] + 12) return null;
  const words = parseAccent(text);
  const out = prog(f, T.s[1] - 4, 14);
  return (
    <div
      style={{
        position: 'absolute',
        top: 300,
        left: 80,
        right: 80,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: 28,
        fontFamily: TYPE.display,
        fontSize: 136,
        fontWeight: 900,
        letterSpacing: '-0.04em',
        lineHeight: 1.02,
        color: th.ink,
        opacity: 1 - out,
        transform: `translateY(${-60 * out}px)`,
      }}
    >
      {words.map((w, i) => {
        const p = springFrom(f, 1 + i * 3, {damping: 14, stiffness: 180});
        const h = w.accent ? prog(f, 8 + i * 3, 8, LINEAR) : 0;
        return (
          <span key={i} style={{display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 70}px)`}}>
            {w.accent ? <Highlight p={h}>{w.w}</Highlight> : w.w}
          </span>
        );
      })}
    </div>
  );
};

// ---------- composition ----------
export const Story: React.FC<ReelProps> = (props) => {
  const th = THEMES[props.script.theme ?? 'paper'];
  if (!th) throw new Error(`Unknown theme "${props.script.theme}". Use one of: ${Object.keys(THEMES).join(', ')}`);
  const frames = props.frames ?? computeFrames(props);
  const T = buildTimeline(props, frames);
  const f = useCurrentFrame();
  const scenes = props.script.scenes;
  const cta = scenes[scenes.length - 1] as {text?: string; sub?: string};
  const whip = f >= T.whipStart - 1 && f <= T.whipStart + 17;
  const sfx: [number, 'pop' | 'whoosh' | 'ding' | 'tick', number?][] = [
    ...T.inv.filter((_, i) => i < 4 || i % 3 === 0).map((v) => [v.drop + 10, 'tick', 0.3] as [number, 'tick', number]),
    [T.buriedAt, 'pop', 0.5],
    [T.whipStart, 'whoosh', 0.4],
    ...T.nodeAt.map((a) => [a, 'pop'] as [number, 'pop']),
    [T.s[3] + 3, 'whoosh', 0.2],
    [T.reminderCue, 'pop'],
    [T.s[4], 'whoosh', 0.25],
    [T.paidCue + 4, 'ding'],
    [T.s[5], 'whoosh', 0.35],
    [T.s[5] + 14, 'pop'],
  ];
  return (
    <ThemeCtx.Provider value={th}>
    <W.Provider value={{...DEFAULT_WORLD, ...props.script.world}}>
    <SfxEnabled.Provider value={props.script.sfx !== false}>
      <AbsoluteFill style={{background: th.bg}}>
        {whip ? (
          <CameraMotionBlur samples={8} shutterAngle={240}>
            <Stage T={T} />
          </CameraMotionBlur>
        ) : (
          <Stage T={T} />
        )}
        <Counter T={T} />
        <HookTitle T={T} text={(scenes[0] as {text?: string}).text ?? ''} />
        {scenes.map((sc, i) =>
          i === 0 || sc.type === 'cta' ? null : (
            <Sequence key={i} from={T.s[i]} durationInFrames={frames[i]} layout="none">
              <Captions vo={sc.vo} starts={wordStarts(sc.vo, LEAD, T.sp[i])} top={CAPTION_TOP} />
            </Sequence>
          ),
        )}
        <Cta T={T} text={cta.text ?? 'DM *AUDIT*'} sub={cta.sub} />
        {scenes.map((_, i) =>
          props.timing?.audio?.[i] ? (
            <Sequence key={`a${i}`} from={T.s[i] + LEAD} layout="none">
              <Audio src={staticFile(props.timing.audio[i] as string)} />
            </Sequence>
          ) : null,
        )}
        {sfx.map(([at, name, vol], i) => (
          <Sfx key={`s${i}`} at={at} name={name} volume={vol} />
        ))}
      </AbsoluteFill>
    </SfxEnabled.Provider>
    </W.Provider>
    </ThemeCtx.Provider>
  );
};
