// Film c2-2026-w41-2, "the wrong wallpaper" (agents/director/DIRECTOR.md). A 1957 magazine illustration printed in two inks
// on newsprint: flat cut-paper shapes, ink keylines, teal Ben-Day screens for shade, one coral plate for the reveal. One sheet
// of sealed air travels through the film: a wall that cannot hold a calendar's nail and peels off over the two men who hung
// it; the roller where two shower curtains are sealed and the air is trapped; a shop where every other roll sells; a
// greenhouse that fogs and tears; and the one place it belongs, around a tape drive that falls onto a dock and keeps turning.
// A dive into one bubble opens back onto the 1957 wall. Puppets and mechanisms move on twos like printed cut-outs; only the
// camera is smooth.
import React, {useMemo} from 'react';
import {useTheme} from '../themes';
import {BACK, type Beat, camAt, Captions, type Cue, Foley, Grain, IN, INOUT, k, type Key, lerp, OUT, rng, Score, useFilm} from './kit';

type Pt = [number, number];
type Quad = [Pt, Pt, Pt, Pt]; // TL TR BR BL
const DIN = '"DIN Condensed", "Avenir Next Condensed", sans-serif';
const mix = (c: string, p: number, to = 'transparent') => `color-mix(in srgb, ${c} ${p}%, ${to})`;
const when = (b: Beat, word: string) => b.vo![0] + (b.text.indexOf(word) / b.text.length) * (b.vo![1] - b.vo![0]);
const twos = (t: number) => Math.floor(t * 12) / 12; // printed puppets move on twos
const f1 = (n: number) => n.toFixed(1);
const R2D = Math.PI / 180;
const view = (c: {x: number; y: number; z: number}, sx = 0, sy = 0) => `translate(${540 + sx} ${960 + sy}) scale(${c.z}) translate(${-c.x} ${-c.y})`;
const quad = (u: number) => u * u;
// a damped wobble that starts at 0 (a bounce after an event)
const wob = (t: number, t0: number, amp: number, freq = 2.2, damp = 4) => (t < t0 ? 0 : amp * Math.exp(-(t - t0) * damp) * Math.sin((t - t0) * Math.PI * 2 * freq));
const bil = (q: Quad, u: number, v: number): Pt => {
  const a: Pt = [lerp(q[0][0], q[1][0], u), lerp(q[0][1], q[1][1], u)];
  const b: Pt = [lerp(q[3][0], q[2][0], u), lerp(q[3][1], q[2][1], u)];
  return [lerp(a[0], b[0], v), lerp(a[1], b[1], v)];
};
const poly = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')} Z`;

type Pal = {paper: string; teal: string; deep: string; ink: string; muted: string; coral: string; rule: string; film: string; domeFilm: string; wall: string};

const times = (b: Beat[], total: number) => {
  const hit = when(b[3], 'became') - 0.05;
  const billions = when(b[4], 'Billions');
  return {
    pop: 0.15,
    land: 1.0,
    tap: when(b[0], 'wallpaper') + 0.25,
    flop: when(b[0], 'It flopped') + 0.05,
    b1: b[1].start,
    fielding: when(b[1], 'Fielding'),
    chav: when(b[1], 'Chavannes'),
    sealed: when(b[1], 'sealed'),
    trapped: when(b[1], 'Trapped'),
    b2: b[2].start,
    n1: when(b[2], 'wanted'),
    n2: when(b[2], 'bubbly'),
    n3: when(b[2], 'plastic'),
    strike1: when(b[2], 'walls') + 0.1,
    strike2: when(b[2], 'at all') + 0.05,
    green: when(b[2], 'Then greenhouses'),
    failed: when(b[2], 'That failed'),
    b3: b[3].start,
    ibm: b[3].vo![0],
    safely: when(b[3], 'safely'),
    failedW: when(b[3], 'Failed'),
    snap: hit - 0.3,
    hit,
    b4: b[4].start,
    sa: b[4].vo![0] + 0.15,
    billions,
    dive: billions + 0.2,
    flop2: when(b[4], 'from a wallpaper'),
    b5: b[5].start,
    total,
  };
};
type Times = ReturnType<typeof times>;

// ---------- the bubble: one printed dome, lit from the upper left ----------
// shade crescent: the dome (r 50) minus the same circle moved 14 up-left
const CRESCENT = 'M27.65 -41.65 A50 50 0 1 1 -41.65 27.65 A50 50 0 0 0 27.65 -41.65 Z';
const POPPED = (() => {
  const r = rng(7);
  return poly(Array.from({length: 18}, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const rr = 41 + (r() - 0.5) * 13;
    return [Math.cos(a) * rr, Math.sin(a) * rr * 0.9] as Pt;
  }));
})();
const CREASES = 'M-26 -8 L-6 3 L13 -7 L27 2 M-12 19 L5 9 L22 21 M-19 -27 L-5 -15 L6 -24';

