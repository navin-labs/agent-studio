// B2 "Swiss": the Velcro story as an animated International Typographic Style poster. Same script, voice and times as c2-2026-w41-1.
// Why this style: de Mestral was a Swiss engineer, and 1941-1955 is exactly when Swiss design was being invented.
// Everything is built from two shapes, the hook (a J) and the loop (a ring), on a six-column grid, with flush-left grotesk type.
// Motion is mechanical: locked-off camera, crisp ease-in-out, snaps with a small overshoot. No drift, no texture beyond print grain.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ensureFonts} from '../fonts';
import {THEMES} from '../themes';
import {Cue, Grain, IN, INOUT, k, OUT, phrases, Sounds, useT, Voice} from './kit';

const C = THEMES['archive-gold'];
const BG = C.bg;
const PAPER = C.ink;
const GOLD = C.reveal!;
const DIM = C.muted;
const RULE = C.rule;
const SANS = 'Inter';

const S = [0, 7.27, 13.13, 18.2, 24.67, 28.23, 30.23];
const LINES = [
  '1941. Swiss engineer de Mestral walks his dog in the Alps. They return covered in sticky burrs.',
  'Most people just brush the burrs off and forget them. He put one under a microscope instead.',
  "Thousands of tiny hooks grabbing loops. Nature's fastener, perfected over ages.",
  'Before Velcro, you fumbled with buttons and stuck zips daily. After de Mestral, you just press and pull.',
  'Fourteen years of work. Then the world could stick and unstick.',
];
const VO = [6.906, 5.516, 4.727, 6.121, 3.204];

const CUES: Cue[] = [
  ...[5.55, 5.8, 6.05, 6.3, 6.55].map((a, i): Cue => [a, i % 2 ? 'soft' : 'wood', 0.3]),
  [8.5, 'cloth', 0.6],
  [10.45, 'latch', 0.4],
  [14.95, 'catch', 0.7],
  [15.08, 'catch', 0.25],
  [18.75, 'soft', 0.2],
  [19.35, 'soft', 0.2],
  [19.95, 'pop', 0.35],
  [23.45, 'press', 0.8],
  [24.15, 'rip', 0.5],
  [26.05, 'wood', 0.35],
  [27.3, 'catch', 0.4],
  [27.8, 'rip', 0.3],
];

// grid: six columns, 72 px margins
const M = 72;
const COL = (1080 - 2 * M) / 6;
const colX = (c: number) => M + COL * c + COL / 2;

// ---------- the two shapes ----------
// Hook: origin at the top of the shank; the catch point (inside the curl) is at (0.3 s, 0.5 s).
const Hook: React.FC<{x: number; y: number; s: number; rot?: number; color?: string; w?: number}> = ({x, y, s, rot = 0, color = GOLD, w}) => (
  <path
    transform={`translate(${x},${y}) rotate(${rot})`}
    d={`M0,0 L0,${s * 1.35} A${s * 0.3},${s * 0.3} 0 0 0 ${s * 0.6},${s * 1.35} L${s * 0.6},${s * 1.1}`}
    stroke={color}
    strokeWidth={w ?? s * 0.16}
    fill="none"
    strokeLinecap="round"
  />
);
const Ring: React.FC<{x: number; y: number; r: number; color?: string; w?: number; sy?: number}> = ({x, y, r, color = PAPER, w, sy = 1}) => (
  <ellipse cx={x} cy={y} rx={r} ry={r * sy} stroke={color} strokeWidth={w ?? r * 0.26} fill="none" />
);
// burr: a ring bristling with twelve small hooks
const Burr: React.FC<{x: number; y: number; r: number; spin?: number; sx?: number}> = ({x, y, r, spin = 0, sx = 1}) => (
  <g transform={`translate(${x},${y}) scale(${sx},${1 / sx}) rotate(${spin})`}>
    {Array.from({length: 12}, (_, i) => (
      <g key={i} transform={`rotate(${i * 30}) translate(0,${-r * 1.05})`}>
        <Hook x={0} y={0} s={r * 0.5} rot={180} color={PAPER} w={r * 0.15} />
      </g>
    ))}
    <circle r={r * 0.62} fill={PAPER} />
  </g>
);

