// Format B, Duotone Story (docs/CREATIVE_BIBLE.md sections 10 and 11): one hue for everything. Real photo cut-outs are mapped
// through a three-stop duotone (shadow ink, saturated mid, light surface) so stock from anywhere reads as one film; they enter
// and leave with a pixel dissolve and sit on a thin orbit ring. The transcript is the typography: keywords huge in Anton with a
// soft glow, connector words tiny in an italic serif tucked above them, each word appearing as it is spoken.
import React from 'react';
import {Img, staticFile} from 'remotion';
import {Grain, k, OUT, rng} from '../films/kit';
import {useTheme} from '../themes';

const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// The ground: a soft radial from the light centre to the saturated edge, grain and a vignette.
export const DuoWorld: React.FC<{children: React.ReactNode; cx?: number; cy?: number}> = ({children, cx = 50, cy = 46}) => {
  const th = useTheme();
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: `radial-gradient(85% 60% at ${cx}% ${cy}%, ${th.surface} 0%, ${th.bg} 52%, ${th.rule} 100%)`}}>
      <DuoDefs />
      {children}
      <Grain opacity={0.07} blend="multiply" />
    </div>
  );
};

// One SVG filter per film: luminance, then the duotone curve in the theme's tones, then a tinted soft shadow.
export const DuoDefs: React.FC = () => {
  const th = useTheme();
  // an S-curve through ink -> neutral mid -> surface: deep shadows, clean highlights, an unsaturated midtone (like the reference)
  const [a, c] = [channels(th.ink), channels(th.surface)];
  const table = (i: number) => `${a[i]} ${a[i]} ${(a[i] + c[i]) / 2} ${c[i]} ${c[i]}`;
  return (
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <defs>
        <filter id="duo" colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="150%">
          <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={table(0)} />
            <feFuncG type="table" tableValues={table(1)} />
            <feFuncB type="table" tableValues={table(2)} />
          </feComponentTransfer>
          <feDropShadow dx={0} dy={26} stdDeviation={24} floodColor={th.ink} floodOpacity={0.32} />
        </filter>
      </defs>
    </svg>
  );
};

// A real cut-out in the duotone, placed in a box (meet), entering and leaving with a pixel dissolve: a grid of cells that
// switch on in a scattered order. lift: gentle push and float while it is on screen.
export const Cutout: React.FC<{t: number; src: string; x: number; y: number; w: number; h: number; at: number; out?: number; seed?: number; cells?: number; rot?: number; id: string}> = ({t, src, x, y, w, h, at, out = 1e9, seed = 1, cells = 14, rot = 0, id}) => {
  if (t < at || t > out + 0.4) return null;
  const r = rng(seed);
  const order = Array.from({length: cells * cells}, () => r());
  const inP = (t - at) / 0.38, outP = (t - out) / 0.32;
  // never fully at rest (the reference's objects keep turning and drifting): a slow push, a turn and a float
  const life = t - at;
  const push = 1 + k(t, [at, Math.min(out, at + 4)], [0, 0.09]);
  const bob = Math.sin(life * 1.6) * 10;
  const turn = rot + Math.sin(life * 0.9) * 3 + life * 1.2;
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs>
        <clipPath id={`m-${id}`} clipPathUnits="userSpaceOnUse">
          {order.map((o, i) => {
            const on = o < inP && !(t > out && o < outP);
            return on ? <rect key={i} x={x - w * 0.1 + ((i % cells) * w * 1.2) / cells} y={y - h * 0.1 + (Math.floor(i / cells) * h * 1.25) / cells} width={(w * 1.2) / cells + 1} height={(h * 1.25) / cells + 1} /> : null;
          })}
        </clipPath>
      </defs>
      <g clipPath={`url(#m-${id})`}>
        <g filter="url(#duo)" transform={`translate(${x + w / 2} ${y + h / 2 + bob}) rotate(${turn}) scale(${push}) translate(${-w / 2} ${-h / 2})`}>
          <image href={staticFile(src)} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
        </g>
      </g>
    </svg>
  );
};

// A thin ring around the object, seen in perspective, turning slowly with a small bead riding on it.
export const Orbit: React.FC<{t: number; at: number; out?: number; cx: number; cy: number; rx: number}> = ({t, at, out = 1e9, cx, cy, rx}) => {
  const th = useTheme();
  const o = Math.min(k(t, [at, at + 0.5], [0, 0.85]), k(t, [out, out + 0.3], [0.85, 0]));
  if (o <= 0) return null;
  const ry = rx * 0.2, a = (t - at) * 0.9;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: o}}>
      <ellipse cx={cx} cy={cy} rx={rx * k(t, [at, at + 0.6], [0.6, 1], OUT)} ry={ry} fill="none" stroke={th.surface} strokeWidth={2.5} />
      <circle cx={cx + Math.cos(a) * rx} cy={cy + Math.sin(a) * ry} r={7} fill={th.surface} />
    </svg>
  );
};

