// Illustrated overlays for CinematicComposite: the motion that carries a shot's metaphor, drawn over the graded plate.
// Each is a pure function of shot time. density.ts counts their motion (OVERLAY_MOTION) as beats.
import React from 'react';
import {interpolate} from 'remotion';
import {k, rng, useMemoOnce} from '../films/kit';
import {alpha, type Theme} from '../themes';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const f1 = (n: number) => n.toFixed(1);
export type O = {t: number; d: number; th: Theme};

const ECG = [0, 0, 0.05, -0.08, 0, 0, 0.9, -0.55, 0.12, 0, 0, 0.18, 0.1, 0, 0];
export const stallAt = (d: number) => d * 0.42;
export const Heartbeat: React.FC<O> = ({t, d, th}) => {
  const a = stallAt(d), b = a + 0.5;
  const stalled = t >= a && t < b;
  const scroll = (t < a ? t : t < b ? a : t - 0.5) * 560;
  const pts: string[] = [];
  for (let x = 0; x <= 1080; x += 6) {
    const s = (x + scroll) / 140, i = Math.floor(s) % ECG.length, fr = s - Math.floor(s);
    const v = ECG[i] + (ECG[(i + 1) % ECG.length] - ECG[i]) * fr;
    pts.push(`${x},${f1(1060 - (stalled && x > 600 ? 0 : v) * 160)}`);
  }
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <polyline points={pts.join(' ')} fill="none" stroke={th.alert} strokeWidth={stalled ? 10 : 6} strokeLinejoin="round" style={{filter: `drop-shadow(0 0 14px ${th.alert})`}} />
      {stalled ? <rect x={600} y={0} width={480} height={1920} fill={alpha(th.alert, 0.12)} /> : null}
    </svg>
  );
};

export const Beams: React.FC<O> = ({t, d, th}) => {
  const fast = k(t, [0.3, 0.7], [0, 1]);
  const slow = interpolate(t, [0.3, d * 0.95], [0, 1], clamp);
  const lane = (y: number, u: number, c: string, wob: number) => (
    <g>
      <line x1={80} y1={y} x2={1000} y2={y} stroke={alpha(c, 0.25)} strokeWidth={3} strokeDasharray="8 14" />
      <line x1={80} y1={y} x2={80 + 920 * u} y2={y + Math.sin(t * 20) * wob} stroke={c} strokeWidth={10} strokeLinecap="round" style={{filter: `drop-shadow(0 0 18px ${c})`}} />
      <circle cx={80 + 920 * u} cy={y + Math.sin(t * 20) * wob} r={22} fill={c} style={{filter: `drop-shadow(0 0 24px ${c})`}} />
    </g>
  );
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <ellipse cx={600} cy={1110} rx={300} ry={70} fill={alpha(th.alert, 0.18)} />
      {lane(960, fast, th.flow, 0)}
      {lane(1110, slow, th.alert, 9)}
    </svg>
  );
};

export const Lens: React.FC<O> = ({t, d, th}) => {
  const x = interpolate(t, [0, d], [300, 700], clamp), y = interpolate(t, [0, d], [520, 640], clamp);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <circle cx={x} cy={y} r={230} fill={alpha(th.flow, 0.1)} stroke={th.ink} strokeWidth={8} />
      <circle cx={x} cy={y} r={252} fill="none" stroke={alpha(th.ink, 0.35)} strokeWidth={3} />
      <line x1={x - 230} y1={y} x2={x + 230} y2={y} stroke={alpha(th.accent, 0.7)} strokeWidth={2} />
      <line x1={x} y1={y - 230} x2={x} y2={y + 230} stroke={alpha(th.accent, 0.7)} strokeWidth={2} />
      <rect x={x - 230} y={y - 230 + ((t * 300) % 460)} width={460} height={5} fill={th.accent} opacity={0.8} />
      <line x1={x + 165} y1={y + 165} x2={x + 300} y2={y + 300} stroke={th.ink} strokeWidth={30} strokeLinecap="round" />
    </svg>
  );
};

