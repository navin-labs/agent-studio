// B1 "The plate": the Velcro story as a naturalist's engraved specimen plate. Same script, voice and scene times as c2-2026-w41-1.
// One world, one camera: open inside a single hook, pull back to the burr, tilt down from the Alps to the dog's coat, close a
// microscope on one burr, watch the hooks catch. The last shot pulls back and reveals every scene was a figure on one plate.
// Gold is C2's reveal colour: the year, the name, the catch.
import React from 'react';
import {AbsoluteFill, random} from 'remotion';
import {ensureFonts} from '../fonts';
import {MASK, THEMES} from '../themes';
import {Cue, drift, Grain, IN, INOUT, k, OUT, phrases, Sounds, SPRING, useT, Voice} from './kit';

const C = THEMES['archive-gold'];
const PAPER = C.ink; // the plate is paper; the channel's navy is the ink
const INK = C.bg;
const GOLD = C.reveal!;
const SOFT = C.muted;
const SERIF = 'Didot, "Bodoni 72", serif';

const S = [0, 7.27, 13.13, 18.2, 24.67, 28.23, 30.23]; // scene starts (live render), last = end
const LINES = [
  '1941. Swiss engineer de Mestral walks his dog in the Alps. They return covered in sticky burrs.',
  'Most people just brush the burrs off and forget them. He put one under a microscope instead.',
  "Thousands of tiny hooks grabbing loops. Nature's fastener, perfected over ages.",
  'Before Velcro, you fumbled with buttons and stuck zips daily. After de Mestral, you just press and pull.',
  'Fourteen years of work. Then the world could stick and unstick.',
  'Follow for more backstories.',
];
const VO = [6.906, 5.516, 4.727, 6.121, 3.204, 1.307];

// Foley only where an object on screen makes it. Silence everywhere else.
const CUES: Cue[] = [
  [0.05, 'page', 0.25],
  ...[5.55, 5.8, 6.05, 6.3, 6.55].map((a, i): Cue => [a, i % 2 ? 'soft' : 'land', 0.35]),
  [8.5, 'cloth', 0.7],
  [10.45, 'latch', 0.45],
  [14.95, 'catch', 0.75],
  [15.07, 'catch', 0.25],
  [18.75, 'soft', 0.2],
  [19.35, 'soft', 0.2],
  [19.95, 'pop', 0.45],
  [23.45, 'press', 0.8],
  [24.15, 'rip', 0.55],
  [24.9, 'flip', 0.5],
  [25.45, 'flip', 0.4],
  [26.0, 'flip', 0.5],
  [27.3, 'press', 0.4],
  [27.8, 'rip', 0.35],
  [28.3, 'page', 0.35],
];

// ---------- drawing ----------
type P = [number, number];
const hookPath = ([bx, by]: P, [tx, ty]: P, h: number, side = 1) => {
  const L = Math.hypot(tx - bx, ty - by);
  const [dx, dy] = [(tx - bx) / L, (ty - by) / L];
  const [px, py] = [-dy * side, dx * side];
  return `M${bx},${by} L${tx},${ty} Q${tx + dx * h * 0.6 + px * h * 1.1},${ty + dy * h * 0.6 + py * h * 1.1} ${tx + px * h * 0.9 - dx * h * 0.8},${ty + py * h * 0.9 - dy * h * 0.8}`;
};

const SPINES = Array.from({length: 96}, (_, i) => {
  const a = -Math.PI / 2 + (i / 96) * Math.PI * 2 + (i ? (random(`a${i}`) - 0.5) * 0.08 : 0);
  return {a, len: i ? 0.72 + random(`l${i}`) * 0.3 : 1, side: random(`s${i}`) > 0.5 ? 1 : -1};
});

