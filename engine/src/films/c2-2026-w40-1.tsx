// c2-2026-w40-1 "The cutaway": the microwave story as one 1940s technical cutaway sheet. Microwaves cook from the inside, so the
// film only ever looks inside things: a pocket, a pot, a kernel, an egg, a cabinet. Heat is the one colour, and it lives only in
// the waves and in whatever they cook from the centre out. Spencer himself is drawn in phantom line: he felt nothing.
// One camera over one sheet; the only cut hides under a cloth that wipes egg off the lens.
import {noise2D} from '@remotion/noise';
import React, {createContext, useContext} from 'react';
import {AbsoluteFill, random} from 'remotion';
import {THEMES} from '../themes';
import {BACK, type Beat, cam, camAt, Captions, type Cue, drift, Foley, Grain, IN, INOUT, k, type Key, lerp, OUT, Score, settle, useFilm} from './kit';

type P = [number, number];
// The film's own palette (themes.ts "cutaway"). The board keeps its channel style's theme, which the recipe and QA pin.
const useTheme = () => THEMES.cutaway;
const FUT = 'Futura, "Futura PT", "Avenir Next", sans-serif';
const SERIF = 'Baskerville, "Baskerville Old Face", "Hoefler Text", serif';
const mix = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
const tone = (a: string, b: string, p: number) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const poly = (pts: P[], close = true) => `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')}${close ? 'Z' : ''}`;
// Catmull-Rom through the points: an outline drawn by hand with a French curve.
const smooth = (pts: P[], closed = true) => {
  const n = pts.length;
  const g = (i: number) => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [a, b, c, e] = [g(i - 1), g(i), g(i + 1), g(i + 2)];
    d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0]},${c[1]}`;
  }
  return d + (closed ? 'Z' : '');
};
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) =>
  `M${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`;

// ---------- the sheet's layout (world units; the camera flies over it) ----------
const DA = {x: 700, y: 900, r: 440}; // Detail A: the pocket, 6:1
const PERCY = {x: 1430, y: 700, s: 1.6}; // phantom figure, crown at (x, y), 1000 local units tall
const MAG = {x: 2470, y: 1180}; // cavity magnetron; its horn mouth faces Spencer
const HORN: P = [2020, 1180];
const F2: P = [700, 2050]; // FIG. 2 outside in
const F3: P = [700, 2900]; // FIG. 3 inside out
const DB = {x: 2350, y: 2750, r: 300}; // Detail B: the kernel
const DC = {x: 2350, y: 3480, r: 360}; // Detail C: the egg
const RR: P = [4300, 2850]; // the Radarange stands here (base centre); later the counter of one kitchen
const BEAKER: P = [1840, 1440];
const FLOOR = 2300;

// ---------- shared clock: when things happen (all from the measured voice) ----------
type Times = Record<'year' | 'b1' | 'after' | 'waves' | 'minutes' | 'b2' | 'name' | 'radar' | 'b3' | 'pop' | 'boom' | 'wipe' | 'b4' | 'six' | 'changed' | 'b5' | 'pulse', number>;
type View = {t: number; T: Times; px: (x: number, y: number) => P; z: number; flare: (x: number, y: number) => number};
const ViewCtx = createContext<View | null>(null);
const useView = () => useContext(ViewCtx)!;
// a translated group: labels inside it still know where they sit on the sheet
const OriginCtx = createContext<P>([0, 0]);
const At: React.FC<{x: number; y: number; extra?: string; o?: number; children: React.ReactNode}> = ({x, y, extra = '', o, children}) => {
  const [ox, oy] = useContext(OriginCtx);
  return (
    <OriginCtx.Provider value={[ox + x, oy + y]}>
      <g transform={`translate(${x},${y})${extra}`} opacity={o}>
        {children}
      </g>
    </OriginCtx.Provider>
  );
};
const wordAt = (b: Beat, word: string) => {
  const i = b.text.indexOf(word);
  return b.vo![0] + (Math.max(0, i) / b.text.length) * (b.vo![1] - b.vo![0]);
};

// A drawing label (engraved Futura). Labels annotate the shot they belong to: one that would sit under platform UI fades away
// before it gets there, so every legible word stays inside the safe area (x 60..960, y 250..1500).
const Label: React.FC<{x: number; y: number; size: number; text: string; anchor?: 'start' | 'middle' | 'end'; weight?: number; fill?: string; spacing?: number; o?: number; style?: React.CSSProperties}> = ({x, y, size, text, anchor = 'start', weight = 500, fill, spacing = 0.12, o = 1, style}) => {
  const {px, z} = useView();
  const [ox, oy] = useContext(OriginCtx);
  const th = useTheme();
  const w = text.length * size * (0.74 + spacing); // Futura caps and figures run wide
  const x0 = anchor === 'start' ? x : anchor === 'middle' ? x - w / 2 : x - w;
  const [l, tp] = px(ox + x0, oy + y - size * 0.82);
  const [r, b] = px(ox + x0 + w, oy + y + size * 0.2);
  const m = Math.min(l - 60, 960 - r, tp - 250, 1370 - b); // and clear of the caption band
  const fit = size * z > 7 ? clamp((m - 14) / 30) : 0;
  const op = o * fit;
  if (op <= 0.01) return null;
  return (
    <text x={x} y={y} fontFamily={FUT} fontSize={size} fontWeight={weight} letterSpacing={size * spacing} textAnchor={anchor} fill={fill ?? th.ink} opacity={op} style={style}>
      {text}
    </text>
  );
};

// Wave fronts leaving a source, drawn as a draughtsman draws radiation: dashed arcs, fading with distance.
const Waves: React.FC<{on: number; off?: number; c: P; dir: number; spread: number; gap: number; speed: number; max: number; w: number; o?: number}> = ({on, off = 1e9, c, dir, spread, gap, speed, max, w, o = 0.8}) => {
  const {t} = useView();
  const th = useTheme();
  if (t < on) return null;
  const head = (t - on) * speed;
  const i0 = Math.max(0, Math.floor((head - max) / gap));
  const i1 = Math.floor(head / gap);
  const fade = k(t, [off, off + 0.6], [1, 0]);
  return (
    <g>
      {Array.from({length: Math.max(0, i1 - i0 + 1)}, (_, j) => {
        const r = head - (i0 + j) * gap;
        if (r <= 4 || r > max) return null;
        const a = Math.pow(1 - r / max, 0.6) * k(r, [0, gap * 0.6], [0, 1]) * fade;
        return <path key={i0 + j} d={arc(c[0], c[1], r, dir - spread, dir + spread)} fill="none" stroke={th.reveal} strokeWidth={w} strokeDasharray={`${w * 5} ${w * 3}`} strokeLinecap="round" opacity={a * o} />;
      })}
    </g>
  );
};
// how close a wave front is to a point (0..1): what is in the beam warms a little each time a front passes through it
const wavePulse = (t: number, on: number, c: P, p: P, gap: number, speed: number) => {
  if (t < on) return 0;
  const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
  const head = (t - on) * speed - d;
  if (head < 0) return 0;
  const f = head % gap;
  return Math.exp(-Math.pow(Math.min(f, gap - f) / (gap * 0.18), 2));
};

// A detail circle: a magnified view on the same sheet, ringed and clipped like an engraver's inset.
const Detail: React.FC<{id: string; x: number; y: number; r: number; draw?: number; children: React.ReactNode}> = ({id, x, y, r, draw = 1, children}) => {
  const th = useTheme();
  return (
    <g transform={`translate(${x},${y})`}>
      <clipPath id={id}>
        <circle r={r} />
      </clipPath>
      <circle r={r} fill={th.bg} opacity={draw > 0 ? 1 : 0} />
      <g clipPath={`url(#${id})`} opacity={clamp(draw * 1.4)}>
        {children}
      </g>
      <circle r={r} fill="none" stroke={th.ink} strokeWidth={7} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} transform="rotate(-90)" />
      <circle r={r + 13} fill="none" stroke={th.ink} strokeWidth={2} opacity={draw} />
    </g>
  );
};

// ---------- Detail A: the candy bar in the pocket ----------
const BW = 115;
const BH = 210;
const barPt = (x: number, y: number, m: number): P => {
  const u = (y + BH) / (2 * BH); // 0 top, 1 bottom
  const ex = Math.abs(x) / BW;
  const sink = m * (150 * (1 - u) + 55 * ex * ex * (1 - u * 0.6));
  return [x * (1 + m * 0.26 * u * u) + noise2D('bx', x * 0.013, y * 0.013) * m * 12, y + sink + noise2D('by', x * 0.013, y * 0.013) * m * 9];
};
const edge = (x0: number, y0: number, x1: number, y1: number, n: number, m: number) => Array.from({length: n}, (_, i) => barPt(lerp(x0, x1, i / n), lerp(y0, y1, i / n), m));
const barOutline = (m: number) => poly([...edge(-BW, -BH, BW, -BH, 18, m), ...edge(BW, -BH, BW, BH, 24, m), ...edge(BW, BH, -BW, BH, 18, m), ...edge(-BW, BH, -BW, -BH, 24, m)]);
const POCKET_WINDOW: P[] = [[-262, -168], [262, -168], [262, 296], [222, 342], [-120, 342], [-150, 300], [-196, 286], [-178, 228], [-226, 176], [-204, 110], [-246, 46], [-214, -12], [-250, -80], [-226, -130]];

