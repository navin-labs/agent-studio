// C2 "Two pens": "stock should not lie" as a chart recorder. Same script, voice and times as c1-2026-w41-1.
// Two pens write on one paper strip: the software's number and the godown's. They should draw one line; they draw two.
// The gap between them is the lie, hatched on the paper. Automation is the moment the pens meet and write as one (lime marker).
// The last shot pulls back: the whole strip is the record of the story. Light paper on a dark table: the opposite of C1.
import React from 'react';
import {AbsoluteFill, Easing, Img, staticFile} from 'remotion';
import {ensureFonts} from '../fonts';
import {Chiku, DitherDefs} from '../host/mascots';
import {THEMES} from '../themes';
import {Cue, Grain, IN, INOUT, k, OUT, phrases, Sounds, SPRING, useT, Voice} from './kit';

const C = THEMES['night-signal'];
const TABLE = C.bg;
const PAPER = C.ink; // the strip is paper; the channel's black is the pen ink
const PEN = C.bg;
const DIM = C.muted;
const LIME = C.ok;
const NUM = '"Inter Tight", Inter, sans-serif';
const MONO = '"JetBrains Mono", monospace';
const BACK = Easing.bezier(0.34, 1.56, 0.64, 1); // the pen arm overshoots and settles: it has mass

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

const LIES: [number, number][] = [[0.75, 1], [4.4, 0.5], [8.1, 0.7], [12.5, 0.6], [15.8, 1], [17.6, 0.6], [23.3, 1.1]];
const AUTO = 24.53;
const LIFT: [number, number] = [24.2, AUTO]; // both pens lift: the paper runs blank for a breath
const SALES = [25.0, 26.9, 27.9, 28.6];
const DRIFT: [number, number][] = [[18.0, 50], [19.5, 52], [21.3, 53], [21.6, 54]]; // each lie pushes the software's number up

const CUES: Cue[] = [
  ...LIES.map(([at, a]): Cue => [at - 0.03, 'pen', 0.25 + a * 0.3]),
  [12.5, 'stamp', 0.75],
  [14.4, 'thump', 0.8],
  [24.2, 'soft', 0.25], // pens lift
  [AUTO, 'latch', 0.45], // pens drop together
  ...SALES.map((a): Cue => [a, 'pen', 0.4]),
];

// ---------- the record ----------
const sw = (tt: number) => {
  if (tt >= AUTO) return gd(tt) + (54 - 32) * (1 - k(tt, [AUTO, AUTO + 0.7], [0, 1], BACK));
  return DRIFT.reduce((v, [at, to]) => v + (to - v) * k(tt, [at, at + 0.3], [0, 1], BACK), 40);
};
const gd = (tt: number) => SALES.reduce((v, at) => v - k(tt, [at, at + 0.25], [0, 1], BACK), 32);
const tremor = (tt: number) => {
  if (tt >= AUTO) return 0;
  let x = 0;
  for (const [at, a] of LIES) {
    const d = tt - at;
    if (d > 0 && d < 0.8) x += Math.sin(d * 40) * 26 * a * Math.exp(-d * 6);
  }
  return x;
};
const X = (v: number) => 560 + (v - 40) * 30;
const PEN_Y = 1250;
const PX = 90; // paper speed: px per second
const lifted = (tt: number) => tt >= LIFT[0] && tt < LIFT[1];

// paper y of a moment, at time t (the strip moves up; the past is above the pens)
const Y = (tt: number, t: number) => PEN_Y - (t - tt) * PX;

const trace = (f: (tt: number) => number, t: number, from: number) => {
  const segs: string[][] = [[]];
  for (let tt = from; tt <= t; tt += 1 / 30) {
    if (lifted(tt)) {
      if (segs[segs.length - 1].length) segs.push([]);
      continue;
    }
    segs[segs.length - 1].push(`${f(tt).toFixed(1)},${Y(tt, t).toFixed(1)}`);
  }
  return segs.filter((s) => s.length > 1).map((s) => s.join(' '));
};