const Type: React.FC<{x?: number; y: number; size: number; color?: string; weight?: number; o?: number; children: React.ReactNode; track?: number}> = ({x = M, y, size, color = PAPER, weight = 900, o = 1, children, track = -0.045}) => (
  <div style={{position: 'absolute', left: x, top: y, fontFamily: SANS, fontWeight: weight, fontSize: size, lineHeight: 0.92, letterSpacing: `${track}em`, color, opacity: o, whiteSpace: 'pre'}}>{children}</div>
);

// ---------- scenes ----------
// 0-4.4: a giant hook swings at a ring and misses; the camera pulls back and the hook becomes a walker crossing the Alps
const PIVOT: [number, number] = [640, -60];
const swing = (t: number) => {
  if (t < 0.3) return k(t, [0, 0.3], [-6, -16], OUT); // anticipation: it draws back before it swings
  const d = t - 0.3;
  return 10 - 26 * Math.exp(-d * 0.9) * Math.cos(d * 3.9); // a damped pendulum: swings at the ring, misses, settles
};
const ROUTE: [number, number][] = [[150, 1240], [300, 1060], [420, 1160], [560, 930], [700, 1120], [830, 1000], [960, 1220]];
const routeAt = (u: number): [number, number] => {
  const f = u * (ROUTE.length - 1);
  const i = Math.min(ROUTE.length - 2, Math.floor(f));
  const r = f - i;
  return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * r, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * r];
};
const Opening: React.FC<{t: number}> = ({t}) => {
  const z = k(t, [2.5, 3.4], [1, 0.16], INOUT);
  const walk = k(t, [3.0, 4.35], [0, 1], (v) => v);
  const [wx, wy] = routeAt(walk);
  // the camera keeps the hook's pivot travelling from its poster position to the walker's position on the route
  const m = k(t, [2.5, 3.4], [0, 1], INOUT);
  const px = PIVOT[0] + (wx - PIVOT[0]) * m;
  const py = PIVOT[1] + (wy - 175 - PIVOT[1]) * m;
  const a = swing(t);
  const alps = k(t, [2.9, 3.4], [0, 1], OUT);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        {/* the Alps: three triangles, one solid */}
        <g opacity={alps}>
          <path d="M60,1320 L430,820 L800,1320 Z" fill="none" stroke={PAPER} strokeWidth={6} />
          <path d="M330,1320 L700,900 L1070,1320 Z" fill={DIM} opacity={0.35} />
          <path d="M-60,1320 L200,1000 L460,1320 Z" fill="none" stroke={DIM} strokeWidth={4} />
          <line x1={0} y1={1320} x2={1080} y2={1320} stroke={PAPER} strokeWidth={6} />
          <path d={`M${ROUTE.map((p) => p.join(',')).join(' L')}`} fill="none" stroke={PAPER} strokeWidth={4} strokeDasharray="2 16" strokeLinecap="round" pathLength={1} />
        </g>
        <g transform={`translate(${px},${py}) scale(${z}) translate(${-PIVOT[0]},${-PIVOT[1]})`}>
          <g opacity={k(t, [2.9, 3.3], [1, 0])}>
            <Ring x={250} y={1080} r={150} w={40} />
          </g>
          <g transform={`translate(${PIVOT[0]},${PIVOT[1]}) rotate(${a})`}>
            <Hook x={0} y={0} s={640} />
          </g>
        </g>
      </svg>
      <Type y={k(t, [0.9, 1.3], [1360, 1330], OUT)} size={340} color={PAPER} o={k(t, [0.9, 1.1], [0, 1]) * k(t, [2.5, 2.8], [1, 0])}>
        1941
      </Type>
      <Type y={k(t, [0.9, 1.3], [1360, 1330], OUT) - 60} size={30} weight={600} track={0.02} color={DIM} o={k(t, [1.3, 1.5], [0, 1]) * k(t, [2.5, 2.8], [1, 0])}>
        {'George de Mestral  ·  Engineer  ·  Switzerland'}
      </Type>
      <Type y={300} size={30} weight={600} track={0.02} color={DIM} o={alps}>
        {'Alps, 1941'}
      </Type>
    </AbsoluteFill>
  );
};