// The transcript as type. A line is written with its keywords in *stars*; every keyword gets the connector words spoken just
// before it as a small italic label above its left edge; words appear as they are spoken (character share of the clip).
// Keywords type on letter by letter out of a blur, with a soft glow. The block clears quickly when the line is done.
export type Line = {text: string; at: number; dur: number; end: number};
export const Transcript: React.FC<{t: number; line: Line; y?: number; size?: number; align?: 'left' | 'right' | 'center'}> = ({t, line, y = 230, size = 150, align = 'left'}) => {
  const th = useTheme();
  if (t < line.at - 0.05 || t > line.end) return null;
  const plain = line.text.replace(/\*/g, '');
  const words = line.text.split(/\s+/);
  let pos = 0;
  const timed = words.map((w) => {
    const clean = w.replace(/\*/g, '');
    const at = line.at + (plain.indexOf(clean, pos) / plain.length) * line.dur;
    pos = plain.indexOf(clean, pos) + clean.length;
    return {w: clean, at, key: w.includes('*')};
  });
  // group: connectors gather until a keyword closes the group; trailing connectors form a last small label
  const groups: {label: typeof timed; key: typeof timed}[] = [];
  let label: typeof timed = [], key: typeof timed = [];
  timed.forEach((x, i) => {
    if (x.key) key.push(x);
    else if (key.length) (groups.push({label, key}), (label = [x]), (key = []));
    else label.push(x);
    if (i === timed.length - 1) groups.push({label, key});
  });
  const fade = k(t, [line.end - 0.18, line.end], [1, 0]);
  const rise = k(t, [line.at, line.end], [0, -36]); // the block floats up slowly while the line is on screen
  const glow = `0 0 26px color-mix(in srgb, ${th.surface} 70%, transparent), 0 0 6px color-mix(in srgb, ${th.surface} 60%, transparent)`;
  return (
    <div style={{position: 'absolute', left: 80, right: 80, top: y + rise, display: 'flex', flexDirection: 'column', alignItems: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center', gap: 4, opacity: fade}}>
      {groups.map((g, gi) => (
        <div key={gi} style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginLeft: align === 'left' ? (gi % 2) * 60 : 0}}>
          {g.label.length > 0 && (
            <div style={{fontFamily: '"Instrument Serif", serif', fontStyle: 'italic', fontSize: size * 0.3, lineHeight: 1, color: th.ink, marginBottom: 4}}>
              {g.label.map((x, i) => (
                <span key={i} style={{opacity: k(t, [x.at, x.at + 0.12], [0, 1]), marginRight: '0.3em'}}>{x.w}</span>
              ))}
            </div>
          )}
          {g.key.length > 0 && (
            <div style={{fontFamily: 'Anton, sans-serif', fontSize: size, lineHeight: 0.92, letterSpacing: '0.005em', color: th.ink, textTransform: 'uppercase', textShadow: glow, whiteSpace: 'nowrap'}}>
              {g.key.map((x, i) => {
                const chars = [...x.w];
                return (
                  <span key={i} style={{marginRight: '0.22em'}}>
                    {chars.map((c, j) => {
                      const p = k(t, [x.at + j * 0.028, x.at + j * 0.028 + 0.16], [0, 1], OUT);
                      return <span key={j} style={{display: 'inline-block', opacity: p, filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined, transform: `translateY(${(1 - p) * 10}px)`}}>{c}</span>;
                    })}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Magnifier lens: a magnified copy of a cut-out shown only inside a circle (the lens of a magnifier photo laid on top).
export const LensView: React.FC<{t: number; at: number; out?: number; src: string; cx: number; cy: number; r: number; w: number; h: number}> = ({t, at, out = 1e9, src, cx, cy, r, w, h}) => {
  const th = useTheme();
  const o = Math.min(k(t, [at, at + 0.3], [0, 1]), k(t, [out, out + 0.25], [1, 0]));
  if (o <= 0) return null;
  const s = k(t, [at, at + 1.6], [1.0, 1.35]);
  return (
    <div style={{position: 'absolute', left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: '50%', overflow: 'hidden', opacity: o, background: th.surface}}>
      <Img src={staticFile(src)} style={{position: 'absolute', left: r - (w * s) / 2, top: r - (h * s) / 2, width: w * s, height: h * s, objectFit: 'contain', filter: 'url(#duo)'}} />
    </div>
  );
};