export const ScanBand: React.FC<O> = ({t, d, th}) => {
  const y = interpolate(t, [0.2, d * 0.8], [300, 1200], clamp);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <rect x={0} y={y - 160} width={1080} height={160} fill={alpha(th.flow, 0.22)} />
      <rect x={0} y={y - 4} width={1080} height={5} fill={th.flow} style={{filter: `drop-shadow(0 0 16px ${th.flow})`}} />
      {y > 700 ? <rect x={380} y={600} width={320} height={190} fill="none" stroke={th.alert} strokeWidth={6} strokeDasharray="20 10" opacity={k(t, [d * 0.45, d * 0.55], [0, 1])} /> : null}
    </svg>
  );
};

export const Spotlight: React.FC<O> = ({t, th}) => {
  const x = 540 + Math.sin(t * 0.8) * 120;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, mixBlendMode: 'screen'}}>
      <defs>
        <linearGradient id="xz-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={th.warn} stopOpacity={0.55} />
          <stop offset="100%" stopColor={th.warn} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`${x - 50},0 ${x + 50},0 ${x + 330},1300 ${x - 330},1300`} fill="url(#xz-cone)" />
    </svg>
  );
};

export const Pins: React.FC<O> = ({t, d, th}) => (
  <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
    {[0, 1, 2, 3, 4].map((i) => {
      const u = k(t, [d * 0.3 + i * 0.25, d * 0.3 + i * 0.25 + 0.2], [0, 1]);
      const x = 300 + i * 120;
      return (
        <g key={i}>
          <rect x={x - 20} y={700 - u * 90} width={40} height={130} rx={10} fill={u > 0.95 ? th.alert : alpha(th.warn, 0.85)} stroke={th.shadow} strokeWidth={3} />
          <line x1={x} y1={560} x2={x} y2={690 - u * 90} stroke={alpha(th.ink, 0.7)} strokeWidth={4} strokeDasharray="6 6" />
        </g>
      );
    })}
    <line x1={240} y1={700} x2={840} y2={700} stroke={alpha(th.ink, 0.6)} strokeWidth={3} strokeDasharray="14 8" />
  </svg>
);

export const RingCut: React.FC<O> = ({t, d, th}) => {
  const nodes = useMemoOnce(() => {
    const r = rng(77);
    return Array.from({length: 90}, () => ({x: 80 + r() * 920, y: 300 + r() * 1000}));
  });
  const c = {x: 560, y: 760}, cut = d * 0.5, R = 250 + t * 25, broken = t >= cut;
  const hand = interpolate(t, [0, cut, d], [-150, 0, 90], clamp);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      {nodes.map((n, i) => {
        const inside = (n.x - c.x) ** 2 + (n.y - c.y) ** 2 < R * R;
        return <circle key={i} cx={n.x} cy={n.y} r={5} fill={inside && !broken ? th.alert : th.flow} opacity={0.85} />;
      })}
      {broken
        ? [0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2, e = a + 0.6, r = R + (t - cut) * 70;
            return <path key={i} d={`M ${c.x + Math.cos(a) * r} ${c.y + Math.sin(a) * r} A ${r} ${r} 0 0 1 ${c.x + Math.cos(e) * r} ${c.y + Math.sin(e) * r}`} fill="none" stroke={th.alert} strokeWidth={9} opacity={Math.max(0, 1 - (t - cut) * 1.2)} />;
          })
        : <circle cx={c.x} cy={c.y} r={R} fill={alpha(th.alert, 0.08)} stroke={th.alert} strokeWidth={9} style={{filter: `drop-shadow(0 0 16px ${th.alert})`}} />}
      <g transform={`translate(540 800) rotate(${hand})`}>
        <line x1={0} y1={50} x2={0} y2={-560} stroke={th.ink} strokeWidth={4} style={{filter: `drop-shadow(0 0 10px ${th.ink})`}} />
        <circle r={16} fill={th.ink} />
      </g>
    </svg>
  );
};


export const OVERLAYS = {pulse: Heartbeat, beams: Beams, lens: Lens, scan: ScanBand, spotlight: Spotlight, pins: Pins, ring: RingCut} as const;
export type OverlayName = keyof typeof OVERLAYS;
