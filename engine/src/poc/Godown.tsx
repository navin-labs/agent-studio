// C1 "Godown at night": "stock should not lie" as an investigation by torchlight. Same script, voice and times as c1-2026-w41-1.
// The register says one thing; the torch counts another. You only ever see what the beam touches, so every count is slow,
// partial and doubtful. Automation is the moment the lights come on: nothing is hidden, and the register and the wall agree.
// One world (desk + register on the left, the rice stack on the right), one camera that pans, pushes and pulls back.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ensureFonts} from '../fonts';
import {Chiku, DitherDefs} from '../host/mascots';
import {THEMES} from '../themes';
import {Cue, Grain, IN, INOUT, k, OUT, phrases, Sounds, useT, Voice} from './kit';

const C = THEMES['night-signal'];
const BG = C.bg;
const WALL = C.surface;
const INK = C.ink;
const DIM = C.muted;
const RULE = C.rule;
const LIME = C.ok;
const TYPE = '"American Typewriter", "Courier New", monospace';
const MONO = '"JetBrains Mono", monospace';

const S = [0, 3.5, 9.57, 16.97, 24.53, 29.17, 33.93, 39.5, 42.0];
const LINES = [
  'Your stock should not lie to you. Chiku here. Let me show you the gap.',
  'The software says forty bags of rice today. The godown holds thirty-two. Eight bags vanished silently.',
  'A customer asks for ten bags urgently. You check the software, it says yes. You check the godown, it says no. Embarrassing.',
  'Someone types fifty instead of fifteen. Someone forgets to update after a sale. Wrong units, damaged goods. The stock lies more.',
  'Sale happens, stock drops, reorder alert fires. On its own, every time.',
  'Stock alert on your phone: only five bags of rice left. Order more today itself.',
  'Stock stops lying to you now. What the software says is exactly what your own godown holds today.',
];
const VO = [3.14, 5.708, 7.052, 7.216, 4.272, 4.405, 5.201];
const SALES = [25.0, 26.9, 27.9, 28.6];
const LIGHTS = 24.53;

const CUES: Cue[] = [
  [10.0, 'page', 0.4],
  [12.5, 'stamp', 0.8],
  [14.4, 'thump', 0.85],
  [17.25, 'wood', 0.22],
  [17.4, 'wood', 0.22],
  [18.0, 'wood', 0.35],
  [19.5, 'wood', 0.2],
  [21.3, 'wood', 0.2],
  [21.6, 'wood', 0.2],
  [LIGHTS, 'switch', 0.7],
  ...SALES.map((a): Cue => [a + 0.2, 'sack', 0.3]),
  ...[29.3, 29.37, 29.44, 29.65, 29.72, 29.79].map((a): Cue => [a, 'wood', 0.28]), // the phone buzzing on the desk
];

// ---------- the world (2400 wide; the screen sees part of it) ----------
const FLOOR = 1500;
const SW = 118;
const SH = 92;
const slot = (i: number): [number, number] => [1180 + (i % 8) * SW + SW / 2, FLOOR - SH / 2 - Math.floor(i / 8) * SH];
const MISSING = [35, 36, 37, 38, 39, 30, 31, 23]; // eight gone, top right: the gap
const SOLD = [34, 33, 32, 29]; // the four the automation sees leave
const PRESENT = Array.from({length: 40}, (_, i) => i).filter((i) => !MISSING.includes(i));
// the torch counts in reading order along the rows, bottom up, like a person would
const COUNT_ORDER = [...PRESENT].sort((a, b) => Math.floor(a / 8) - Math.floor(b / 8) || (Math.floor(a / 8) % 2 ? b - a : a - b));

const Sack: React.FC<{x: number; y: number; o?: number}> = ({x, y, o = 1}) => (
  <g transform={`translate(${x},${y})`} opacity={o}>
    <path d={`M-54,-30 Q0,-52 54,-30 Q64,0 54,34 Q0,48 -54,34 Q-64,0 -54,-30 Z`} fill={DIM} stroke={BG} strokeWidth={4} />
    <path d="M-44,-18 Q0,-34 44,-18" fill="none" stroke={BG} strokeWidth={3} strokeDasharray="6 7" opacity={0.6} />
    <ellipse cx={-6} cy={-24} rx={34} ry={8} fill={INK} opacity={0.18} />
  </g>
);