const PocketDetail: React.FC = () => {
  const {t} = useView();
  const th = useTheme();
  const heat = th.reveal!;
  const choc = tone(th.ink, heat, 84);
  const src: P = [1700, -60];
  // it softens, then gives way all at once (a rebound as the weight lands), then keeps slumping
  const give = 0.95;
  const rebound = t > give ? -0.07 * Math.exp(-(t - give) * 5) * Math.sin((t - give) * 17) : 0;
  const m = 0.1 * k(t, [0, 0.55], [0, 1], (x) => x) + 0.4 * k(t, [0.55, give], [0, 1], IN) + rebound + 0.32 * k(t, [give + 0.1, 4.2], [0, 1], (x) => x) + k(t, [4.2, 16], [0, 0.18], (x) => x);
  const pulse = wavePulse(t, -6.6, src, [10, 40], 120, 250);
  const h = clamp(0.5 + 0.45 *k(t, [0, 3.6], [0, 1], (x) => x) + 0.22 * pulse);
  const drip = k(t, [give, give + 0.45], [0, 1], IN);
  const stain = k(t, [give + 0.45, 4.5], [0, 1]);
  const cells = [0, 1, 2, 3].flatMap((r) => [0, 1].map((c) => [c, r] as const));
  return (
    <g>
      {/* the jacket front: tweed, a lapel rolling away to the right */}
      <rect x={-460} y={-460} width={920} height={920} fill={th.bg} />
      <rect x={-460} y={-460} width={920} height={920} fill="url(#weave)" />
      <path d="M110,-470 C160,-350 300,-240 470,-110 L470,-470 Z" fill="url(#hatchFine)" />
      <path d="M110,-470 C160,-350 300,-240 470,-110" fill="none" stroke={th.ink} strokeWidth={6} />
      <path d="M88,-470 C138,-338 280,-222 460,-86" fill="none" stroke={th.ink} strokeWidth={1.8} strokeDasharray="8 7" />
      <path d="M262,-318 l34,-30" stroke={th.ink} strokeWidth={10} strokeLinecap="round" />
      <path d="M140,-410 C180,-330 290,-250 420,-150" fill="none" stroke={mix(th.ink, 40)} strokeWidth={2.5} />
      {/* the cutaway window into the pocket: the front panel is torn away, its cut edge hatched as a section */}
      <path d={poly(POCKET_WINDOW)} fill={th.surface} stroke={th.ink} strokeWidth={22} strokeLinejoin="round" />
      <path d={poly(POCKET_WINDOW)} fill="none" stroke="url(#hatch)" strokeWidth={18} strokeLinejoin="round" />
      <path d={poly(POCKET_WINDOW)} fill="url(#hatchFine)" opacity={0.55} />
      {/* the stain: chocolate soaking into the lining at the bottom seam, then through to the cloth */}
      <ellipse cx={-40} cy={334} rx={40 + 190 * stain} ry={10 + 36 * stain} fill={choc} opacity={0.18 * stain} filter="url(#ink-strong)" />
      <ellipse cx={-60} cy={330} rx={22 + 120 * stain} ry={7 + 20 * stain} fill={choc} opacity={0.85 * clamp(stain * 3)} filter="url(#ink-strong)" />
      <path d="M-240,330 L240,330" stroke={th.ink} strokeWidth={2.4} strokeDasharray="12 9" />
      {/* a fountain pen shares the pocket */}
      <g transform="rotate(5 165 0)">
        <rect x={150} y={-318} width={34} height={560} rx={16} fill={th.surface} stroke={th.ink} strokeWidth={4} />
        <rect x={150} y={-318} width={34} height={170} rx={16} fill="url(#hatch)" stroke={th.ink} strokeWidth={4} />
        <path d="M184,-300 L198,-300 L198,-190 Q198,-176 190,-176" fill="none" stroke={th.ink} strokeWidth={4} />
      </g>
      {/* the bar: foil behind, chocolate in section in front; it slumps and spills as its core heats */}
      <g transform="translate(10,40) rotate(-4)">
        <path d={poly(Array.from({length: 60}, (_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r = i % 2 ? 0 : 5;
          return [Math.max(-1, Math.min(1, Math.cos(a) * 1.42)) * (BW + 14 + r), Math.max(-1, Math.min(1, Math.sin(a) * 1.42)) * (BH + 12 + r)] as P;
        }))} fill={th.surface} stroke={th.muted} strokeWidth={2.5} />
        {[-60, 20, 110, 170].map((y, i) => (
          <path key={i} d={`M${-BW - 6},${y} l14,-9 l18,12 l22,-8`} fill="none" stroke={th.muted} strokeWidth={1.6} />
        ))}
        <clipPath id="bar-a">
          <path d={barOutline(m)} />
        </clipPath>
        <path d={barOutline(m)} fill={choc} />
        <g clipPath="url(#bar-a)">
          <radialGradient id="core-a" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={heat} stopOpacity={0.95} />
            <stop offset="0.45" stopColor={heat} stopOpacity={0.55} />
            <stop offset="1" stopColor={heat} stopOpacity={0} />
          </radialGradient>
          {cells.map(([c, r]) => {
            const x0 = -BW + c * BW + 10;
            const y0 = -BH + r * (BH / 2) + 10;
            const w = BW - 20;
            const hh = BH / 2 - 20;
            const face = poly([...edge(x0, y0, x0 + w, y0, 5, m), ...edge(x0 + w, y0, x0 + w, y0 + hh, 5, m), ...edge(x0 + w, y0 + hh, x0, y0 + hh, 5, m), ...edge(x0, y0 + hh, x0, y0, 5, m)]);
            const lit = poly([...edge(x0, y0 + hh, x0, y0, 5, m), ...edge(x0, y0, x0 + w, y0, 5, m), barPt(x0 + w, y0, m)], false);
            const dark = poly([...edge(x0 + w, y0, x0 + w, y0 + hh, 5, m), ...edge(x0 + w, y0 + hh, x0, y0 + hh, 5, m), barPt(x0, y0 + hh, m)], false);
            return (
              <g key={`${c}${r}`} opacity={1 - m * 0.85}>
                <path d={face} fill={tone(th.ink, heat, 90)} />
                <path d={lit} fill="none" stroke={mix(th.bg, 42)} strokeWidth={5} strokeLinejoin="round" />
                <path d={dark} fill="none" stroke={th.ink} strokeWidth={6} strokeLinejoin="round" />
              </g>
            );
          })}
          <ellipse cx={0} cy={30 + m * 70} rx={70 + 120 * h} ry={100 + 140 * h} fill="url(#core-a)" opacity={h} />
          {/* wet gloss along the slumped top */}
          <path d={poly(edge(-BW + 20, -BH + 22, BW - 30, -BH + 22, 10, m), false)} fill="none" stroke={mix(th.bg, 70)} strokeWidth={7} strokeLinecap="round" opacity={k(m, [0.25, 0.6], [0, 0.8])} />
        </g>
        <path d={barOutline(m)} fill="none" stroke={th.ink} strokeWidth={5} strokeLinejoin="round" />
        {/* the first drip runs out of the corner and down the lining */}
        <path d={`M${-96 - m * 20},${BH - 6 + m * 4} C${-104 - m * 20},${BH + 40 * drip} ${-90 - m * 20},${BH + 70 * drip} ${-98 - m * 20},${BH + 82 * drip}`} fill="none" stroke={choc} strokeWidth={16 - 6 * drip} strokeLinecap="round" opacity={drip > 0 ? 1 : 0} />
      </g>
      {/* the welt seam of the pocket mouth */}
      <path d="M-262,-168 L262,-168" stroke={th.ink} strokeWidth={4} />
      <path d="M-250,-182 L250,-182" stroke={th.ink} strokeWidth={2} strokeDasharray="10 8" />
      {/* the waves pass straight through the cloth; only the chocolate takes their heat */}
      <Waves on={-6.6} c={src} dir={Math.PI} spread={0.42} gap={120} speed={250} max={2300} w={4} o={0.85} />
    </g>
  );
};

