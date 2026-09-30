// Host mascots: drawn entirely in code (SVG shapes + gradients + a stepped pixel dither). No images, no 3D libraries.
// Every mascot takes the same acting inputs so the Composer can drive it: mouth (0 shut..1 open), blink (0 open..1 shut), tilt (deg).
import React from 'react';
import {random} from 'remotion';
import {alpha, CHARACTER as C, MASK, useTheme} from '../themes';

export type Acting = {mouth?: number; blink?: number; tilt?: number};
type Box = {x: number; y: number; w: number; h: number};

// ---- pixel dither: one shared grid; deeper shadow = bigger pixels, the lit core gets fine light pixels ----
const PITCH = 10;
const SIZES = [2, 3, 4, 5, 6, 7, 8]; // pixel size per shadow step, lightest first
const BANDS: {from: number; to: number; dot: string}[] = [
  {from: 0, to: 0.12, dot: 'dot-hl'},
  ...SIZES.map((_, k) => ({from: 0.4 + k * 0.086, to: k === SIZES.length - 1 ? 1.01 : 0.4 + (k + 1) * 0.086, dot: `dot-${k}`})),
];

export const DitherDefs: React.FC = () => (
  <defs>
    {[
      ...SIZES.map((s, k) => [`dot-${k}`, s, C.eye, 0.5 + k * 0.05]),
      ['dot-hl', 3, C.catchlight, 0.8],
    ].map(([id, s, fill, op]) => (
      <pattern key={id as string} id={id as string} width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
        <rect x={(PITCH - (s as number)) / 2} y={(PITCH - (s as number)) / 2} width={s as number} height={s as number} fill={fill as string} opacity={op as number} />
      </pattern>
    ))}
  </defs>
);

// A shaded part: base gradient lit from the top-left, then dither bands, all clipped to the shape.
const Part: React.FC<{id: string; box: Box; tone: [string, string, string]; children: React.ReactElement}> = ({id, box, tone, children}) => {
  const cx = box.x + box.w * 0.32;
  const cy = box.y + box.h * 0.26;
  const r = Math.hypot(box.w, box.h) * 0.82;
  const cover = {x: box.x - 40, y: box.y - 40, width: box.w + 80, height: box.h + 80};
  return (
    <g>
      <defs>
        <clipPath id={`${id}-c`}>{children}</clipPath>
        <radialGradient id={`${id}-f`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r}>
          <stop offset={0} stopColor={tone[0]} />
          <stop offset={0.5} stopColor={tone[1]} />
          <stop offset={1} stopColor={tone[2]} />
        </radialGradient>
        {BANDS.map((b, k) => (
          <React.Fragment key={k}>
            <radialGradient id={`${id}-g${k}`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r}>
              <stop offset={b.from} stopColor={MASK.hide} />
              <stop offset={b.from} stopColor={MASK.show} />
              <stop offset={b.to} stopColor={MASK.show} />
              <stop offset={b.to} stopColor={MASK.hide} />
            </radialGradient>
            <mask id={`${id}-m${k}`} maskUnits="userSpaceOnUse" {...cover}>
              <rect {...cover} fill={`url(#${id}-g${k})`} />
            </mask>
          </React.Fragment>
        ))}
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <rect {...cover} fill={`url(#${id}-f)`} />
        {BANDS.map((b, k) => (
          <rect key={k} {...cover} fill={`url(#${b.dot})`} mask={`url(#${id}-m${k})`} />
        ))}
      </g>
    </g>
  );
};

const PAPER: [string, string, string] = [C.paper, C.paperShade, C.paperDeep];
const BLUE: [string, string, string] = [C.blueLight, C.blue, C.blueDeep];
const LIME: [string, string, string] = [C.limeLight, C.lime, C.limeDeep];

// Big simple eyes with catchlights; blink squashes them.
const Eyes: React.FC<{y: number; gap: number; rx: number; ry: number; blink: number; sclera?: boolean}> = ({y, gap, rx, ry, blink, sclera}) => (
  <g>
    {[-1, 1].map((s) => {
      const x = 540 + (s * gap) / 2;
      const k = Math.max(0.1, 1 - blink * 0.9);
      return (
        <g key={s} transform={`translate(${x} ${y}) scale(1 ${k})`}>
          {sclera ? <ellipse rx={rx * 1.25} ry={ry * 1.2} fill={C.paper} /> : null}
          <ellipse rx={rx} ry={ry} fill={C.eye} />
          <circle cx={rx * 0.32} cy={-ry * 0.36} r={rx * 0.34} fill={C.catchlight} />
          <circle cx={-rx * 0.3} cy={ry * 0.4} r={rx * 0.15} fill={C.catchlight} opacity={0.8} />
        </g>
      );
    })}
  </g>
);

const Blush: React.FC<{y: number; gap: number}> = ({y, gap}) => (
  <g>
    {[-1, 1].map((s) => (
      <ellipse key={s} cx={540 + (s * gap) / 2} cy={y} rx={34} ry={17} fill={C.blush} opacity={0.6} />
    ))}
  </g>
);