const Ledger: React.FC<{t: number}> = ({t}) => {
  const typo = t < 17.25 ? '' : t < 17.4 ? '1' : t < 18.0 ? '15' : '50';
  const total = Math.round(40 + k(t, [22.6, 24.0], [0, 6], (v) => v));
  const synced = t >= LIGHTS;
  const left = 32 - SALES.filter((a) => t >= a + 0.2).length;
  const rows: [string, string, number, boolean?][] = [
    ['Opening stock', '40', 0],
    ['Received', typo, 17.25, true],
    ['Sale', '—', 19.5],
    ['Unit', 'kg as bags', 21.3],
    ['Damaged', 'counted', 21.6],
  ];
  return (
    <g transform="translate(140,540) rotate(-1.5)">
      <rect width={760} height={880} fill={INK} />
      {Array.from({length: 11}, (_, i) => <line key={i} x1={40} y1={190 + i * 62} x2={720} y2={190 + i * 62} stroke={DIM} strokeWidth={2} opacity={0.35} />)}
      <line x1={530} y1={120} x2={530} y2={860} stroke={DIM} strokeWidth={2} opacity={0.35} />
      <text x={40} y={90} fontFamily={TYPE} fontSize={36} fill={BG}>GODOWN REGISTER · RICE</text>
      {rows.map(([label, val, at, typed], i) =>
        t >= at ? (
          <g key={i} opacity={synced && i > 0 ? 0.35 : 1}>
            <text x={40} y={240 + i * 124} fontFamily={TYPE} fontSize={46} fill={BG}>{label}</text>
            <text x={560} y={240 + i * 124} fontFamily={TYPE} fontSize={i === 0 ? 96 : typed ? 72 : 34} fill={BG}>{val}</text>
            {synced && i > 0 ? <line x1={30} y1={226 + i * 124} x2={730} y2={226 + i * 124} stroke={BG} strokeWidth={4} /> : null}
          </g>
        ) : null,
      )}
      {t > 22.6 && !synced ? (
        <text x={40} y={850} fontFamily={TYPE} fontSize={56} fill={BG}>
          Total <tspan x={560} fontSize={84}>{total}</tspan>
        </text>
      ) : null}
      {synced ? (
        <g opacity={k(t, [LIGHTS + 0.4, LIGHTS + 0.8], [0, 1])}>
          <rect x={540} y={760} width={190} height={110} rx={55} fill={LIME} />
          <text x={40} y={840} fontFamily={TYPE} fontSize={46} fill={BG}>Synced, live</text>
          <text x={635} y={848} textAnchor="middle" fontFamily={TYPE} fontSize={84} fill={BG}>{left}</text>
        </g>
      ) : null}
    </g>
  );
};

const Stack: React.FC<{t: number}> = ({t}) => {
  const counted = k(t, [3.7, 7.0], [0, 32], (v) => v);
  return (
    <g>
      {PRESENT.map((i) => {
        const [x, y] = slot(i);
        const s = SOLD.indexOf(i);
        const lift = s >= 0 ? k(t, [SALES[s], SALES[s] + 0.6], [0, -2400], IN) : 0;
        return lift > -2400 ? <Sack key={i} x={x} y={y + lift} /> : null;
      })}
      {/* chalk outlines where the register says rice should be */}
      {MISSING.map((i, j) => {
        const [x, y] = slot(i);
        const at = 7.45 + j * 0.2;
        return t > at ? (
          <path key={i} d="M-54,-30 Q0,-52 54,-30 Q64,0 54,34 Q0,48 -54,34 Q-64,0 -54,-30 Z" transform={`translate(${x},${y})`} fill="none" stroke={INK} strokeWidth={3} strokeDasharray="10 9" opacity={k(t, [at, at + 0.3], [0, 0.8])} />
        ) : null;
      })}
      {counted > 0 && t < 9.6 ? (
        <text x={1180} y={1000} fontFamily={TYPE} fontSize={110} fill={INK}>
          {Math.min(32, Math.floor(counted) + 1)}
          <tspan fontSize={44} fill={DIM}>{'  counted by torch'}</tspan>
        </text>
      ) : null}
      {t > 8.4 && t < 9.6 ? (
        <text x={1180} y={880} fontFamily={TYPE} fontSize={56} fill={DIM} opacity={k(t, [8.4, 8.7], [0, 1])}>
          register 40 · shelf 32 · gone 8
        </text>
      ) : null}
    </g>
  );
};