const Defs: React.FC<{p: Pal}> = ({p}) => (
  <defs>
    <pattern id="bd-deep" width={9} height={9} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <circle cx={4.5} cy={4.5} r={2.3} fill={p.deep} />
    </pattern>
    <pattern id="bd-ink" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <circle cx={4} cy={4} r={1.6} fill={p.ink} />
    </pattern>
    <pattern id="bd-paper" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
      <circle cx={5} cy={5} r={2.4} fill={p.paper} />
    </pattern>
    <pattern id="bd-coarse" width={22} height={22} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <circle cx={11} cy={11} r={4.2} fill={p.deep} />
    </pattern>
    <pattern id="peg" width={34} height={34} patternUnits="userSpaceOnUse">
      <circle cx={17} cy={17} r={3.4} fill={p.ink} opacity={0.55} />
    </pattern>
    <pattern id="pat-atomic" width={124} height={124} patternUnits="userSpaceOnUse">
      <rect width={124} height={124} fill={p.paper} />
      <path d={STAR} transform="translate(30 34)" fill={p.ink} />
      <path d={STAR} transform="translate(92 94) scale(0.6)" fill={p.ink} />
      <circle cx={92} cy={30} r={6} fill="none" stroke={p.ink} strokeWidth={2.2} />
      <circle cx={26} cy={96} r={3} fill={p.ink} />
      <path d="M52 70 Q66 52 84 66" stroke={p.deep} strokeWidth={7} fill="none" strokeLinecap="round" />
    </pattern>
    <pattern id="pat-stripe" width={64} height={64} patternUnits="userSpaceOnUse">
      <rect width={64} height={64} fill={p.paper} />
      <rect width={26} height={64} fill={p.teal} />
      <line x1={34} y1={0} x2={34} y2={64} stroke={p.ink} strokeWidth={2} />
      <line x1={40} y1={0} x2={40} y2={64} stroke={p.ink} strokeWidth={1} />
    </pattern>
    <pattern id="pat-harl" width={80} height={104} patternUnits="userSpaceOnUse">
      <rect width={80} height={104} fill={mix(p.teal, 30, p.paper)} />
      <path d="M40 0 L80 52 L40 104 L0 52 Z" fill={p.deep} />
      <path d="M40 0 L80 52 L40 104 L0 52 Z" fill="none" stroke={p.ink} strokeWidth={1.5} />
      <circle cx={40} cy={52} r={5} fill={p.paper} />
    </pattern>
    <g id="dome">
      <circle cx={8} cy={10} r={50} fill="url(#bd-ink)" opacity={0.32} />
      <circle r={50} fill="currentColor" />
      <path d={CRESCENT} fill="url(#bd-deep)" />
      <ellipse cx={-21} cy={-23} rx={17} ry={7.5} transform="rotate(-45 -21 -23)" fill={p.paper} />
      <circle cx={-35} cy={-4} r={4} fill={p.paper} />
      <circle r={50} fill="none" stroke={p.ink} strokeWidth={3} />
    </g>
    <g id="popped">
      <path d={POPPED} fill="currentColor" stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
      <path d={POPPED} fill="url(#bd-deep)" opacity={0.5} />
      <path d={CREASES} fill="none" stroke={p.ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </defs>
);
const STAR = 'M0 -15 L3 -3 L15 0 L3 3 L0 15 L-3 3 L-15 0 L-3 -3 Z';

// one bubble: strains and pops at `pop`, or inflates from a flat sealed ring (inflate 0..1)
const Bub: React.FC<{x: number; y: number; r: number; t: number; color: string; ink: string; pop?: number; inflate?: number; ring?: string; strain?: number}> = ({x, y, r, t, color, ink, pop, inflate = 1, ring, strain = 0}) => {
  const sc = r / 50;
  if (pop !== undefined && t >= pop) {
    const e = t - pop;
    return (
      <g transform={`translate(${f1(x)} ${f1(y)})`}>
        <use href="#popped" transform={`scale(${sc * (1 + 0.18 * Math.max(0, 1 - e / 0.1))})`} style={{color}} />
        {e < 0.16
          ? [25, 115, 205, 295].map((a) => {
              const c = Math.cos(a * R2D);
              const s = Math.sin(a * R2D);
              const r0 = r * (1.12 + e * 5);
              const r1 = r * (1.42 + e * 6);
              return <line key={a} x1={c * r0} y1={s * r0} x2={c * r1} y2={s * r1} stroke={ink} strokeWidth={Math.max(2, r * 0.08)} strokeLinecap="round" opacity={1 - e / 0.16} />;
            })
          : null}
      </g>
    );
  }
  const s = (pop !== undefined ? 1 + 0.15 * k(t, [pop - 0.09, pop], [0, 1], IN) : 1) * (1 + strain);
  return (
    <g transform={`translate(${f1(x)} ${f1(y)})`}>
      {inflate < 1 && ring ? <circle r={r * 0.94} fill="none" stroke={ring} strokeWidth={Math.max(1.4, r * 0.08)} /> : null}
      {inflate > 0.02 ? <use href="#dome" transform={`scale(${sc * s * (0.25 + 0.75 * inflate)})`} style={{color}} opacity={Math.min(1, inflate * 3)} /> : null}
    </g>
  );
};

// a field of bubbles in offset rows
const grid = (x0: number, y0: number, x1: number, y1: number, s: number, row: number, ox = 0, oy = 0): Pt[] => {
  const out: Pt[] = [];
  for (let j = 0; y0 + oy + j * row <= y1; j++)
    for (let i = -1; ; i++) {
      const x = x0 + ox + (j & 1 ? s / 2 : 0) + i * s;
      if (x > x1) break;
      if (x >= x0) out.push([x, y0 + oy + j * row]);
    }
  return out;
};

// ---------- the two engineers: geometric 1957 figures, cut paper on twos ----------
const elbow = (s: Pt, h: Pt, l1: number, l2: number, bend: 1 | -1): Pt => {
  const dx = h[0] - s[0];
  const dy = h[1] - s[1];
  const d = Math.max(1, Math.hypot(dx, dy));
  const a = Math.atan2(dy, dx);
  const A = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  return [s[0] + l1 * Math.cos(a + bend * A), s[1] + l1 * Math.sin(a + bend * A)];
};
type ManP = {x: number; y: number; f: 1 | -1; suit: string; p: Pal; hands: [Pt, Pt]; look?: number; glasses?: boolean; tache?: boolean};
const SB: Pt = [-40, -452];
const SF: Pt = [44, -452];
const restHands = (x: number, y: number, f: 1 | -1): [Pt, Pt] => [[x - 46 * f, y - 238], [x + 50 * f, y - 238]];
const Man: React.FC<ManP> = ({x, y, f, suit, p, hands, look = 0, glasses, tache}) => {
  const loc = (w: Pt): Pt => [(w[0] - x) * f, w[1] - y];
  const arm = (s: Pt, w: Pt) => {
    const h0 = loc(w);
    const d = Math.hypot(h0[0] - s[0], h0[1] - s[1]);
    const reach = 224;
    const h: Pt = d > reach ? [s[0] + ((h0[0] - s[0]) * reach) / d, s[1] + ((h0[1] - s[1]) * reach) / d] : h0;
    const e = elbow(s, h, 118, 110, h[0] < s[0] ? 1 : -1);
    return {h, d: `M${f1(s[0])} ${f1(s[1])} L${f1(e[0])} ${f1(e[1])} L${f1(h[0])} ${f1(h[1])}`};
  };
  const back = arm(SB, hands[0]);
  const front = arm(SF, hands[1]);
  const Arm = ({a}: {a: typeof back}) => (
    <>
      <path d={a.d} stroke={p.ink} strokeWidth={37} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={a.d} stroke={suit} strokeWidth={30} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={a.h[0]} cy={a.h[1]} r={15} fill={p.paper} stroke={p.ink} strokeWidth={3} />
    </>
  );
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${f} 1)`}>
      <Arm a={back} />
      {/* trousers */}
      <path d="M-40 -264 L-6 -264 L-12 -20 L-36 -20 Z" fill={suit} stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-4 -264 L34 -264 L38 -20 L12 -20 Z" fill={suit} stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-40 -264 L-6 -264 L-12 -20 L-24 -20 Z" fill="url(#bd-ink)" opacity={0.35} />
      {/* shoes */}
      <path d="M-44 -2 Q-46 -22 -24 -22 L-10 -22 Q-4 -10 -6 0 Z" fill={p.ink} />
      <path d="M8 -22 L30 -22 Q58 -18 62 -4 L62 0 L8 0 Z" fill={p.ink} />
      {/* jacket, shirt, tie */}
      <path d="M-56 -466 L58 -466 L52 -244 L-50 -244 Z" fill={suit} stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-56 -466 L-20 -466 L-24 -244 L-50 -244 Z" fill="url(#bd-ink)" opacity={0.3} />
      <path d="M-6 -466 L26 -466 L10 -392 Z" fill={p.paper} stroke={p.ink} strokeWidth={2} />
      <path d="M8 -462 L13 -462 L15 -404 L10 -394 L6 -404 Z" fill={p.ink} />
      <path d="M-6 -466 L10 -392 L4 -340 M26 -466 L10 -392" fill="none" stroke={p.ink} strokeWidth={2.5} />
      <path d="M30 -428 L46 -428 L42 -420 Z" fill={p.paper} />
      <circle cx={8} cy={-330} r={4} fill={p.ink} />
      <circle cx={8} cy={-290} r={4} fill={p.ink} />
      {/* head */}
      <g transform={`rotate(${look} 6 -482)`}>
        <rect x={-8} y={-492} width={24} height={30} fill={p.paper} stroke={p.ink} strokeWidth={2.5} />
        <ellipse cx={6} cy={-524} rx={30} ry={38} fill={p.paper} stroke={p.ink} strokeWidth={3} />
        <ellipse cx={-14} cy={-520} rx={6} ry={10} fill={p.paper} stroke={p.ink} strokeWidth={2.5} />
        <path d="M34 -532 L44 -514 L33 -510" fill={p.paper} stroke={p.ink} strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={22} cy={-530} r={3.4} fill={p.ink} />
        <path d="M14 -545 L30 -543" stroke={p.ink} strokeWidth={3} strokeLinecap="round" />
        {glasses ? (
          <>
            <circle cx={22} cy={-530} r={10} fill="none" stroke={p.ink} strokeWidth={2.5} />
            <path d="M12 -531 L-8 -527" stroke={p.ink} strokeWidth={2} />
          </>
        ) : null}
        {tache ? <path d="M26 -503 Q34 -510 42 -502 Q34 -498 26 -503 Z" fill={p.ink} /> : <path d="M26 -497 L36 -498" stroke={p.ink} strokeWidth={2.5} strokeLinecap="round" />}
        {/* fedora */}
        <path d="M-24 -556 Q-26 -598 6 -598 Q20 -590 36 -598 Q42 -580 38 -556 Z" fill={p.ink} />
        <rect x={-25} y={-570} width={63} height={12} fill={p.deep} />
        <ellipse cx={8} cy={-555} rx={54} ry={9} fill={p.ink} />
      </g>
      <Arm a={front} />
    </g>
  );
};

// ---------- the calendar: a 1957 wall calendar, its own little offset print ----------
const Calendar: React.FC<{p: Pal}> = ({p}) => (
  <g data-tb-skip>
    <rect x={8} y={12} width={300} height={440} fill="url(#bd-ink)" opacity={0.4} />
    <rect x={0} y={0} width={300} height={440} fill={p.paper} stroke={p.ink} strokeWidth={2.5} />
    {[60, 240].map((x) => (
      <circle key={x} cx={x} cy={16} r={6} fill={p.paper} stroke={p.ink} strokeWidth={2.5} />
    ))}
    {/* the picture: a sloop under a coral sun */}
    <rect x={20} y={42} width={260} height={180} fill={mix(p.teal, 22, p.paper)} />
    <circle cx={214} cy={96} r={30} fill={p.coral} />
    <circle cx={211} cy={93} r={30} fill="none" stroke={p.ink} strokeWidth={1.5} />
    <rect x={20} y={160} width={260} height={62} fill={p.teal} />
    <rect x={20} y={190} width={260} height={32} fill="url(#bd-deep)" />
    <path d="M30 176 q10 -6 20 0 t20 0 M150 184 q10 -6 20 0 t20 0 M210 172 q10 -6 20 0 t20 0" fill="none" stroke={p.ink} strokeWidth={2} />
    <path d="M68 164 L194 164 L174 188 L88 188 Z" fill={p.ink} />
    <line x1={130} y1={164} x2={130} y2={60} stroke={p.ink} strokeWidth={3} />
    <path d="M134 64 L134 158 L190 158 Z" fill={p.paper} stroke={p.ink} strokeWidth={2} strokeLinejoin="round" />
    <path d="M126 74 L126 158 L80 158 Z" fill={p.teal} stroke={p.ink} strokeWidth={2} strokeLinejoin="round" />
    <path d="M60 86 l7 5 l7 -5 M84 72 l5 4 l5 -4" fill="none" stroke={p.ink} strokeWidth={2} />
    <rect x={20} y={42} width={260} height={180} fill="none" stroke={p.ink} strokeWidth={2} />
    <text x={150} y={318} textAnchor="middle" fontFamily={DIN} fontWeight={700} fontSize={104} letterSpacing={6} fill={p.coral}>
      1957
    </text>
    <text x={150} y={348} textAnchor="middle" fontFamily={DIN} fontWeight={700} fontSize={22} letterSpacing={9} fill={p.ink}>
      MARCH
    </text>
    {Array.from({length: 31}, (_, d) => {
      const c = (d + 5) % 7;
      const r = Math.floor((d + 5) / 7);
      return (
        <text key={d} x={46 + c * 35} y={376 + r * 13.5} textAnchor="middle" fontFamily={DIN} fontWeight={700} fontSize={12} fill={c === 0 ? p.coral : p.muted}>
          {d + 1}
        </text>
      );
    })}
  </g>
);

// ---------- 1. the wall, 1957 ----------
const WALL_TOP = -840;
const WALL_BOT = 1430;
const FLOOR = 1490;
const WS = 90; // wallpaper bubble spacing
const WR = 31;
const WROW = 78;
const PEEL_X = 720; // the right-hand strip peels
const FLAP_END = 1470;
const YF_END = (FLAP_END + WALL_TOP) / 2;
const NAIL: Pt = [405, 352];
const TAP: Pt = [630, 586];
const COLUMN: Pt[] = [-428, -272, -116, 40, 196, 352].map((y) => [675, y]);
const STRIPS = [-720, -360, 0, 360, 720, 1080, 1440];
const WALL_GRID: Pt[] = (() => {
  const out: Pt[] = [];
  for (let j = -9; j <= 17; j++)
    for (let i = -9; i <= 20; i++) {
      const x = 45 + (j & 1 ? 45 : 0) + i * WS;
      const y = 40 + j * WROW;
      if (y > WALL_TOP - 40 && y < WALL_BOT - 12) out.push([x, y]);
    }
  return out;
})();
const peelAt = (t: number, T: Times) => {
  if (t < T.flop) return WALL_TOP;
  const u = k(t, [T.flop, T.flop + 0.62], [0, 1], quad);
  return lerp(WALL_TOP, YF_END, u) + wob(t, T.flop + 0.62, 14, 2.4, 4.5);
};
// the calendar hangs from the nail on a cord (CORD below it): the strained dome stays in sight above it. When the dome
// bursts it bumps down the domes row by row and lands against the skirting.
const CORD = 120;
const CAL_DROP = FLOOR + 10 - 440 - CORD - NAIL[1];
const calAt = (t: number, T: Times) => {
  if (t < T.pop) return {x: NAIL[0], y: NAIL[1], rot: 1.5 + (t > 0.04 ? 0.7 * Math.sin(t * 46) : 0), slack: 0};
  const slack = k(t, [T.pop, T.pop + 0.16], [0, 1], OUT);
  if (t < T.land) {
    const u = k(t, [T.pop + 0.03, T.land], [0, 1], (x) => x);
    const y = NAIL[1] + CAL_DROP * Math.pow(u, 1.7);
    const phase = (y + CORD + 440 - 40) / WROW;
    const fr = phase - Math.floor(phase);
    const side = Math.floor(phase) % 2 ? 1 : -1;
    return {x: NAIL[0] - 30 * u + 7 * Math.sin(fr * Math.PI), y, rot: 1.5 - 7 * u + side * 2.4 * Math.sin(fr * Math.PI), slack};
  }
  return {x: NAIL[0] - 30, y: NAIL[1] + CAL_DROP, rot: -5.5 + wob(t, T.land, -2.6, 2.6, 5), slack};
};

const Wall: React.FC<{t: number; T: Times; p: Pal}> = ({t, T, p}) => {
  const tt = twos(t);
  const yf = peelAt(t, T);
  const pops = new Map<string, number>([
    [`${NAIL[0]},${NAIL[1]}`, T.pop],
    [`${TAP[0]},${TAP[1]}`, T.tap],
    ...COLUMN.map((c, i) => [`${c[0]},${c[1]}`, T.b5 + 0.95 + i * 0.13] as [string, number]),
  ]);
  const cal = calAt(t, T);
  // the nail tips out of the burst dome and falls
  const nailT = Math.max(0, t - T.pop - 0.02);
  const nail = t < T.pop ? {x: NAIL[0], y: NAIL[1], rot: -8} : {x: NAIL[0] - 40 * nailT, y: Math.min(FLOOR - 4, NAIL[1] + 2600 * nailT * nailT), rot: -8 - 1100 * Math.min(nailT, 0.42)};
  // the man with the paste brush taps the wall to show it off: it pops
  const tap = k(tt, [T.tap - 0.42, T.tap], [0, 1], IN) * (1 - k(tt, [T.tap + 0.25, T.tap + 0.7], [0, 1]));
  const tip: Pt = [lerp(744, TAP[0] + 22, tap), lerp(800, TAP[1] + 22, tap)];
  const handA: Pt = [lerp(748, 728, tap), lerp(1178, 1092, tap)];
  const butt: Pt = [handA[0] + (handA[0] - tip[0]) * 0.18, handA[1] + (handA[1] - tip[1]) * 0.18];
  const pa = Math.atan2(tip[1] - butt[1], tip[0] - butt[0]) / R2D;
  const look = tt > 1.25 && tt < 2.2 ? -9 : 0;
  const bubbleIn = (s: number) => WALL_GRID.filter(([x]) => x > STRIPS[s] - WR - 2 && x < STRIPS[s] + 360 + WR + 2);
  const stripBody = (s: number) => (
    <>
      <rect x={STRIPS[s]} y={WALL_TOP - 200} width={360} height={WALL_BOT - WALL_TOP + 200} fill={p.wall} />
      {bubbleIn(s).map(([x, y]) => (
        <Bub key={`${x},${y}`} x={x} y={y} r={WR} t={t} color={p.teal} ink={p.ink} pop={pops.get(`${x},${y}`)} strain={x === NAIL[0] && y === NAIL[1] && t < T.pop ? 0.03 * Math.sin(t * 50) : 0} />
      ))}
      <line x1={STRIPS[s] + 1} y1={WALL_TOP - 200} x2={STRIPS[s] + 1} y2={WALL_BOT} stroke={p.paper} strokeWidth={2} opacity={0.7} />
      <line x1={STRIPS[s]} y1={WALL_TOP - 200} x2={STRIPS[s]} y2={WALL_BOT} stroke={p.ink} strokeWidth={1.6} opacity={0.55} />
    </>
  );
  return (
    <g>
      <defs>
        {STRIPS.map((x, s) => (
          <clipPath key={s} id={`strip-${s}`}>
            <rect x={x} y={s === 4 ? yf : WALL_TOP - 200} width={360} height={WALL_BOT - (s === 4 ? yf : WALL_TOP - 200)} />
          </clipPath>
        ))}
        <clipPath id="peel">
          <rect x={PEEL_X} y={WALL_TOP} width={360} height={Math.max(0, yf - WALL_TOP)} />
        </clipPath>
      </defs>
      {/* bare plaster behind the strip that peels: paste streaks and the pencil plumb line it was hung to */}
      <rect x={PEEL_X} y={WALL_TOP - 200} width={360} height={WALL_BOT - WALL_TOP + 200} fill={mix(p.paper, 86, p.rule)} />
      {[-380, -150, 60, 250].map((y, i) => (
        <path key={i} d={`M${PEEL_X + 10} ${y} q90 ${18 - i * 9} 180 2 t170 -6`} stroke={p.rule} strokeWidth={46} fill="none" opacity={0.55} strokeLinecap="round" />
      ))}
      <line x1={PEEL_X + 14} y1={WALL_TOP} x2={PEEL_X + 14} y2={WALL_BOT} stroke={p.muted} strokeWidth={1.6} opacity={0.45} />
      {STRIPS.map((_, s) => (
        <g key={s} clipPath={`url(#strip-${s})`}>
          {stripBody(s)}
        </g>
      ))}
      {/* skirting and floorboards in perspective */}
      <rect x={-1200} y={WALL_BOT} width={3600} height={FLOOR - WALL_BOT} fill={p.paper} />
      <rect x={-1200} y={FLOOR - 20} width={3600} height={20} fill="url(#bd-deep)" />
      <line x1={-1200} y1={WALL_BOT} x2={2400} y2={WALL_BOT} stroke={p.ink} strokeWidth={4} />
      <line x1={-1200} y1={WALL_BOT + 12} x2={2400} y2={WALL_BOT + 12} stroke={p.ink} strokeWidth={1.5} />
      <rect x={-1200} y={FLOOR} width={3600} height={1400} fill={mix(p.muted, 58, p.paper)} />
      {Array.from({length: 34}, (_, i) => -2600 + i * 200).map((x) => (
        <line key={x} x1={540 + (x - 540) * 0.14} y1={FLOOR} x2={x} y2={FLOOR + 1400} stroke={p.ink} strokeWidth={2} opacity={0.45} />
      ))}
      {[FLOOR + 70, FLOOR + 190, FLOOR + 380].map((y) => (
        <line key={y} x1={-1200} y1={y} x2={2400} y2={y} stroke={p.ink} strokeWidth={1.2} opacity={0.25} />
      ))}
      <rect x={-1200} y={FLOOR} width={3600} height={60} fill="url(#bd-ink)" opacity={0.45} />
      {/* the nail through the straining dome (creases where the cord drags it down), then falling; the calendar on its cord */}
      {t < T.pop ? (
        <path d={`M${NAIL[0] - 6} ${NAIL[1] + 4} q-10 10 -22 12 M${NAIL[0] + 6} ${NAIL[1] + 4} q10 10 22 12 M${NAIL[0]} ${NAIL[1] + 7} l0 16`} fill="none" stroke={p.ink} strokeWidth={2} strokeLinecap="round" />
      ) : null}
      <g transform={`translate(${f1(nail.x)} ${f1(nail.y)}) rotate(${f1(nail.rot)})`}>
        {t >= T.pop ? <rect x={-2.5} y={0} width={5} height={44} fill={mix(p.muted, 70, p.paper)} stroke={p.ink} strokeWidth={1.5} /> : null}
        <ellipse cx={0} cy={0} rx={9} ry={4} fill={p.muted} stroke={p.ink} strokeWidth={2} />
        <ellipse cx={-2} cy={-1} rx={3} ry={1.4} fill={p.paper} />
      </g>
      <g transform={`translate(${f1(cal.x)} ${f1(cal.y)}) rotate(${f1(cal.rot)})`}>
        <path d={`M-90 ${CORD + 16} Q${f1(-30 * cal.slack)} ${f1(lerp(0, CORD - 30, cal.slack))} 0 ${f1(lerp(0, CORD - 46, cal.slack))} Q${f1(30 * cal.slack)} ${f1(lerp(0, CORD - 30, cal.slack))} 90 ${CORD + 16}`} fill="none" stroke={p.ink} strokeWidth={2.4} />
        <g transform={`translate(-150 ${CORD})`}>
          <Calendar p={p} />
        </g>
      </g>
      {/* the two engineers admire their wall */}
      <Man x={805} y={FLOOR} f={-1} suit={p.deep} p={p} glasses look={look} hands={[restHands(805, FLOOR, -1)[0], handA]} />
      <g>
        <line x1={butt[0]} y1={butt[1]} x2={tip[0]} y2={tip[1]} stroke={p.ink} strokeWidth={9} strokeLinecap="round" />
        <line x1={butt[0]} y1={butt[1]} x2={tip[0]} y2={tip[1]} stroke={mix(p.muted, 40, p.paper)} strokeWidth={4} strokeLinecap="round" />
        <g transform={`translate(${f1(tip[0])} ${f1(tip[1])}) rotate(${f1(pa)})`}>
          <rect x={-6} y={-30} width={24} height={60} rx={4} fill={p.muted} stroke={p.ink} strokeWidth={2.5} />
          <rect x={18} y={-27} width={20} height={54} fill={p.paper} stroke={p.ink} strokeWidth={2} />
          {[-20, -10, 0, 10, 20].map((v) => (
            <line key={v} x1={20} y1={v} x2={37} y2={v} stroke={p.ink} strokeWidth={1.4} />
          ))}
        </g>
      </g>
      <Man x={975} y={FLOOR} f={-1} suit={p.ink} p={p} tache look={look * 0.6} hands={[restHands(975, FLOOR, -1)[0], [912, 1196]]} />
      {/* the roll under his arm */}
      <g transform="translate(930 1172) rotate(-12)">
        <rect x={-92} y={-25} width={184} height={50} rx={6} fill={p.wall} stroke={p.ink} strokeWidth={3} />
        {[-70, -38, -6, 26, 58].map((x) => (
          <circle key={x} cx={x} cy={0} r={11} fill={p.teal} stroke={p.ink} strokeWidth={1.8} />
        ))}
        <rect x={-92} y={8} width={184} height={17} fill="url(#bd-deep)" />
        <ellipse cx={-92} cy={0} rx={10} ry={25} fill={p.paper} stroke={p.ink} strokeWidth={3} />
        <path d="M-92 -12 a6 12 0 1 0 0.1 0" fill="none" stroke={p.ink} strokeWidth={1.5} />
      </g>
      <circle cx={912} cy={1196} r={15} fill={p.paper} stroke={p.ink} strokeWidth={3} />
      {/* the peeled strip, folded over on itself and down over the two of them: its back is plain film and paste */}
      {yf > WALL_TOP + 1 ? (
        <>
          <g transform={`translate(0 ${f1(2 * yf)}) scale(1 -1)`}>
            <g clipPath="url(#peel)">
              <rect x={PEEL_X} y={WALL_TOP - 200} width={360} height={WALL_BOT - WALL_TOP + 200} fill={mix(p.teal, 30, p.paper)} />
              {bubbleIn(4).map(([x, y]) => (
                <g key={`${x},${y}`}>
                  <circle cx={x} cy={y} r={WR} fill={mix(p.teal, 46, p.paper)} stroke={p.deep} strokeWidth={2.4} />
                  <path d={`M${x - WR * 0.55} ${y + WR * 0.5} A${WR * 0.75} ${WR * 0.75} 0 0 0 ${x + WR * 0.55} ${y + WR * 0.5}`} fill="none" stroke={p.deep} strokeWidth={1.6} opacity={0.6} />
                </g>
              ))}
              {[-300, 40, 330].map((y, i) => (
                <path key={i} d={`M${PEEL_X + 20} ${y} q80 ${-20 + i * 12} 160 0 t160 10`} stroke={p.paper} strokeWidth={34} fill="none" opacity={0.42} strokeLinecap="round" />
              ))}
              <line x1={PEEL_X + 1} y1={WALL_TOP - 200} x2={PEEL_X + 1} y2={WALL_BOT} stroke={p.ink} strokeWidth={3} />
              <line x1={PEEL_X + 359} y1={WALL_TOP - 200} x2={PEEL_X + 359} y2={WALL_BOT} stroke={p.ink} strokeWidth={3} />
              <line x1={PEEL_X} y1={WALL_TOP + 1} x2={PEEL_X + 360} y2={WALL_TOP + 1} stroke={p.ink} strokeWidth={4} />
            </g>
          </g>
          <rect x={PEEL_X - 4} y={yf - 13} width={368} height={28} rx={14} fill={p.deep} stroke={p.ink} strokeWidth={3} />
          <rect x={PEEL_X + 6} y={yf - 8} width={348} height={6} rx={3} fill={p.paper} opacity={0.7} />
          <rect x={PEEL_X - 2} y={yf + 15} width={364} height={22} fill="url(#bd-ink)" opacity={0.45} />
        </>
      ) : null}
    </g>
  );
};