// a note on the paper at the moment it happened; paper behind it so it stays legible over the hatching
const Note: React.FC<{t: number; at: number; x: number; children: string}> = ({t, at, x, children}) =>
  t < at ? null : (
    <g opacity={k(t, [at, at + 0.3], [0, 1])}>
      <rect x={x - 8} y={Y(at, t) - 20} width={children.length * 15.6 + 16} height={38} fill={PAPER} />
      <text x={x} y={Y(at, t) + 9} fontFamily={MONO} fontWeight={600} fontSize={26} fill={PEN}>
        {children}
      </text>
    </g>
  );

const Stamp: React.FC<{t: number; at: number; x: number; word: string; rot: number}> = ({t, at, x, word, rot}) =>
  t < at ? null : (
    <g transform={`translate(${x},${Y(at, t)}) rotate(${rot}) scale(${k(t, [at, at + 0.1], [1.6, 1], IN)})`} opacity={k(t, [at, at + 0.05], [0, 0.85])}>
      <rect x={-110} y={-52} width={220} height={104} rx={8} fill="none" stroke={PEN} strokeWidth={7} />
      <text textAnchor="middle" y={28} fontFamily={NUM} fontWeight={900} fontSize={78} fill={PEN}>{word}</text>
    </g>
  );

const Strip: React.FC<{t: number}> = ({t}) => {
  const from = -16;
  const top = Y(from, t);
  const swX = (tt: number) => X(sw(tt)) + tremor(tt);
  const gdX = (tt: number) => X(gd(tt));
  // the gap: everything between the two lines, hatched, until the pens lift
  const gapPts: string[] = [];
  const end = Math.min(t, LIFT[0]);
  for (let tt = from; tt <= end; tt += 1 / 15) gapPts.push(`${swX(tt).toFixed(1)},${Y(tt, t).toFixed(1)}`);
  for (let tt = end; tt >= from; tt -= 1 / 15) gapPts.push(`${gdX(tt).toFixed(1)},${Y(tt, t).toFixed(1)}`);
  const merged = trace(gdX, t, AUTO + 0.6);
  const lift = lifted(t) ? 1 : t > LIFT[0] - 0.08 && t < LIFT[0] ? (t - (LIFT[0] - 0.08)) / 0.08 : 0;
  const nibs: [number, string][] = t < AUTO + 0.6 ? [[swX(t), 'SOFTWARE'], [gdX(t), 'GODOWN']] : [[gdX(t), '']];
  return (
    <g>
      <defs>
        <pattern id="hatch" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform={`translate(0,${-t * PX}) rotate(45)`}>
          <line x1={0} y1={0} x2={0} y2={14} stroke={PEN} strokeWidth={2.5} />
        </pattern>
      </defs>
      {/* the paper strip with its sprocket holes and grid; it runs from the start of the story to well past the pens */}
      <rect x={100} y={top - 200} width={900} height={PEN_Y - top + 2400} fill={PAPER} />
      {Array.from({length: Math.ceil((PEN_Y - top + 2400) / 60)}, (_, i) => {
        const y = top - 200 + i * 60 - ((t * PX) % 60) + 60;
        return (
          <g key={i}>
            <circle cx={128} cy={y} r={8} fill={TABLE} />
            <circle cx={972} cy={y} r={8} fill={TABLE} />
            <line x1={160} y1={y} x2={940} y2={y} stroke={DIM} strokeWidth={i % 5 ? 1 : 2} opacity={0.3} />
          </g>
        );
      })}
      {[28, 32, 36, 40, 44, 48, 52].map((v) => (
        <line key={v} x1={X(v)} y1={top - 200} x2={X(v)} y2={PEN_Y + 2200} stroke={DIM} strokeWidth={v % 8 === 0 ? 2 : 1} opacity={0.3} />
      ))}
      <polygon points={gapPts.join(' ')} fill="url(#hatch)" opacity={0.32} />
      {merged.map((p, i) => (
        <polyline key={`m${i}`} points={p} fill="none" stroke={LIME} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      ))}
      {trace(gdX, t, from).map((p, i) => (
        <polyline key={`g${i}`} points={p} fill="none" stroke={t >= AUTO ? PEN : DIM} strokeWidth={5} strokeLinejoin="round" />
      ))}
      {trace(swX, t, from).map((p, i) => (
        <polyline key={`s${i}`} points={p} fill="none" stroke={PEN} strokeWidth={5} strokeLinejoin="round" />
      ))}
      {/* what happened, written on the paper at the moment it happened */}
      <Note t={t} at={7.6} x={X(32) + 24}>8 bags vanished</Note>
      <Note t={t} at={10.0} x={X(40) + 30}>order: 10 bags</Note>
      <Stamp t={t} at={12.5} x={X(40) + 170} word="YES" rot={-7} />
      <Stamp t={t} at={14.4} x={X(36)} word="NO" rot={6} />
      <Note t={t} at={18.0} x={X(38)}>typed 50, meant 15</Note>
      <Note t={t} at={19.5} x={X(32) + 24}>sale, not entered</Note>
      <Note t={t} at={20.6} x={X(32) + 24}>kg as bags</Note>
      <Note t={t} at={21.7} x={X(32) + 24}>damaged, counted</Note>
      <Note t={t} at={AUTO + 1.2} x={X(31) + 40}>on its own</Note>
      {t > 29.3 ? (
        <g transform={`translate(${X(30) + 40},${Y(29.3, t)})`} opacity={k(t, [29.3, 29.5], [0, 1])}>
          <rect x={0} y={-34} width={470} height={68} rx={34} fill={PEN} />
          <text x={30} y={10} fontFamily={MONO} fontWeight={700} fontSize={24} fill={LIME}>ALERT · 5 LEFT · ORDER TODAY</text>
        </g>
      ) : null}
      {/* the pen arms: galvanometer styli on pivots below the paper; they lift together before the automation */}
      {nibs.map(([x, label], i) => (
        <g key={i}>
          <line x1={x} y1={PEN_Y + 6 + lift * 14} x2={540 + (x - 540) * 0.35} y2={2100} stroke={PEN} strokeWidth={6} />
          <circle cx={x} cy={PEN_Y + lift * 14} r={13 - lift * 4} fill={t >= AUTO + 0.6 ? LIME : PEN} stroke={PEN} strokeWidth={4} />
          {label ? (
            <g opacity={t > AUTO ? k(t, [AUTO, AUTO + 0.15], [1, 0]) : 1}>
              <text x={x + (i || x > 760 ? -26 : 26)} y={PEN_Y + 112} textAnchor={i || x > 760 ? 'end' : 'start'} fontFamily={NUM} fontWeight={900} fontSize={104} fill={i ? DIM : PEN} letterSpacing={-4}>
                {Math.round(i ? gd(t) : sw(t))}
              </text>
              <text x={x + (i || x > 760 ? -26 : 26)} y={PEN_Y + 150} textAnchor={i || x > 760 ? 'end' : 'start'} fontFamily={MONO} fontWeight={600} fontSize={24} fill={i ? DIM : PEN} letterSpacing={3}>
                {label}
              </text>
            </g>
          ) : (
            <text x={x + 30} y={PEN_Y + 112} fontFamily={NUM} fontWeight={900} fontSize={104} fill={PEN} letterSpacing={-4} opacity={k(t, [AUTO + 0.6, AUTO + 0.9], [0, 1])}>
              {Math.round(gd(t))}
            </text>
          )}
        </g>
      ))}
    </g>
  );
};