const Chit: React.FC<{t: number}> = ({t}) => {
  if (t < 9.9 || t > 17.2) return null;
  const x = k(t, [9.9, 10.3], [-500, 400], OUT);
  const stamp = (at: number, word: string, dx: number, rot: number) =>
    t >= at ? (
      <g transform={`translate(${dx},150) rotate(${rot}) scale(${k(t, [at, at + 0.1], [1.5, 1], IN)})`} opacity={k(t, [at, at + 0.05], [0, 0.9])}>
        <rect x={-120} y={-58} width={240} height={116} rx={10} fill="none" stroke={BG} strokeWidth={8} />
        <text textAnchor="middle" y={30} fontFamily={TYPE} fontWeight={700} fontSize={84} fill={BG}>{word}</text>
      </g>
    ) : null;
  return (
    <g transform={`translate(${x},1060) rotate(4)`}>
      <rect width={520} height={300} fill={INK} />
      <text x={30} y={66} fontFamily={TYPE} fontSize={40} fill={BG}>ORDER · 10 bags rice</text>
      <text x={30} y={110} fontFamily={TYPE} fontSize={28} fill={BG}>urgent</text>
      {stamp(12.5, 'YES', 140, -8)}
      {stamp(14.4, 'NO', 380, 6)}
    </g>
  );
};

const Phone: React.FC<{t: number}> = ({t}) => {
  const buzz = [29.3, 29.65].some((a) => t > a && t < a + 0.2) ? Math.sin(t * 160) * 5 : 0;
  const lit = t > 29.3;
  return (
    <g transform={`translate(${985 + buzz},1340)`}>
      <rect x={-80} y={-150} width={160} height={300} rx={26} fill={BG} stroke={DIM} strokeWidth={5} />
      {lit ? (
        <g opacity={k(t, [29.3, 29.45], [0, 1])}>
          <rect x={-66} y={-136} width={132} height={272} rx={16} fill={WALL} />
          <text textAnchor="middle" y={-60} fontFamily={MONO} fontWeight={700} fontSize={18} fill={DIM}>RICE · STOCK</text>
          <text textAnchor="middle" y={40} fontFamily={MONO} fontWeight={700} fontSize={110} fill={LIME}>5</text>
          <text textAnchor="middle" y={90} fontFamily={MONO} fontWeight={700} fontSize={17} fill={INK}>BAGS LEFT</text>
          <text textAnchor="middle" y={118} fontFamily={MONO} fontWeight={700} fontSize={15} fill={LIME}>ORDER TODAY</text>
        </g>
      ) : null}
    </g>
  );
};

const Torch: React.FC = () => (
  <g transform="translate(330,1468) rotate(-4)">
    <rect x={0} y={-22} width={170} height={44} rx={12} fill={DIM} />
    <path d="M170,-22 L230,-40 L230,40 L170,22 Z" fill={DIM} />
    <rect x={60} y={-30} width={22} height={10} rx={3} fill={RULE} />
  </g>
);

const Tubes: React.FC<{on: number}> = ({on}) => (
  <g>
    {[200, 700, 1200, 1700, 2200].map((x) => (
      <g key={x}>
        <rect x={x - 160} y={130} width={320} height={22} rx={11} fill={on > 0 ? INK : RULE} opacity={0.35 + on * 0.65} />
        {on > 0 ? <ellipse cx={x} cy={600} rx={420} ry={560} fill={`url(#pool)`} opacity={on} /> : null}
      </g>
    ))}
  </g>
);