// ---------- FIG. 2 and FIG. 3: the same potato, heated from outside, then from inside ----------
const POTATO = {cx: 0, cy: 70, rx: 150, ry: 100};
const Potato: React.FC<{raw: number; bloom: number; id: string; flare?: number}> = ({raw, bloom, id, flare = 0}) => {
  const th = useTheme();
  const heat = th.reveal!;
  const {cx, cy, rx, ry} = POTATO;
  return (
    <g>
      <clipPath id={id}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      </clipPath>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={th.bg} />
      <g clipPath={`url(#${id})`}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={heat} opacity={raw < 1 ? 0.78 : 0} />
        <ellipse cx={cx} cy={cy} rx={rx * raw} ry={ry * raw} fill={th.bg} />
        <ellipse cx={cx} cy={cy} rx={rx * raw} ry={ry * raw} fill="url(#stip)" />
        {raw < 1 && <ellipse cx={cx} cy={cy} rx={rx * raw} ry={ry * raw} fill="none" stroke={th.ink} strokeWidth={2} strokeDasharray="8 7" />}
        <radialGradient id={`${id}-g`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={heat} stopOpacity={0.95} />
          <stop offset="0.7" stopColor={heat} stopOpacity={0.75} />
          <stop offset="1" stopColor={heat} stopOpacity={0} />
        </radialGradient>
        {bloom > 0 && <ellipse cx={cx} cy={cy} rx={rx * 1.15 * bloom} ry={ry * 1.15 * bloom} fill={`url(#${id}-g)`} opacity={0.9 + flare * 0.1} />}
      </g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={th.ink} strokeWidth={7} />
      <path d={`M${cx - rx + 12},${cy - 18} q8,-5 12,2 M${cx + 40},${cy - ry + 14} q6,-6 12,0 M${cx + rx - 40},${cy + 40} q6,-6 10,1`} fill="none" stroke={th.ink} strokeWidth={3} />
    </g>
  );
};
const Clock: React.FC<{x: number; y: number; r: number; minutes: number}> = ({x, y, r, minutes}) => {
  const th = useTheme();
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={r + 10} fill={th.surface} stroke={th.ink} strokeWidth={6} />
      <circle r={r - 4} fill={th.bg} stroke={th.ink} strokeWidth={2} />
      {Array.from({length: 12}, (_, i) => (
        <line key={i} x1={0} y1={-r + 8} x2={0} y2={-r + (i % 3 ? 18 : 28)} stroke={th.ink} strokeWidth={i % 3 ? 3 : 6} transform={`rotate(${i * 30})`} />
      ))}
      <line x1={0} y1={8} x2={0} y2={-r * 0.5} stroke={th.ink} strokeWidth={9} strokeLinecap="round" transform={`rotate(${minutes / 2})`} />
      <line x1={0} y1={12} x2={0} y2={-r * 0.8} stroke={th.ink} strokeWidth={5} strokeLinecap="round" transform={`rotate(${minutes * 6})`} />
      <circle r={7} fill={th.ink} />
    </g>
  );
};
const Flame: React.FC<{x: number; h: number; sway: number}> = ({x, h, sway}) => {
  const th = useTheme();
  const f = (s: number) => `M${x - 34 * s},330 C${x - 40 * s},${330 - h * 0.45 * s} ${x + sway * s - 10 * s},${330 - h * 0.7 * s} ${x + sway * s},${330 - h * s} C${x + sway * s + 14 * s},${330 - h * 0.62 * s} ${x + 42 * s},${330 - h * 0.4 * s} ${x + 34 * s},330 Z`;
  return (
    <g>
      <path d={f(1)} fill={th.reveal} stroke={th.ink} strokeWidth={4} strokeLinejoin="round" />
      <path d={f(0.5)} fill={th.bg} />
    </g>
  );
};
const Fig2: React.FC = () => {
  const {t, T} = useView();
  const th = useTheme();
  const raw = 1 - 0.3 * k(t, [T.b1, T.after + 1.5], [0, 1], (x) => x) - 0.08 * k(t, [T.after + 1.5, 24], [0, 1], (x) => x);
  const fl = (i: number) => ({h: 120 + 26 * noise2D(`fh${i}`, t * 2.6, 0), sway: 22 * noise2D(`fs${i}`, t * 1.9, 3)});
  const pot = 'M-300,-150 L-300,130 Q-300,210 -220,210 L220,210 Q300,210 300,130 L300,-150 L272,-150 L272,126 Q272,182 216,182 L-216,182 Q-272,182 -272,126 L-272,-150 Z';
  return (
    <At x={F2[0]} y={F2[1]}>
      {/* the water, simmering */}
      <path d={`M-272,-70 ${Array.from({length: 18}, (_, i) => `Q${-272 + i * 30.2 + 15},${-70 + (i % 2 ? 6 : -6) * Math.sin(t * 3 + i)} ${-272 + (i + 1) * 30.2},-70`).join(' ')} L272,126 Q272,182 216,182 L-216,182 Q-272,182 -272,126 Z`} fill={th.surface} />
      <rect x={-272} y={-70} width={544} height={252} fill="url(#water)" />
      {Array.from({length: 7}, (_, i) => {
        const p = (t * 0.55 + random(`bub${i}`)) % 1;
        return <circle key={i} cx={-220 + random(`bx${i}`) * 440} cy={170 - p * 235} r={5 + 6 * p} fill="none" stroke={th.ink} strokeWidth={2} opacity={k(p, [0, 0.15], [0, 1]) * k(p, [0.85, 1], [1, 0])} />;
      })}
      <Potato raw={raw} bloom={0} id="pot2" />
      <path d={pot} fill="url(#hatch)" stroke={th.ink} strokeWidth={5} strokeLinejoin="round" />
      <path d="M-300,-150 L-340,-150 L-340,-130 L-300,-130 M300,-150 L340,-150 L340,-130 L300,-130" fill="none" stroke={th.ink} strokeWidth={5} />
      <path d="M-300,-110 C-380,-110 -380,-40 -300,-40 M300,-110 C380,-110 380,-40 300,-40" fill="none" stroke={th.ink} strokeWidth={9} />
      {/* fire: flames lick the pot from outside; heat has to walk in through iron, water and skin */}
      {[-150, -75, 0, 75, 150].map((x, i) => (
        <Flame key={i} x={x} {...fl(i)} />
      ))}
      {[-120, 0, 120].map((x, i) => (
        <g key={i} transform={`translate(${x},372)`}>
          <circle r={40} fill={th.surface} stroke={th.ink} strokeWidth={5} />
          <circle r={27} fill="none" stroke={th.ink} strokeWidth={2} />
          <circle r={14} fill="none" stroke={th.ink} strokeWidth={2} />
          <path d="M0,0 L22,-26" stroke={th.ink} strokeWidth={2.5} />
        </g>
      ))}
      <line x1={-260} y1={414} x2={260} y2={414} stroke={th.ink} strokeWidth={4} />
      {[0, 1, 2, 3].map((i) => {
        const p = (t * 0.7 + i / 4) % 1;
        return <path key={i} d={`M${-140 + i * 90},${232 - p * 60} q10,-12 0,-24 q-10,-12 0,-24`} fill="none" stroke={th.ink} strokeWidth={3} opacity={k(p, [0, 0.2], [0, 1]) * k(p, [0.7, 1], [1, 0])} />;
      })}
      <Clock x={330} y={-300} r={86} minutes={Math.max(0, t - T.b1 + 0.6) * 300} />
      <Label x={-340} y={-300} size={40} weight={700} text="FIG. 2" />
      <Label x={-340} y={-254} size={28} text="OUTSIDE IN" fill={th.muted} spacing={0.3} />
    </At>
  );
};
const Fig3: React.FC = () => {
  const {t, T, flare} = useView();
  const th = useTheme();
  const bloom = k(t, [T.waves + 0.3, T.minutes - 0.2], [0, 1], OUT);
  const steam = k(t, [T.minutes - 0.6, T.minutes + 0.8], [0, 1]);
  return (
    <At x={F3[0]} y={F3[1]}>
      <path d="M-260,168 Q-250,200 -200,204 L200,204 Q250,200 260,168 L235,168 Q225,182 190,184 L-190,184 Q-225,182 -235,168 Z" fill="url(#hatch)" stroke={th.ink} strokeWidth={5} strokeLinejoin="round" />
      <path d="M-90,204 L-80,228 L80,228 L90,204" fill="none" stroke={th.ink} strokeWidth={5} />
      <Potato raw={1} bloom={bloom} id="pot3" flare={flare(F3[0], F3[1])} />
      {[-60, 0, 60].map((x, i) => {
        const p = (t * 0.45 + i * 0.33) % 1;
        return <path key={i} d={`M${x},${-50 - p * 120} q16,-20 0,-40 q-16,-20 0,-40`} fill="none" stroke={th.ink} strokeWidth={3} opacity={steam * k(p, [0, 0.2], [0, 1]) * k(p, [0.6, 1], [1, 0])} />;
      })}
      <Waves on={T.waves - 1.0} c={[640, 70]} dir={Math.PI} spread={0.5} gap={110} speed={520} max={1300} w={4} />
      <Clock x={330} y={-300} r={86} minutes={k(t, [T.waves, T.minutes + 0.4], [0, 4], (x) => x)} />
      <Label x={-340} y={-300} size={40} weight={700} text="FIG. 3" />
      <Label x={-340} y={-254} size={28} text="INSIDE OUT" fill={th.muted} spacing={0.3} />
    </At>
  );
};

// ---------- Percy Spencer, in phantom line ----------
const BODY: P[] = [[0, 0], [48, 20], [64, 60], [62, 74], [82, 99], [64, 108], [68, 118], [63, 125], [67, 132], [60, 150], [38, 161], [30, 176], [46, 192], [88, 250], [98, 310], [92, 420], [97, 560], [99, 604], [80, 622], [78, 780], [66, 930], [64, 962], [98, 974], [132, 990], [130, 1000], [-30, 1000], [-32, 976], [-22, 958], [-38, 820], [-34, 760], [-50, 622], [-74, 604], [-78, 420], [-82, 262], [-62, 200], [-40, 176], [-58, 140], [-72, 80], [-50, 20]];
const ARM_UP: P[] = [[-24, 0], [24, 0], [22, 205], [-20, 205]];
const ARM_LO: P[] = [[-20, 0], [20, 0], [16, 150], [-16, 150]];
const armAngles = (lift: number) => [lerp(-4, -50, lift), lerp(-10, -95, lift)] as const;
const handAt = (lift: number): P => {
  const [a1, a2] = armAngles(lift).map((a) => (a * Math.PI) / 180);
  const ex = 2 - 205 * Math.sin(a1);
  const ey = 215 + 205 * Math.cos(a1);
  const hx = ex - 175 * Math.sin(a2);
  const hy = ey + 175 * Math.cos(a2);
  return [PERCY.x + hx * PERCY.s, PERCY.y + hy * PERCY.s];
};
const Percy: React.FC<{lift: number; x?: number; y?: number; o?: number; bag?: boolean}> = ({lift, x = PERCY.x, y = PERCY.y, o = 1, bag = false}) => {
  const th = useTheme();
  const [a1, a2] = armAngles(lift);
  const ph = {fill: 'none', stroke: th.ink, strokeWidth: 3.4, strokeDasharray: '28 7 5 7', strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const};
  return (
    <g transform={`translate(${x},${y}) scale(${PERCY.s})`} opacity={o}>
      <path d={smooth(BODY)} {...ph} fill={mix(th.bg, 70)} />
      <path d="M44,22 C10,6 -40,14 -66,92 L-58,106 C-40,50 0,30 46,30 Z" fill="url(#hatchFine)" />
      <path d="M-6,82 C-20,82 -22,112 -6,114" {...ph} strokeDasharray="none" strokeWidth={2.4} />
      <circle cx={50} cy={78} r={13} {...ph} strokeDasharray="none" strokeWidth={2.4} />
      <path d="M37,78 L-4,86" {...ph} strokeDasharray="none" strokeWidth={2} />
      <path d="M46,192 L74,300 L98,316 M30,176 L20,236" {...ph} />
      {[380, 452, 524].map((yy) => (
        <circle key={yy} cx={92} cy={yy} r={4} fill={th.ink} />
      ))}
      {/* the pocket: solid line, because it is the subject; a bar and a pen peek out */}
      <path d="M72,288 L100,292" fill="none" stroke={th.ink} strokeWidth={3} />
      <path d="M80,288 L80,276 L95,277 L95,290" fill={th.ink} stroke={th.ink} strokeWidth={2} />
      <path d="M74,288 L73,262" stroke={th.ink} strokeWidth={4} strokeLinecap="round" />
      <g transform={`translate(2,215) rotate(${a1})`}>
        <path d={smooth(ARM_UP)} {...ph} fill={mix(th.bg, 70)} />
        <g transform={`translate(0,205) rotate(${a2 - a1})`}>
          <path d={smooth(ARM_LO)} {...ph} fill={mix(th.bg, 70)} />
          <ellipse cx={0} cy={172} rx={17} ry={26} {...ph} />
          {bag && (
            <g transform="translate(0,170)">
              <path d="M-24,-46 L24,-46 L18,22 L-18,22 Z" fill={th.surface} stroke={th.ink} strokeWidth={2.4} />
              {[-12, 0, 12, -6, 6].map((dx, i) => (
                <ellipse key={i} cx={dx} cy={i < 3 ? -50 : -58} rx={6} ry={8} fill={th.bg} stroke={th.ink} strokeWidth={1.6} />
              ))}
            </g>
          )}
        </g>
      </g>
    </g>
  );
};