// Mouth: a small smile when shut, an open rounded mouth when speaking.
const Mouth: React.FC<{y: number; open: number; color?: string}> = ({y, open, color = C.eye}) =>
  open > 0.08 ? (
    <g>
      <ellipse cx={540} cy={y + 6} rx={24 + open * 6} ry={6 + open * 20} fill={color} />
      <ellipse cx={540} cy={y + 12 + open * 10} rx={13 + open * 3} ry={4 + open * 6} fill={C.blush} opacity={0.9} />
    </g>
  ) : (
    <path d={`M ${514} ${y} Q 540 ${y + 22} ${566} ${y}`} stroke={color} strokeWidth={9} strokeLinecap="round" fill="none" />
  );

const Rim: React.FC<{children: React.ReactNode}> = ({children}) => (
  <g style={{filter: `drop-shadow(0 0 3px ${alpha(C.lime, 0.9)}) drop-shadow(-10px -6px 22px ${alpha(C.lime, 0.35)}) drop-shadow(12px 8px 26px ${alpha(C.blue, 0.55)})`}}>{children}</g>
);

// ---- concept 1: BAHI, a rolled-ledger capsule with a pencil tucked on top ----
export const Bahi: React.FC<Acting> = ({mouth = 0, blink = 0, tilt = 0}) => (
  <g transform={`rotate(${tilt} 540 1250)`}>
    <Rim>
      <Part id="bahi-footl" box={{x: 410, y: 1235, w: 110, h: 60}} tone={BLUE}><ellipse cx={465} cy={1265} rx={55} ry={30} /></Part>
      <Part id="bahi-footr" box={{x: 560, y: 1235, w: 110, h: 60}} tone={BLUE}><ellipse cx={615} cy={1265} rx={55} ry={30} /></Part>
      <Part id="bahi-arml" box={{x: 290, y: 930, w: 110, h: 200}} tone={PAPER}><rect x={300} y={935} width={80} height={190} rx={40} transform="rotate(18 340 1030)" /></Part>
      <Part id="bahi-armr" box={{x: 690, y: 700, w: 130, h: 220}} tone={PAPER}><rect x={700} y={720} width={80} height={190} rx={40} transform="rotate(-28 740 815)" /></Part>
      <Part id="bahi-body" box={{x: 360, y: 640, w: 360, h: 630}} tone={PAPER}><rect x={360} y={640} width={360} height={630} rx={180} /></Part>
      <g transform="rotate(-16 540 640)">
        <Part id="bahi-pencil" box={{x: 400, y: 596, w: 250, h: 46}} tone={LIME}><rect x={400} y={596} width={250} height={46} rx={10} /></Part>
        <path d="M 650 596 L 712 619 L 650 642 Z" fill={C.paper} />
        <path d="M 694 612 L 712 619 L 694 626 Z" fill={C.eye} />
        <rect x={372} y={596} width={34} height={46} rx={10} fill={C.blush} />
      </g>
    </Rim>
    {[1100, 1140, 1180].map((y, k) => (
      <rect key={y} x={470} y={y} width={k === 2 ? 90 : 140} height={10} rx={5} fill={alpha(C.paperDeep, 0.55)} />
    ))}
    <Eyes y={860} gap={140} rx={40} ry={52} blink={blink} />
    <Blush y={936} gap={220} />
    <Mouth y={950} open={mouth} />
  </g>
);

// ---- concept 2: TIKKU, a rounded-cube head with a screen face and a rubber-stamp handle on top ----
export const Tikku: React.FC<Acting> = ({mouth = 0, blink = 0, tilt = 0}) => (
  <g transform={`rotate(${tilt} 540 1250)`}>
    <Rim>
      <Part id="tik-footl" box={{x: 420, y: 1210, w: 100, h: 56}} tone={PAPER}><ellipse cx={470} cy={1238} rx={50} ry={28} /></Part>
      <Part id="tik-footr" box={{x: 560, y: 1210, w: 100, h: 56}} tone={PAPER}><ellipse cx={610} cy={1238} rx={50} ry={28} /></Part>
      <Part id="tik-arml" box={{x: 320, y: 960, w: 100, h: 180}} tone={BLUE}><rect x={330} y={960} width={70} height={170} rx={35} transform="rotate(20 365 1045)" /></Part>
      <Part id="tik-armr" box={{x: 660, y: 880, w: 150, h: 200}} tone={BLUE}><rect x={690} y={890} width={70} height={170} rx={35} transform="rotate(-38 725 1000)" /></Part>
      <Part id="tik-body" box={{x: 400, y: 930, w: 280, h: 300}} tone={BLUE}><rect x={400} y={930} width={280} height={300} rx={70} /></Part>
      <Part id="tik-stem" box={{x: 516, y: 505, w: 48, h: 70}} tone={BLUE}><rect x={516} y={505} width={48} height={70} rx={12} /></Part>
      <Part id="tik-knob" box={{x: 490, y: 440, w: 100, h: 90}} tone={BLUE}><ellipse cx={540} cy={485} rx={50} ry={44} /></Part>
      <Part id="tik-head" box={{x: 320, y: 560, w: 440, h: 400}} tone={PAPER}><rect x={320} y={560} width={440} height={400} rx={80} /></Part>
    </Rim>
    <rect x={365} y={612} width={350} height={270} rx={48} fill={C.eye} />
    <rect x={365} y={612} width={350} height={270} rx={48} fill="url(#dot-s)" opacity={0.5} />
    <Eyes y={725} gap={150} rx={34} ry={44} blink={blink} sclera />
    <Blush y={790} gap={250} />
    <Mouth y={815} open={mouth} color={C.paper} />
  </g>
);