// the room: wall, floor, register on the desk, the stack, the wall display
const World: React.FC<{t: number; on: number}> = ({t, on}) => {
  const left = 32 - SALES.filter((a) => t >= a + 0.2).length;
  return (
    <svg width={2400} height={2400} style={{position: 'absolute', overflow: 'visible'}}>
      <DitherDefs />
      <defs>
        <radialGradient id="pool">
          <stop offset="0" stopColor={INK} stopOpacity={0.14} />
          <stop offset="1" stopColor={INK} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={-1400} y={-1400} width={5200} height={FLOOR + 1400} fill={WALL} />
      <rect x={-1400} y={FLOOR} width={5200} height={2400} fill={RULE} />
      <line x1={-1400} y1={FLOOR} x2={3800} y2={FLOOR} stroke={BG} strokeWidth={6} />
      {/* desk */}
      <rect x={60} y={1490} width={1000} height={36} fill={DIM} opacity={0.6} />
      <rect x={100} y={1526} width={30} height={400} fill={DIM} opacity={0.5} />
      <rect x={990} y={1526} width={30} height={400} fill={DIM} opacity={0.5} />
      <Tubes on={on} />
      <Ledger t={t} />
      <Stack t={t} />
      <Chit t={t} />
      <Phone t={t} />
      {t >= LIGHTS ? <Torch /> : null}
      {/* the wall display: it only exists once the system does */}
      <g opacity={k(t, [LIGHTS + 0.3, LIGHTS + 0.7], [0, 1])}>
        <rect x={1640} y={330} width={420} height={260} rx={18} fill={BG} stroke={RULE} strokeWidth={6} />
        <text x={1670} y={385} fontFamily={MONO} fontWeight={700} fontSize={30} fill={DIM}>RICE · BAGS</text>
        <text x={1850} y={545} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={150} fill={LIME}>{left}</text>
      </g>
      <g transform={`translate(1110,${FLOOR}) scale(0.3) translate(-540,-1420)`} opacity={t < 3.4 ? 1 : 0}>
        <Chiku mouth={t > 1.6 && t < 2.6 ? Math.abs(Math.sin(t * 18)) * 0.8 : 0} blink={t > 1.75 && t < 1.95 ? 1 : 0} tilt={-6} />
      </g>
    </svg>
  );
};

// ---------- camera and torch ----------
type Key = [number, number, number, number]; // time, x, y, zoom (world point at screen centre)
const CAM: Key[] = [
  [0, 560, 1000, 1],
  [1.2, 560, 1000, 1],
  [3.2, 1650, 1150, 1],
  [9.6, 1650, 1150, 1.08],
  [10.6, 1120, 1150, 0.72],
  [16.97, 1120, 1150, 0.76],
  [17.6, 520, 1000, 1.2],
  [24.4, 520, 1000, 1.25],
  [25.4, 1660, 1000, 0.85],
  [29.17, 1660, 1000, 0.88],
  [29.9, 985, 1300, 1.6],
  [33.93, 985, 1300, 1.66],
  [34.9, 1150, 1050, 0.55],
  [42, 1150, 1050, 0.57],
];
const at = (keys: Key[], t: number): [number, number, number] => {
  const i = Math.max(0, keys.findIndex((kk, j) => t >= kk[0] && (j === keys.length - 1 || t < keys[j + 1][0])));
  const a = keys[i];
  const b = keys[Math.min(keys.length - 1, i + 1)];
  const p = b[0] > a[0] ? INOUT(Math.min(1, (t - a[0]) / (b[0] - a[0]))) : 0;
  return [a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p, a[3] + (b[3] - a[3]) * p];
};
// the beam lags the story slightly: it is a hand, not a cursor
const BEAM: Key[] = [
  [0, 720, 770, 300],
  [0.3, 720, 770, 300],
  [1.9, 1110, 1300, 300],
  [2.7, 1830, 1100, 340],
  [3.6, 1830, 1100, 340],
  [7.2, 1600, 1220, 420],
  [8.0, 1780, 1180, 560],
  [9.6, 1780, 1180, 560],
  [10.4, 650, 1180, 440],
  [13.5, 650, 1180, 440],
  [14.1, 1700, 1250, 460],
  [14.35, 650, 1180, 440], // back to the order slip in time for the NO to land in the light
  [15.8, 650, 1180, 440],
  [16.5, 1450, 1720, 320],
  [16.97, 1450, 1720, 320],
  [17.4, 560, 960, 470],
  [24.2, 560, 960, 470],
];
const beamAt = (t: number): [number, number, number] => {
  if (t >= 3.7 && t < 7.0) {
    // counting: the beam steps from sack to sack in the order a person counts
    const u = k(t, [3.7, 7.0], [0, COUNT_ORDER.length - 1], (v) => v);
    const a = slot(COUNT_ORDER[Math.floor(u)]);
    const b = slot(COUNT_ORDER[Math.min(COUNT_ORDER.length - 1, Math.floor(u) + 1)]);
    const f = INOUT(u - Math.floor(u));
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 300];
  }
  return at(BEAM, t);
};
const power = (t: number) => {
  if (t >= 24.2) return 0; // the torch dies: a breath of total dark before the lights
  if (t > 23.4) return Math.floor(t * 30) % 5 < 2 ? 0.3 : 0.9; // the battery stutters as the lies pile up
  return t > 15.8 && t < 17.0 ? k(t, [15.8, 16.5], [1, 0.6]) : 1;
};
const lights = (t: number) => (t < LIGHTS ? 0 : t < 24.6 ? 0.5 : t < 24.68 ? 0 : t < 24.74 ? 0.7 : 1); // tubes stutter on