// 4.4-13.13: burrs snap into the grid; a bar sweeps them off; one clings; the reticle closes on it and we push in
const LAND = [5.55, 5.8, 6.05, 6.3, 6.55];
const CELLS: [number, number][] = [[1, 2], [4, 1], [2, 4], [5, 3], [0, 5]];
const rowY = (r: number) => 500 + r * 170;
const KEEP = 2;
const Grid: React.FC<{o?: number}> = ({o = 1}) => (
  <g opacity={o}>
    {Array.from({length: 7}, (_, i) => <line key={`v${i}`} x1={M + COL * i} y1={0} x2={M + COL * i} y2={1920} stroke={RULE} strokeWidth={2} />)}
    {Array.from({length: 12}, (_, i) => <line key={`h${i}`} x1={0} y1={415 + i * 170} x2={1080} y2={415 + i * 170} stroke={RULE} strokeWidth={2} />)}
  </g>
);
const Burrs: React.FC<{t: number}> = ({t}) => {
  const reticle = k(t, [10.45, 11.1], [900, 120], INOUT);
  const [kx, ky] = [colX(CELLS[KEEP][0]), rowY(CELLS[KEEP][1])];
  const push = k(t, [11.8, 13.13], [0, 1], IN);
  const z = Math.pow(14, push);
  const bar = k(t, [8.4, 8.95], [-200, 1300], INOUT);
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={`translate(${kx},${ky}) scale(${z}) translate(${-kx},${-ky})`}>
          <Grid o={k(t, [4.4, 4.8], [0, 1])} />
          {CELLS.map(([c, r], i) => {
            const x = colX(c);
            const y = rowY(r);
            const drop = k(t, [LAND[i] - 0.25, LAND[i]], [-900, 0], IN);
            const squash = 1 + Math.sin(k(t, [LAND[i], LAND[i] + 0.25], [0, Math.PI], (v) => v)) * 0.18;
            const spin = k(t, [LAND[i] - 0.25, LAND[i]], [-90, 0], OUT);
            const hit = 8.4 + (x / 1080) * 0.55; // the bar reaches this column
            const gone = i === KEEP ? 0 : k(t, [hit, hit + 0.6], [0, 1], IN);
            const cling = i === KEEP && t > hit ? 1 + Math.sin((t - hit) * 18) * 0.35 * Math.exp(-(t - hit) * 5) : 1; // stretches with the bar, springs back: the hooks hold
            if (t < LAND[i] - 0.25) return null;
            return (
              <g key={i} transform={`translate(${gone * 900},${gone * gone * 700})`}>
                <Burr x={x} y={y + drop} r={52} spin={spin + gone * 220} sx={squash * cling} />
              </g>
            );
          })}
          {t > 10.45 ? (
            <g opacity={k(t, [10.45, 10.7], [0, 1])}>
              <circle cx={kx} cy={ky} r={reticle} fill="none" stroke={GOLD} strokeWidth={3} />
              {[0, 90, 180, 270].map((a) => (
                <line key={a} x1={kx + Math.cos((a * Math.PI) / 180) * (reticle - 30)} y1={ky + Math.sin((a * Math.PI) / 180) * (reticle - 30)} x2={kx + Math.cos((a * Math.PI) / 180) * (reticle + 30)} y2={ky + Math.sin((a * Math.PI) / 180) * (reticle + 30)} stroke={GOLD} strokeWidth={3} />
              ))}
            </g>
          ) : null}
        </g>
        <rect x={bar} y={360} width={46} height={1500} fill={PAPER} opacity={t > 8.4 && t < 9.0 ? 1 : 0} />
      </svg>
      <Type y={300} size={30} weight={600} track={0.02} color={DIM} o={k(t, [4.6, 4.9], [0, 1]) * k(t, [11.8, 12.1], [1, 0])}>
        {t < 8.4 ? 'Burrs, after one walk: 5' : t < 10.45 ? 'Brushed off: 4' : 'Kept: 1'}
      </Type>
    </AbsoluteFill>
  );
};