// ---------- camera: locked on the pens, then a pull-back that shows the whole strip ----------
const camera = (t: number) => {
  const p = k(t, [34.1, 35.9], [0, 1], INOUT);
  const z = 1 + (0.37 - 1) * p;
  const py = PEN_Y + (1450 - PEN_Y) * p; // the pens slide down the frame as the past opens above them
  const px = 540 - 290 * p; // and the strip moves to the left third, leaving the right for the last line
  return `translate(${px}px, ${py}px) scale(${z}) translate(-540px, ${-PEN_Y}px)`;
};

const Captions: React.FC<{t: number}> = ({t}) => {
  const all = LINES.flatMap((l, i) => phrases(l, S[i], VO[i]));
  const cur = all.find((p) => t >= p.from && t < p.to + 0.15);
  if (!cur) return null;
  if (t > 34.1 && t < 35.4) return null; // mid pull-back there is no clean ground for a caption; the voice carries it
  const table = t > 34.1; // after the pull-back the captions sit on the table beside the strip, not on the paper
  const [fg, halo] = table ? [PAPER, TABLE] : [PEN, PAPER];
  return <div style={{position: 'absolute', top: table ? 1180 : 1690, left: table ? 470 : 0, width: table ? 560 : 1080, textAlign: table ? 'left' : 'center', fontFamily: 'Inter', fontWeight: 700, fontSize: 46, color: fg, textShadow: `0 0 14px ${halo}, 0 0 6px ${halo}`}}>{cur.text}</div>;
};