const Captions: React.FC<{t: number}> = ({t}) => {
  const all = LINES.flatMap((l, i) => phrases(l, S[i], VO[i]));
  const cur = all.find((p) => t >= p.from && t < p.to + 0.15);
  if (!cur) return null;
  return <div style={{position: 'absolute', top: 1660, width: 1080, textAlign: 'center', fontFamily: TYPE, fontSize: 50, color: INK, textShadow: `0 0 14px ${BG}, 0 0 6px ${BG}`}}>{cur.text}</div>;
};

export const GodownPoc: React.FC = () => {
  ensureFonts();
  const t = useT();
  const [cx, cy, z] = at(CAM, t);
  const [bx, by, br] = beamAt(t);
  const on = lights(t);
  const p = power(t);
  const sx = 540 + (bx - cx) * z;
  const sy = 960 + (by - cy) * z;
  const r = br * z * (0.85 + p * 0.15);
  const night = 0.965 * (1 - on);
  const truth = t >= S[6];
  const end = t >= S[7];
  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${540 - cx * z}px, ${960 - cy * z}px) scale(${z})`}}>
        <World t={t} on={on} />
      </AbsoluteFill>
      {/* the dark: everything the torch does not touch. Soft edge, brighter core, like a real beam */}
      {night > 0 ? (
        <AbsoluteFill
          style={{
            background:
              p > 0
                ? `radial-gradient(circle ${r}px at ${sx}px ${sy}px, color-mix(in srgb, ${BG} ${8 + (1 - p) * 50}%, transparent) 0%, color-mix(in srgb, ${BG} ${18 + (1 - p) * 50}%, transparent) 40%, color-mix(in srgb, ${BG} ${60 + (1 - p) * 25}%, transparent) 72%, color-mix(in srgb, ${BG} ${night * 100}%, transparent) 100%)`
                : `color-mix(in srgb, ${BG} 100%, transparent)`,
          }}
        />
      ) : null}
      {truth && !end ? (
        <div style={{position: 'absolute', top: 210, width: 1080, textAlign: 'center', fontFamily: TYPE, fontSize: 92, lineHeight: 1.1, color: INK, opacity: k(t, [35.0, 35.4], [0, 1])}}>
          Stock tells
          <br />
          the <span style={{color: LIME}}>truth.</span>
        </div>
      ) : null}
      {end ? (
        <AbsoluteFill style={{alignItems: 'center', backgroundColor: `color-mix(in srgb, ${BG} ${k(t, [39.5, 39.9], [0, 92])}%, transparent)`}}>
          <Img src={staticFile('brand/mark.png')} style={{position: 'absolute', top: 560, width: 180, height: 180, opacity: k(t, [39.6, 39.9], [0, 1])}} />
          <div style={{position: 'absolute', top: 800, fontFamily: TYPE, fontSize: 130, color: INK, opacity: k(t, [39.7, 40.0], [0, 1])}}>Follow</div>
          <div style={{position: 'absolute', top: 980, fontFamily: TYPE, fontSize: 36, color: DIM, opacity: k(t, [39.9, 40.1], [0, 1])}}>@theautomationguynavin</div>
        </AbsoluteFill>
      ) : null}
      <Grain opacity={0.07} blend="screen" />
      <Captions t={t} />
      <Voice dir="vo/c1-2026-w41-1/instagram" starts={S.slice(0, 8)} />
      <Sounds music="poc/stock/cinematic/music.wav" sfxDir="poc/sfx" cues={CUES} />
    </AbsoluteFill>
  );
};