// 13.13-18.2: one hook fills the frame; pull back: it is one of forty-two. They catch in a ripple from the centre.
const CATCH = 14.95;
const FC = 6;
const FR = 7;
const FIELD = Array.from({length: FC * FR}, (_, i) => {
  const c = i % FC;
  const r = Math.floor(i / FC);
  const x = colX(c) - 18;
  const y = 420 + r * 150;
  return {x, y, at: CATCH + Math.hypot(x - 522, y - 920) * 0.00045};
});
const Field: React.FC<{t: number}> = ({t}) => {
  const z = k(t, [13.13, 13.9], [9, 1], OUT);
  const [cx, cy] = [FIELD[20].x + 18, FIELD[20].y + 50];
  const tug = t > 15.8 ? -Math.sin(k(t, [15.8, 16.5], [0, Math.PI], OUT)) * 46 : 0;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={`translate(${cx},${cy}) scale(${z}) translate(${-cx},${-cy})`}>
          {FIELD.map(({x, y, at}, i) => {
            const caught = t >= at;
            const hover = k(t, [13.9, CATCH - 0.15], [-90, -24], INOUT);
            const dy = caught ? -24 * (1 - k(t, [at, at + 0.16], [0, 1], IN)) + Math.sin(k(t, [at + 0.16, at + 0.45], [0, Math.PI], OUT)) * 5 : hover;
            const flash = caught ? k(t, [at, at + 0.5], [1, 0], OUT) : 0;
            const sy = 1 + (tug ? -tug / 200 : 0);
            return (
              <g key={i}>
                <Ring x={x + 18} y={y + 66 + tug * 0.4} r={30} w={8} sy={sy} />
                {flash > 0 ? <Ring x={x + 18} y={y + 66 + tug * 0.4} r={30} w={8} color={GOLD} sy={sy} /> : null}
                <Hook x={x} y={y + dy + tug} s={44} w={9} />
                {/* the ring passes in front of the hook's right arm: threaded, not overlapped */}
                <path d={`M${x + 18 + 30 * Math.cos(-1.1)},${y + 66 + tug * 0.4 + 30 * sy * Math.sin(-1.1)} A30,${30 * sy} 0 0 1 ${x + 18 + 30},${y + 66 + tug * 0.4}`} stroke={flash > 0.3 ? GOLD : PAPER} strokeWidth={8} fill="none" />
              </g>
            );
          })}
        </g>
      </svg>
      <Type y={300} size={30} weight={600} track={0.02} color={DIM} o={k(t, [13.7, 14.0], [0, 1])}>
        {'Hooks: gold. Loops: white.'}
      </Type>
      <Type y={1480} size={110} o={k(t, [16.3, 16.6], [0, 1])}>
        {"Nature's\n"}
        <span style={{color: GOLD}}>fastener.</span>
      </Type>
    </AbsoluteFill>
  );
};