// ---------- 2. the workshop: two shower curtains into a dimpled roller ----------
const NIP = 888;
const TOPR = {cy: 832, r: 56};
const BOTR = {cy: 945, r: 57};
const RX0 = 200;
const RX1 = 760;
const SX0 = 240;
const SX1 = 720;
const WHEEL: Pt = [842, 945];
const FEED = 250; // px/s of sheet through the nip
const CURT_L: Quad = [[150, 238], [500, 238], [SX1 + 2, 860], [SX0 - 2, 860]];
const CURT_R: Quad = [[580, 238], [930, 238], [SX1 + 2, 860], [SX0 - 2, 860]];
const SHEET_ROW = 56;
const Curtain: React.FC<{q: Quad; p: Pal; feed: number; kind: 'dots' | 'waves'}> = ({q, p, feed, kind}) => {
  const N = 8;
  const band = (i: number) => poly([bil(q, i / N, 0), bil(q, (i + 1) / N, 0), bil(q, (i + 1) / N, 1), bil(q, i / N, 1)]);
  const body = poly([q[0], q[1], q[2], q[3]]);
  return (
    <g opacity={kind === 'dots' ? 0.94 : 1}>
      <path d={body} fill={kind === 'dots' ? mix(p.paper, 84, p.teal) : mix(p.paper, 72, p.teal)} stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
      {Array.from({length: N}, (_, i) =>
        i % 2 ? <path key={i} d={band(i)} fill="url(#bd-deep)" opacity={0.42} /> : null,
      )}
      {kind === 'dots'
        ? Array.from({length: 10}, (_, r) =>
            Array.from({length: 6}, (_, c) => {
              const v = ((r + feed / 70) / 10) % 1;
              const [x, y] = bil(q, (c + 0.5 + (r % 2) * 0.5) / 6.5, v);
              const w = lerp(q[1][0] - q[0][0], q[2][0] - q[3][0], v) / 350;
              return (
                <g key={`${r}-${c}`}>
                  <circle cx={x} cy={y} r={11 * w} fill="none" stroke={p.deep} strokeWidth={2.6} />
                  <circle cx={x - 3 * w} cy={y - 3 * w} r={3 * w} fill={p.deep} />
                </g>
              );
            }),
          )
        : Array.from({length: 9}, (_, r) => {
            const v = ((r + feed / 70) / 9) % 1;
            const pts = Array.from({length: 13}, (_, i) => {
              const [x, y] = bil(q, i / 12, v);
              return [x, y + Math.sin(i * 1.3) * 7] as Pt;
            });
            return <path key={r} d={`M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L')}`} fill="none" stroke={p.ink} strokeWidth={2.2} opacity={0.75} />;
          })}
      {Array.from({length: N - 1}, (_, i) => {
        const a = bil(q, (i + 1) / N, 0);
        const b = bil(q, (i + 1) / N, 1);
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={p.ink} strokeWidth={1.4} opacity={0.5} />;
      })}
      {/* draped over the feed bar */}
      <path d={`M${q[0][0]} ${q[0][1]} Q${q[0][0] - 6} 214 ${q[0][0] + 20} 214 L${q[1][0] - 20} 214 Q${q[1][0] + 6} 214 ${q[1][0]} ${q[1][1]} Z`} fill={kind === 'dots' ? mix(p.paper, 84, p.teal) : mix(p.paper, 72, p.teal)} stroke={p.ink} strokeWidth={3} />
    </g>
  );
};
const NameChip: React.FC<{x: number; y: number; first: string; last: string; align: 'start' | 'end'; on: number; p: Pal}> = ({x, y, first, last, align, on, p}) => {
  if (on <= 0) return null;
  const w = last.length * 27 + 34;
  const x0 = align === 'start' ? x : x - w;
  return (
    <g data-tb-skip transform={`translate(${x0 + w / 2} ${y}) rotate(${align === 'start' ? -1.5 : 1.2}) scale(${1 + 0.12 * (1 - on)}) translate(${-w / 2} 0)`} opacity={Math.min(1, on * 2)}>
      <rect x={5} y={7} width={w} height={96} fill="url(#bd-ink)" opacity={0.4} />
      <rect x={0} y={0} width={w} height={96} fill={p.paper} stroke={p.ink} strokeWidth={2} />
      <text x={17} y={30} fontFamily={DIN} fontWeight={700} fontSize={22} letterSpacing={5} fill={p.ink}>
        {first}
      </text>
      <text x={15} y={82} fontFamily={DIN} fontWeight={700} fontSize={56} letterSpacing={1.5} fill={p.coral}>
        {last}
      </text>
    </g>
  );
};
const Workshop: React.FC<{t: number; T: Times; p: Pal}> = ({t, T, p}) => {
  const tt = twos(t);
  const run = Math.max(0, tt - T.sealed);
  const feed = run * FEED;
  const phi = run * 2.1 * Math.PI * 2 - Math.PI / 2;
  const knob: Pt = [WHEEL[0] + 76 * Math.cos(phi), WHEEL[1] + 76 * Math.sin(phi)];
  const sheetEnd = 1002 + feed;
  const rows: {y: number; k: number}[] = [];
  for (let kk = 0; ; kk++) {
    const y = sheetEnd - 30 - kk * SHEET_ROW;
    if (y < 1002 + 20) break;
    rows.push({y, k: kk});
  }
  const frame = (fx: number) => (
    <g>
      <path d={`M${fx - 74} 1500 L${fx - 28} 1010 L${fx - 32} 800 Q${fx} 752 ${fx + 32} 800 L${fx + 28} 1010 L${fx + 74} 1500 Z`} fill={p.ink} />
      <path d={`M${fx - 70} 1500 L${fx - 25} 1010 L${fx - 29} 800`} fill="none" stroke={p.deep} strokeWidth={4} />
      <circle cx={fx} cy={1250} r={30} fill={mix(p.muted, 25, p.paper)} stroke={p.deep} strokeWidth={3} />
      {[TOPR.cy, BOTR.cy].map((cy) => (
        <g key={cy}>
          <circle cx={fx} cy={cy} r={27} fill={p.ink} stroke={p.deep} strokeWidth={3} />
          <circle cx={fx} cy={cy} r={8} fill={p.paper} />
        </g>
      ))}
    </g>
  );
  return (
    <g>
      {/* pegboard wall, a hammer and a saw hung on it, a concrete floor */}
      <rect x={-600} y={-600} width={2300} height={2100} fill={mix(p.paper, 80, p.muted)} />
      <rect x={-600} y={-600} width={2300} height={2100} fill="url(#peg)" />
      <g transform="translate(46 470) rotate(-18)">
        <rect x={-6} y={0} width={14} height={150} rx={5} fill={p.muted} stroke={p.ink} strokeWidth={2.5} />
        <path d="M-34 -6 L40 -6 L46 6 L28 18 L-34 18 Z" fill={p.ink} />
      </g>
      <g transform="translate(990 380) rotate(8)">
        <path d="M0 0 L50 0 L58 250 L10 230 Z" fill={mix(p.paper, 60, p.muted)} stroke={p.ink} strokeWidth={2.5} />
        {Array.from({length: 22}, (_, i) => (
          <path key={i} d={`M${10 + i * 2.2} ${10 + i * 10} l-7 5 l7 5`} fill="none" stroke={p.ink} strokeWidth={1.2} />
        ))}
        <rect x={-6} y={-46} width={62} height={52} rx={14} fill={p.deep} stroke={p.ink} strokeWidth={2.5} />
      </g>
      <rect x={-600} y={1500} width={2300} height={1400} fill={mix(p.muted, 40, p.paper)} />
      <rect x={-600} y={1500} width={2300} height={1400} fill="url(#bd-ink)" opacity={0.28} />
      <line x1={-600} y1={1500} x2={1700} y2={1500} stroke={p.ink} strokeWidth={4} />
      {/* the feed bar and the two curtains over it */}
      <Curtain q={CURT_R} p={p} feed={feed} kind="waves" />
      <Curtain q={CURT_L} p={p} feed={feed} kind="dots" />
      <line x1={120} y1={226} x2={960} y2={226} stroke={p.ink} strokeWidth={12} strokeLinecap="round" />
      <circle cx={120} cy={226} r={13} fill={p.ink} />
      <circle cx={960} cy={226} r={13} fill={p.ink} />
      {/* the sheet that comes out: sealed rings, then domes as the air is trapped */}
      {feed > 0 ? (
        <g>
          <rect x={SX0} y={1000} width={SX1 - SX0} height={feed + 2} fill={mix(p.teal, 34, p.paper)} stroke={p.ink} strokeWidth={3} />
          {rows.map(({y, k: kk}) => {
            const wave = k(t, [T.trapped + kk * 0.035, T.trapped + kk * 0.035 + 0.3], [0, 1], BACK);
            const inf = Math.min(wave, k(y, [1002, 1060], [0, 1]));
            return Array.from({length: 8}, (_, c) => {
              const x = SX0 + 34 + (kk % 2 ? 26 : 0) + c * 58;
              if (x > SX1 - 24) return null;
              return <Bub key={`${kk}-${c}`} x={x} y={y} r={22} t={t} color={p.domeFilm} ink={p.ink} inflate={inf} ring={p.deep} />;
            });
          })}
        </g>
      ) : null}
      {/* the rollers: smooth on top, dimpled below */}
      <rect x={RX0} y={TOPR.cy - TOPR.r} width={RX1 - RX0} height={TOPR.r * 2} rx={8} fill={mix(p.teal, 50, p.paper)} stroke={p.ink} strokeWidth={3} />
      <rect x={RX0} y={TOPR.cy + 10} width={RX1 - RX0} height={TOPR.r - 12} fill="url(#bd-deep)" />
      <rect x={RX0 + 6} y={TOPR.cy - TOPR.r + 12} width={RX1 - RX0 - 12} height={9} rx={4} fill={p.paper} opacity={0.85} />
      <rect x={RX0} y={BOTR.cy - BOTR.r} width={RX1 - RX0} height={BOTR.r * 2} rx={8} fill={mix(p.teal, 62, p.paper)} stroke={p.ink} strokeWidth={3} />
      {Array.from({length: 12}, (_, r) => {
        const th = phi * 0.55 + r * (Math.PI / 6);
        const a = ((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        if (Math.abs(a) > Math.PI / 2 - 0.15) return null;
        const y = BOTR.cy + BOTR.r * Math.sin(a) * 0.92;
        return Array.from({length: 8}, (_, c) => (
          <ellipse key={`${r}-${c}`} cx={RX0 + 46 + (r % 2 ? 30 : 0) + c * 62} cy={y} rx={20} ry={Math.max(1, 17 * Math.cos(a))} fill={p.deep} stroke={p.ink} strokeWidth={1.8} />
        ));
      })}
      <rect x={RX0} y={BOTR.cy + 18} width={RX1 - RX0} height={BOTR.r - 22} fill="url(#bd-ink)" opacity={0.35} />
      <line x1={RX0} y1={NIP} x2={RX1} y2={NIP} stroke={p.ink} strokeWidth={4} />
      {frame(180)}
      {frame(780)}
      {/* crank wheel */}
      <rect x={780} y={BOTR.cy - 6} width={WHEEL[0] - 780} height={12} fill={p.ink} />
      <circle cx={WHEEL[0]} cy={WHEEL[1]} r={88} fill="none" stroke={p.ink} strokeWidth={13} />
      <circle cx={WHEEL[0]} cy={WHEEL[1]} r={88} fill="none" stroke={p.deep} strokeWidth={3} strokeDasharray="4 10" />
      {Array.from({length: 5}, (_, i) => {
        const a = phi + (i * Math.PI * 2) / 5;
        return <line key={i} x1={WHEEL[0]} y1={WHEEL[1]} x2={WHEEL[0] + 84 * Math.cos(a)} y2={WHEEL[1] + 84 * Math.sin(a)} stroke={p.ink} strokeWidth={8} />;
      })}
      <circle cx={WHEEL[0]} cy={WHEEL[1]} r={16} fill={p.ink} stroke={p.deep} strokeWidth={3} />
      <circle cx={knob[0]} cy={knob[1]} r={13} fill={p.paper} stroke={p.ink} strokeWidth={3} />
      {/* the two of them: one feeds, one cranks */}
      <Man x={100} y={1500} f={1} suit={p.deep} p={p} glasses hands={[[232, 980 + Math.sin(tt * 9) * 4 * (run > 0 ? 1 : 0)], [250, 900]]} />
      <Man x={962} y={1500} f={-1} suit={p.ink} p={p} tache hands={[restHands(962, 1500, -1)[0], knob]} />
      <NameChip x={30} y={772} first="ALFRED" last="FIELDING" align="start" on={k(t, [T.fielding - 0.05, T.fielding + 0.12], [0, 1], OUT) * (1 - k(t, [T.trapped - 0.6, T.trapped - 0.3], [0, 1]))} p={p} />
      <NameChip x={958} y={772} first="MARC" last="CHAVANNES" align="end" on={k(t, [T.chav - 0.05, T.chav + 0.12], [0, 1], OUT) * (1 - k(t, [T.trapped - 0.6, T.trapped - 0.3], [0, 1]))} p={p} />
    </g>
  );
};

// ---------- 3. the shop, then the greenhouse ----------
const SAMPLES = [
  {x: 140, y: 400, fill: 'url(#pat-atomic)', price: '$1.10'},
  {x: 560, y: 400, fill: 'url(#pat-stripe)', price: '$1.25'},
  {x: 140, y: 910, fill: 'url(#pat-harl)', price: '$0.95'},
  {x: 560, y: 910, fill: 'bubbles', price: '$1.25'},
];
const SW = 380;
const SH = 360;
const GROUND = 1600;
const GH = {x0: 1320, x1: 2080, wall: 1080, peak: 820};
const GH_PATH = `M${GH.x0} ${GROUND} L${GH.x0} ${GH.wall} L${(GH.x0 + GH.x1) / 2} ${GH.peak} L${GH.x1} ${GH.wall} L${GH.x1} ${GROUND} Z`;
const Tag: React.FC<{x: number; y: number; price: string; p: Pal; s1?: number; s2?: number}> = ({x, y, price, p, s1 = 0, s2 = 0}) => (
  <g data-tb-skip transform={`translate(${x} ${y}) rotate(-6)`}>
    <line x1={0} y1={-34} x2={0} y2={0} stroke={p.ink} strokeWidth={1.5} />
    <path d="M-50 4 L38 4 L54 30 L38 56 L-50 56 Z" fill={p.paper} stroke={p.ink} strokeWidth={2.5} strokeLinejoin="round" />
    <circle cx={40} cy={30} r={5} fill="none" stroke={p.ink} strokeWidth={2} />
    <text x={-40} y={46} fontFamily={DIN} fontWeight={700} fontSize={40} fill={p.ink}>
      {s2 > 0.5 ? '49¢' : s1 > 0.5 ? '99¢' : price}
    </text>
    {s1 > 0 && s1 < 1 ? <path d="M-44 26 L26 18" stroke={p.ink} strokeWidth={4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - s1 * 2} strokeLinecap="round" /> : null}
    {s2 > 0 && s2 < 1 ? <path d="M-44 26 L26 18" stroke={p.ink} strokeWidth={4} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - s2 * 2} strokeLinecap="round" /> : null}
  </g>
);
const FilmPanel: React.FC<{x: number; y: number; w: number; h: number; t: number; p: Pal; id: string; s?: number}> = ({x, y, w, h, t, p, id, s = 64}) => (
  <g>
    <clipPath id={id}>
      <rect x={x} y={y} width={w} height={h} />
    </clipPath>
    <rect x={x} y={y} width={w} height={h} fill={p.film} />
    <g clipPath={`url(#${id})`}>
      {grid(x - s, y + s * 0.4, x + w + s, y + h + s, s, s * 0.866).map(([bx, by]) => (
        <Bub key={`${bx},${by}`} x={bx} y={by} r={s * 0.34} t={t} color={p.domeFilm} ink={p.ink} />
      ))}
    </g>
  </g>
);
const Shop: React.FC<{t: number; T: Times; p: Pal}> = ({t, T, p}) => {
  const tt = twos(t);
  const sold = [T.n1, T.n2, T.n3];
  // three rolls sell; then the unwanted one is pulled off its bracket too, for the greenhouse
  const at = (i: number) => (i < 3 ? sold[i] : T.green);
  const yank = (i: number) => 10 * k(tt, [at(i) - 0.14, at(i) - 0.05], [0, 1]) - 2200 * k(t, [at(i) - 0.05, at(i) + 0.3], [0, 1], IN);
  const landDy = -80 * (1 - k(t, [T.b2, T.b2 + 0.16], [0, 1], IN)) + wob(t, T.b2 + 0.16, 6, 3, 6);
  // the film comes down over the greenhouse frame; then fog, a wilting plant, a tear, and it blows off
  const drape = k(t, [T.green + 0.3, T.green + 0.85], [0, 1], OUT);
  const dropY = lerp(GH.peak - 30, GROUND + 50, drape);
  const fog = 0.62 * k(t, [T.failed - 0.05, T.failed + 0.7], [0, 1]);
  const wilt = k(tt, [T.failed + 0.05, T.failed + 0.8], [0, 1], INOUT);
  const tear = T.failed + 0.42;
  const rip = T.b3 - 0.36;
  const flap = t > tear ? 18 + 26 * Math.abs(Math.sin((t - tear) * 15)) * (t < rip ? 1 : 0) : 0;
  const stem = (u: number): Pt => {
    const bx = 1700;
    const by = 1290;
    const tipX = bx + 120 * wilt;
    const tipY = by - 350 + 220 * wilt;
    const cx = bx + 10;
    const cy = by - 270 - 30 * wilt;
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    return [a * bx + b * cx + c * tipX, a * by + b * cy + c * tipY];
  };
  const leaf = (u: number, side: 1 | -1, size: number) => {
    const [x, y] = stem(u);
    const ang = side * (40 + 70 * wilt) + (side < 0 ? 180 : 0);
    return (
      <g key={`${u}${side}`} transform={`translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)}) scale(${size})`}>
        <path d="M0 0 Q22 -16 52 0 Q22 16 0 0 Z" fill={p.deep} stroke={p.ink} strokeWidth={2.4} />
        <path d="M2 0 L48 0" stroke={p.ink} strokeWidth={1.4} />
      </g>
    );
  };
  return (
    <g>
      {/* the shop: a papered wall, a display board of samples, a wainscot, the floor */}
      <rect x={-600} y={-600} width={1740} height={2200} fill={mix(p.paper, 92, p.rule)} />
      {Array.from({length: 20}, (_, i) => (
        <line key={i} x1={-560 + i * 90} y1={-600} x2={-560 + i * 90} y2={GROUND} stroke={p.rule} strokeWidth={10} />
      ))}
      <rect x={-600} y={1470} width={1740} height={130} fill={p.deep} />
      <rect x={-600} y={1470} width={1740} height={130} fill="url(#bd-ink)" opacity={0.35} />
      <rect x={90} y={340} width={900} height={1110} fill={mix(p.paper, 70, p.muted)} stroke={p.ink} strokeWidth={6} />
      <rect x={110} y={360} width={860} height={1070} fill="none" stroke={p.ink} strokeWidth={1.5} />
      {SAMPLES.map((s, i) => {
        const hero = i === 3;
        const dy = yank(i) + (hero ? landDy : 0);
        return (
          <g key={i}>
            <path d={`M${s.x - 18} ${s.y - 6} l0 -26 l12 0 M${s.x + SW + 18} ${s.y - 6} l0 -26 l-12 0`} fill="none" stroke={p.ink} strokeWidth={6} />
            <g transform={`translate(0 ${f1(dy)})`}>
              <rect x={s.x + 6} y={s.y + 30} width={SW} height={SH} fill="url(#bd-ink)" opacity={0.4} transform="translate(8 10)" />
              {s.fill === 'bubbles' ? <FilmPanel x={s.x} y={s.y + 30} w={SW} h={SH} t={t} p={p} id="hero-sample" /> : <rect x={s.x} y={s.y + 30} width={SW} height={SH} fill={s.fill} />}
              <rect x={s.x} y={s.y + 30} width={SW} height={SH} fill="none" stroke={p.ink} strokeWidth={2.5} />
              <rect x={s.x - 14} y={s.y - 30} width={SW + 28} height={62} rx={8} fill={s.fill === 'bubbles' ? p.film : s.fill} stroke={p.ink} strokeWidth={3} />
              <rect x={s.x - 14} y={s.y + 6} width={SW + 28} height={26} rx={6} fill="url(#bd-deep)" opacity={0.7} />
              <ellipse cx={s.x - 14} cy={s.y + 1} rx={11} ry={31} fill={p.paper} stroke={p.ink} strokeWidth={3} />
              <circle cx={s.x - 14} cy={s.y + 1} r={6} fill={p.ink} />
              <Tag x={s.x + SW - 70} y={s.y + 30 + SH + 34} price={s.price} p={p} s1={hero ? k(t, [T.strike1, T.strike1 + 0.3], [0, 1]) : 0} s2={hero ? k(t, [T.strike2, T.strike2 + 0.3], [0, 1]) : 0} />
            </g>
          </g>
        );
      })}
      <rect x={-600} y={GROUND} width={1740} height={1400} fill={mix(p.muted, 55, p.paper)} />
      <line x1={-600} y1={GROUND} x2={1140} y2={GROUND} stroke={p.ink} strokeWidth={4} />
      {/* the garden: a separate clipping pasted beside the shop with a torn edge */}
      <g>
        <path d={`M1140 -600 ${Array.from({length: 48}, (_, i) => `L${1140 + ((i * 37) % 5) * 5 - 10} ${-600 + i * 60}`).join(' ')} L1140 2400 L3200 2400 L3200 -600 Z`} fill={mix(p.teal, 34, p.paper)} />
        <path d={`M1140 -600 ${Array.from({length: 48}, (_, i) => `L${1140 + ((i * 37) % 5) * 5 - 10} ${-600 + i * 60}`).join(' ')}`} fill="none" stroke={p.paper} strokeWidth={9} />
        <circle cx={2010} cy={470} r={86} fill={p.paper} stroke={p.ink} strokeWidth={3} />
        {Array.from({length: 12}, (_, i) => {
          const a = (i * 30 + 8) * R2D;
          return <line key={i} x1={2010 + 104 * Math.cos(a)} y1={470 + 104 * Math.sin(a)} x2={2010 + 136 * Math.cos(a)} y2={470 + 136 * Math.sin(a)} stroke={p.ink} strokeWidth={5} strokeLinecap="round" />;
        })}
        <rect x={1146} y={GROUND} width={2100} height={900} fill={p.deep} />
        <rect x={1146} y={GROUND} width={2100} height={900} fill="url(#bd-ink)" opacity={0.4} />
        {Array.from({length: 60}, (_, i) => (
          <path key={i} d={`M${1160 + i * 34} ${GROUND + 4} l${(i % 3) * 4 - 4} -26`} stroke={p.ink} strokeWidth={3} strokeLinecap="round" />
        ))}
        <line x1={1146} y1={GROUND} x2={3200} y2={GROUND} stroke={p.ink} strokeWidth={4} />
        {/* inside the greenhouse: a bench, a pot, a tomato seedling */}
        <rect x={1420} y={1418} width={560} height={20} fill={mix(p.muted, 50, p.paper)} stroke={p.ink} strokeWidth={3} />
        <path d="M1440 1438 L1446 1600 M1960 1438 L1954 1600" stroke={p.ink} strokeWidth={8} />
        <path d={`M${f1(stem(0)[0])} ${f1(stem(0)[1])} Q${f1(1710)} ${f1(1020 - 30 * wilt)} ${f1(stem(1)[0])} ${f1(stem(1)[1])}`} fill="none" stroke={p.ink} strokeWidth={11} strokeLinecap="round" />
        {leaf(0.22, 1, 1.7)}
        {leaf(0.38, -1, 1.85)}
        {leaf(0.56, 1, 1.6)}
        {leaf(0.72, -1, 1.4)}
        {leaf(0.9, 1, 1.1)}
        <path d={`M${f1(stem(0.48)[0])} ${f1(stem(0.48)[1])} q30 10 ${f1(36 + 20 * wilt)} ${f1(40 + 60 * wilt)}`} fill="none" stroke={p.ink} strokeWidth={4} />
        <circle cx={f1(stem(0.48)[0] + 36 + 20 * wilt)} cy={f1(stem(0.48)[1] + 66 + 60 * wilt)} r={25} fill={p.teal} stroke={p.ink} strokeWidth={3} />
        <circle cx={f1(stem(0.48)[0] + 28 + 20 * wilt)} cy={f1(stem(0.48)[1] + 58 + 60 * wilt)} r={6} fill={p.paper} />
        <path d="M1622 1290 L1778 1290 L1758 1418 L1642 1418 Z" fill={mix(p.muted, 75, p.paper)} stroke={p.ink} strokeWidth={3.5} />
        <rect x={1610} y={1274} width={180} height={28} fill={mix(p.muted, 75, p.paper)} stroke={p.ink} strokeWidth={3.5} />
        <path d="M1700 1302 L1772 1302 L1758 1418 L1700 1418 Z" fill="url(#bd-ink)" opacity={0.5} />
        {/* the cladding of bubble film, fogging */}
        {t < rip ? (
          <g>
            <clipPath id="clad">
              <path d={GH_PATH} />
            </clipPath>
            <clipPath id="clad-sweep">
              <path d={t > tear ? `M${GH.x0} ${GROUND} L${GH.x0} ${GH.peak - 20} L${GH.x1 - 230} ${GH.peak - 20} L${GH.x1 + 10} ${GH.wall - 40} L${GH.x1 + 10} ${GROUND} Z` : `M${GH.x0 - 20} ${GH.peak - 40} L${GH.x1 + 20} ${GH.peak - 40} ${Array.from({length: 14}, (_, i) => `L${f1(GH.x1 + 20 - i * 62)} ${f1(dropY + Math.sin(i * 1.9 + t * 11) * 22 * (1 - drape))}`).join(' ')} L${GH.x0 - 20} ${f1(dropY)} Z`} />
            </clipPath>
            <g clipPath="url(#clad-sweep)">
              <g clipPath="url(#clad)">
                <rect x={GH.x0} y={GH.peak} width={GH.x1 - GH.x0} height={GROUND - GH.peak} fill={p.film} opacity={0.62} />
                {grid(GH.x0 - 40, GH.peak, GH.x1 + 40, GROUND, 64, 55).map(([x, y]) => (
                  <Bub key={`${x},${y}`} x={x} y={y} r={21} t={t} color={p.domeFilm} ink={p.ink} />
                ))}
                <rect x={GH.x0} y={GH.peak} width={GH.x1 - GH.x0} height={GROUND - GH.peak} fill="url(#bd-paper)" opacity={fog * 0.92} />
                {fog > 0.2
                  ? [1380, 1520, 1610, 1790, 1880, 2010].map((x, i) => (
                      <path key={x} d={`M${x} ${1120 + (i % 3) * 30} l0 ${lerp(0, 160 + (i % 2) * 90, k(fog, [0.2, 0.62], [0, 1]))}`} stroke={p.paper} strokeWidth={5} strokeLinecap="round" />
                    ))
                  : null}
              </g>
            </g>
            {t > tear ? (
              <g transform={`translate(${GH.x1 - 230} ${GH.peak - 20}) rotate(${f1(-flap)})`}>
                <path d={`M0 0 L240 ${GH.wall - 20 - GH.peak} L180 ${GH.wall - 20 - GH.peak + 30} L40 40 Z`} fill={p.film} stroke={p.ink} strokeWidth={2.5} />
                <path d={`M0 0 L240 ${GH.wall - 20 - GH.peak} L180 ${GH.wall - 20 - GH.peak + 30} L40 40 Z`} fill="url(#bd-paper)" opacity={0.5} />
                <path d="M40 40 l12 -6 l8 10 l14 -8 l10 12 l16 -6 l10 12 l18 -4 l10 14 l20 -6" fill="none" stroke={p.ink} strokeWidth={2} />
              </g>
            ) : null}
          </g>
        ) : null}
        {/* the frame */}
        <g fill="none" stroke={p.ink} strokeLinecap="round" strokeLinejoin="round">
          <path d={GH_PATH} strokeWidth={11} />
          {Array.from({length: 4}, (_, i) => {
            const x = GH.x0 + 152 * (i + 1);
            const yTop = x < (GH.x0 + GH.x1) / 2 ? lerp(GH.wall, GH.peak, (x - GH.x0) / 380) : lerp(GH.peak, GH.wall, (x - 1700) / 380);
            return <line key={i} x1={x} y1={GROUND} x2={x} y2={yTop} strokeWidth={7} />;
          })}
          <line x1={GH.x0} y1={GH.wall} x2={GH.x1} y2={GH.wall} strokeWidth={7} />
          <line x1={GH.x0} y1={1340} x2={GH.x1} y2={1340} strokeWidth={5} />
          <line x1={1700} y1={GH.peak} x2={1700} y2={GROUND} strokeWidth={7} />
        </g>
      </g>
    </g>
  );
};

// ---------- 4. the dock: an IBM tape drive, wrapped, dropped ----------
const M = {x0: 300, x1: 680, y0: 640, y1: 1400};
const DOCK = 1424;
const WRAP = {x0: 274, y0: 590, x1: 726, y1: 1424};
const WRAP_GRID = grid(WRAP.x0 + 24, WRAP.y0 + 24, WRAP.x1 - 16, WRAP.y1 - 18, 62, 54);
const WRAP_BOTTOM = Math.max(...WRAP_GRID.map(([, y]) => y));
const DIVE: Pt = WRAP_GRID.reduce((a, b) => (Math.hypot(b[0] - 612, b[1] - 1300) < Math.hypot(a[0] - 612, a[1] - 1300) ? b : a));
const Reel: React.FC<{x: number; y: number; a: number; p: Pal}> = ({x, y, a, p}) => (
  <g transform={`translate(${x} ${y}) rotate(${f1(a)})`}>
    <circle r={74} fill={p.paper} stroke={p.ink} strokeWidth={4} />
    <circle r={54} fill={p.ink} />
    <circle r={54} fill="url(#bd-paper)" opacity={0.18} />
    {[0, 120, 240].map((d) => (
      <path key={d} d="M-17 -64 A66 66 0 0 1 17 -64 L10 -26 A28 28 0 0 0 -10 -26 Z" transform={`rotate(${d})`} fill={mix(p.teal, 30, p.paper)} stroke={p.ink} strokeWidth={2} />
    ))}
    <circle r={18} fill={p.paper} stroke={p.ink} strokeWidth={3} />
    <circle r={6} fill={p.ink} />
  </g>
);
const Stencil: React.FC<{x: number; y: number; size: number; text: string; p: Pal; id: string; spacing?: number}> = ({x, y, size, text, p, id, spacing = 3}) => (
  <g data-tb-skip>
    <mask id={id}>
      <rect x={x - 400} y={y - size} width={800} height={size * 1.2} fill={p.paper} />
      {Array.from({length: 40}, (_, i) => (
        <rect key={i} x={x - 400 + i * 21} y={y - size} width={3} height={size * 1.2} fill={p.ink} />
      ))}
    </mask>
    <text x={x} y={y} textAnchor="middle" fontFamily={DIN} fontWeight={700} fontSize={size} letterSpacing={spacing} fill={p.ink} opacity={0.86} mask={`url(#${id})`}>
      {text}
    </text>
  </g>
);
const Dock: React.FC<{t: number; T: Times; p: Pal}> = ({t, T, p}) => {
  const tt = twos(t);
  // the wrap drapes down over the machine
  const drape = k(t, [T.safely - 0.15, T.safely + 0.5], [0, 1], OUT);
  const dropY = lerp(WRAP.y0 - 40, WRAP.y1 + 60, drape);
  // the chain comes down, hooks, lifts; a link snaps; it falls, hits, bounces, settles
  const chainDown = k(t, [T.failedW - 0.1, T.failedW + 0.3], [0, 1], OUT);
  const lift = k(t, [T.failedW + 0.4, T.snap - 0.05], [0, 1], INOUT);
  let yOff = -340 * lift;
  if (t >= T.snap) yOff = t < T.hit ? -340 * (1 - quad((t - T.snap) / (T.hit - T.snap))) : -Math.abs(Math.sin((t - T.hit) * Math.PI * 2.6)) * 46 * Math.exp(-(t - T.hit) * 5);
  const sway = t < T.snap ? wob(t, T.failedW + 0.42, 2.2, 1.1, 1.8) : 0;
  const sq = t >= T.hit ? Math.exp(-(t - T.hit) * 9) * Math.cos((t - T.hit) * 30) : 0;
  const hookY = lerp(-900, WRAP.y0 - 30, chainDown) + (t < T.snap ? yOff : 0);
  const recoil = t >= T.snap ? -1600 * k(t, [T.snap, T.snap + 0.3], [0, 1], OUT) : 0;
  // alive: after the drop the reels quietly turn
  const alive = T.hit + 0.75;
  const spin = 230 * k(t, [alive, alive + 1.1], [0, 1], INOUT) + (t > T.ibm + 0.85 && t < T.ibm + 1.6 ? 12 * Math.sin((t - T.ibm - 0.85) * 14) * k(t, [T.ibm + 0.85, T.ibm + 1.0], [0, 1]) * (1 - k(t, [T.ibm + 1.3, T.ibm + 1.6], [0, 1])) : 0);
  const loop = 30 + 26 * Math.sin(spin * 0.05);
  const pops = (x: number, y: number) => (y >= WRAP_BOTTOM - 60 ? T.hit + Math.abs(x - 490) * 0.00035 + (WRAP_BOTTOM - y) * 0.001 : undefined);
  const label = k(t, [T.sa, T.sa + 0.1], [0, 1], IN);
  return (
    <g>
      {/* corrugated warehouse wall and the dock floor */}
      <rect x={-600} y={-1200} width={2300} height={DOCK + 1200} fill={mix(p.paper, 85, p.muted)} />
      {Array.from({length: 60}, (_, i) => (
        <rect key={i} x={-600 + i * 44} y={-1200} width={18} height={DOCK + 1200} fill="url(#bd-deep)" opacity={0.55} />
      ))}
      {Array.from({length: 60}, (_, i) => (
        <line key={i} x1={-600 + i * 44} y1={-1200} x2={-600 + i * 44} y2={DOCK} stroke={p.ink} strokeWidth={1.4} opacity={0.5} />
      ))}
      <rect x={-600} y={DOCK} width={2300} height={1400} fill={mix(p.muted, 34, p.paper)} />
      <rect x={-600} y={DOCK} width={2300} height={70} fill="url(#bd-ink)" opacity={0.4} />
      <line x1={-600} y1={DOCK} x2={1700} y2={DOCK} stroke={p.ink} strokeWidth={5} />
      {/* the crate's lid leaning on the wall */}
      <g transform="translate(760 860) rotate(-4)">
        <rect x={0} y={0} width={270} height={566} fill={mix(p.paper, 70, p.muted)} stroke={p.ink} strokeWidth={3} />
        {[1, 2, 3, 4].map((i) => (
          <line key={i} x1={0} y1={i * 113} x2={270} y2={i * 113} stroke={p.ink} strokeWidth={2} />
        ))}
        {Array.from({length: 14}, (_, i) => (
          <path key={i} d={`M${8 + (i * 53) % 250} ${12 + i * 40} q30 -4 60 2`} fill="none" stroke={p.muted} strokeWidth={1.4} opacity={0.6} />
        ))}
        <rect x={18} y={0} width={30} height={566} fill={mix(p.muted, 40, p.paper)} stroke={p.ink} strokeWidth={2.5} />
        <Stencil x={150} y={124} size={74} text="IBM 1401" p={p} id="st1" />
        <Stencil x={150} y={228} size={66} text="FRAGILE" p={p} id="st2" spacing={5} />
        <Stencil x={150} y={300} size={30} text="THIS SIDE UP" p={p} id="st3" spacing={4} />
        <path d="M150 330 L150 410 M126 356 L150 330 L174 356" fill="none" stroke={p.ink} strokeWidth={9} opacity={0.86} />
      </g>
      {/* its contact shadow, spreading and fading as it is lifted */}
      <ellipse cx={500} cy={DOCK + 6} rx={260 * (1 + Math.max(0, -yOff) / 900)} ry={22} fill="url(#bd-ink)" opacity={0.75 * (1 - Math.min(0.8, Math.max(0, -yOff) / 420))} />
      {/* the chain from the hoist */}
      <g transform={`translate(0 ${f1(recoil)})`}>
        {Array.from({length: 40}, (_, i) => {
          const y = hookY - 40 - i * 34;
          return i % 2 ? <rect key={i} x={486} y={y - 16} width={8} height={32} fill={p.ink} /> : <ellipse key={i} cx={490} cy={y} rx={9} ry={19} fill="none" stroke={p.ink} strokeWidth={6} />;
        })}
      </g>
      {/* the machine, its wrap and the hook travel together */}
      <g transform={`translate(0 ${f1(yOff)}) rotate(${f1(sway)} 490 ${WRAP.y0}) translate(490 ${DOCK}) scale(${1 + 0.06 * sq} ${1 - 0.08 * sq}) translate(-490 ${-DOCK})`}>
        {chainDown > 0 ? (
          <path d={`M490 ${f1(t < T.snap ? WRAP.y0 - 70 : WRAP.y0 - 70)} l0 40 q0 30 -26 30 q-22 0 -22 -24`} fill="none" stroke={p.ink} strokeWidth={9} strokeLinecap="round" opacity={t < T.snap ? (hookY > WRAP.y0 - 60 ? 1 : 0) : 1} />
        ) : null}
        {/* body with a side face and a top face for depth */}
        <path d={`M${M.x1} ${M.y0} L${M.x1 + 34} ${M.y0 - 28} L${M.x1 + 34} ${M.y1 - 28} L${M.x1} ${M.y1} Z`} fill={mix(p.teal, 70, p.paper)} stroke={p.ink} strokeWidth={3} />
        <path d={`M${M.x1} ${M.y0} L${M.x1 + 34} ${M.y0 - 28} L${M.x1 + 34} ${M.y1 - 28} L${M.x1} ${M.y1} Z`} fill="url(#bd-deep)" />
        <path d={`M${M.x0} ${M.y0} L${M.x0 + 34} ${M.y0 - 28} L${M.x1 + 34} ${M.y0 - 28} L${M.x1} ${M.y0} Z`} fill={p.paper} stroke={p.ink} strokeWidth={3} />
        <rect x={M.x0} y={M.y0} width={M.x1 - M.x0} height={M.y1 - M.y0} fill={mix(p.paper, 72, p.teal)} stroke={p.ink} strokeWidth={3.5} />
        {/* glass door, reels, head, vacuum columns */}
        <rect x={320} y={660} width={340} height={400} fill={mix(p.teal, 26, p.paper)} stroke={p.ink} strokeWidth={4} />
        <Reel x={406} y={772} a={spin} p={p} />
        <Reel x={574} y={772} a={spin * 1.3} p={p} />
        <path d="M352 800 L452 900 M628 800 L528 900" stroke={p.ink} strokeWidth={3} />
        <rect x={448} y={880} width={84} height={46} rx={6} fill={p.muted} stroke={p.ink} strokeWidth={3} />
        <rect x={464} y={890} width={52} height={10} fill={p.paper} />
        {[348, 596].map((x) => (
          <g key={x}>
            <rect x={x} y={944} width={38} height={100} fill={p.ink} />
            <path d={`M${x + 8} 944 L${x + 8} ${944 + loop} Q${x + 19} ${958 + loop} ${x + 30} ${944 + loop} L${x + 30} 944`} fill="none" stroke={p.paper} strokeWidth={3} />
          </g>
        ))}
        <path d="M330 676 L400 676 L340 760 Z M560 1040 L650 930 L650 990 L600 1040 Z" fill={p.paper} opacity={0.55} />
        {/* control strip and louvres */}
        <rect x={M.x0} y={1074} width={M.x1 - M.x0} height={48} fill={p.ink} />
        {[340, 380, 420, 560, 600].map((x, i) => (
          <circle key={x} cx={x} cy={1098} r={i === 0 ? 12 : 8} fill={i === 0 ? p.paper : p.deep} stroke={p.paper} strokeWidth={1.5} />
        ))}
        <text data-tb-skip x={490} y={1110} textAnchor="middle" fontFamily={DIN} fontWeight={700} fontSize={34} letterSpacing={6} fill={p.paper}>
          IBM
        </text>
        {Array.from({length: 10}, (_, i) => (
          <g key={i}>
            <rect x={334} y={1150 + i * 22} width={312} height={7} rx={3} fill={p.ink} />
            <rect x={334} y={1157 + i * 22} width={312} height={6} fill="url(#bd-deep)" />
          </g>
        ))}
        <rect x={M.x0} y={M.y1 - 22} width={M.x1 - M.x0} height={22} fill={p.ink} />
        {/* the wrap */}
        {drape > 0 ? (
          <g>
            <clipPath id="wrap">
              <path d={`M${WRAP.x0 + 30} ${WRAP.y0} L${WRAP.x1 - 30} ${WRAP.y0} Q${WRAP.x1} ${WRAP.y0} ${WRAP.x1} ${WRAP.y0 + 30} L${WRAP.x1} ${WRAP.y1} L${WRAP.x0} ${WRAP.y1} L${WRAP.x0} ${WRAP.y0 + 30} Q${WRAP.x0} ${WRAP.y0} ${WRAP.x0 + 30} ${WRAP.y0} Z`} />
            </clipPath>
            <clipPath id="drape">
              <path d={`M${WRAP.x0 - 20} ${WRAP.y0 - 60} L${WRAP.x1 + 20} ${WRAP.y0 - 60} L${WRAP.x1 + 20} ${f1(dropY)} ${Array.from({length: 9}, (_, i) => `L${f1(WRAP.x1 + 20 - i * 60)} ${f1(dropY + Math.sin(i * 1.7 + t * 9) * 16 * (1 - drape))}`).join(' ')} L${WRAP.x0 - 20} ${f1(dropY)} Z`} />
            </clipPath>
            <g clipPath="url(#drape)">
              <g clipPath="url(#wrap)">
                <rect x={WRAP.x0} y={WRAP.y0} width={WRAP.x1 - WRAP.x0} height={WRAP.y1 - WRAP.y0} fill={p.film} opacity={0.55} />
                {WRAP_GRID.map(([x, y]) => (
                  <Bub key={`${x},${y}`} x={x} y={y} r={21} t={t} color={p.domeFilm} ink={p.ink} pop={pops(x, y)} />
                ))}
                <path d={`M${WRAP.x0} ${WRAP.y0 + 40} L${WRAP.x0 + 60} ${WRAP.y0} M${WRAP.x1} ${WRAP.y0 + 40} L${WRAP.x1 - 60} ${WRAP.y0}`} stroke={p.ink} strokeWidth={2.5} />
                <rect x={WRAP.x0} y={1006} width={WRAP.x1 - WRAP.x0} height={34} fill={mix(p.paper, 85, p.muted)} stroke={p.ink} strokeWidth={2} />
                <rect x={WRAP.x0} y={1026} width={WRAP.x1 - WRAP.x0} height={14} fill="url(#bd-ink)" opacity={0.3} />
              </g>
              <path d={`M${WRAP.x0 + 30} ${WRAP.y0} L${WRAP.x1 - 30} ${WRAP.y0} Q${WRAP.x1} ${WRAP.y0} ${WRAP.x1} ${WRAP.y0 + 30} L${WRAP.x1} ${WRAP.y1} M${WRAP.x0} ${WRAP.y1} L${WRAP.x0} ${WRAP.y0 + 30} Q${WRAP.x0} ${WRAP.y0} ${WRAP.x0 + 30} ${WRAP.y0}`} fill="none" stroke={p.ink} strokeWidth={3.5} />
            </g>
          </g>
        ) : null}
        {/* the shipping label: the company is born */}
        {t >= T.sa ? (
          <g data-tb-skip transform={`translate(490 1188) rotate(-3) scale(${1 + 0.2 * (1 - label)})`} opacity={label > 0 ? 1 : 0}>
            <rect x={-136} y={-74} width={280} height={156} fill="url(#bd-ink)" opacity={0.4} transform="translate(6 8)" />
            <rect x={-140} y={-78} width={280} height={156} fill={p.paper} stroke={p.ink} strokeWidth={3} />
            <rect x={-130} y={-68} width={260} height={136} fill="none" stroke={p.ink} strokeWidth={1.2} />
            <text x={0} y={-10} textAnchor="middle" fontFamily={DIN} fontWeight={700} fontSize={62} letterSpacing={2} fill={p.coral}>
              SEALED AIR
            </text>
            <text x={0} y={24} textAnchor="middle" fontFamily={DIN} fontWeight={700} fontSize={22} letterSpacing={9} fill={p.ink}>
              CORPORATION
            </text>
            <line x1={-100} y1={38} x2={100} y2={38} stroke={p.ink} strokeWidth={1.5} />
            <text x={0} y={60} textAnchor="middle" fontFamily={DIN} fontWeight={700} fontSize={16} letterSpacing={6} fill={p.muted}>
              EST. 1960
            </text>
          </g>
        ) : null}
      </g>
      {/* casters stay on the dock */}
      <circle cx={330} cy={DOCK - 8 + Math.min(0, yOff)} r={10} fill={p.ink} />
      <circle cx={650} cy={DOCK - 8 + Math.min(0, yOff)} r={10} fill={p.ink} />
    </g>
  );
};

// ---------- the sheet that crosses the lens between scenes ----------
const Cover: React.FC<{p: Pal; t: number; transform: string}> = ({p, t, transform}) => (
  <g transform={transform}>
    <rect x={-760} y={-1180} width={1520} height={2360} fill={p.film} stroke={p.ink} strokeWidth={6} />
    {grid(-760, -1150, 760, 1180, 236, 204).map(([x, y]) => (
      <Bub key={`${x},${y}`} x={x} y={y} r={80} t={t} color={p.domeFilm} ink={p.ink} />
    ))}
  </g>
);

// ---------- the film ----------
export const Film: React.FC = () => {
  const th = useTheme();
  const {t, beats, total, cta} = useFilm();
  const T = useMemo(() => times(beats, total), [beats, total]);
  const p: Pal = {
    paper: th.bg,
    teal: th.surface,
    deep: th.flow,
    ink: th.ink,
    muted: th.muted,
    coral: th.reveal ?? th.ok,
    rule: th.rule,
    film: mix(th.surface, 36, th.bg),
    domeFilm: mix(th.surface, 58, th.bg),
    wall: mix(th.surface, 70, th.bg),
  };

  const cutGreen = T.green + 0.2;
  const scene = t < T.b1 ? 'wall' : t < T.b2 ? 'work' : t < cutGreen ? 'shop' : t < T.b3 ? 'green' : t < T.dive ? 'dock' : 'end';
  const CLOSE: Key = [T.b5 + 0.5, 700, 440, 0.9];
  const KEYS: Record<string, Key[]> = {
    wall: [
      [0, 452, 560, 2.05],
      [0.2, 452, 562, 2.04],
      [1.05, 440, 830, 1.45],
      [2.3, 560, 960, 0.98],
      [T.flop - 0.1, 575, 955, 1.0],
      [T.flop + 0.6, 760, 1010, 1.16],
      [T.b1 - 0.3, 890, 1150, 1.5],
      [T.b1 + 0.02, 900, 1180, 4.2],
    ],
    work: [
      [T.b1, 545, 880, 1.0],
      [T.sealed, 535, 884, 1.02],
      [T.trapped - 0.15, 480, 1120, 1.15],
      [T.b2 - 0.12, 480, 1360, 2.3],
      [T.b2, 480, 1380, 2.45],
    ],
    shop: [
      [T.b2, 540, 925, 0.95],
      [T.n3 + 0.15, 560, 960, 1.0],
      [T.strike1 - 0.1, 768, 1185, 1.8],
      [T.green - 0.05, 770, 1190, 1.8],
      [cutGreen, 772, 1120, 1.8],
    ],
    green: [
      [cutGreen, 1700, 1240, 0.97],
      [T.failed, 1700, 1245, 1.0],
      [T.failed + 0.55, 1712, 1180, 1.75],
      [T.b3, 1714, 1178, 1.8],
    ],
    dock: [
      [T.b3, 520, 965, 1.0],
      [T.ibm + 0.65, 490, 830, 1.7],
      [T.safely - 0.35, 492, 860, 1.6],
      [T.safely + 0.5, 520, 990, 1.0],
      [T.failedW + 0.1, 520, 880, 0.94],
      [T.failedW + 0.6, 520, 830, 0.94],
      [T.hit + 0.6, 515, 850, 0.97],
      [T.b4 - 0.05, 500, 1000, 1.12],
      [T.sa + 0.55, 490, 1170, 2.2],
      [T.billions - 0.3, 494, 1180, 2.3],
      [T.dive, DIVE[0], DIVE[1], 26],
    ],
    end: [[T.dive, 585, 352, 26], [T.flop2 + 0.45, 600, 900, 0.93], [T.b5 - 0.05, 612, 885, 0.95], CLOSE, [total + 0.5, 700, 442, 0.904]],
  };
  const c = camAt(t, KEYS[scene]);
  const shake = scene === 'dock' && t > T.hit ? 16 * Math.exp(-(t - T.hit) * 8) : 0;
  const sx = shake * Math.sin(t * 71);
  const sy = shake * Math.cos(t * 59);

  // the sheet across the lens: pulled up off the engineers into the workshop; blown off the greenhouse onto the dock
  const cover = (() => {
    if (t >= T.b1 && t < T.b1 + 0.5) {
      const u = k(t, [T.b1 + 0.02, T.b1 + 0.45], [0, 1], IN);
      return `translate(540 ${f1(960 - 2500 * u)}) rotate(${f1(-4 * u)})`;
    }
    if (t >= T.green + 0.02 && t < cutGreen + 0.24) {
      const v = t < cutGreen ? 2400 * (1 - k(t, [T.green + 0.02, cutGreen], [0, 1], IN)) : -2400 * k(t, [cutGreen, cutGreen + 0.22], [0, 1], OUT);
      return `translate(540 ${f1(960 + v)}) rotate(2)`;
    }
    const rip = T.b3 - 0.36;
    if (t >= rip && t < T.b3) {
      const u = k(t, [rip, T.b3], [0, 1], IN);
      return `translate(${f1(lerp(620, 540, u))} ${f1(lerp(760, 960, u))}) rotate(${f1(lerp(-14, -3, u))}) scale(${f1(lerp(0.55, 1.08, u))})`;
    }
    if (t >= T.b3 && t < T.b3 + 0.4) {
      const u = k(t, [T.b3 + 0.02, T.b3 + 0.36], [0, 1], IN);
      return `translate(${f1(540 + 900 * u)} ${f1(960 - 2300 * u)}) rotate(${f1(-3 + 30 * u)}) scale(1.08)`;
    }
    return null;
  })();

  // captions: torn newsprint slips; set left during the wall (the strip that peels is on the right), above the subject after
  const capTop = scene === 'wall' ? 300 : scene === 'work' || scene === 'shop' || scene === 'green' ? 262 : 280;
  const capStyle: React.CSSProperties =
    scene === 'wall'
      ? {top: capTop, left: 70, right: 'auto', width: 'fit-content', maxWidth: 560, textAlign: 'left'}
      : {top: capTop, left: 0, right: 0, width: 'fit-content', maxWidth: 780, margin: '0 auto', textAlign: 'center'};

  // the closer is printed on the bare plaster where the strip peeled off
  const closeOn = k(t, [T.b5 + 0.45, T.b5 + 0.6], [0, 1], IN);
  const words = cta.text.toUpperCase().split(' ');
  const longest = Math.max(...words.map((w) => w.length));
  const ctaSize = Math.min(170, 270 / (longest * 0.44));

  const cues: Cue[] = [
    [T.pop, 'pop', 0.8],
    [T.pop + 0.05, 'page', 0.35],
    [0.45, 'soft', 0.16],
    [0.64, 'soft', 0.18],
    [0.82, 'soft', 0.2],
    [0.6, 'tin', 0.22],
    [T.land, 'wood', 0.45],
    [T.land + 0.02, 'page', 0.3],
    [T.tap, 'pop', 0.6],
    [T.flop, 'tear', 0.35],
    [T.flop + 0.12, 'cloth', 0.55],
    [T.flop + 0.6, 'soft', 0.5],
    [T.b1 - 0.28, 'swish', 0.3],
    [T.b1 + 0.04, 'cloth', 0.45],
    [T.sealed - 0.1, 'latch', 0.35],
    ...Array.from({length: 6}, (_, i) => [T.sealed + 0.08 + i * 0.48, 'creak', 0.26] as Cue),
    [T.trapped + 0.05, 'press', 0.3],
    [T.trapped + 0.25, 'soft', 0.22],
    [T.b2 + 0.16, 'thump', 0.45],
    [T.n1 - 0.04, 'swish', 0.32],
    [T.n2 - 0.04, 'swish', 0.32],
    [T.n3 - 0.04, 'swish', 0.32],
    [T.strike1, 'pen', 0.55],
    [T.strike2, 'pen', 0.55],
    [T.green - 0.03, 'swish', 0.45],
    [T.green + 0.4, 'cloth', 0.5],
    [T.green + 0.82, 'soft', 0.3],
    [T.failed + 0.42, 'tear', 0.6],
    [T.b3 - 0.36, 'swish', 0.5],
    [T.b3 + 0.05, 'cloth', 0.35],
    [T.safely - 0.1, 'cloth', 0.5],
    [T.failedW - 0.05, 'metal', 0.4],
    [T.failedW + 0.42, 'creak', 0.4],
    [T.snap, 'metal', 0.55],
    [T.hit, 'thump', 0.95],
    ...WRAP_GRID.filter(([, y]) => y >= WRAP_BOTTOM - 60)
      .map(([x, y]) => T.hit + Math.abs(x - 490) * 0.00035 + (WRAP_BOTTOM - y) * 0.001)
      .sort((a, b) => a - b)
      .filter((_, i) => i % 2 === 0)
      .slice(0, 6)
      .map((at, i) => [at + 0.01, 'pop', 0.55 - i * 0.05] as Cue),
    [T.hit + 0.2, 'thump', 0.25],
    [T.hit + 0.75, 'switch', 0.3],
    [T.sa, 'stamp', 0.65],
    [T.dive - 0.02, 'pop', 0.5],
    [T.b5 + 0.45, 'press', 0.55],
    ...COLUMN.map((_, i) => [T.b5 + 0.95 + i * 0.13, 'pop', 0.42 - i * 0.03] as Cue),
  ];

  return (
    <div style={{position: 'absolute', inset: 0, background: th.bg, overflow: 'hidden'}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <Defs p={p} />
        <g transform={view(c, sx, sy)}>
          {scene === 'wall' || scene === 'end' ? <Wall t={t} T={T} p={p} /> : null}
          {scene === 'work' ? <Workshop t={t} T={T} p={p} /> : null}
          {scene === 'shop' || scene === 'green' ? <Shop t={t} T={T} p={p} /> : null}
          {scene === 'dock' ? <Dock t={t} T={T} p={p} /> : null}
        </g>
        {cover ? <Cover p={p} t={t} transform={cover} /> : null}
        {/* window light from the upper left, falling off to the corners */}
        <radialGradient id="light" cx="22%" cy="14%" r="105%">
          <stop offset="0%" style={{stopColor: p.paper, stopOpacity: 0.16}} />
          <stop offset="55%" style={{stopColor: p.paper, stopOpacity: 0}} />
          <stop offset="100%" style={{stopColor: p.ink, stopOpacity: 0.3}} />
        </radialGradient>
        <rect width={1080} height={1920} fill="url(#light)" />
      </svg>
      {closeOn > 0 ? (
        <div style={{position: 'absolute', left: 588, top: 300, width: 276, opacity: closeOn, transform: `scale(${1 + 0.06 * (1 - closeOn)})`, transformOrigin: '0 0'}}>
          <div data-tb="cta" style={{fontFamily: DIN, fontWeight: 700, fontSize: ctaSize, lineHeight: 0.86, letterSpacing: '0.01em', color: th.ink, textShadow: `4px 3px 0 ${mix(th.reveal ?? th.ink, 70)}`}}>
            {words.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
          {cta.sub ? <div style={{fontFamily: DIN, fontWeight: 700, fontSize: 38, lineHeight: 1.08, color: th.muted, marginTop: 22, opacity: k(t, [T.b5 + 0.7, T.b5 + 0.9], [0, 1])}}>{cta.sub}</div> : null}
          {cta.handle ? <div style={{fontFamily: DIN, fontWeight: 700, fontSize: 28, letterSpacing: '0.18em', color: th.reveal ?? th.ink, marginTop: 16, opacity: k(t, [T.b5 + 0.9, T.b5 + 1.1], [0, 1])}}>{cta.handle}</div> : null}
        </div>
      ) : null}
      <Grain opacity={0.12} />
      <Captions
        style={{...capStyle, fontFamily: DIN, fontWeight: 700, fontSize: 56, lineHeight: 1.04, letterSpacing: '0.01em', color: th.ink, background: th.bg, padding: '14px 24px 6px', boxShadow: `5px 7px 0 ${mix(th.ink, 22)}`, clipPath: 'polygon(0 4%, 3% 0, 97% 3%, 100% 0, 99% 96%, 96% 100%, 2% 97%, 0 100%)'}}
        enter={(e) => ({opacity: e, transform: `translateX(${(1 - e) * -14}px) rotate(-0.6deg)`})}
        hide={[[0, 1.02], [T.flop - 0.05, T.b1 + 0.35], [T.b1, T.sealed - 0.1], [T.b5, total + 1]]}
      />
      <Score src="music/c2-2026-w41-2.wav" shape={[[0, -3], [1, 0], [T.b1, 0], [T.b2, 1], [T.b3, 1], [T.hit - 0.6, 2], [T.hit + 0.2, 3], [T.b4, 2], [T.b5, 3], [total, 3]]} hush={[[T.hit - 0.45, T.hit + 0.05]]} />
      <Foley cues={cues} />
    </div>
  );
};