const Burr: React.FC<{x: number; y: number; r: number; spin?: number; w?: number}> = ({x, y, r, spin = 0, w = 3.2}) => (
  <g transform={`translate(${x},${y}) rotate(${spin})`}>
    {SPINES.map(({a, len, side}, i) => (
      <path
        key={i}
        d={hookPath([Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2], [Math.cos(a) * r * len, Math.sin(a) * r * len], r * 0.075, side)}
        fill="none"
        stroke={INK}
        strokeWidth={w * (0.7 + (i % 3) * 0.2)}
        opacity={i % 4 === 0 ? 0.55 : 1}
        strokeLinecap="round"
      />
    ))}
    <circle r={r * 0.3} fill={INK} />
  </g>
);

// Engraved line: a printed plate's lines are never perfectly clean. A fixed displacement (no boil) reads as ink on paper.
const InkDefs: React.FC = () => (
  <defs>
    <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency={0.035} numOctaves={2} seed={4} />
      <feDisplacementMap in="SourceGraphic" scale={4} />
    </filter>
  </defs>
);

// Engraved mountains: a jagged alpine ridge. Every face that falls away from the light (left) is hatched; lit faces stay paper.
// A far range sits behind in thinner, lighter lines (an engraver's atmosphere). The burin wipes in left to right.
const NEAR: P[] = [[-10, 1180], [40, 1090], [90, 1120], [170, 990], [215, 1030], [290, 900], [330, 935], [395, 830], [440, 905], [480, 880], [545, 1000], [600, 960], [650, 1040], [720, 950], [770, 985], [850, 860], [900, 915], [950, 890], [1010, 980], [1090, 940]];
const FAR: P[] = [[-10, 1000], [80, 930], [150, 960], [240, 860], [300, 900], [380, 800], [430, 850], [520, 760], [590, 860], [660, 820], [730, 900], [820, 790], [880, 840], [960, 770], [1090, 880]];
const BASE = 1180;
const shade = (r: P[]) =>
  r.slice(1).flatMap(([x2, y2], i) => {
    const [x1, y1] = r[i];
    return y2 > y1 ? [`M${x1},${y1} L${x2},${y2} L${x2 + (x2 - x1) * 0.1},${BASE} L${x1 + (x2 - x1) * 0.45},${BASE} Z`] : [];
  });