// 18.2-24.67: the old ways are misregistered type; then two bands press and pull
const Fumble: React.FC<{t: number}> = ({t}) => {
  const word = 'BUTTONS';
  const tries = [18.55, 19.15].map((a) => k(t, [a, a + 0.25], [0, 1], INOUT) * k(t, [a + 0.3, a + 0.5], [1, 0], IN)).reduce((a, b) => a + b, 0);
  const fall = t > 19.95 ? t - 19.95 : 0;
  const zip = k(t, [20.35, 20.8], [0, 1], OUT);
  const jam = t > 20.8 ? Math.sin((t - 20.8) * 40) * 8 * Math.exp(-(t - 20.8) * 3) : 0;
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <line x1={M} y1={880} x2={1008} y2={880} stroke={RULE} strokeWidth={3} />
        <line x1={M} y1={1340} x2={1008} y2={1340} stroke={RULE} strokeWidth={3} />
      </svg>
      <div style={{position: 'absolute', left: M, top: 700, fontFamily: SANS, fontWeight: 900, fontSize: 196, letterSpacing: '-0.05em', color: PAPER, opacity: k(t, [18.3, 18.45], [0, 1])}}>
        {word.split('').map((ch, i) => {
          const off = 1 - tries * 0.8; // each try almost registers the letters on the baseline, then they slip back
          return (
            <span key={i} style={{display: 'inline-block', translate: `${Math.sin(i * 2.1) * 14 * off}px ${Math.sin(i * 1.3 + 1) * 34 * off + fall * fall * 2600 * (1 + i * 0.12)}px`, rotate: `${Math.sin(i * 1.7) * 9 * off + fall * 120 * (i % 2 ? 1 : -1)}deg`}}>
              {ch}
            </span>
          );
        })}
      </div>
      {t > 20.3 ? (
        <>
          <div style={{position: 'absolute', left: M, top: 1160, fontFamily: SANS, fontWeight: 900, fontSize: 196, letterSpacing: '-0.05em', color: PAPER}}>ZIPS</div>
          <svg width={1080} height={1920} style={{position: 'absolute'}}>
            {Array.from({length: 20}, (_, i) => {
              const y = 1620 - i * 26;
              const top = 1620 - zip * 400 + jam;
              return y > top ? (
                <g key={i}>
                  <rect x={760} y={y} width={26} height={12} fill={GOLD} />
                  <rect x={790} y={y + 13} width={26} height={12} fill={GOLD} />
                </g>
              ) : null;
            })}
            <rect x={752} y={1620 - zip * 400 + jam - 40} width={72} height={48} fill={GOLD} />
          </svg>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
const Bands: React.FC<{t: number; meet: number; part: number; y: number}> = ({t, meet, part, y}) => {
  const gap = k(t, [meet - 0.2, meet], [300, 0], IN) + k(t, [part, part + 0.35], [0, 1400], IN);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute'}}>
      <g transform={`translate(0,${y - gap})`}>
        <rect x={M} y={-130} width={1080 - 2 * M} height={90} fill={GOLD} />
        {Array.from({length: 14}, (_, i) => <Hook key={i} x={M + 30 + i * 66} y={-40} s={22} w={6} />)}
      </g>
      <g transform={`translate(0,${y})`}>
        {Array.from({length: 14}, (_, i) => <Ring key={i} x={M + 37 + i * 66} y={6} r={13} w={5} />)}
        <rect x={M} y={16} width={1080 - 2 * M} height={90} fill={PAPER} />
      </g>
    </svg>
  );
};
const After: React.FC<{t: number}> = ({t}) => {
  const pull = k(t, [24.15, 24.4], [0, 1], OUT) * k(t, [24.4, 24.65], [1, 0.25], INOUT);
  return (
    <AbsoluteFill>
      <Type y={300} size={30} weight={600} track={0.02} color={DIM} o={k(t, [21.7, 21.9], [0, 1])}>
        {'After'}
      </Type>
      <Type y={350} size={150} color={GOLD} o={k(t, [21.75, 21.95], [0, 1])}>
        {'de Mestral'}
      </Type>
      <Bands t={t} meet={23.45} part={24.15} y={1000} />
      <div style={{position: 'absolute', left: M, top: 1180, fontFamily: SANS, fontWeight: 900, fontSize: 200, letterSpacing: '-0.05em', color: PAPER, lineHeight: 0.92}}>
        <span style={{display: 'inline-block', opacity: k(t, [23.4, 23.46], [0, 1]), scale: `1 ${k(t, [23.45, 23.62], [0.55, 1], OUT)}`, transformOrigin: 'top'}}>PRESS</span>
        <br />
        <span style={{display: 'inline-block', opacity: k(t, [24.12, 24.18], [0, 1]), scale: `1 ${1 + pull * 0.55}`, transformOrigin: 'top'}}>PULL</span>
      </div>
    </AbsoluteFill>
  );
};
const Before: React.FC<{t: number}> = ({t}) => (t < 21.65 ? <Fumble t={t} /> : <After t={t} />);

// 24.67-28.23: the year rolls like a mechanical counter, one step per year; then one hook sticks and unsticks
const Years: React.FC<{t: number}> = ({t}) => {
  const u = k(t, [24.85, 26.05], [0, 14], (v) => v);
  const n = Math.min(14, Math.floor(u));
  const v = n + INOUT(Math.min(1, (u - n) * 1.6));
  const stick = k(t, [27.1, 27.3], [-120, 0], IN) + k(t, [27.8, 28.05], [0, -160], OUT);
  const ringLift = t > 27.8 ? Math.sin(k(t, [27.8, 28.1], [0, Math.PI], OUT)) * -30 : 0;
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', left: M, top: 380, height: 300, overflow: 'hidden', fontFamily: SANS, fontWeight: 900, fontSize: 320, lineHeight: '300px', letterSpacing: '-0.05em', color: n >= 14 ? GOLD : PAPER, fontVariantNumeric: 'tabular-nums', display: 'flex'}}>
        <span>19</span>
        <span style={{display: 'inline-block', translate: `0 ${-v * 300}px`}}>
          {Array.from({length: 15}, (_, i) => (
            <div key={i}>{41 + i}</div>
          ))}
        </span>
      </div>
      <Type y={720} size={30} weight={600} track={0.02} color={DIM} o={k(t, [25.0, 25.2], [0, 1])}>
        {'Fourteen years. Patented 1955.'}
      </Type>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <Ring x={colX(2) + 54} y={1160 + ringLift} r={100} w={26} />
        <Hook x={colX(2)} y={830 + stick} s={150} />
      </svg>
    </AbsoluteFill>
  );
};

const End: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill>
    <svg width={1080} height={1920} style={{position: 'absolute'}}>
      <Ring x={M + 120} y={600} r={78} w={22} />
      <Hook x={M + 66} y={k(t, [28.3, 28.6], [380, 420], OUT)} s={120} />
      <path d={`M${M + 120 + 78 * Math.cos(-1.1)},${600 + 78 * Math.sin(-1.1)} A78,78 0 0 1 ${M + 198},600`} stroke={PAPER} strokeWidth={22} fill="none" />
    </svg>
    <Type y={820} size={200} o={k(t, [28.35, 28.55], [0, 1])}>
      Follow
    </Type>
    <Type y={1030} size={34} weight={600} track={0.02} o={k(t, [28.5, 28.7], [0, 1])}>
      {'@backstory.minute'}
    </Type>
    <Type y={1080} size={34} weight={600} track={0.02} color={DIM} o={k(t, [28.6, 28.8], [0, 1])}>
      {'for more backstories'}
    </Type>
  </AbsoluteFill>
);

const Captions: React.FC<{t: number}> = ({t}) => {
  const all = LINES.flatMap((l, i) => phrases(l, S[i], VO[i]));
  const cur = all.find((p) => t >= p.from && t < p.to + 0.15);
  if (!cur) return null;
  return <div style={{position: 'absolute', left: M, top: 1720, fontFamily: SANS, fontWeight: 600, fontSize: 46, letterSpacing: '-0.01em', color: PAPER}}>{cur.text}</div>;
};

export const SwissPoc: React.FC = () => {
  ensureFonts();
  const t = useT();
  const Scene = [t < 4.4 ? Opening : Burrs, Burrs, Field, Before, Years, End][S.findIndex((s, i) => t >= s && t < S[i + 1])] ?? End;
  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <Scene t={t} />
      <Grain opacity={0.06} blend="screen" />
      <Captions t={t} />
      <Voice dir="vo/c2-2026-w41-1/instagram" starts={S.slice(0, 6)} />
      <Sounds music="poc/velcro/cinematic/music.wav" sfxDir="poc/sfx" cues={CUES} />
    </AbsoluteFill>
  );
};