// ---------- the cavity magnetron, in section ----------
const Magnetron: React.FC<{on: number}> = ({on}) => {
  const {t} = useView();
  const th = useTheme();
  const heat = th.reveal!;
  const spin = t * 260;
  return (
    <g transform={`translate(${MAG.x},${MAG.y})`}>
      {/* the horseshoe magnet behind the block */}
      <path d={`${arc(0, 0, 330, Math.PI * 1.08, Math.PI * 1.92)} L${330 * Math.cos(Math.PI * 1.92)},140 L${270 * Math.cos(Math.PI * 1.92)},140 L${270 * Math.cos(Math.PI * 1.92)},${270 * Math.sin(Math.PI * 1.92)} A270,270 0 0 0 ${270 * Math.cos(Math.PI * 1.08)},${270 * Math.sin(Math.PI * 1.08)} L${270 * Math.cos(Math.PI * 1.08)},140 L${330 * Math.cos(Math.PI * 1.08)},140 Z`} fill="url(#hatchFine)" stroke={th.ink} strokeWidth={5} />
      {/* cooling fins */}
      {Array.from({length: 24}, (_, i) => (
        <rect key={i} x={-5} y={-262} width={10} height={60} fill={th.surface} stroke={th.ink} strokeWidth={2.4} transform={`rotate(${i * 15 + 7.5})`} />
      ))}
      {/* the copper anode block, sectioned; eight resonant cavities around the bore */}
      <circle r={206} fill={th.surface} />
      <circle r={206} fill="url(#hatch)" stroke={th.ink} strokeWidth={6} />
      {Array.from({length: 8}, (_, i) => (
        <g key={i} transform={`rotate(${i * 45})`}>
          <rect x={-9} y={-120} width={18} height={50} fill={th.bg} />
          <circle cx={0} cy={-136} r={32} fill={th.bg} stroke={th.ink} strokeWidth={4} />
          <path d="M-9,-106 L-9,-76 M9,-106 L9,-76" stroke={th.ink} strokeWidth={4} />
        </g>
      ))}
      <circle r={78} fill={th.bg} stroke={th.ink} strokeWidth={4} />
      {/* the electron cloud: four spokes turning in the interaction space, the source of the heat */}
      <g opacity={on * 0.95} transform={`rotate(${spin})`}>
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M-10,-26 C-6,-50 14,-64 30,-72 L44,-62 C24,-52 12,-40 10,-26 Z" fill={heat} transform={`rotate(${a})`} />
        ))}
      </g>
      <circle r={26} fill={th.ink} />
      <path d="M-14,0 l5,-8 l5,8 l5,-8 l5,8 l5,-8" fill="none" stroke={th.bg} strokeWidth={2.4} />
      {/* output: antenna loop, waveguide, horn */}
      <path d="M-160,-6 C-200,-6 -210,0 -262,0" fill="none" stroke={th.ink} strokeWidth={6} />
      <rect x={-400} y={-42} width={140} height={84} fill={th.bg} stroke={th.ink} strokeWidth={5} />
      <rect x={-400} y={-42} width={140} height={14} fill="url(#hatch)" stroke={th.ink} strokeWidth={2} />
      <rect x={-400} y={28} width={140} height={14} fill="url(#hatch)" stroke={th.ink} strokeWidth={2} />
      <path d="M-400,-42 L-450,-118 L-466,-110 L-416,-28 M-400,42 L-450,118 L-466,110 L-416,28" fill="url(#hatch)" stroke={th.ink} strokeWidth={5} strokeLinejoin="round" />
      <rect x={-262} y={-6} width={140} height={12} fill={heat} opacity={on * (0.6 + 0.4 * Math.sin(t * 20))} />
      {/* mounting foot */}
      <path d="M-120,190 L-160,290 L160,290 L120,190" fill="url(#hatchFine)" stroke={th.ink} strokeWidth={5} />
    </g>
  );
};

// ---------- Detail B: the kernel; Detail C: the egg ----------
const KERNEL: P[] = [[0, -122], [70, -106], [106, -50], [100, 22], [70, 82], [30, 116], [0, 130], [-30, 116], [-70, 82], [-100, 22], [-106, -50], [-70, -106]];
const PUFFS: [number, number, number][] = [[0, 0, 0.5], [-0.52, -0.3, 0.42], [0.48, -0.38, 0.44], [0.6, 0.28, 0.38], [-0.5, 0.36, 0.4], [0.04, 0.58, 0.36], [-0.08, -0.66, 0.36], [-0.86, 0.02, 0.26]];
const KernelDetail: React.FC = () => {
  const {t, T, flare} = useView();
  const th = useTheme();
  const heat = th.reveal!;
  const p = k(t, [T.b3 + 1.2, T.pop], [0, 1], IN);
  const after = t - T.pop;
  const popped = after >= 0;
  const shiver = popped ? 0 : p * p * 7;
  const sx = noise2D('ks', t * 40, 0) * shiver;
  const sy = noise2D('ks', 0, t * 40) * shiver;
  const R = popped ? 160 * (1 + 0.1 * settle(t, T.pop + 0.14, 3, 1.4)) : 0;
  const glow = popped ? k(after, [0, 2.5], [0.8, 0.25]) + 0.4 * flare(DB.x, DB.y) : 0.25 + 0.75 * p;
  return (
    <g>
      <Waves on={T.b3 + 0.6} c={[1300, -20]} dir={Math.PI} spread={0.3} gap={110} speed={420} max={1900} w={4} o={0.7} />
      {!popped ? (
        <g transform={`translate(${sx},${sy + 10})`}>
          <path d={smooth(KERNEL)} fill={th.bg} />
          <path d={smooth(KERNEL)} fill="url(#stip)" />
          <ellipse cx={0} cy={86} rx={30} ry={36} fill="url(#hatch)" stroke={th.ink} strokeWidth={3} />
          <radialGradient id="kcore" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={heat} stopOpacity={1} />
            <stop offset="1" stopColor={heat} stopOpacity={0} />
          </radialGradient>
          <ellipse cx={0} cy={-14} rx={30 + 70 * p} ry={24 + 60 * p} fill="url(#kcore)" opacity={glow} />
          <ellipse cx={0} cy={-14} rx={18 + 26 * p} ry={14 + 20 * p} fill="none" stroke={th.ink} strokeWidth={2.5} />
          {Array.from({length: 9}, (_, i) => (
            <circle key={i} cx={(random(`kb${i}`) - 0.5) * 150} cy={(random(`kc${i}`) - 0.5) * 170 - 10} r={3 + 7 * p} fill="none" stroke={th.ink} strokeWidth={1.6} opacity={k(p, [0.2 + i * 0.06, 0.4 + i * 0.06], [0, 1])} />
          ))}
          <path d={smooth(KERNEL)} fill="none" stroke={th.ink} strokeWidth={10} />
          <path d={smooth(KERNEL.map(([x, y]) => [x * 0.9, y * 0.9 - 2] as P))} fill="none" stroke={th.ink} strokeWidth={2} />
        </g>
      ) : (
        <g>
          {/* the hull splits and falls away; the starch turns inside out into a flake */}
          {[-1, 1].map((s) => (
            <g key={s} transform={`translate(${s * 260 * after},${-120 * after + 900 * after * after}) rotate(${s * 220 * after})`} opacity={k(after, [0.5, 0.9], [1, 0])}>
              <path d={`${smooth(KERNEL.filter(([x]) => x * s >= 0), false)} Z`} fill="url(#hatch)" stroke={th.ink} strokeWidth={8} strokeLinejoin="round" transform={`scale(${s > 0 ? 0.55 : 0.5})`} />
            </g>
          ))}
          {/* popcorn: puffs of starch, one outline round the lot (strokes under, fills over), the hull cap still clinging */}
          <g filter="url(#ink)">
            {PUFFS.map(([x, y, r], i) => (
              <circle key={i} cx={x * R} cy={y * R} r={r * R * k(after, [0, 0.1 + i * 0.015], [0.3, 1], BACK)} fill={th.ink} stroke={th.ink} strokeWidth={16} />
            ))}
            {PUFFS.map(([x, y, r], i) => (
              <circle key={i} cx={x * R} cy={y * R} r={r * R * k(after, [0, 0.1 + i * 0.015], [0.3, 1], BACK)} fill={th.bg} />
            ))}
            {PUFFS.map(([x, y, r], i) => (
              <path key={i} d={arc(x * R, y * R, r * R * 0.72, Math.PI * (0.9 + i * 0.37), Math.PI * (1.35 + i * 0.37))} fill="none" stroke={th.ink} strokeWidth={3.5} strokeLinecap="round" />
            ))}
            <circle cx={0} cy={0} r={R * 0.5} fill="url(#stip)" />
            <path d={`M${-R * 0.32},${R * 0.86} Q0,${R * 1.08} ${R * 0.32},${R * 0.86} Q0,${R * 0.94} ${-R * 0.32},${R * 0.86} Z`} fill={tone(th.ink, heat, 80)} stroke={th.ink} strokeWidth={4} />
          </g>
          <ellipse cx={0} cy={0} rx={R * 0.55} ry={R * 0.5} fill="url(#kcore)" opacity={glow} />
          <circle r={R * 1.6 * k(after, [0, 0.25], [0.6, 1])} fill="none" stroke={th.ink} strokeWidth={3} strokeDasharray="10 16" opacity={k(after, [0, 0.3], [0.9, 0])} />
        </g>
      )}
    </g>
  );
};

const EGG_S = 1.3;
const egg = (s = 1): P[] =>
  Array.from({length: 40}, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return [Math.sin(a) * 128 * (1 - 0.13 * Math.cos(a)) * s, -Math.cos(a) * 170 * s + 10];
  });