const Range: React.FC<{id: string; r: P[]; gap: number; w: number; o: number}> = ({id, r, gap, w, o}) => (
  <g opacity={o}>
    <clipPath id={id}>
      {shade(r).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </clipPath>
    <path d={`M${r.map((p) => p.join(',')).join(' L')} L1090,${BASE} L-10,${BASE} Z`} fill={PAPER} />
    <g clipPath={`url(#${id})`}>
      {Array.from({length: Math.ceil(500 / gap)}, (_, j) => (
        <line key={j} x1={-10} y1={720 + j * gap} x2={1090} y2={720 + j * gap - 40} stroke={INK} strokeWidth={w} />
      ))}
    </g>
    <path d={`M${r.map((p) => p.join(',')).join(' L')}`} fill="none" stroke={INK} strokeWidth={w * 1.8} strokeLinejoin="round" />
  </g>
);
const Alps: React.FC<{draw: number}> = ({draw}) => (
  <g filter="url(#ink)">
    <clipPath id="burin">
      <rect x={-10} y={0} width={1100 * draw} height={1920} />
    </clipPath>
    <g clipPath="url(#burin)">
      <Range id="far" r={FAR} gap={11} w={1.3} o={0.55} />
      <Range id="near" r={NEAR} gap={7} w={2} o={1} />
      <line x1={-10} y1={BASE} x2={1090} y2={BASE} stroke={INK} strokeWidth={3} />
    </g>
  </g>
);

// The dog's coat: tufts of fine strands combed one way (fur lies down along the body; grass stands up). The coat breathes.
const TUFTS = Array.from({length: 96}, (_, i) => ({
  x: -160 + (i % 6) * 220 + random(`tx${i}`) * 160,
  y: 560 + Math.floor(i / 6) * 92 + random(`ty${i}`) * 80,
  a: ((22 + (random(`ta${i}`) - 0.5) * 24) * Math.PI) / 180,
  len: 270 + random(`tl${i}`) * 150,
  c: (14 + random(`tc${i}`) * 34) * (random(`ts${i}`) > 0.3 ? 1 : -1),
}));
const Coat: React.FC<{t: number; bend: number; fade?: number}> = ({t, bend, fade = 1}) => (
  <g opacity={fade} filter="url(#ink)" transform={`translate(0,${Math.sin(t * 2.1) * 5})`}>
    {TUFTS.map(({x, y, a, len, c}, i) => {
      const [dx, dy] = [Math.cos(a), Math.sin(a)];
      const [nx, ny] = [-dy, dx];
      const lift = -bend * (0.5 + random(`lf${i}`) * 0.6);
      return Array.from({length: 12}, (_, j) => {
        const o = (j - 5.5) * 3.6;
        const l = len * (0.85 + ((j * 7) % 5) * 0.06);
        const [sx, sy] = [x + nx * o, y + ny * o];
        const [ex, ey] = [sx + dx * l + nx * lift * 0.6, sy + dy * l + ny * lift * 0.6];
        const k1 = [sx + dx * l * 0.33 + nx * (c + lift * 0.2), sy + dy * l * 0.33 + ny * (c + lift * 0.2)];
        const k2 = [sx + dx * l * 0.7 - nx * c * 0.6 + nx * lift, sy + dy * l * 0.7 - ny * c * 0.6 + ny * lift];
        return (
          <path
            key={`${i}-${j}`}
            d={`M${sx},${sy} C${k1[0]},${k1[1]} ${k2[0]},${k2[1]} ${ex},${ey}`}
            stroke={INK}
            strokeWidth={1.1 + ((i + j) % 3) * 0.4}
            fill="none"
            strokeLinecap="round"
            opacity={0.4 + ((i * 5 + j) % 6) * 0.1}
          />
        );
      });
    })}
  </g>
);

// Plate annotation: a leader line from the thing to its label; the label sits just above the line's end, set away from the frame edge.
// The plate's only text language.
const Note: React.FC<{t: number; at: number; from: P; to: P; children: string; color?: string}> = ({t, at, from, to, children, color = INK}) => {
  const d = k(t, [at, at + 0.4], [0, 1], OUT);
  const right = to[0] > 600; // label ends at the line on the right half, starts there on the left half
  return t < at ? null : (
    <>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <circle cx={from[0]} cy={from[1]} r={6} fill={color} opacity={d} />
        <line x1={from[0]} y1={from[1]} x2={from[0] + (to[0] - from[0]) * d} y2={from[1] + (to[1] - from[1]) * d} stroke={color} strokeWidth={2} />
      </svg>
      <div
        style={{position: 'absolute', top: to[1] - 52, left: right ? undefined : to[0], right: right ? 1080 - to[0] : undefined, fontFamily: SERIF, fontStyle: 'italic', fontSize: 38, color, whiteSpace: 'pre', opacity: k(t, [at + 0.25, at + 0.55], [0, 1])}}
      >
        {children}
      </div>
    </>
  );
};

// ---------- scenes ----------
// 0-4.6: inside one hook -> the burr -> the Alps; then the camera tilts down to the coat
const Opening: React.FC<{t: number}> = ({t}) => {
  const p = k(t, [0, 2.4], [0, 1], OUT);
  const s = 9 * Math.pow(1 / 9, p); // geometric pull-back: constant perceived speed
  const fy = 740 + 270 * p;
  const shrink = k(t, [2.5, 3.5], [1, 0.16], INOUT);
  const ride = k(t, [2.6, 4.2], [0, 1], INOUT);
  const draw = k(t, [2.5, 3.9], [0, 1], (v) => v);
  const yearSize = k(t, [2.5, 3.3], [330, 130], INOUT);
  const yearY = k(t, [2.5, 3.3], [300, 170], INOUT);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: yearY, width: 1080, textAlign: 'center', fontFamily: SERIF, fontSize: yearSize, color: GOLD, lineHeight: 1, opacity: k(t, [0, 0.4], [0.35, 1]), translate: `0 ${k(t, [0, 0.7], [60, 0])}px`}}>
        1941
      </div>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <InkDefs />
        <Alps draw={draw} />
        <g transform={`translate(540,${760 + 250 * p}) scale(${s}) translate(${-540},${-fy})`}>
          <g transform={`translate(${ride * 380},${ride * -60 + Math.abs(Math.sin(ride * Math.PI * 3)) * -40 * ride})`}>
            <g transform={`translate(540,1010) scale(${shrink}) translate(-540,-1010)`}>
              <Burr x={540} y={1010} r={270} spin={t * 8 + ride * 300} w={4} />
            </g>
          </g>
        </g>
      </svg>
      {t < 2.5 ? <Note t={t} at={1.1} from={[540, 1290]} to={[560, 1420]}>{'fig. 1  the burdock burr'}</Note> : null}
      <Note t={t} at={3.3} from={[395, 840]} to={[140, 700]}>{'the Alps, Switzerland'}</Note>
    </AbsoluteFill>
  );
};