export const StockPoc: React.FC = () => {
  ensureFonts();
  const t = useT();
  const chiku = k(t, [1.55, 1.85], [0, 1], SPRING) * k(t, [2.7, 3.0], [1, 0], IN);
  const end = t >= S[7];
  return (
    <AbsoluteFill style={{backgroundColor: TABLE}}>
      <AbsoluteFill style={{transformOrigin: '0 0', transform: camera(t)}}>
        <svg width={1080} height={1920} style={{position: 'absolute', overflow: 'visible'}}>
          <Strip t={t} />
        </svg>
      </AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <DitherDefs />
        <g transform={`translate(${1010 + (1 - chiku) * 300},${1500}) scale(0.28) translate(-540,-900)`} opacity={chiku > 0 ? 1 : 0}>
          <Chiku mouth={Math.abs(Math.sin(t * 18)) * 0.8} tilt={-12} />
        </g>
      </svg>
      {t > 35.5 && !end ? (
        <div style={{position: 'absolute', top: 640, left: 470, fontFamily: NUM, fontWeight: 900, fontSize: 132, lineHeight: 0.95, letterSpacing: -5, color: PAPER, opacity: k(t, [35.6, 36.0], [0, 1]), translate: `0 ${k(t, [35.6, 36.1], [20, 0], OUT)}px`}}>
          Stock
          <br />
          tells the
          <br />
          <span style={{color: LIME}}>truth.</span>
        </div>
      ) : null}
      {end ? (
        <AbsoluteFill style={{alignItems: 'center', backgroundColor: `color-mix(in srgb, ${TABLE} ${k(t, [39.5, 39.9], [0, 94])}%, transparent)`}}>
          <Img src={staticFile('brand/mark.png')} style={{position: 'absolute', top: 560, width: 180, height: 180, opacity: k(t, [39.6, 39.9], [0, 1])}} />
          <div style={{position: 'absolute', top: 790, fontFamily: NUM, fontWeight: 900, fontSize: 160, letterSpacing: -6, color: PAPER, opacity: k(t, [39.7, 40.0], [0, 1])}}>Follow</div>
          <div style={{position: 'absolute', top: 990, fontFamily: MONO, fontWeight: 600, fontSize: 32, letterSpacing: 3, color: DIM, opacity: k(t, [39.9, 40.1], [0, 1])}}>@THEAUTOMATIONGUYNAVIN</div>
        </AbsoluteFill>
      ) : null}
      <Grain opacity={0.1} />
      <Captions t={t} />
      <Voice dir="vo/c1-2026-w41-1/instagram" starts={S.slice(0, 8)} />
      <Sounds music="poc/stock/cinematic/music.wav" sfxDir="poc/sfx" cues={CUES} />
    </AbsoluteFill>
  );
};