const SHARDS = Array.from({length: 10}, (_, i) => {
  const a0 = (i / 10) * Math.PI * 2 + (random(`sa${i}`) - 0.5) * 0.2;
  const a1 = ((i + 1) / 10) * Math.PI * 2 + (random(`sa${i + 1}`) - 0.5) * 0.2;
  const ring = (a: number, s: number): P => [Math.sin(a) * 128 * (1 - 0.13 * Math.cos(a)) * s, -Math.cos(a) * 170 * s + 10];
  const pts: P[] = [...[0, 0.33, 0.66, 1].map((u) => ring(lerp(a0, a1, u), 1)), ...[1, 0.5, 0].map((u) => ring(lerp(a0, a1, u), 0.92))];
  const mid = (a0 + a1) / 2;
  return {pts, dir: [Math.sin(mid), -Math.cos(mid)] as P, v: 500 + random(`sv${i}`) * 500, w: (random(`sw${i}`) - 0.5) * 900, stays: Math.cos(mid) < -0.75};
});
const EggDetail: React.FC = () => {
  const {t, T, flare} = useView();
  const th = useTheme();
  const heat = th.reveal!;
  const p = k(t, [T.pop - 0.3, T.boom], [0, 1], IN);
  const crack = k(t, [T.boom - 0.45, T.boom - 0.05], [0, 1]);
  const after = t - T.boom;
  const gone = after >= 0;
  const amp = gone ? 0 : 2 + p * p * 9;
  const sx = noise2D('es', t * 46, 0) * amp;
  const glow = gone ? 0.35 + 0.5 * flare(DC.x, DC.y) : 0.3 + 0.7 * p;
  return (
    <g>
      <Waves on={T.b3 + 0.6} c={[1400, -20]} dir={Math.PI} spread={0.3} gap={110} speed={420} max={2000} w={4} o={0.7} />
      <radialGradient id="ecore" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor={heat} stopOpacity={1} />
        <stop offset="1" stopColor={heat} stopOpacity={0} />
      </radialGradient>
      {!gone ? (
        <g transform={`translate(${sx},0) scale(${EGG_S * (1 + p * 0.04)})`}>
          <path d={smooth(egg())} fill={th.surface} />
          <path d={smooth(egg(0.94))} fill={th.bg} />
          {[0.5, 0.72].map((s) => (
            <path key={s} d={smooth(egg(s).map(([x, y]) => [x, y + 30] as P))} fill="none" stroke={mix(th.ink, 30)} strokeWidth={2} />
          ))}
          <path d="M0,-150 C14,-120 -14,-90 0,-55 M0,95 C14,120 -14,140 0,165" fill="none" stroke={th.ink} strokeWidth={3} />
          <circle cx={0} cy={22} r={70} fill="url(#hatchX)" stroke={th.ink} strokeWidth={4} />
          <ellipse cx={0} cy={22} rx={70 + 90 * p} ry={70 + 100 * p} fill="url(#ecore)" opacity={glow} />
          <path d={smooth([[-70, 150], [0, 168], [70, 150], [0, 158]])} fill={th.bg} stroke={th.ink} strokeWidth={2} />
          <path d={smooth(egg())} fill="none" stroke={th.ink} strokeWidth={9} />
          <path d={smooth(egg(0.94))} fill="none" stroke={th.ink} strokeWidth={2} />
          {['M-40,-150 L-22,-110 L-44,-80 L-18,-40', 'M60,-120 L48,-82 L74,-50 L62,-14', 'M-110,30 L-80,44 L-96,80'].map((d, i) => (
            <path key={i} d={d} fill="none" stroke={th.ink} strokeWidth={4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp(crack * 1.6 - i * 0.3)} strokeLinejoin="bevel" />
          ))}
        </g>
      ) : (
        <g>
          {/* what is left in the ring: the cup of the shell, cooked from the inside */}
          <ellipse cx={0} cy={100} rx={110} ry={50} fill="url(#ecore)" opacity={glow} />
          <circle r={260 * k(after, [0, 0.3], [0.3, 1.2])} fill="none" stroke={heat} strokeWidth={10} strokeDasharray="24 18" opacity={k(after, [0, 0.35], [1, 0])} />
        </g>
      )}
    </g>
  );
};
// The shell pieces leave the detail circle and fly at the lens: they are drawn outside its clip.
const EggShards: React.FC = () => {
  const {t, T} = useView();
  const th = useTheme();
  const after = t - T.boom;
  if (after < 0 || after > 1.4) return null;
  return (
    <g transform={`translate(${DC.x},${DC.y}) scale(${EGG_S})`}>
      {SHARDS.map((s, i) => {
        const d = s.stays ? Math.min(after, 0.08) : after;
        const x = s.dir[0] * s.v * d;
        const y = s.dir[1] * s.v * d + 1100 * d * d;
        const sc = s.stays ? 1 : 1 + 2.4 * d;
        return <path key={i} d={poly(s.pts)} transform={`translate(${x},${y}) rotate(${s.w * d}) scale(${sc})`} fill="url(#hatch)" stroke={th.ink} strokeWidth={6} strokeLinejoin="round" opacity={s.stays ? 1 : k(after, [0.7, 1.2], [1, 0])} />;
      })}
    </g>
  );
};

// ---------- the Radarange, and the kitchen it became ----------
const RANGE_H = 1690;
const RANGE_W = 680;
const Radarange: React.FC<{draw: number; o: number}> = ({draw, o}) => {
  const {t} = useView();
  const th = useTheme();
  const heat = th.reveal!;
  const ln = (d: string, w = 5, at = 0) => <path d={d} fill="none" stroke={th.ink} strokeWidth={w} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp((draw - at) * 2.2)} strokeLinejoin="round" />;
  const H = RANGE_H;
  const W = RANGE_W / 2;
  const fill = clamp(draw * 2 - 0.9);
  return (
    <g opacity={o}>
      <g opacity={fill}>
        <rect x={-W} y={-H} width={2 * W} height={H} fill={th.surface} />
        <rect x={0} y={-1600} width={W - 24} height={420} fill={th.bg} />
        <rect x={0} y={-1130} width={W - 24} height={500} fill={th.bg} />
        <rect x={0} y={-500} width={W - 24} height={430} fill={th.bg} />
        {[-1600, -1130, -500].map((y, i) => (
          <rect key={i} x={-4} y={y} width={14} height={[420, 500, 430][i]} fill="url(#hatch)" />
        ))}
        {Array.from({length: 9}, (_, i) => (
          <rect key={i} x={-W + 60} y={-1570 + i * 42} width={220} height={14} rx={7} fill={th.ink} />
        ))}
        {/* the magnetron up top feeds a waveguide down into the cavity */}
        <g transform="translate(170,-1400) scale(0.36)">
          <circle r={206} fill="url(#hatch)" stroke={th.ink} strokeWidth={10} />
          <circle r={78} fill={th.bg} stroke={th.ink} strokeWidth={8} />
          <circle r={26} fill={th.ink} />
        </g>
        <rect x={150} y={-1326} width={40} height={210} fill="url(#hatchFine)" stroke={th.ink} strokeWidth={4} />
        <Waves on={-10} c={[170, -1110]} dir={Math.PI / 2} spread={0.7} gap={60} speed={140} max={330} w={4} o={0.8} />
        <ellipse cx={150} cy={-760} rx={110} ry={34} fill="none" stroke={th.ink} strokeWidth={5} />
        <ellipse cx={150} cy={-800} rx={70} ry={46} fill={heat} opacity={0.75 + 0.2 * Math.sin(t * 6)} stroke={th.ink} strokeWidth={4} />
        {/* the door, latch and handle on the left half */}
        <rect x={-W + 30} y={-1110} width={W - 50} height={460} fill={th.bg} stroke={th.ink} strokeWidth={4} />
        <rect x={-60} y={-980} width={22} height={200} rx={10} fill={th.ink} />
        {/* controls */}
        <circle cx={-200} cy={-565} r={34} fill={th.bg} stroke={th.ink} strokeWidth={5} />
        <line x1={-200} y1={-565} x2={-200} y2={-592} stroke={th.ink} strokeWidth={6} transform={`rotate(${40 + 10 * Math.sin(t)} -200 -565)`} />
        {[-110, -60].map((x) => (
          <g key={x}>
            <circle cx={x} cy={-565} r={12} fill={th.ink} />
            <line x1={x} y1={-565} x2={x + 10} y2={-595} stroke={th.ink} strokeWidth={6} strokeLinecap="round" />
          </g>
        ))}
        <circle cx={100} cy={-565} r={16} fill={heat} stroke={th.ink} strokeWidth={4} />
        {/* below: transformer and the water cooling coil */}
        <rect x={-W + 50} y={-450} width={250} height={300} fill="url(#hatchX)" stroke={th.ink} strokeWidth={4} />
        <path d={`M40,-470 ${Array.from({length: 8}, (_, i) => `C${40 + 240},${-470 + i * 48 + 8} ${40 + 240},${-470 + i * 48 + 40} 40,${-470 + i * 48 + 48}`).join(' ')}`} fill="none" stroke={th.ink} strokeWidth={8} />
      </g>
      {ln(`M${-W},0 L${-W},${-H} L${W},${-H} L${W},0 Z`, 7, 0)}
      {ln(`M${-W - 20},${-H} L${W + 20},${-H} L${W + 20},${-H + 50} L${-W - 20},${-H + 50} Z`, 5, 0.1)}
      {ln(`M${-W},-1150 L${W},-1150 M${-W},-620 L${W},-620 M${-W},-520 L${W},-520 M${-W},-60 L${W},-60`, 4, 0.2)}
      {ln(`M${-W + 30},0 L${-W + 30},30 L${-W + 90},30 L${-W + 90},0 M${W - 30},0 L${W - 30},30 L${W - 90},30 L${W - 90},0`, 4, 0.3)}
      {/* the break line where the right half is cut away */}
      {ln(`M0,${-H + 50} L18,-1500 L-10,-1380 L14,-1240 L-8,-1150 M0,-1130 L16,-980 L-12,-820 L10,-640 M0,-500 L14,-360 L-10,-220 L12,-60`, 5, 0.25)}
    </g>
  );
};
// the countertop box it became, drawn at its final size; it arrives stretched from the cabinet's proportions
const BOX = {w: 480, h: 290};
const Countertop: React.FC<{sx: number; sy: number; o: number; glow: number}> = ({sx, sy, o, glow}) => {
  const th = useTheme();
  const nss = {vectorEffect: 'non-scaling-stroke' as const};
  const {w, h} = BOX;
  return (
    <g opacity={o} transform={`scale(${sx},${sy})`}>
      <rect x={-w / 2} y={-h} width={w} height={h - 14} rx={18} fill={th.surface} stroke={th.ink} strokeWidth={6} {...nss} />
      <rect x={-w / 2 + 26} y={-h + 28} width={w * 0.6} height={h - 80} rx={10} fill={th.bg} stroke={th.ink} strokeWidth={4} {...nss} />
      <rect x={-w / 2 + 40} y={-h + 42} width={w * 0.6 - 28} height={h - 108} rx={6} fill={th.reveal} opacity={glow} />
      <ellipse cx={-w / 2 + 26 + w * 0.3} cy={-70} rx={70} ry={14} fill="none" stroke={th.ink} strokeWidth={3} {...nss} />
      <circle cx={w / 2 - 70} cy={-h + 80} r={26} fill={th.bg} stroke={th.ink} strokeWidth={4} {...nss} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={w / 2 - 100} y={-h + 130 + i * 34} width={60} height={20} rx={4} fill={th.bg} stroke={th.ink} strokeWidth={3} {...nss} />
      ))}
      <path d={`M${-w / 2 + 30},-14 L${-w / 2 + 30},0 M${w / 2 - 30},-14 L${w / 2 - 30},0`} stroke={th.ink} strokeWidth={6} {...nss} />
    </g>
  );
};
// the building: every window a kitchen, every kitchen a box with a lit door
const COLS = 5;
const ROWS = 6;
const WIN = {w: 1040, h: 900, px: 1300, py: 1450};
const winAt = (c: number, r: number): P => [RR[0] - WIN.w / 2 + (c - 2) * WIN.px, 2060 + (r - 3) * WIN.py];
const Facade: React.FC<{o: number; draw: number; lit: (c: number, r: number) => number}> = ({o, draw, lit}) => {
  const th = useTheme();
  const L = winAt(0, 0)[0] - 300;
  const R = winAt(COLS - 1, 0)[0] + WIN.w + 300;
  const top = winAt(0, 0)[1] - 420;
  const ground = winAt(0, ROWS - 1)[1] + WIN.h + 440;
  return (
    <g opacity={o}>
      <rect x={L} y={top} width={R - L} height={ground - top} fill={th.bg} />
      <rect x={L} y={top} width={R - L} height={ground - top} fill="url(#brick)" />
      <path d={`M${L},${ground} L${L},${top} L${R},${top} L${R},${ground}`} fill="none" stroke={th.ink} strokeWidth={26} />
      <rect x={L - 120} y={top - 160} width={R - L + 240} height={160} fill="url(#hatch)" stroke={th.ink} strokeWidth={22} />
      <path d={`M${R - 1500},${top - 160} L${R - 1500},${top - 900} L${R - 700},${top - 900} L${R - 700},${top - 160} M${R - 1540},${top - 900} L${R - 1100},${top - 1200} L${R - 660},${top - 900} Z`} fill="none" stroke={th.ink} strokeWidth={20} strokeLinejoin="round" />
      {Array.from({length: ROWS - 1}, (_, r) => (
        <line key={r} x1={L} y1={winAt(0, r)[1] + WIN.h + 270} x2={R} y2={winAt(0, r)[1] + WIN.h + 270} stroke={th.ink} strokeWidth={14} />
      ))}
      <line x1={L - 1400} y1={ground} x2={R + 1400} y2={ground} stroke={th.ink} strokeWidth={30} />
      <rect x={L - 1400} y={ground} width={R - L + 2800} height={160} fill="url(#hatch)" />
      {Array.from({length: COLS * ROWS}, (_, i) => {
        const c = i % COLS;
        const r = Math.floor(i / COLS);
        if (c === 2 && r === 3) return null;
        const [x, y] = winAt(c, r);
        const g = lit(c, r);
        return (
          <g key={i} opacity={draw}>
            <rect x={x} y={y} width={WIN.w} height={WIN.h} fill={th.surface} stroke={th.ink} strokeWidth={24} />
            <line x1={x} y1={y + 790} x2={x + WIN.w} y2={y + 790} stroke={th.ink} strokeWidth={22} />
            <rect x={x + 280} y={y + 500} width={480} height={290} rx={20} fill={th.bg} stroke={th.ink} strokeWidth={18} />
            <rect x={x + 310} y={y + 530} width={290} height={200} fill={th.reveal} opacity={g} />
            <rect x={x - 40} y={y + WIN.h} width={WIN.w + 80} height={50} fill={th.ink} />
          </g>
        );
      })}
    </g>
  );
};
// the origin kitchen: its window frame and counter draw around the box
const Kitchen: React.FC<{draw: number}> = ({draw}) => {
  const th = useTheme();
  const [x, y] = winAt(2, 3);
  const ln = (d: string, w: number, at: number) => <path d={d} fill="none" stroke={th.ink} strokeWidth={w} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp((draw - at) * 2)} />;
  return (
    <g>
      <rect x={x} y={y} width={WIN.w} height={WIN.h} fill={th.surface} opacity={clamp(draw * 2 - 1)} />
      <rect x={x} y={y + 790} width={WIN.w} height={110} fill="url(#hatch)" opacity={clamp(draw * 2 - 1)} />
      {Array.from({length: 7}, (_, i) => (
        <line key={i} x1={x + i * 150 + 70} y1={y + 600} x2={x + i * 150 + 70} y2={y + 790} stroke={mix(th.ink, 30)} strokeWidth={4} opacity={clamp(draw * 2 - 1)} />
      ))}
      {ln(`M${x},${y + 790} L${x + WIN.w},${y + 790}`, 22, 0)}
      {ln(`M${x},${y + WIN.h} L${x},${y} L${x + WIN.w},${y} L${x + WIN.w},${y + WIN.h} Z`, 24, 0.25)}
      <rect x={x - 40} y={y + WIN.h} width={WIN.w + 80} height={50} fill={th.ink} opacity={clamp(draw * 2 - 1)} />
    </g>
  );
};

