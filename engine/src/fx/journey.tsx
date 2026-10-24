// Format D, Flat Journey (docs/CREATIVE_BIBLE.md section 11; reference Video-45335): one illustrated world in two inks on
// cream that the camera travels through sideways, station by station, while a timeline below scrubs to each year.
// Illustration plates come from the asset pipeline (Stitch flat illustrations, Pixabay vectors) with their paper keyed out to
// transparency (white-balanced on the paper, then distance from white -> alpha), so they sit straight on our cream.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {Grain, INOUT, k, OUT} from '../films/kit';
import {useTheme} from '../themes';

export type Station = {x: number; at: number; src: string; year: string; line: string};

// The world: stations side by side; the camera glides from one to the next when its line starts. Each plate rises out of
// its ground line as the camera arrives (clip reveal from the bottom), with a slight parallax drift while it is in view.
export const World: React.FC<{t: number; stations: Station[]; y: number; w: number; h: number}> = ({t, stations, y, w, h}) => {
  const th = useTheme();
  let cam = stations[0].x;
  for (let i = 1; i < stations.length; i++) cam += k(t, [stations[i].at - 0.9, stations[i].at + 0.1], [0, stations[i].x - stations[i - 1].x], INOUT);
  cam += Math.sin(t * 0.8) * 40; // never fully still: the world breathes sideways a little, and never drifts off a station
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 540 - cam, top: 0}}>
        {stations.map((s, i) => {
          const p = k(t, [s.at - 0.7, s.at + 0.4], [0, 1], OUT);
          const push = 1 + k(t, [s.at - 0.7, (stations[i + 1]?.at ?? s.at + 4) + 0.1], [0, 0.24]);
          return (
            <div key={i} style={{position: 'absolute', left: s.x - w / 2, top: y + (1 - p) * 60, width: w, height: h, clipPath: `inset(${(1 - p) * 100}% 0 0 0)`, scale: String(push)}}>
              <Img src={staticFile(s.src)} style={{width: w, height: h, objectFit: 'contain'}} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// The year and its line for the station currently on screen: the year is set big and slides up into place; the line fades.
export const Caption: React.FC<{t: number; stations: Station[]}> = ({t, stations}) => {
  const th = useTheme();
  const i = stations.filter((s) => t >= s.at - 0.35).length - 1;
  if (i < 0) return null;
  const s = stations[i];
  const next = stations[i + 1]?.at ?? 1e9;
  const o = Math.min(k(t, [s.at - 0.35, s.at], [0, 1], OUT), k(t, [next - 0.6, next - 0.35], [1, 0]));
  const lift = k(t, [s.at - 0.35, s.at + 0.2], [40, 0], OUT);
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 300 + lift, textAlign: 'center', opacity: o}}>
      <div style={{fontFamily: 'Anton, sans-serif', fontSize: 190, lineHeight: 1, color: th.ink, letterSpacing: '0.01em'}}>{s.year}</div>
      <div style={{fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontSize: 60, color: th.muted, marginTop: 14}}>{s.line}</div>
    </div>
  );
};

// A ruler of years along the bottom: ticks, a coral progress bar and a cursor that scrubs to each station's year.
export const Timeline: React.FC<{t: number; stations: Station[]; from: number; to: number; y?: number}> = ({t, stations, from, to, y = 1580}) => {
  const th = useTheme();
  const X0 = 90, X1 = 990;
  const px = (yr: number) => X0 + ((yr - from) / (to - from)) * (X1 - X0);
  const years = stations.map((s) => (/^\d{4}$/.test(s.year) ? +s.year : to));
  let yr = years[0] - k(t, [0, 1.1], [years[0] - from, 0], OUT);
  for (let i = 1; i < stations.length; i++) yr += k(t, [stations[i].at - 0.9, stations[i].at + 0.1], [0, years[i] - years[i - 1]], INOUT);
  const cx = px(yr);
  const ticks = Array.from({length: Math.floor((to - from) / 2) + 1}, (_, i) => from + i * 2);
  return (
    <svg width={1080} height={300} style={{position: 'absolute', left: 0, top: y, opacity: k(t, [0, 0.4], [0, 1])}}>
      {ticks.map((v) => <line key={v} x1={px(v)} x2={px(v)} y1={v % 10 === 0 ? 26 : 34} y2={50} stroke={th.ink} strokeWidth={v % 10 === 0 ? 3 : 1.5} />)}
      <rect x={X0} y={56} width={Math.max(0, cx - X0)} height={10} fill={th.alert} />
      <path d={`M ${cx - 14} 10 L ${cx + 14} 10 L ${cx} 26 Z`} fill={th.ink} />
      <text x={cx} y={108} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={600} fontSize={40} fill={th.ink}>{Math.round(yr)}</text>
    </svg>
  );
};

export const Paper: React.FC<{children: React.ReactNode}> = ({children}) => {
  const th = useTheme();
  return (
    <div style={{position: 'absolute', inset: 0, background: th.bg, overflow: 'hidden'}}>
      {children}
      <Grain opacity={0.09} blend="multiply" />
    </div>
  );
};

