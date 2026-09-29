import React from 'react';

// The brand mascot: a hovering blue bot with a screen face. Pure SVG, every pose is a prop.
// Arm angles are degrees raised away from the body (0 = hanging down, 90 = straight out, 180 = straight up).
export type Eyes = 'normal' | 'wide' | 'happy';
export type MascotPose = {
  frame: number; // drives idle hover, blink, antenna sway
  eyes?: Eyes;
  lookX?: number; // -1..1
  lookY?: number; // -1..1
  talk?: number; // 0..1 mouth open
  armL?: number;
  armR?: number;
  sway?: number; // extra antenna lean in degrees (from movement)
  sweat?: boolean;
  alert?: boolean; // antenna ball flashes red
  working?: boolean; // chest light green
  chai?: number; // 0..1 cup visible in right hand
  squashX?: number;
  squashY?: number;
};

const BODY_LIGHT = '#5AA0F7';
const BODY = '#2F80ED';
const BODY_DARK = '#1C5FC2';
const LIMB = '#2A72D6';
const SCREEN = '#0B1420';
const FACE = '#CFE6FF';

export const Mascot: React.FC<MascotPose & {x: number; y: number; scale?: number; z?: number}> = ({x, y, scale = 1, z, ...p}) => {
  const f = p.frame;
  const hover = Math.sin(f / 13) * 7;
  const blinkPhase = (f + 20) % 97;
  const blink = blinkPhase < 5 ? Math.abs(blinkPhase - 2.5) / 2.5 : 1;
  const lookX = (p.lookX ?? 0) * 7;
  const lookY = (p.lookY ?? 0) * 6;
  const talk = Math.max(0, Math.min(1, p.talk ?? 0));
  const sway = Math.sin(f / 9 + 1) * 5 + (p.sway ?? 0);
  const armL = (p.armL ?? 8) + Math.sin(f / 13 + 0.6) * 3;
  const armR = p.armR ?? 8;
  const eyes = p.eyes ?? 'normal';
  const alertOn = p.alert && Math.floor(f / 6) % 2 === 0;
  const W = 220 * scale;
  const H = 280 * scale;
  const chai = p.chai ?? 0;

  const eye = (cx: number) =>
    eyes === 'happy' ? (
      <path d={`M ${cx - 11} -8 Q ${cx} -22 ${cx + 11} -8`} stroke={FACE} strokeWidth={7} strokeLinecap="round" fill="none" />
    ) : (
      <g transform={`translate(${cx + lookX} ${-14 + lookY}) scale(1 ${blink})`}>
        <rect x={eyes === 'wide' ? -11 : -8} y={eyes === 'wide' ? -19 : -14} width={eyes === 'wide' ? 22 : 16} height={eyes === 'wide' ? 38 : 28} rx={eyes === 'wide' ? 11 : 8} fill={FACE} />
        <circle cx={-3} cy={eyes === 'wide' ? -9 : -6} r={3.2} fill="#FFFFFF" opacity={0.9} />
      </g>
    );

  const arm = (side: 1 | -1, angle: number, holdCup: boolean) => (
    <g transform={`translate(${side * 70} 12) rotate(${-side * angle})`}>
      <rect x={-9} y={-4} width={18} height={58} rx={9} fill={LIMB} />
      <circle cx={0} cy={58} r={13} fill={BODY_LIGHT} />
      {holdCup && chai > 0 ? (
        <g transform={`translate(0 58) rotate(${side * angle}) scale(${chai})`}>
          {[0, 1].map((k) => (
            <path
              key={k}
              d={`M ${-6 + k * 12} -30 q ${6 + Math.sin(f / 5 + k) * 4} -12 0 -24 q ${-6 - Math.sin(f / 6 + k) * 4} -12 0 -24`}
              stroke="#FFFFFF"
              strokeWidth={3.5}
              strokeLinecap="round"
              fill="none"
              opacity={0.35 + 0.25 * Math.sin(f / 7 + k * 2)}
            />
          ))}
          <path d="M 16 -14 q 14 0 14 10 q 0 10 -14 10" stroke="#E9EDF2" strokeWidth={5} fill="none" />
          <path d="M -18 -24 L 18 -24 L 14 10 Q 14 16 8 16 L -8 16 Q -14 16 -14 10 Z" fill="#F2F4F7" />
          <ellipse cx={0} cy={-24} rx={18} ry={5} fill="#B67A45" />
        </g>
      ) : null}
    </g>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x - W / 2,
        top: y - H / 2,
        width: W,
        height: H,
        zIndex: z,
      }}
    >
      <svg viewBox="-110 -160 220 280" width={W} height={H} style={{overflow: 'visible'}}>
        <defs>
          <linearGradient id="mbody" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor={BODY_LIGHT} />
            <stop offset="0.55" stopColor={BODY} />
            <stop offset="1" stopColor={BODY_DARK} />
          </linearGradient>
          <radialGradient id="mglow">
            <stop offset="0" stopColor="#6FB0FF" stopOpacity={0.55} />
            <stop offset="1" stopColor="#6FB0FF" stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* ground shadow */}
        <ellipse cx={0} cy={104} rx={62 - hover * 1.5} ry={10} fill="#000" opacity={0.35} />
        <g transform={`translate(0 ${-hover}) scale(${p.squashX ?? 1} ${p.squashY ?? 1})`}>
          {/* thruster glow */}
          <ellipse cx={0} cy={86} rx={46} ry={20} fill="url(#mglow)" opacity={0.7 + 0.3 * Math.sin(f / 3)} />
          {/* antenna */}
          <g transform={`rotate(${sway} 0 -72)`}>
            <rect x={-3.5} y={-112} width={7} height={42} rx={3.5} fill={BODY_DARK} />
            <circle cx={0} cy={-116} r={16} fill={alertOn ? '#E5484D' : '#8CC1FF'} opacity={0.25} />
            <circle cx={0} cy={-116} r={10} fill={alertOn ? '#FF6B6F' : '#A9D1FF'} />
          </g>
          {arm(-1, armL, false)}
          {arm(1, armR, true)}
          {/* side bolts */}
          <rect x={-82} y={-26} width={12} height={36} rx={6} fill={BODY_DARK} />
          <rect x={70} y={-26} width={12} height={36} rx={6} fill={BODY_DARK} />
          {/* body */}
          <rect x={-72} y={-74} width={144} height={150} rx={46} fill="url(#mbody)" />
          <path d="M -48 -66 Q -60 -60 -62 -40" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" fill="none" />
          {/* face screen */}
          <rect x={-54} y={-54} width={108} height={82} rx={26} fill={SCREEN} />
          <rect x={-54} y={-54} width={108} height={82} rx={26} fill="none" stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={2} />
          {eye(-22)}
          {eye(22)}
          {eyes === 'happy' && talk < 0.05 ? (
            <path d="M -10 10 Q 0 18 10 10" stroke={FACE} strokeWidth={5} strokeLinecap="round" fill="none" />
          ) : (
            <rect x={-12} y={10 - talk * 4} width={24} height={4 + talk * 12} rx={3 + talk * 3} fill={FACE} opacity={0.9} />
          )}
          {/* chest light */}
          <circle cx={0} cy={52} r={7} fill={p.working ? '#3DDC84' : '#A9D1FF'} opacity={p.working ? 0.6 + 0.4 * Math.sin(f / 2.5) : 0.8} />
          {p.sweat ? <path d={`M 60 ${-70 + ((f * 2) % 40)} q 9 14 0 20 q -9 -6 0 -20 Z`} fill="#9BCBFF" opacity={1 - ((f * 2) % 40) / 40} /> : null}
        </g>
      </svg>
    </div>
  );
};