// ---------- on the lens: egg, then the cloth that wipes it ----------
const blob = (cx: number, cy: number, R: number, seed: string, n = 40): string =>
  smooth(
    Array.from({length: n}, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = R * (1 + 0.28 * noise2D(seed, Math.cos(a) * 1.3, Math.sin(a) * 1.3) + 0.14 * Math.sin(a * 7 + R));
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as P;
    }),
  );
const SPLATS = [
  {x: 470, y: 1010, R: 240, yolk: false, d: 0.02},
  {x: 600, y: 760, R: 215, yolk: true, d: 0},
  {x: 220, y: 450, R: 70, yolk: true, d: 0.05},
  {x: 880, y: 1200, R: 56, yolk: true, d: 0.07},
];
const Lens: React.FC = () => {
  const {t, T} = useView();
  const th = useTheme();
  const land = T.boom + 0.12;
  if (t < land || t >= T.wipe + 0.065) return null; // gone with the cut, under the cloth
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, filter: `drop-shadow(0 10px 14px ${mix(th.ink, 28)})`}}>
        {SPLATS.map((s, i) => {
          const a = t - land - s.d;
          if (a < 0) return null;
          const sc = 1 + 0.35 * Math.exp(-a * 30);
          const slide = 260 * k(a, [0.25, 1.9], [0, 1], (x) => x) * (s.R / 165);
          const fill = s.yolk ? tone(th.reveal!, th.bg, 82) : mix(th.surface, 78);
          return (
            <g key={i} transform={`translate(${s.x},${s.y}) scale(${sc}) translate(${-s.x},${-s.y})`}>
              <path d={`M${s.x - s.R * 0.25},${s.y + s.R * 0.6} L${s.x - s.R * 0.2},${s.y + s.R * 0.6 + slide} A${s.R * 0.2},${s.R * 0.2} 0 0 0 ${s.x + s.R * 0.2},${s.y + s.R * 0.6 + slide} L${s.x + s.R * 0.25},${s.y + s.R * 0.6} Z`} fill={fill} stroke={mix(th.ink, s.yolk ? 50 : 25)} strokeWidth={3} />
              <path d={blob(s.x, s.y, s.R, `sp${i}`)} fill={fill} stroke={mix(th.ink, s.yolk ? 50 : 25)} strokeWidth={3} />
              {Array.from({length: 7}, (_, j) => {
                const ang = random(`da${i}${j}`) * Math.PI * 2;
                const dist = s.R * (1.25 + random(`dd${i}${j}`) * 0.7);
                return <circle key={j} cx={s.x + Math.cos(ang) * dist} cy={s.y + Math.sin(ang) * dist} r={s.R * (0.05 + random(`dr${i}${j}`) * 0.08)} fill={fill} stroke={mix(th.ink, 35)} strokeWidth={2} />;
              })}
              <path d={arc(s.x - s.R * 0.15, s.y - s.R * 0.15, s.R * 0.55, Math.PI * 1.05, Math.PI * 1.45)} fill="none" stroke={mix(th.bg, 85)} strokeWidth={s.R * 0.08} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
// A cloth fills the lens for an instant and drags away up and to the right: the cut to the whole sheet happens behind it.
const Cloth: React.FC = () => {
  const {t, T} = useView();
  const th = useTheme();
  const p = k(t, [T.wipe - 0.28, T.wipe + 0.42], [0, 1], INOUT);
  if (p <= 0 || p >= 1) return null;
  const s = lerp(-2400, 3600, p); // position of the cloth along the wipe axis; it covers the whole frame for p in 0.28..0.72
  const fold = (o: number, i: number) => `M${-2000},${o} C${-700},${o - 80 + 60 * Math.sin(i)} ${600},${o + 90} ${1900},${o - 40}`;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <pattern id="weaveBig" width={54} height={54} patternUnits="userSpaceOnUse">
          <path d="M3,13 h21 M30,40 h21 M13,30 v21 M40,3 v21" stroke={mix(th.ink, 34)} strokeWidth={5} strokeLinecap="round" />
        </pattern>
        <g transform={`translate(540,960) rotate(-28) translate(${s - 540},0)`}>
          <path d={`M-2100,-1600 L-2100,1600 L${-1980 + 40 * Math.sin(t * 9)},1600 C-1920,600 -2040,-500 -1980,-1600 Z`} fill={th.ink} opacity={0.18} />
          <path d="M-2000,-1500 L1900,-1500 C1980,-700 1860,300 1940,1500 L-2000,1500 Z" fill={th.surface} />
          <path d="M-2000,-1500 L1900,-1500 C1980,-700 1860,300 1940,1500 L-2000,1500 Z" fill="url(#weaveBig)" />
          {[-900, -420, 80, 560, 1000].map((o, i) => (
            <path key={i} d={fold(o, i)} fill="none" stroke={mix(th.ink, 55)} strokeWidth={10} strokeLinecap="round" />
          ))}
          <path d="M1900,-1500 C1980,-700 1860,300 1940,1500" fill="none" stroke={th.ink} strokeWidth={16} />
          <path d="M1860,-1500 C1940,-700 1820,300 1900,1500" fill="none" stroke={th.ink} strokeWidth={4} strokeDasharray="22 16" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

// ---------- the closer: the sheet's border and title block ----------
const TitleBlock: React.FC = () => {
  const {t, T} = useView();
  const {cta} = useFilm();
  const th = useTheme();
  const a = k(t, [T.b5 + 0.05, T.b5 + 0.5], [0, 1]);
  const stamp = t - (T.b5 + 0.4);
  const ln = (d: string, w: number, at: number) => <path d={d} fill="none" stroke={th.ink} strokeWidth={w} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp((a - at) * 1.6)} />;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {ln('M40,40 L1040,40 L1040,1880 L40,1880 Z', 8, 0)}
        {ln('M58,58 L1022,58 L1022,1862 L58,1862 Z', 2, 0.1)}
        <rect x={80} y={1290} width={880} height={200} fill={th.bg} opacity={clamp(a * 3)} />
        {ln('M80,1290 L960,1290 L960,1490 L80,1490 Z', 6, 0.2)}
        {ln('M530,1290 L530,1490 M530,1400 L960,1400', 3, 0.35)}
      </svg>
      <div style={{position: 'absolute', left: 560, top: 1312, width: 380, fontFamily: SERIF, fontStyle: 'italic', fontSize: 33, lineHeight: 1.12, color: th.ink, opacity: k(t, [T.b5 + 0.3, T.b5 + 0.6], [0, 1])}}>{cta.sub}</div>
      <div style={{position: 'absolute', left: 560, top: 1424, width: 380, fontFamily: FUT, fontWeight: 500, fontSize: 26, letterSpacing: 3, color: th.muted, opacity: k(t, [T.b5 + 0.4, T.b5 + 0.7], [0, 1])}}>{cta.handle || 'SHEET 1 OF 1'}</div>
      {stamp > 0 && (
        <div style={{position: 'absolute', left: 100, top: 1318, width: 410, height: 144, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `6px solid ${th.reveal}`, color: th.reveal, fontFamily: FUT, fontWeight: 700, fontSize: Math.min(80, (360 - cta.text.length * 6) / (cta.text.length * 0.78)), letterSpacing: 6, whiteSpace: 'nowrap', textTransform: 'uppercase', transform: `rotate(-3deg) scale(${1 + 0.1 * Math.exp(-stamp * 22)})`, opacity: k(stamp, [0, 0.04], [0, 1]), filter: 'url(#ink)'}}>
          {cta.text}
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- the film ----------
export const Film: React.FC = () => {
  const {t, beats, total} = useFilm();
  const th = useTheme();
  const heat = th.reveal!;
  const b = beats;
  const T: Times = {
    year: wordAt(b[0], '1945'),
    b1: b[1].start,
    after: wordAt(b[1], 'After'),
    waves: wordAt(b[1], 'invisible'),
    minutes: wordAt(b[1], 'minutes'),
    b2: b[2].start,
    name: wordAt(b[2], 'Percy'),
    radar: wordAt(b[2], 'radar'),
    b3: b[3].start,
    pop: wordAt(b[3], 'popped') + 0.1,
    boom: wordAt(b[3], 'exploded') + 0.15,
    wipe: wordAt(b[3], 'Microwaves') + 0.05,
    b4: b[4].start,
    six: wordAt(b[4], 'Six'),
    changed: wordAt(b[4], 'changed'),
    b5: b[5].start,
    pulse: wordAt(b[3], 'inside') - 0.45,
  };
  // the camera: one sheet, one camera. Subjects sit high in frame; the figure captions live below them.
  const KEYS: Key[] = [
    [0, DA.x, DA.y + 80 / 1.22, 1.22],
    [b[1].start - 0.15, DA.x, DA.y + 80 / 1.02, 1.02],
    [T.b1 + 1.05, F2[0], F2[1] + 140, 1.0],
    [T.after, F2[0], F2[1] + 132, 1.07],
    [T.after + 1.2, F3[0], F3[1] + 140, 1.0],
    [T.b2 - 0.08, F3[0], F3[1] + 128, 1.12],
    [T.b2 + 1.2, 1700, 1330, 0.5],
    [T.radar - 0.3, 1700, 1325, 0.52],
    [T.b3, 2250, 1250, 0.8],
    [T.b3 + 1.05, 2150, 1290, 0.85],
    [T.pop - 0.6, DB.x, DB.y + 150, 1.0],
    [T.pop + 0.1, DB.x, DB.y + 145, 1.03],
    [T.boom - 0.12, DC.x, DC.y + 125, 1.2],
    [T.wipe + 0.06, DC.x, DC.y + 140, 1.3],
    [T.wipe + 0.07, 1545, 2550, 0.34],
    [T.b4, 1545, 2540, 0.36],
    [T.b4 + 0.95, RR[0], RR[1] - 400 / 0.6, 0.6],
    [T.changed, RR[0], RR[1] - 400 / 0.62, 0.62],
    [T.changed + 0.75, RR[0], RR[1] - 400 / 0.62, 0.62],
    [T.b5 + 0.25, RR[0], 3690, 0.111],
    [total, RR[0], 3690, 0.104],
  ];
  const c = camAt(t, KEYS);
  const push = 1 + 0.09 * (1 - OUT(clamp(t / 1.6)));
  const px = (x: number, y: number): P => [540 + (x - c.x) * c.z * push, 960 + (y - c.y) * c.z * push];
  const pulseR = (t - T.pulse) * 2600;
  const flare = (x: number, y: number) => (t < T.pulse ? 0 : Math.exp(-Math.pow((pulseR - Math.hypot(x - HORN[0], y - HORN[1])) / 380, 2)));
  const view: View = {t, T, px, z: c.z * push, flare};

  const shakeAt = (t0: number, amp: number) => (t < t0 ? 0 : amp * Math.exp(-(t - t0) * 9));
  const sh = shakeAt(T.pop, 10) + shakeAt(T.boom, 26);
  const shake = `translate(${noise2D('shx', t * 30, 0) * sh}px, ${noise2D('shy', 0, t * 30) * sh}px)`;

  const lift = k(t, [T.b3 + 0.1, T.b3 + 0.95], [0, 1], OUT) * (1 + 0.04 * settle(t, T.b3 + 0.95, 2.4, 1.2));
  const hand = handAt(lift);
  const leadA = k(t, [T.name - 0.1, T.name + 0.6], [0, 1]);
  const leadB = k(t, [T.b3 + 1.0, T.pop - 0.7], [0, 1]);
  const magOn = k(t, [T.b2 + 0.1, T.b2 + 0.6], [0, 1]);
  const rDraw = k(t, [T.b4 + 0.1, T.b4 + 1.0], [0, 1], (x) => x);
  const shrink = k(t, [T.changed + 0.02, T.changed + 0.62], [0, 1], INOUT);
  const sy = lerp(1, BOX.h / RANGE_H, shrink) * (shrink >= 1 ? 1 + 0.05 * settle(t, T.changed + 0.62, 3, 1.3) : 1);
  const sx = lerp(1, BOX.w / RANGE_W, shrink);
  const kitchen = k(t, [T.changed + 0.5, T.changed + 1.0], [0, 1], (x) => x);
  const facade = k(t, [T.changed + 0.75, T.changed + 1.15], [0, 1]);
  const oldSheet = 1 - k(t, [T.changed + 0.3, T.changed + 0.8], [0, 1]);
  const lightAt = (cc: number, r: number) => k(t, [T.changed + 0.95 + Math.hypot(cc - 2, r - 3) * 0.14, T.changed + 1.15 + Math.hypot(cc - 2, r - 3) * 0.14], [0, 0.85]);
  const inches = Math.round(72 * sy);
  const yearStamp = t - T.year;
  const nameIn = k(t, [T.name, T.name + 0.35], [0, 1]);

  const cues: Cue[] = [
    [0.95, 'soft', 0.45],
    [1.42, 'soft', 0.22],
    [T.year, 'stamp', 0.45],
    [T.b1 + 1.6, 'wood', 0.3],
    [T.b1 + 2.2, 'pen', 0.22],
    [T.b1 + 2.7, 'pen', 0.22],
    [T.b1 + 3.2, 'pen', 0.22],
    [T.b2 + 0.15, 'metal', 0.45],
    [T.b3 + 0.2, 'sack', 0.4],
    [T.pop, 'pop', 0.9],
    [T.boom - 0.4, 'tear', 0.35],
    [T.boom, 'thump', 0.9],
    [T.boom + 0.12, 'drop', 0.6],
    [T.wipe - 0.25, 'cloth', 0.8],
    [T.wipe, 'swish', 0.35],
    [T.b4 + 0.15, 'pen', 0.4],
    [T.six, 'pen', 0.35],
    [T.changed + 0.05, 'press', 0.5],
    [T.changed + 1.0, 'switch', 0.3],
    [T.changed + 1.25, 'switch', 0.22],
    [T.b5 + 0.4, 'stamp', 0.75],
  ];

  return (
    <ViewCtx.Provider value={view}>
      <AbsoluteFill style={{background: th.bg}}>
        <div style={{position: 'absolute', inset: 0, transform: `${shake} ${drift(t, 3)}`}}>
          <div style={{position: 'absolute', inset: 0, transform: `scale(${push})`, transformOrigin: '540px 960px'}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: cam(t, KEYS), transformOrigin: '0 0'}}>
              <svg width={8000} height={8000} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
                <defs>
                  <pattern id="hatch" width={12} height={12} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <line x1={0} y1={0} x2={0} y2={12} stroke={th.ink} strokeWidth={2.2} />
                  </pattern>
                  <pattern id="hatchFine" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                    <line x1={0} y1={0} x2={0} y2={8} stroke={mix(th.ink, 45)} strokeWidth={1.2} />
                  </pattern>
                  <pattern id="hatchX" width={11} height={11} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <path d="M0,0 L0,11 M0,0 L11,0" stroke={th.ink} strokeWidth={1.6} />
                  </pattern>
                  <pattern id="weave" width={18} height={18} patternUnits="userSpaceOnUse">
                    <path d="M1,4.5 h7 M10,13.5 h7 M4.5,10 v7 M13.5,1 v7" stroke={mix(th.ink, 38)} strokeWidth={1.8} strokeLinecap="round" />
                  </pattern>
                  <pattern id="stip" width={26} height={26} patternUnits="userSpaceOnUse">
                    {[[3, 5], [15, 2], [22, 13], [9, 16], [18, 22], [4, 23], [12, 9]].map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r={1.7} fill={mix(th.ink, 60)} />
                    ))}
                  </pattern>
                  <pattern id="water" width={46} height={20} patternUnits="userSpaceOnUse">
                    <path d="M2,10 h24" stroke={mix(th.ink, 35)} strokeWidth={1.6} />
                  </pattern>
                  <pattern id="brick" width={240} height={110} patternUnits="userSpaceOnUse">
                    <path d="M0,0 h240 M0,55 h240 M60,0 v55 M180,55 v55" stroke={mix(th.ink, 22)} strokeWidth={8} />
                  </pattern>
                  <filter id="ink">
                    <feTurbulence type="fractalNoise" baseFrequency={0.04} numOctaves={3} seed={5} />
                    <feDisplacementMap in="SourceGraphic" scale={3} />
                  </filter>
                  <filter id="ink-strong">
                    <feTurbulence type="fractalNoise" baseFrequency={0.03} numOctaves={4} seed={9} />
                    <feDisplacementMap in="SourceGraphic" scale={14} />
                  </filter>
                </defs>

                <g opacity={oldSheet}>
                  {/* floor, bench, stand */}
                  <line x1={1050} y1={FLOOR} x2={2950} y2={FLOOR} stroke={th.ink} strokeWidth={6} />
                  <rect x={1050} y={FLOOR} width={1900} height={40} fill="url(#hatchFine)" />
                  <rect x={2150} y={1470} width={650} height={40} fill="url(#hatch)" stroke={th.ink} strokeWidth={5} />
                  <path d={`M2200,1510 L2200,${FLOOR} M2750,1510 L2750,${FLOOR} M2200,1900 L2750,1900`} stroke={th.ink} strokeWidth={8} />
                  <path d={`M1780,${FLOOR} L1960,${FLOOR} M1910,${FLOOR} L1910,1380 M1910,1480 L1880,1480`} stroke={th.ink} strokeWidth={7} />
                  <path d="M1795,1380 L1800,1484 Q1840,1496 1880,1484 L1885,1380" fill={mix(th.bg, 80)} stroke={th.ink} strokeWidth={4} />
                  <ellipse cx={BEAKER[0]} cy={BEAKER[1]} rx={26} ry={34} fill={t >= T.boom ? 'none' : th.bg} stroke={th.ink} strokeWidth={3.5} strokeDasharray={t >= T.boom ? '6 8' : 'none'} />
                  <Magnetron on={magOn} />
                  <Waves on={T.b2 + 0.2} off={T.b4 + 0.4} c={HORN} dir={Math.PI} spread={0.55} gap={150} speed={480} max={1500} w={7} o={0.8} />
                  <Label x={MAG.x} y={MAG.y - 360} size={64} weight={700} anchor="middle" text="MAGNETRON" o={magOn} />

                  <Percy lift={lift} bag={t > T.b3} />
                  {/* the pocket ringed on his chest: "A" */}
                  <circle cx={1577} cy={1180} r={58} fill={heat} opacity={0.18 + 0.5 * k(t, [T.b2, T.b2 + 1], [0, 1]) + 0.3 * view.flare(1577, 1180)} />
                  <circle cx={1577} cy={1180} r={58} fill="none" stroke={th.ink} strokeWidth={5} />
                  <path d={`M1522,1162 L${lerp(1522, 1119, leadA)},${lerp(1162, 1034, leadA)}`} stroke={th.ink} strokeWidth={4} />
                  <At x={1640} y={600 - 20 * (1 - nameIn)} o={nameIn}>
                    <Label x={0} y={0} size={72} weight={700} text="PERCY SPENCER" fill={heat} spacing={0.08} />
                    <Label x={0} y={60} size={40} text="RAYTHEON, 1945" fill={th.muted} spacing={0.25} />
                  </At>

                  <Detail id="da" x={DA.x} y={DA.y} r={DA.r}>
                    <PocketDetail />
                  </Detail>
                  <g opacity={k(t, [0.25, 0.9], [0, 1])}>
                    <Label x={DA.x - 440} y={DA.y - 486} size={42} weight={700} text="DETAIL A" />
                    <Label x={DA.x - 440} y={DA.y - 446} size={26} text="SCALE 6 : 1" fill={th.muted} spacing={0.3} />
                  </g>
                  {yearStamp > 0 && (
                    <At x={DA.x + 350} y={DA.y + 410} extra={` rotate(-4) scale(${1 + 0.08 * Math.exp(-yearStamp * 20)})`}>
                      <rect x={-210} y={-62} width={214} height={78} fill="none" stroke={heat} strokeWidth={5} opacity={k(yearStamp, [0, 0.05], [0, 1])} filter="url(#ink)" />
                      <Label x={-103} y={0} size={60} weight={700} anchor="middle" text="1945" fill={heat} spacing={0.1} o={k(yearStamp, [0, 0.05], [0, 1])} />
                    </At>
                  )}

                  <Fig2 />
                  <Fig3 />

                  {/* leader lines down the sheet to the two details */}
                  <path d={`M${hand[0]},${hand[1]} L${lerp(hand[0], DB.x - 150, leadB)},${lerp(hand[1], DB.y - DB.r + 40, leadB)}`} stroke={th.ink} strokeWidth={4} opacity={leadB > 0 ? 1 : 0} />
                  <path d={`M${BEAKER[0]},${BEAKER[1] + 34} L${lerp(BEAKER[0], DC.x - 250, leadB)},${lerp(BEAKER[1] + 34, DC.y - 250, leadB)}`} stroke={th.ink} strokeWidth={4} opacity={leadB > 0 ? 1 : 0} />
                  <Detail id="db" x={DB.x} y={DB.y} r={DB.r}>
                    <KernelDetail />
                  </Detail>
                  <Detail id="dc" x={DC.x} y={DC.y} r={DC.r}>
                    <EggDetail />
                  </Detail>
                  <Label x={DB.x - DB.r - 30} y={DB.y - DB.r + 40} size={38} weight={700} anchor="end" text="DETAIL B" />
                  <Label x={DB.x - DB.r - 30} y={DB.y - DB.r + 80} size={24} anchor="end" text="KERNEL, 20 : 1" fill={th.muted} spacing={0.25} />
                  <Label x={DC.x - DC.r - 30} y={DC.y - DC.r + 60} size={38} weight={700} anchor="end" text="DETAIL C" />
                  <Label x={DC.x - DC.r - 30} y={DC.y - DC.r + 100} size={24} anchor="end" text="EGG, 2 : 1" fill={th.muted} spacing={0.25} />
                  <EggShards />
                </g>

                {/* the Radarange, 6 ft, with Spencer beside it for scale */}
                <Facade o={facade} draw={facade} lit={lightAt} />
                <Kitchen draw={kitchen} />
                <Percy lift={0} x={RR[0] - 640} y={RR[1] - 1600} o={rDraw * (1 - k(t, [T.changed, T.changed + 0.3], [0, 1]))} />
                <At x={RR[0]} y={RR[1]}>
                  <g transform={`scale(${sx},${sy})`}>
                    <Radarange draw={rDraw} o={1 - k(shrink, [0.35, 0.6], [0, 1])} />
                  </g>
                  <Countertop sx={sx / (BOX.w / RANGE_W)} sy={sy / (BOX.h / RANGE_H)} o={k(shrink, [0.4, 0.6], [0, 1])} glow={0.4 + 0.45 * k(t, [T.changed + 0.7, T.changed + 0.9], [0, 1])} />
                  {/* the dimension reads the cabinet's live height */}
                  <g opacity={k(t, [T.six - 0.05, T.six + 0.3], [0, 1]) * (1 - facade)}>
                    <path d={`M${RANGE_W / 2 + 40},0 L${RANGE_W / 2 + 140},0 M${RANGE_W / 2 + 40},${-RANGE_H * sy} L${RANGE_W / 2 + 140},${-RANGE_H * sy}`} stroke={th.ink} strokeWidth={3} />
                    <path d={`M${RANGE_W / 2 + 100},-8 L${RANGE_W / 2 + 100},${-RANGE_H * sy * k(t, [T.six, T.six + 0.4], [0, 1]) + 8}`} stroke={th.ink} strokeWidth={4} />
                    <path d={`M${RANGE_W / 2 + 100},${-RANGE_H * sy} l-14,34 l28,0 Z M${RANGE_W / 2 + 100},0 l-14,-34 l28,0 Z`} fill={th.ink} />
                    <rect x={RANGE_W / 2 + 10} y={-RANGE_H * sy * 0.5 - 50} width={180} height={100} fill={th.bg} />
                    <Label x={RANGE_W / 2 + 100} y={-RANGE_H * sy * 0.5 + 20} size={56} weight={700} anchor="middle" spacing={0.04} text={inches >= 70 ? '6 FT' : `${Math.floor(inches / 12)}′ ${inches % 12}″`} o={k(t, [T.six + 0.2, T.six + 0.4], [0, 1])} />
                  </g>
                  <Label x={-RANGE_W / 2 - 380} y={-RANGE_H - 40} size={72} weight={700} text="RADARANGE" fill={heat} spacing={0.1} o={k(t, [T.b4 + 0.2, T.b4 + 0.5], [0, 1]) * (1 - k(t, [T.changed, T.changed + 0.3], [0, 1]))} />
                </At>
              </svg>
            </div>
          </div>
        </div>
        <Lens />
        <Cloth />
        {/* desk-lamp falloff from the upper left, and paper grain */}
        <AbsoluteFill style={{background: `radial-gradient(ellipse 120% 90% at 28% 18%, transparent 45%, ${mix(th.ink, 16)} 100%)`, pointerEvents: 'none'}} />
        <Grain opacity={0.13} blend="multiply" />
        {t >= T.b5 && <TitleBlock />}
        <Captions
          style={{top: 1388, fontFamily: SERIF, fontStyle: 'italic', fontSize: 54, lineHeight: 1.1, color: th.ink, textShadow: `0 0 14px ${th.bg}, 0 0 6px ${th.bg}, 0 0 2px ${th.bg}`, letterSpacing: 0.2}}
          hide={[[T.year - 0.05, T.year + 0.6], [T.pop - 0.3, T.pop + 0.45], [T.b5, total + 1]]}
          enter={(p) => ({opacity: p, transform: `translateY(${(1 - p) * 10}px)`})}
        />
        <Score src="music/c2-2026-w40-1.wav" shape={[[0, -2], [T.b1, 0], [T.b3, 1], [T.boom - 0.5, 2], [T.boom + 0.3, 3], [T.b4, 2], [T.b5, 4], [total, 3]]} hush={[[T.boom - 0.42, T.boom]]} />
        <Foley cues={cues} />
      </AbsoluteFill>
    </ViewCtx.Provider>
  );
};