// ---- CHIKU (C1 host, picked 2026-10-01): a rounded-triangle flow arrow wearing a narrator headset ----
export const Chiku: React.FC<Acting> = ({mouth = 0, blink = 0, tilt = 0}) => (
  <g transform={`rotate(${tilt} 540 1250)`}>
    <Rim>
      <Part id="chk-footl" box={{x: 400, y: 1215, w: 110, h: 56}} tone={PAPER}><ellipse cx={455} cy={1243} rx={55} ry={28} /></Part>
      <Part id="chk-footr" box={{x: 570, y: 1215, w: 110, h: 56}} tone={PAPER}><ellipse cx={625} cy={1243} rx={55} ry={28} /></Part>
      <Part id="chk-arml" box={{x: 260, y: 1020, w: 110, h: 150}} tone={BLUE}><ellipse cx={318} cy={1095} rx={42} ry={70} transform="rotate(32 318 1095)" /></Part>
      <Part id="chk-armr" box={{x: 720, y: 900, w: 130, h: 180}} tone={BLUE}><ellipse cx={770} cy={990} rx={42} ry={78} transform="rotate(-38 770 990)" /></Part>
      <Part id="chk-body" box={{x: 270, y: 590, w: 540, h: 650}} tone={BLUE}>
        <path d="M 492 646 Q 540 566 588 646 L 800 1140 Q 826 1236 730 1236 L 350 1236 Q 254 1236 280 1140 Z" />
      </Part>
      <path d="M 405 820 Q 405 600 540 598 Q 675 600 675 820" stroke={C.eye} strokeWidth={18} fill="none" strokeLinecap="round" />
      <Part id="chk-cupl" box={{x: 372, y: 790, w: 70, h: 110}} tone={LIME}><rect x={372} y={790} width={70} height={110} rx={30} /></Part>
      <Part id="chk-cupr" box={{x: 638, y: 790, w: 70, h: 110}} tone={LIME}><rect x={638} y={790} width={70} height={110} rx={30} /></Part>
      <path d="M 690 890 Q 712 1040 604 1050" stroke={C.eye} strokeWidth={10} fill="none" strokeLinecap="round" />
      <circle cx={598} cy={1050} r={16} fill={C.lime} />
    </Rim>
    <Eyes y={945} gap={150} rx={34} ry={44} blink={blink} sclera />
    <Blush y={1030} gap={250} />
    <Mouth y={1040} open={mouth} />
  </g>
);

export const CONCEPTS = [
  {name: 'BAHI', line: 'A rolled ledger with a pencil tucked on top. The old account book that learned to keep itself.', Mascot: Bahi},
  {name: 'TIKKU', line: 'A rubber-stamp head with a screen face. It approves, files and forwards so nobody has to.', Mascot: Tikku},
  {name: 'CHIKU', line: 'A flow arrow in a narrator headset. It keeps work moving from step to step.', Mascot: Chiku},
];

// The stage: near-black, drifting starfield, a warm glow behind the host.
export const Stage: React.FC<{f?: number; glowY?: number}> = ({f = 0, glowY = 950}) => {
  const th = useTheme();
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="stage-glow" cx={540} cy={glowY} r={560} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={alpha(C.glow, 0.32)} />
          <stop offset={0.45} stopColor={alpha(C.glow, 0.1)} />
          <stop offset={1} stopColor={alpha(C.glow, 0)} />
        </radialGradient>
      </defs>
      <rect width={1080} height={1920} fill={th.bg} />
      {Array.from({length: 120}, (_, i) => {
        const x = (random(`sx${i}`) * 1080 + f * 0.2 * (0.3 + random(`sv${i}`))) % 1080;
        const y = random(`sy${i}`) * 1920;
        const s = random(`ss${i}`) < 0.85 ? 3 : 5;
        return <rect key={i} x={x} y={y} width={s} height={s} fill={th.ink} opacity={0.15 + 0.5 * random(`so${i}`)} />;
      })}
      <rect width={1080} height={1920} fill="url(#stage-glow)" />
    </svg>
  );
};