// 4.0-13.13: burrs land in the coat, get brushed off, one goes under the lens
const LAND = [5.55, 5.8, 6.05, 6.3, 6.55];
const SPOTS: P[] = [[250, 1000], [700, 930], [470, 1180], [860, 1130], [160, 1280]];
const CoatScene: React.FC<{t: number}> = ({t}) => {
  const brush = k(t, [8.5, 8.95], [0, 1], IN);
  const bend = k(t, [8.45, 8.7], [0, 160], OUT) * k(t, [8.7, 9.6], [1, 0], SPRING);
  const dark = k(t, [10.6, 11.4], [0, 1], INOUT);
  const lensR = k(t, [10.45, 11.2], [1400, 430], INOUT);
  const zoom = k(t, [11.8, 13.13], [1, 2.4], INOUT);
  const keep = 2; // the one that stays
  const [kx, ky] = SPOTS[keep];
  const f = k(t, [11.8, 13.13], [0, 1], INOUT);
  const cam = `translate(540,960) scale(${zoom}) translate(${-(540 + (kx - 540) * f)},${-(960 + (ky - 960) * f)})`;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <InkDefs />
        <g transform={cam}>
          <Coat t={t} bend={bend} fade={1 - dark * 0.8} />
          {SPOTS.map(([x, y], i) => {
            const d = k(t, [LAND[i] - 0.3, LAND[i]], [-700, 0], IN);
            const settle = Math.sin(k(t, [LAND[i], LAND[i] + 0.35], [0, Math.PI], (v) => v)) * -14;
            const gone = i === keep ? 0 : brush;
            const smear = 1 + Math.sin(gone * Math.PI) * 1.4; // stretched along the throw at full speed, round again as it leaves
            const ang = (i % 2 ? -1 : 1) * 12;
            return t > LAND[i] - 0.3 ? (
              <g key={i} transform={`translate(${gone * (1400 + i * 120)},${gone * -260 * (i % 2 ? 1 : -1)})`}>
                <g transform={`translate(${x},${y + d + settle}) rotate(${ang}) scale(${smear},${1 / Math.sqrt(smear)}) rotate(${-ang}) translate(${-x},${-(y + d + settle)})`}>
                  <Burr x={x} y={y + d + settle} r={95} spin={i * 40 + gone * 200} w={3.4} />
                </g>
              </g>
            ) : null;
          })}
        </g>
        {/* the microscope: the world outside the lens goes dark */}
        <defs>
          <mask id={`lens${Math.round(lensR)}`}>
            <rect width={1080} height={1920} fill={MASK.show} />
            <circle cx={540} cy={960} r={lensR} fill={MASK.hide} />
          </mask>
        </defs>
        <rect width={1080} height={1920} fill={INK} opacity={dark} mask={`url(#lens${Math.round(lensR)})`} />
        {t > 10.45 ? (
          <g opacity={k(t, [10.45, 11.0], [0, 1])}>
            <circle cx={540} cy={960} r={lensR} fill="none" stroke={PAPER} strokeWidth={5} />
            {Array.from({length: 60}, (_, i) => {
              const a = (i / 60) * Math.PI * 2;
              const l = i % 5 ? 18 : 40;
              return <line key={i} x1={540 + Math.cos(a) * (lensR + 12)} y1={960 + Math.sin(a) * (lensR + 12)} x2={540 + Math.cos(a) * (lensR + 12 + l)} y2={960 + Math.sin(a) * (lensR + 12 + l)} stroke={PAPER} strokeWidth={2.5} />;
            })}
          </g>
        ) : null}
      </svg>
      {t < 8.4 ? <Note t={t} at={6.75} from={[470, 1240]} to={[180, 1470]}>{'fig. 2  five burrs, one walk'}</Note> : null}
      {t > 12.0 ? (
        <div style={{position: 'absolute', top: 1470, width: 1080, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 120, color: PAPER, opacity: k(t, [12.1, 12.45], [0, 1]), translate: `0 ${k(t, [12.1, 12.6], [24, 0])}px`}}>
          instead.
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// 0-13.13 as one shot: the tilt down from the mountains to the coat is the cut
const Walk: React.FC<{t: number}> = ({t}) => {
  const tilt = k(t, [4.0, 4.75], [0, 1], INOUT);
  return (
    <AbsoluteFill>
      {tilt < 1 ? <AbsoluteFill style={{translate: `0 ${-1920 * tilt}px`}}><Opening t={t} /></AbsoluteFill> : null}
      {tilt > 0 ? <AbsoluteFill style={{translate: `0 ${1920 * (1 - tilt)}px`}}><CoatScene t={t} /></AbsoluteFill> : null}
    </AbsoluteFill>
  );
};

// 13.13-18.2: inside the lens, hooks find loops. The catch is the reveal.
const CATCH = 14.95;
const Lens: React.FC<{t: number}> = ({t}) => {
  const down = k(t, [13.2, CATCH - 0.25], [-260, -90], INOUT) + k(t, [CATCH - 0.25, CATCH], [0, 90], IN);
  const tug = t > 15.8 ? Math.sin((t - 15.8) * 9) * 38 * Math.exp(-(t - 15.8) * 1.6) - k(t, [15.8, 16.0], [0, 30]) : 0;
  const xs = [290, 390, 490, 590, 690, 790];
  const caught = t >= CATCH;
  const flash = caught ? k(t, [CATCH, CATCH + 0.6], [1, 0], OUT) : 0;
  const peak = 960 + (caught ? tug : 0); // loops stretch with the hooks once caught
  return (
    <AbsoluteFill style={{backgroundColor: INK}}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <InkDefs />
        <defs>
          <clipPath id="lc">
            <circle cx={540} cy={960} r={430} />
          </clipPath>
        </defs>
        <circle cx={540} cy={960} r={430} fill={PAPER} />
        <g clipPath="url(#lc)">
          <g filter="url(#ink)">
            <g transform={`translate(0,${down + tug})`}>
              <rect x={0} y={420} width={1080} height={160} fill={INK} />
              {xs.map((x, i) => (
                <path key={`h${i}`} d={`M${x - 40},560 L${x - 40},1105 Q${x - 40},1150 ${x - 8},1142 Q${x + 20},1132 ${x + 12},1092`} fill="none" stroke={INK} strokeWidth={15} strokeLinecap="round" />
              ))}
            </g>
            {xs.map((x, i) => (
              <path key={`l${i}`} d={`M${x - 34},1420 C${x - 62},${peak} ${x + 62},${peak} ${x + 34},1420`} fill="none" stroke={SOFT} strokeWidth={13} strokeLinecap="round" />
            ))}
            <rect x={0} y={1330} width={1080} height={200} fill={SOFT} />
          </g>
          {flash > 0 ? xs.map((x, i) => <circle key={`f${i}`} cx={x} cy={1095 + tug * 0.75} r={24 + (1 - flash) * 70} fill="none" stroke={GOLD} strokeWidth={9 * flash} opacity={flash} />) : null}
          {caught ? xs.map((x, i) => <circle key={`d${i}`} cx={x + 4} cy={1100 + tug * 0.75} r={10} fill={GOLD} />) : null}
        </g>
        <circle cx={540} cy={960} r={430} fill="none" stroke={PAPER} strokeWidth={5} />
      </svg>
      <Note t={t} at={13.5} from={[250, 720]} to={[130, 480]} color={PAPER}>{'hook'}</Note>
      <Note t={t} at={14.1} from={[830, 1300]} to={[950, 1460]} color={PAPER}>{'loop'}</Note>
      {t > 16.3 ? (
        <div style={{position: 'absolute', top: 1490, width: 1080, textAlign: 'center', fontFamily: SERIF, fontSize: 92, lineHeight: 1.05, color: PAPER, opacity: k(t, [16.3, 16.7], [0, 1])}}>
          Nature&rsquo;s <span style={{color: GOLD, fontStyle: 'italic'}}>fastener</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// 18.2-24.67: the button misses its hole twice, gives up; the zip jams; then press and pull
const Button: React.FC<{t: number}> = ({t}) => {
  // two tries at the slit: lean in (anticipation), bump, fall back; the third time it flies off
  const tries = [18.55, 19.15].map((a) => Math.sin(k(t, [a, a + 0.5], [0, Math.PI], INOUT)) * 120).reduce((a, b) => a + b, 0);
  const pop = k(t, [19.95, 20.5], [0, 1], IN);
  const lean = k(t, [19.6, 19.95], [0, 60], IN);
  return (
    <g filter="url(#ink)">
      <rect x={780} y={590} width={18} height={330} rx={9} fill={INK} opacity={1 - pop} />
      <g transform={`translate(${470 + tries + lean + pop * 300},${760 - pop * 900}) rotate(${tries * 0.1 + pop * 380})`}>
        <circle r={170} fill={PAPER} stroke={INK} strokeWidth={9} />
        <circle r={134} fill="none" stroke={INK} strokeWidth={3} />
        {Array.from({length: 26}, (_, i) => (
          <line key={i} x1={-150 + i * 12} y1={60} x2={-150 + i * 12 + 50} y2={150} stroke={INK} strokeWidth={2} opacity={0.5} />
        ))}
        {[[-42, -42], [42, -42], [-42, 42], [42, 42]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={18} fill={INK} />)}
        <path d="M-42,-42 L42,42 M42,-42 L-42,42" stroke={GOLD} strokeWidth={6} strokeLinecap="round" />
      </g>
    </g>
  );
};
const Zip: React.FC<{t: number}> = ({t}) => {
  const jam = t > 20.8 ? Math.abs(Math.sin((t - 20.8) * 16)) * 26 * k(t, [20.8, 21.6], [1, 0.3]) : 0;
  const up = k(t, [20.4, 20.8], [0, 1], OUT);
  const sy = 1250 - up * 260 + jam;
  return (
    <g opacity={k(t, [20.3, 20.45], [0, 1])} filter="url(#ink)">
      {Array.from({length: 22}, (_, i) => {
        const y = 1520 - i * 34;
        const open = y < sy ? Math.min(90, (sy - y) * 0.35) : 0;
        return (
          <g key={i}>
            <rect x={540 - 44 - open} y={y} width={40} height={16} rx={4} fill={INK} />
            <rect x={540 + 4 + open} y={y + 17} width={40} height={16} rx={4} fill={INK} />
          </g>
        );
      })}
      <rect x={490} y={sy - 30} width={100} height={70} rx={14} fill={PAPER} stroke={INK} strokeWidth={6} />
    </g>
  );
};
// fabric tape: hatched, with a shadow that darkens as the top strip comes close (depth from contact, not from a gradient)
const Strips: React.FC<{t: number; meet: number; part: number; y?: number}> = ({t, meet, part, y = 960}) => {
  const gap = k(t, [meet - 0.18, meet], [260, 0], IN) + k(t, [part, part + 0.3], [0, 1300], IN);
  const tilt = k(t, [part, part + 0.35], [0, -8], OUT);
  const shadow = Math.max(0, 1 - gap / 260);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute'}}>
      <InkDefs />
      <g transform={`translate(0,${y + 10})`} filter="url(#ink)">
        <rect x={60} y={0} width={960} height={110} fill={PAPER} stroke={INK} strokeWidth={3} />
        {Array.from({length: 28}, (_, i) => (
          <path key={i} d={`M${90 + i * 34},10 c-14,-34 26,-34 12,0`} fill="none" stroke={INK} strokeWidth={3} opacity={0.7} />
        ))}
        {Array.from({length: 60}, (_, i) => (
          <line key={`h${i}`} x1={62 + i * 16} y1={30} x2={62 + i * 16 + 30} y2={108} stroke={INK} strokeWidth={1.6} opacity={0.35} />
        ))}
        <rect x={60} y={0} width={960} height={30} fill={INK} opacity={0.35 * shadow} />
      </g>
      <g transform={`translate(0,${y - 120 - gap}) rotate(${tilt},540,60)`} filter="url(#ink)">
        <rect x={60} y={0} width={960} height={110} fill={INK} />
        {Array.from({length: 28}, (_, i) => (
          <path key={i} d={hookPath([92 + i * 34, 110], [92 + i * 34, 128], 9)} fill="none" stroke={INK} strokeWidth={4} />
        ))}
      </g>
    </svg>
  );
};
const Before: React.FC<{t: number}> = ({t}) => {
  const after = t >= 21.65;
  return (
    <AbsoluteFill>
      {!after ? (
        <>
          <svg width={1080} height={1920} style={{position: 'absolute'}}>
            <InkDefs />
            <Button t={t} />
            {t > 20.3 ? <Zip t={t} /> : null}
          </svg>
          {t < 19.95 ? <Note t={t} at={18.5} from={[789, 600]} to={[960, 470]}>{'fig. 4  the buttonhole'}</Note> : null}
          {t > 20.4 ? <Note t={t} at={20.5} from={[590, 1100]} to={[900, 1220]}>{'fig. 5  the zip'}</Note> : null}
        </>
      ) : (
        <>
          <div style={{position: 'absolute', top: 260, width: 1080, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 60, color: SOFT, opacity: k(t, [21.7, 22.0], [0, 1])}}>after</div>
          <div style={{position: 'absolute', top: 340, width: 1080, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 140, color: GOLD, opacity: k(t, [21.75, 22.1], [0, 1]), translate: `0 ${k(t, [21.75, 22.2], [30, 0])}px`}}>
            de Mestral
          </div>
          <Strips t={t} meet={23.45} part={24.15} />
          <div style={{position: 'absolute', top: 1180, width: 1080, textAlign: 'center', fontFamily: SERIF, fontSize: 170, letterSpacing: 6, color: INK, lineHeight: 1}}>
            <span style={{opacity: k(t, [23.4, 23.5], [0, 1]), display: 'inline-block', scale: `${k(t, [23.4, 23.7], [1.25, 1], SPRING)}`}}>PRESS</span>
            <br />
            <span style={{opacity: k(t, [24.1, 24.2], [0, 1]), display: 'inline-block', translate: `0 ${k(t, [24.1, 24.5], [-40, 0], OUT)}px`}}>PULL</span>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// 24.67-28.23: fourteen years turn like pages, then the world sticks and unsticks
const Years: React.FC<{t: number}> = ({t}) => {
  const n = Math.round(k(t, [24.85, 26.05], [41, 55], (v) => v));
  const gold = t > 26.05;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 360, width: 1080, textAlign: 'center', fontFamily: SERIF, fontSize: 300, lineHeight: 1, color: gold ? GOLD : INK, fontVariantNumeric: 'tabular-nums'}}>19{n}</div>
      <div style={{position: 'absolute', top: 700, width: 1080, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 44, color: INK, opacity: k(t, [26.1, 26.4], [0, 1])}}>fourteen years; patented</div>
      <Strips t={t} meet={27.3} part={27.8} y={1080} />
    </AbsoluteFill>
  );
};

// 28.23-30.23: the camera pulls back. Every scene was a figure on one plate.
const FIGS: [React.FC<{t: number}>, number, string][] = [
  [Walk, 2.6, 'fig. 1'],
  [Walk, 7.0, 'fig. 2'],
  [Walk, 12.4, 'fig. 3'],
  [Lens, 16.6, 'fig. 4'],
  [Before, 23.6, 'fig. 5'],
  [Years, 28.2, 'fig. 6'],
];
const CW = 293;
const CH = 521;
const cell = (i: number): P => [70 + (i % 3) * (CW + 30), 520 + Math.floor(i / 3) * (CH + 40)];
const Plate: React.FC<{t: number}> = ({t}) => {
  const p = k(t, [28.3, 29.4], [0, 1], INOUT);
  const [lx, ly] = cell(5);
  const z = 1080 / CW;
  const s = z + (1 - z) * p; // from fig. 6 filling the frame to the whole plate
  const ox = -lx * s * (1 - p);
  const oy = -ly * s * (1 - p);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${ox}px, ${oy}px) scale(${s})`}}>
        {FIGS.map(([Fig, ft, label], i) => {
          const [x, y] = cell(i);
          return (
            <div key={i} style={{position: 'absolute', left: x, top: y, width: CW, height: CH + 40}}>
              <div style={{position: 'absolute', width: 1080, height: 1920, transformOrigin: '0 0', scale: `${CW / 1080}`, overflow: 'hidden', backgroundColor: PAPER, outline: `${3 * z}px solid ${INK}`}}>
                <Fig t={ft} />
              </div>
              <div style={{position: 'absolute', top: CH + 6, fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, color: INK}}>{label}</div>
            </div>
          );
        })}
      </AbsoluteFill>
      <div style={{position: 'absolute', top: 250, width: 1080, textAlign: 'center', fontFamily: SERIF, fontSize: 110, color: INK, opacity: k(t, [28.9, 29.3], [0, 1])}}>
        Velcro<span style={{color: GOLD, fontStyle: 'italic'}}> 1941&ndash;1955</span>
      </div>
      <div style={{position: 'absolute', top: 1660, width: 1080, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 44, color: INK, opacity: k(t, [29.2, 29.5], [0, 1])}}>
        follow @backstory.minute for more
      </div>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{t: number; dark: boolean}> = ({t, dark}) => {
  const all = LINES.slice(0, 5).flatMap((l, i) => phrases(l, S[i], VO[i]));
  const cur = all.find((p) => t >= p.from && t < p.to + 0.15);
  if (!cur) return null;
  return (
    <div style={{position: 'absolute', top: 1670, width: 1080, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 54, color: dark ? PAPER : INK, textShadow: `0 0 18px ${dark ? INK : PAPER}, 0 0 8px ${dark ? INK : PAPER}`, opacity: k(t, [cur.from, cur.from + 0.08], [0.2, 1])}}>
      {cur.text}
    </div>
  );
};

export const VelcroPoc: React.FC = () => {
  ensureFonts();
  const t = useT();
  const dark = t > 11.0 && t < 18.2;
  return (
    <AbsoluteFill style={{backgroundColor: PAPER}}>
      <AbsoluteFill style={{transform: drift(t, 4)}}>
        {t < S[2] ? <Walk t={t} /> : null}
        {t >= S[2] && t < S[3] ? <Lens t={t} /> : null}
        {t >= S[3] && t < S[4] ? <Before t={t} /> : null}
        {t >= S[4] && t < S[5] ? <Years t={t} /> : null}
        {t >= S[5] ? <Plate t={t} /> : null}
      </AbsoluteFill>
      {/* paper under a desk lamp: edges a touch darker, and the grain of the sheet */}
      <AbsoluteFill style={{background: `radial-gradient(ellipse at 50% 40%, transparent 55%, color-mix(in srgb, ${SOFT} 35%, transparent))`}} />
      <Grain opacity={0.12} />
      <Captions t={t} dark={dark} />
      <Voice dir="vo/c2-2026-w41-1/instagram" starts={S.slice(0, 6)} />
      <Sounds music="poc/velcro/cinematic/music.wav" sfxDir="poc/sfx" cues={CUES} />
    </AbsoluteFill>
  );
};
