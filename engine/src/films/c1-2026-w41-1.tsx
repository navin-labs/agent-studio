// Film c1-2026-w41-1, "the lying stock" (agents/director/DIRECTOR.md). One hanging shop balance weighs the printed count against
// the real sacks: a slip of paper outweighs 32 sacks (the lie), every hand-typed error tips it further, and once each sale updates
// the count itself the beam comes level and never moves again. Still life in conte and charcoal on black paper (theme night-signal);
// lime only for the truth (the centre tick, the bell).
import * as brush from 'p5.brush/standalone';
import React, {useLayoutEffect, useRef} from 'react';
import {type Theme, useTheme} from '../themes';
import {BACK, Captions, cam, type Cue, drift, Foley, Grain, IN, InkDefs, k, type Key, OUT, rng, Score, settle, useFilm, useMemoOnce} from './kit';

type Brush = typeof brush;
type Pt = [number, number];

// ---------- geometry (world px; the frame at zoom 1 is the world) ----------
const PIV: Pt = [540, 400]; // beam pivot
const ARM = 326; // pivot to each end ring
const L = 500; // ring to pan rim
const RIM = 155; // pan rim half-width
const STOP = 15.5; // degrees: the pointer meets the stirrup window
const REAR = 980; // back edge of the counter top
const COUNTER = 1150; // its front edge; below it, the plank face
const PANEL = [150, 1380, 930, 1640]; // the sign panel recessed into the counter face
const S = 2.5; // atlas pixels per world px
const ROWS = [9, 8, 7, 6, 5, 3, 2]; // the full pyramid of 40 upright sacks, bottom row first
const SW = 34; // a sack sprite, world px
const SH = 44;

const rad = (d: number) => (d * Math.PI) / 180;
const ring = (side: -1 | 1, th: number): Pt => [PIV[0] + side * ARM * Math.cos(rad(th)), PIV[1] - side * ARM * Math.sin(rad(th))];
const toWorld = (side: -1 | 1, th: number, phi: number, [x, y]: Pt): Pt => {
  const [ex, ey] = ring(side, th);
  const a = rad(phi);
  return [ex + x * Math.cos(a) - y * Math.sin(a), ey + x * Math.sin(a) + y * Math.cos(a)];
};
// decaying sine kicks: impacts that shake something without moving where it rests
const kicks = (t: number, at: number[], amp: number, freq = 4, damp = 5) =>
  at.reduce((a, t0) => (t > t0 ? a + amp * Math.exp(-(t - t0) * damp) * Math.sin((t - t0) * freq * Math.PI * 2) : a), 0);

// The beam: a damped pendulum driven only by what lands in or leaves the pans. events [t, rest angle, freq, damp]; + = left pan down.
type Ev = [number, number, number, number];
const beamAt = (t: number, evs: Ev[], th0: number) => {
  let from = th0;
  let cur: Ev | null = null;
  const val = (e: Ev | null, f: number, s: number) => (e ? e[1] + (f - e[1]) * settle(s, e[0], e[2], e[3]) : f);
  for (const e of evs) {
    if (t < e[0]) break;
    from = val(cur, from, e[0]);
    cur = e;
  }
  const v = val(cur, from, t);
  return v > STOP ? STOP - (v - STOP) * 0.35 : v < -STOP ? -STOP - (v + STOP) * 0.35 : v;
};

// ---------- painting (once per render tab) ----------
// Two passes per canvas: flat washes on a 2D canvas (g), then p5.brush conte, charcoal and hatching on top (b). p5.brush's
// watercolour fills stack many translucent layers and bleed, which floods a dark ground, so the films paints its masses as washes.
type G = CanvasRenderingContext2D;
const paintCanvas = (w: number, h: number, density: number, seed: number, paint: (b: Brush, g: G) => void) => {
  const out = document.createElement('canvas');
  out.width = w * density;
  out.height = h * density;
  const g = out.getContext('2d')!;
  g.scale(density, density);
  const host = document.createElement('div');
  const cv = brush.createCanvas(w, h, {parent: host, pixelDensity: density});
  brush.seed(seed);
  brush.noiseSeed(seed);
  brush.push();
  brush.translate(-w / 2, -h / 2);
  brush.angleMode(brush.DEGREES);
  paint(brush, g);
  brush.pop();
  brush.render();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(cv, 0, 0);
  return out;
};
const ellipse = (cx: number, cy: number, rx: number, ry: number, from = 0, to = 360, n = 28): Pt[] =>
  Array.from({length: n + 1}, (_, i) => {
    const a = rad(from + ((to - from) * i) / n);
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
const mix = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;
// a wash lit from the upper left: strong where the light lands, thin where the form turns away
const wash = (g: G, pts: Pt[], c: string, hi: number, lo: number) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const gr = g.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  gr.addColorStop(0, mix(c, hi));
  gr.addColorStop(1, mix(c, lo));
  g.fillStyle = gr;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
};

// A copy of one region of a painted canvas, as its own small canvas (sprites move with CSS, the paint never re-runs).
const View: React.FC<{src: HTMLCanvasElement; r: [number, number, number, number]; scale: number; d?: number; style?: React.CSSProperties}> = ({src, r: [sx, sy, sw, sh], scale, d = 1, style}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current!.getContext('2d')!;
    c.clearRect(0, 0, sw * d, sh * d);
    c.drawImage(src, sx * d, sy * d, sw * d, sh * d, 0, 0, sw * d, sh * d);
  }, [src, sx, sy, sw, sh, d]);
  return <canvas ref={ref} width={sw * d} height={sh * d} style={{position: 'absolute', left: 0, top: 0, width: sw * scale, height: sh * scale, ...style}} />;
};

// Atlas regions (atlas px): sack tiles, the beam with its pointer, the dish, the bell.
const A = {sack: (v: number): [number, number, number, number] => [v * 100, 0, 100, 130], beam: [0, 150, 1700, 500] as [number, number, number, number], dish: [0, 660, 825, 125] as [number, number, number, number], bell: [850, 660, 100, 100] as [number, number, number, number]};

// One upright jute sack in a 100 x 130 tile: gathered ears tied with twine, shoulders, a belly slumped under the rice, a woven stripe.
const paintSack = (b: Brush, g: G, th: Theme, ox: number, oy: number, seed: number) => {
  const r = rng(seed * 977 + 13);
  const j = (n: number) => (r() - 0.5) * n;
  const lean = j(10);
  const wd = 1 + j(0.12);
  const X = (x: number, y: number): Pt => [ox + 50 + (x - 50) * wd + lean * (1 - y / 126), oy + y];
  const body: Pt[] = [X(42, 34), X(18 + j(5), 40), X(7 + j(4), 54), X(3, 90 + j(5)), X(5, 116), X(18, 124), X(50, 126), X(82, 124), X(95, 116), X(97, 90 + j(5)), X(93 + j(4), 54), X(82 + j(5), 40), X(58, 34)];
  const ears: Pt[] = [X(43, 35), X(34 + j(6), 22 + j(6)), X(44, 26), X(50 + j(6), 18 + j(4)), X(56, 26), X(66 + j(6), 22 + j(6)), X(57, 35)];
  // contact shadow, then the washes (lit from the upper left)
  wash(g, ellipse(...X(50, 125), 48, 6), th.bg, 95, 70);
  wash(g, body, th.muted, 78 + j(10), 16 + j(8));
  wash(g, ears, th.muted, 70, 30);
  // the side turned away from the light, hatched
  b.noStroke();
  b.noFill();
  b.hatch(5, 40 + j(12), {rand: 0.25});
  b.hatchStyle('2B', th.bg, 1.4);
  b.polygon([X(56, 36), X(74, 40), X(88, 62), X(94, 90), X(90, 114), X(76, 123), X(55, 125), X(66, 92), X(63, 60)]);
  b.noHatch();
  // the folds pulled down from the neck, and the sag where the rice settles
  b.set('HB', th.bg, 1.8);
  b.spline([X(12, 100 + j(6)), X(50, 108 + j(4)), X(88, 100 + j(6))], 0.6);
  b.spline([X(46, 34), X(39 + j(4), 50 + j(6)), X(34, 68)], 0.6);
  b.spline([X(55, 34), X(62 + j(4), 52 + j(6)), X(67, 66)], 0.6);
  // twine at the neck
  b.set('charcoal', th.ink, 2.2);
  b.line(...X(38, 33), ...X(62, 35));
  b.set('2B', th.bg, 1.6);
  b.line(...X(40, 38), ...X(60, 39));
  // contour: lit up the left side, the right side and base sunk in shadow
  b.set('charcoal', th.ink, 2.2);
  b.spline([body[6], body[5], body[4], body[3], body[2], body[1], body[0]], 0.5);
  b.set('charcoal', th.bg, 2.6);
  b.spline(body.slice(6), 0.5);
  b.set('2B', th.ink, 1.6);
  b.spline(ears.slice(0, 4), 0.5);
  b.set('2B', th.muted, 1.6);
  b.spline(ears.slice(3), 0.5);
};

const paintAtlas = (b: Brush, g: G, th: Theme) => {
  for (let v = 0; v < 9; v++) paintSack(b, g, th, v * 100, 0, v + 1);
  // ---- beam (680 x 200 world, pivot at 340, 184) with its pointer
  const B = (x: number, y: number): Pt => [x * S, 150 + y * S];
  const thick = (x: number) => 6.5 + 7.5 * (1 - Math.abs(x - 340) / 320);
  const xs = Array.from({length: 33}, (_, i) => 20 + i * 20);
  const topEdge = xs.map((x) => B(x, 184 - thick(x) / 2));
  const botEdge = xs.map((x) => B(x, 184 + thick(x) / 2)).reverse();
  // pointer: a tapered tongue standing on the boss
  wash(g, [B(334.5, 176), B(338.8, 20), B(341.2, 20), B(345.5, 176)], th.muted, 85, 45);
  b.set('charcoal', th.ink, 1.8);
  b.line(...B(334.5, 176), ...B(338.8, 20));
  b.set('2B', th.bg, 1.8);
  b.line(...B(345.5, 176), ...B(341.2, 20));
  wash(g, [...topEdge, ...botEdge], th.muted, 85, 35);
  b.noStroke();
  b.hatch(1.4 * S, 15, {rand: 0.15});
  b.hatchStyle('2B', th.bg, 1.4);
  b.polygon([...xs.map((x) => B(x, 184 + 0.5)), ...botEdge]);
  b.noHatch();
  b.set('charcoal', th.ink, 2.6);
  b.spline(topEdge.slice(0, 22), 0.3);
  b.set('2B', th.ink, 1.5);
  b.spline(topEdge.slice(21), 0.3);
  b.set('charcoal', th.bg, 2.8);
  b.spline(botEdge, 0.3);
  // end rings and the pivot boss
  for (const x of [14, 666]) {
    b.set('charcoal', th.ink, 2);
    b.spline(ellipse(...B(x, 184), 8 * S, 8 * S, 150, 330, 18), 0.5);
    b.set('2B', th.muted, 2.2);
    b.spline(ellipse(...B(x, 184), 8 * S, 8 * S, -30, 150, 14), 0.5);
  }
  wash(g, ellipse(...B(340, 184), 11 * S, 11 * S), th.muted, 75, 25);
  b.set('charcoal', th.ink, 2.2);
  b.spline(ellipse(...B(340, 184), 11 * S, 11 * S, 140, 300, 14), 0.5);
  b.set('charcoal', th.bg, 2.4);
  b.spline(ellipse(...B(340, 184), 11 * S, 11 * S, -40, 120, 14), 0.5);
  b.set('2B', th.ink, 1.4);
  b.spline(ellipse(...B(340, 184), 3 * S, 3 * S, 0, 360, 10), 0.5);
  // ---- dish (330 x 50 world, rim centre at 165, 12)
  const D = (x: number, y: number): Pt => [x * S, 660 + y * S];
  const bowl: Pt[] = [...ellipse(165, 12, 155, 9, 180, 360, 20).map(([x, y]) => D(x, y)), ...ellipse(165, 12, 155, 32, 0, 180, 20).map(([x, y]) => D(x, y))];
  wash(g, bowl, th.muted, 80, 30);
  wash(g, ellipse(165, 12, 148, 7.5, 0, 360, 30).map(([x, y]) => D(x, y)), th.bg, 85, 60);
  b.noStroke();
  b.hatch(1.5 * S, 75, {rand: 0.2});
  b.hatchStyle('2B', th.bg, 1.4);
  b.polygon([D(190, 14), D(320, 12), ...ellipse(165, 12, 155, 32, 0, 80, 10).map(([x, y]) => D(x, y)).reverse()]);
  b.noHatch();
  b.set('charcoal', th.ink, 2.4);
  b.spline(ellipse(165, 12, 155, 9, 160, 300, 16).map(([x, y]) => D(x, y)), 0.5);
  b.set('2B', th.ink, 1.5);
  b.spline(ellipse(165, 12, 140, 26, 110, 160, 8).map(([x, y]) => D(x, y)), 0.5);
  b.set('charcoal', th.bg, 2.6);
  b.spline(ellipse(165, 12, 155, 32, 10, 120, 14).map(([x, y]) => D(x, y)), 0.5);
  // ---- bell (40 x 40 world)
  const E = (x: number, y: number): Pt => [850 + x * S, 660 + y * S];
  wash(g, [E(18, 3), E(22, 3), E(25, 8), E(28, 18), E(31, 28), E(37, 34), E(20, 36.5), E(3, 34), E(9, 28), E(12, 18), E(15, 8)], th.muted, 90, 35);
  b.noStroke();
  b.hatch(1.2 * S, 70, {rand: 0.1});
  b.hatchStyle('2B', th.bg, 1.2);
  b.polygon([E(22, 4), E(25, 8), E(28, 18), E(31, 28), E(37, 34), E(24, 36)]);
  b.noHatch();
  b.set('charcoal', th.ink, 1.8);
  b.spline([E(18, 3), E(15, 8), E(12, 18), E(9, 28), E(3, 34)], 0.5);
  b.set('charcoal', th.bg, 2);
  b.spline([E(3, 34), E(20, 36.5), E(37, 34)], 0.5);
};

// The plate: black paper, the hanging rope, the stirrup window and the counter. World offset (-100, -150).
const PLATE = {x: -100, y: -150, w: 1280, h: 2220, d: 1.5};
const paintPlate = (b: Brush, g: G, th: Theme) => {
  const P = (pts: number[][]): Pt[] => pts.map(([x, y]) => [x - PLATE.x, y - PLATE.y]);
  const Q = (x: number, y: number): Pt => [x - PLATE.x, y - PLATE.y];
  const r = rng(77);
  // wood grain and seams as smooth pencil lines (brush texture glitters at this scale)
  const line2d = (pts: Pt[], c: string, a0: number, a1: number, wd: number) => {
    const gr = g.createLinearGradient(pts[0][0], 0, pts.at(-1)![0], 0);
    gr.addColorStop(0, mix(c, a0));
    gr.addColorStop(1, mix(c, a1));
    g.strokeStyle = gr;
    g.lineWidth = wd;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  };
  // counter top: a deep plane lit from the left, its boards receding toward the back wall
  wash(g, P([[-100, REAR], [1180, REAR], [1180, COUNTER], [-100, COUNTER]]), th.muted, 30, 7);
  for (let i = 1; i < 15; i++) {
    const y = REAR + (COUNTER - REAR) *(i / 15) ** 1.5 + r() * 2;
    const seam = i % 4 === 0;
    line2d(Array.from({length: 23}, (_, q) => Q(-100 + q * 60, y + Math.sin(q * 0.7 + i * 2) * (0.5 + i * 0.12))), seam ? th.bg : th.muted, seam ? 80 : 26, seam ? 40 : 3, seam ? 1.4 + i * 0.1 : 0.7 + i * 0.06);
  }
  // the front edge: a lit bevel
  line2d([Q(-100, COUNTER), Q(1180, COUNTER + 1)], th.ink, 75, 14, 2.2);
  line2d([Q(-100, COUNTER + 4), Q(1180, COUNTER + 5)], th.muted, 32, 6, 5);
  // the face: planks with seams, grain, knots and nails, falling off away from the light
  wash(g, P([[-100, COUNTER + 8], [1180, COUNTER + 8], [1180, 2070], [-100, 2070]]), th.muted, 15, 4);
  for (let p = 0; p < 7; p++) {
    const y0 = COUNTER + 8 + p * 128;
    line2d([Q(-100, y0), Q(1180, y0)], th.bg, 95, 75, 3.5);
    line2d([Q(-100, y0 + 3), Q(1180, y0 + 3)], th.muted, 26, 5, 1.2);
    for (let q = 0; q < 6; q++) {
      const yy = y0 + 14 + q * 19 + r() * 6;
      const ph = r() * 6;
      line2d(Array.from({length: 24}, (_, s) => Q(-100 + s * 56, yy + Math.sin(s * 0.45 + ph) * 3 + Math.sin(s * 1.7 + ph))), th.muted, 22 + r() * 10, 3, 0.7 + r() * 0.7);
    }
    for (const x of [70, 1010]) {
      g.fillStyle = mix(th.muted, 50);
      g.beginPath();
      g.arc(...Q(x, y0 + 64), 3.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  // the sign panel, recessed: lit from the upper left, so its top and left inner walls are in shadow
  const [px0, py0, px1, py1] = PANEL;
  const bev = 14;
  wash(g, P([[px0, py0], [px1, py0], [px1, py1], [px0, py1]]), th.bg, 85, 70);
  wash(g, P([[px0 + bev, py0 + bev], [px1 - bev, py0 + bev], [px1 - bev, py1 - bev], [px0 + bev, py1 - bev]]), th.muted, 12, 4);
  wash(g, P([[px0, py1], [px0 + bev, py1 - bev], [px1 - bev, py1 - bev], [px1, py1]]), th.muted, 18, 6);
  wash(g, P([[px1, py0], [px1, py1], [px1 - bev, py1 - bev], [px1 - bev, py0 + bev]]), th.muted, 14, 4);
  // rope, ring, stirrup window and straps down to the pivot
  b.set('charcoal', th.muted, 3);
  b.spline([Q(538, -150), Q(542, 20), Q(539, 190)], 0.5);
  b.set('2B', th.ink, 1.2);
  for (let y = -140; y < 186; y += 9) b.line(...Q(536, y), ...Q(543, y + 6));
  b.set('charcoal', th.ink, 2);
  b.spline(ellipse(...Q(540, 204), 10, 10, 0, 360, 18), 0.5);
  for (const pts of [
    [[480, 214], [600, 214], [600, 225], [480, 225]],
    [[480, 341], [600, 341], [600, 352], [480, 352]],
    [[480, 214], [491, 214], [491, 352], [480, 352]],
    [[589, 214], [600, 214], [600, 352], [589, 352]],
    [[492, 350], [503, 350], [533, 397], [527, 400]],
    [[577, 350], [588, 350], [553, 400], [547, 397]],
  ])
    wash(g, P(pts), th.muted, 80, 45);
  b.set('charcoal', th.ink, 1.8);
  b.line(...Q(480, 214), ...Q(600, 214));
  b.line(...Q(480, 214), ...Q(480, 352));
  b.line(...Q(589, 226), ...Q(589, 340));
  b.set('charcoal', th.bg, 2);
  b.line(...Q(600, 214), ...Q(600, 352));
  b.line(...Q(480, 352), ...Q(600, 352));
  b.line(...Q(491, 226), ...Q(491, 340));
  b.set('HB', th.muted, 0.8);
  b.line(...Q(540, 225), ...Q(540, 236));
};

// ---------- paper props ----------
const DIDOT = 'Didot, "Bodoni 72", serif';
const STAMP = 'Copperplate, "Copperplate Gothic", serif';
const paper = (th: Theme, shade = 82) => `linear-gradient(168deg, ${th.ink} 0%, color-mix(in srgb, ${th.ink} ${shade}%, ${th.bg}) 100%)`;
const SLIP_W = 62;
const SLIP_H = 96;
const torn = 'polygon(0% 3%, 8% 0%, 17% 3%, 25% 0%, 34% 3%, 42% 0%, 51% 3%, 59% 0%, 68% 3%, 76% 0%, 85% 3%, 93% 0%, 100% 3%, 100% 94%, 70% 97%, 40% 100%, 0% 97%)';

// The count as printed matter. `prev`/`since` animate a reprint: the old figure lifts away, the new one inks in.
const Slip: React.FC<{th: Theme; n: string; unit?: string; note?: string; prev?: string; since?: number; blank?: boolean}> = ({th, n, unit = 'BAGS', note, prev, since = 9, blank}) => {
  const p = k(since, [0, 0.2], [0, 1]);
  const ink = {color: th.bg, fontFamily: DIDOT, position: 'absolute' as const, left: 0, right: 0, textAlign: 'center' as const};
  return (
    <>
    {/* the end of the strip that lies curled in the dish, behind the rim */}
    <div style={{position: 'absolute', left: -SLIP_W / 2 + 3, top: -11, width: SLIP_W - 6, height: 13, background: paper(th, 70), borderRadius: '45% 55% 10% 10% / 90% 90% 10% 10%'}} />
    <div data-tb-skip style={{position: 'absolute', left: -SLIP_W / 2, top: 0, width: SLIP_W, height: SLIP_H, background: paper(th), clipPath: torn, overflow: 'hidden'}}>
      {blank ? (
        [16, 34, 42, 50, 70].map((y, i) => <div key={i} style={{position: 'absolute', left: 9, right: i % 2 ? 22 : 12, top: y, height: i === 1 ? 9 : 2.2, background: `color-mix(in srgb, ${th.bg} ${i === 1 ? 55 : 35}%, transparent)`}} />)
      ) : (
        <>
          <div style={{...ink, top: 11, fontSize: 7, letterSpacing: '0.38em', textIndent: '0.38em'}}>RICE</div>
          <div style={{...ink, top: 19, height: 50, overflow: 'hidden'}}>
            {prev && p < 1 ? <div style={{position: 'absolute', left: 0, right: 0, top: 0, fontSize: 44, lineHeight: '50px', transform: `translateY(${-p * 16}px)`, opacity: 1 - p}}>{prev}</div> : null}
            <div style={{position: 'absolute', left: 0, right: 0, top: 0, fontSize: 44, lineHeight: '50px', fontVariantNumeric: 'lining-nums', opacity: prev ? p : 1, filter: prev && p < 1 ? `blur(${(1 - p) * 1.6}px)` : undefined}}>{n}</div>
          </div>
          <div style={{...ink, top: 70, fontSize: 7, letterSpacing: '0.38em', textIndent: '0.38em'}}>{unit}</div>
          {note ? <div style={{...ink, top: 79, fontSize: 9, fontStyle: 'italic', color: th.muted, textDecoration: 'line-through'}}>{note}</div> : null}
        </>
      )}
      <div style={{position: 'absolute', inset: 0, background: `linear-gradient(180deg, color-mix(in srgb, ${th.bg} 30%, transparent) 0%, transparent 14%)`}} />
    </div>
    </>
  );
};

// A chit for the spike: what was asked, and the stamps it gets ([word, seconds since stamped, rotation, size, left, top]).
type Stamp = [string, number, number, number, number, number];
const Chit: React.FC<{th: Theme; head: string; n: string; unit: string; foot: string; stamps: Stamp[]}> = ({th, head, n, unit, foot, stamps}) => {
  const stamp = (p: number, rot: number, size: number): React.CSSProperties => ({
    position: 'absolute', fontFamily: STAMP, fontWeight: 700, fontSize: size, letterSpacing: '0.08em', color: `color-mix(in srgb, ${th.bg} 88%, transparent)`,
    border: `2.5px double color-mix(in srgb, ${th.bg} 88%, transparent)`, padding: '1px 6px 0', filter: 'url(#ink-strong)', opacity: k(p, [0, 0.05], [0, 1]),
    transform: `rotate(${rot}deg) scale(${1 + 0.4 * k(p, [0, 0.07], [1, 0], IN)})`,
  });
  const ink = {position: 'absolute' as const, color: th.bg, fontFamily: DIDOT};
  return (
    <div data-tb-skip style={{position: 'absolute', left: -64, top: -14, width: 128, height: 96, background: paper(th, 86), boxShadow: `3px 5px 10px color-mix(in srgb, ${th.bg} 80%, transparent)`}}>
      <div style={{...ink, left: 10, top: 6, fontFamily: STAMP, fontSize: 8, letterSpacing: '0.3em'}}>{head}</div>
      <div style={{position: 'absolute', left: 10, right: 10, top: 18, height: 1, background: `color-mix(in srgb, ${th.bg} 40%, transparent)`}} />
      <div style={{position: 'absolute', left: 61, top: 11, width: 6, height: 6, borderRadius: 3, background: th.surface}} />
      <div style={{...ink, left: 10, top: 23, fontSize: 14, fontStyle: 'italic'}}>Rice</div>
      <div style={{...ink, left: 10, top: 34, fontSize: 40, lineHeight: '44px'}}>{n}</div>
      <div style={{...ink, left: n.length > 1 ? 58 : 38, top: 52, fontSize: 13, fontStyle: 'italic'}}>{unit}</div>
      <div style={{...ink, left: 10, top: 76, fontSize: 12, fontStyle: 'italic'}}>{foot}</div>
      <svg width={128} height={96} style={{position: 'absolute', left: 0, top: 0}}>
        <path d="M10 91 C 24 89, 38 92, 50 90 M12 94 C 26 92, 40 95, 48 93" stroke={th.muted} strokeWidth={1} fill="none" />
      </svg>
      {stamps.map(([word, p, rot, size, left, top]) => (
        <div key={word} style={{...stamp(p, rot, size), left, top}}>
          {word}
        </div>
      ))}
    </div>
  );
};

// A hanging chain from the ring (0, 0) to a point on the rim: oval links face-on, alternating with links seen edge-on.
const Chain: React.FC<{th: Theme; to: Pt; back?: boolean}> = ({th, to: [x2, y2], back}) => {
  const n = Math.floor(Math.hypot(x2, y2) / 9);
  const c = back ? th.rule : th.muted;
  return (
    <g transform={`rotate(${(Math.atan2(y2, x2) * 180) / Math.PI})`} filter="url(#ink)">
      {Array.from({length: n}, (_, i) =>
        i % 2 ? (
          <line key={i} x1={i * 9 + 1} x2={i * 9 + 8} y1={0} y2={0} stroke={c} strokeWidth={2.6} strokeLinecap="round" />
        ) : (
          <ellipse key={i} cx={i * 9 + 4.5} cy={0} rx={5.6} ry={2.8} fill="none" stroke={c} strokeWidth={1.8} />
        ),
      )}
      {back ? null : Array.from({length: Math.ceil(n / 2)}, (_, i) => <path key={`h${i}`} d={`M${i * 18 + 1.5} -1.8 Q ${i * 18 + 4.5} -3.4 ${i * 18 + 7.5} -1.8`} stroke={th.ink} strokeWidth={1} fill="none" opacity={0.65} />)}
    </g>
  );
};

// ---------- the film ----------
export const Film: React.FC = () => {
  const th = useTheme();
  const {t, beats, total, cta} = useFilm();
  const atlas = useMemoOnce(() => paintCanvas(1800, 800, 1, 41, (b, g) => paintAtlas(b, g, th)));
  const plate = useMemoOnce(() => paintCanvas(PLATE.w, PLATE.h, PLATE.d, 7, (b, g) => paintPlate(b, g, th)));

  // when a word is spoken (share of its line's measured clip)
  const w = (i: number, s: string) => {
    const b = beats[i];
    return b.vo![0] + (Math.max(0, b.text.indexOf(s)) / b.text.length) * (b.vo![1] - b.vo![0]);
  };
  const T = {
    land: 0.2,
    b1: beats[1].start, godown: w(1, 'The godown'), thirty: w(1, 'thirty'), eight: w(1, 'Eight'), silently: w(1, 'silently'), v1e: beats[1].vo![1],
    b2: beats[2].start, ten: w(2, 'ten bags'), yes: w(2, 'says yes') + 0.2, no: w(2, 'says no') + 0.2, emb: w(2, 'Embarrassing'),
    b3: beats[3].start, fifty: w(3, 'fifty') + 0.1, forgets: w(3, 'forgets'), units: w(3, 'Wrong') + 0.1, tear: w(3, 'damaged') + 0.05, more: w(3, 'lies more'),
    b4: beats[4].start, v4: beats[4].vo![0],
    b5: beats[5].start, v5: beats[5].vo![0], order: w(5, 'Order more'),
    b6: beats[6].start, software: w(6, 'software'), owngodown: w(6, 'godown'), v6e: beats[6].vo![1],
    b7: beats[7].start,
  };
  const gust = T.v4 - 0.12;
  const trueLand = gust + 0.42;
  const levelAt = trueLand + 0.7;
  const huskOff = T.tear + 0.9; // the torn sack leaves the pan
  const huskLand = huskOff + 0.36;
  const FLOOR = 1088; // where things that fall off the pans land on the counter top
  const slips = [
    {land: T.land, n: '40', x: -12, rot: -3},
    {land: T.fifty, n: '50', note: '15', x: -3, rot: 5},
    {land: T.units, n: '40', unit: 'KG', x: -20, rot: -7},
    {land: T.more - 0.05, blank: true, x: 9, rot: 9},
    {land: T.more + 0.14, blank: true, x: -9, rot: -4},
  ];

  // ---- the goods: 40 places in a pyramid, 32 sacks at the start (two rows short, gaps on the shoulders)
  const stack = useMemoOnce(() => {
    const rj = rng(5);
    return ROWS.flatMap((n, r) =>
      Array.from({length: n}, (_, i) => ({r, i, c: Math.abs(i - (n - 1) / 2), x: (i - (n - 1) / 2) * 30 + (r % 2 ? 2 : -2) + (rj() - 0.5) * 4, y: L + 6 - r * 25 + (rj() - 0.5) * 2, v: Math.floor(rj() * 9), lean: (rj() - 0.5) * 5})),
    );
  });
  type Sack = (typeof stack)[number];
  const drawOrder = useMemoOnce(() => [...stack].sort((a, b) => b.r - a.r)); // back rows first, the bottom row in front
  const start = (s: Sack) => s.r <= 2 || (s.r === 3 && s.i <= 4) || (s.r === 4 && s.i >= 1 && s.i <= 3);
  const forgot = stack.find((s) => s.r === 4 && s.i === 3)!; // sold, never written down
  const husk = stack.find((s) => s.r === 4 && s.i === 1)!; // the damaged one
  const thirty = stack.filter((s) => start(s) && s !== forgot && s !== husk).sort((a, b) => b.r - a.r || b.c - a.c);
  const sold = thirty.slice(0, 25); // each sale takes the top sack, one at a time
  const kept = thirty.slice(25);
  const refill = stack.filter((s) => !kept.includes(s)).sort((a, b) => a.r - b.r || a.c - b.c);
  const saleFrom = levelAt + 0.15;
  const sales = sold.map((_, i) => saleFrom + 1.9 * (i / 24) ** 0.85); // slow at first, then the day speeds up
  const alertAt = sales[24] + 0.12;
  const bells = [alertAt, T.v5 - 0.35];
  const restock = refill.map((_, i) => T.order + 0.35 + 2.3 * (i / 34) ** 0.8);
  const outAt = (s: Sack) => (s === forgot ? T.forgets + 0.1 : sold.includes(s) ? sales[sold.indexOf(s)] : undefined);
  const inAt = (s: Sack) => (refill.includes(s) ? restock[refill.indexOf(s)] : undefined);
  const count = 30 - sales.filter((x) => t >= x).length + restock.filter((x) => t >= x).length;
  const lastChange = [trueLand, ...sales, ...restock].filter((x) => t >= x).at(-1) ?? trueLand;
  const prevCount = sales.includes(lastChange) ? count + 1 : count - 1;

  // ---- the beam
  const EVS: Ev[] = [
    [T.land, 8, 2.2, 0.45], // slams past level, hits the stop, swings back
    [T.fifty + 0.02, 10.5, 1.6, 0.9],
    [T.forgets + 0.25, 12, 1.4, 0.9],
    [T.units + 0.02, 13.2, 1.6, 0.9],
    [huskOff, 14.2, 1.5, 0.9],
    [T.more - 0.03, 15.4, 1.3, 0.7],
    [gust + 0.08, -6, 1.1, 0.8],
    [trueLand, 0, 1.3, 1.5],
  ];
  const theta = (s: number) => beamAt(s, EVS, -7);
  const th0 = theta(t);
  const swing = (s: number) => Math.max(-12, Math.min(12, -(theta(s) - theta(s - 0.1)) * 1.4));
  const phiL = swing(t) + kicks(t, [...slips.map((s) => s.land + 0.02), trueLand + 0.02], 1.2, 1.6, 2.5);
  const phiR = swing(t) + kicks(t, [...sales, ...restock], 0.22, 1.5, 2.2) + kicks(t, [T.forgets + 0.1, huskOff], 1.1, 1.5, 2.2);

  // ---- camera: the tableau, then moves through it; two cuts, each on a sound
  const K: Key[] = [
    [0, 540, 900, 1.12],
    [T.land, 540, 900, 1.12],
    [T.land + 1.2, 525, 885, 1.2],
    [T.b1 - 0.35, 520, 880, 1.24],
    [T.b1 + 0.8, 230, 960, 2.2],
    [T.godown - 0.25, 235, 965, 2.3],
    [T.godown + 0.55, 850, 800, 1.9],
    [T.b2 - 0.3, 850, 790, 2.0],
    [T.b2 + 0.85, 390, 990, 1.75],
    [T.yes + 0.1, 410, 995, 1.85],
    [T.no + 0.1, 410, 995, 1.9],
    [T.b3 - 0.25, 400, 985, 1.75],
    [T.fifty - 0.15, 250, 930, 2.0],
    [T.units + 0.3, 245, 950, 2.05],
    [T.tear - 0.35, 830, 820, 1.9],
    [huskLand + 0.15, 720, 900, 1.7],
    [T.b4 - 0.1, 540, 890, 1.14],
    [saleFrom, 540, 890, 1.14],
    [alertAt - 0.3, 540, 860, 1.17],
    [alertAt + 0.45, 840, 570, 1.9],
    [T.v5 - 0.22, 845, 565, 1.95],
    [T.v5 - 0.21, 540, 1000, 1.85], // cut on the second bell: the alert lands on the spike
    [T.order + 0.24, 540, 1005, 1.9],
    [T.order + 0.25, 560, 860, 1.17], // cut on the ORDER stamp: the pan fills
    [T.b6 - 0.1, 545, 870, 1.14],
    [T.b6 + 0.9, 280, 940, 1.9],
    [T.software + 0.3, 285, 940, 1.95],
    [T.owngodown, 820, 820, 1.75],
    [T.v6e - 0.1, 540, 330, 2.3],
    [T.b7 + 0.7, 540, 1100, 0.96],
    [total, 540, 1104, 0.97],
  ];

  const sackStyle = (s: Sack): React.CSSProperties | null => {
    let dx = 0;
    let dy = 0;
    let sx = 1;
    let sy = 1;
    let rot = s.lean;
    const tin = inAt(s);
    const tout = outAt(s);
    if (tin !== undefined && t >= tin - 0.3) {
      dy = -700 * (1 - k(t, [tin - 0.3, tin], [0, 1], IN));
      const q = t > tin ? settle(t, tin, 4.5, 1.3) : 0;
      sy = 1 - 0.14 * q;
      sx = 1 + 0.08 * q;
    } else if (s === husk && t >= T.tear) {
      if (t >= huskOff) return null;
      const d = k(t, [T.tear, T.tear + 0.5], [0, 1]);
      sy = 1 - 0.35 * d;
      sx = 1 + 0.12 * d;
      const sl = k(t, [T.tear + 0.5, huskOff], [0, 1], IN);
      dx = (-RIM + 4 - s.x) * sl;
      dy = (L - 4 - s.y) * sl * 0.9;
      rot += -38 * sl;
    } else if (tout !== undefined && t >= tout - 0.06) {
      // sold: gripped by the neck, lifted clear of the pile, carried off
      const pre = k(t, [tout - 0.06, tout], [0, 1]);
      const lift = k(t, [tout, tout + 0.08], [0, 1]);
      const go = k(t, [tout + 0.04, tout + 0.28], [0, 1], IN);
      if (go >= 1) return null;
      sy = 1 + 0.08 * lift - 0.06 * pre * (1 - lift);
      dy = -30 * lift - 40 * go;
      dx = 900 * go;
      rot += 10 * lift + 30 * go;
    } else if (!start(s)) return null;
    if (t < 3) dy -= Math.abs(kicks(t, [T.land, 0.55], 1 + s.r * 0.9, 5, 6));
    return {left: s.x - SW / 2 + dx, top: s.y - SH + dy, transform: `rotate(${rot}deg) scale(${sx}, ${sy})`, transformOrigin: '50% 100%'};
  };

  // ---- slips in the left pan (and the gust that clears every claim at the turn)
  const gusted = (i: number) => {
    const g = k(t, [gust + i * 0.035, gust + 0.62 + i * 0.035], [0, 1], IN);
    return {dx: -1100 * g, dy: -300 * g + 40 * Math.sin(g * 6), rot: -160 * g};
  };
  // sc scales the slip; lift stands it up in the dish instead of hanging over the lip
  const slipStyle = (land: number, x: number, rot: number, i: number, sc: number, lift: number): React.CSSProperties | null => {
    if (t < land - 0.45) return null;
    if (t < land) {
      // falling fast through open air, turning over as paper does
      const d = land - t;
      const f = Math.min(1, d * 4);
      return {left: x + Math.sin(t * 7 + i) * 14 * f, top: L - 2 - lift - 900 * d, transform: `rotate(${rot + Math.sin(t * 11 + i) * 24 * f}deg) scaleY(${0.6 + 0.4 * Math.abs(Math.cos(t * 8 + i))}) scale(${sc})`, transformOrigin: '50% 0'};
    }
    const g = i < 0 ? {dx: 0, dy: 0, rot: 0} : gusted(i);
    const flop = k(t, [land, land + 0.15], [0.3, 1], IN);
    return {left: x + g.dx, top: L - 2 - lift + g.dy, transform: `rotate(${rot + g.rot + 5 * settle(t, land + 0.15, 2.6, 1.3) * (t > land + 0.15 ? 1 : 0)}deg) scaleY(${flop}) scale(${sc})`, transformOrigin: '50% 0'};
  };
  // a falling slip leaves two fading after-images above it
  const slipEl = (key: string, land: number, x: number, rot: number, i: number, sc: number, lift: number, node: React.ReactNode) => {
    const st = slipStyle(land, x, rot, i, sc, lift);
    if (!st) return null;
    return (
      <React.Fragment key={key}>
        {(t < land ? [2, 1] : []).map((n) => (
          <div key={n} style={{position: 'absolute', ...st, top: (st.top as number) - 42 * n, opacity: 0.24 / n}}>
            {node}
          </div>
        ))}
        <div style={{position: 'absolute', ...st}}>{node}</div>
      </React.Fragment>
    );
  };

  // ---- the torn sack's fall and its rice, in world space
  const huskFrom = toWorld(1, theta(huskOff), 0, [-RIM + 4, L - 4]);
  const huskTo: Pt = [huskFrom[0] - 16, FLOOR - 8];
  const huskPos = (s: number): Pt => {
    const p = k(s, [huskOff, huskLand], [0, 1], (x) => x);
    return [huskFrom[0] + (huskTo[0] - huskFrom[0]) * p, huskFrom[1] + (huskTo[1] - huskFrom[1]) * p * p];
  };
  const grains = useMemoOnce(() => {
    const r = rng(311);
    return Array.from({length: 150}, () => ({e: r(), vx: (r() - 0.5) * 70, vy: r() * 50, jx: (r() - 0.5) * 36, jy: r() * 7, s: 0.7 + r() * 0.6}));
  });
  const pourFrom = huskOff - 0.05;
  const pourTo = huskLand + 0.55;

  // ---- bell (hangs from the right ring; rings by itself once the count is linked)
  const ringAmp = bells.reduce((a, b0) => (t > b0 ? a + 24 * Math.exp(-(t - b0) * 2.2) * Math.sin((t - b0) * 4.2 * Math.PI * 2) : a), 0);
  const psi = ringAmp - phiR * 0.5 + kicks(t, [T.land], 4, 1.4, 1.5);
  const bellLime = t >= bells[0];

  const [lx, ly] = ring(-1, th0);
  const [rx, ry] = ring(1, th0);
  const chains = (back: boolean) => (back ? [[0, L - 20] as Pt] : [[-RIM, L] as Pt, [RIM, L] as Pt]).map((p, i) => <Chain key={i} th={th} to={p} back={back} />);
  const lip = (
    <g filter="url(#ink)">
      <path d={`M ${-RIM} ${L} A ${RIM} 9 0 0 0 ${RIM} ${L}`} stroke={th.ink} strokeWidth={2.8} fill="none" opacity={0.85} />
      <path d={`M ${-RIM + 8} ${L + 5} A ${RIM - 8} 8 0 0 0 ${RIM - 40} ${L + 8}`} stroke={th.bg} strokeWidth={2.2} fill="none" opacity={0.6} />
    </g>
  );
  const panSvg = (children: React.ReactNode) => (
    <svg width={400} height={700} viewBox="-200 -60 400 700" style={{position: 'absolute', left: -200, top: -60, overflow: 'visible'}}>
      {children}
    </svg>
  );
  const dish = <View src={atlas} r={A.dish} scale={1 / S} style={{left: -165, top: L - 12}} />;

  // the customer's order on the spike: falls, is spiked, stamped twice, droops; the gust rips it away
  const chitIn = k(t, [T.ten - 0.35, T.ten], [0, 1], IN);
  const chitG = k(t, [gust + 0.02, gust + 0.6], [0, 1], IN);
  const chitY = 990 - 520 * (1 - chitIn) - 4 * k(t, [T.yes, T.yes + 0.05], [0, 1]) - 3 * k(t, [T.no, T.no + 0.05], [0, 1]) - 260 * chitG;
  const chitRot = 9 * k(t, [T.emb, T.emb + 0.5], [0, 1], BACK) + 3 * settle(t, T.no, 3, 1.6) * (t > T.no ? 1 : 0) - 150 * chitG;
  // the stock's own alert: lands on the same spike by itself, and is stamped ORDER
  const alertIn = k(t, [T.v5 - 0.3, T.v5], [0, 1], IN);
  const alertY = 990 - 520 * (1 - alertIn) - 4 * k(t, [T.order, T.order + 0.05], [0, 1]);
  const alertRot = -4 + 3 * settle(t, T.v5, 3, 1.6) * (t > T.v5 ? 1 : 0) + 2 * settle(t, T.order, 3, 1.6) * (t > T.order ? 1 : 0);
  const impaled = (chitIn > 0 && chitG < 0.05) || alertIn >= 1;

  // CTA painted into the counter's sign panel by a sign-writer's brush
  const signAt = T.b7 + 0.62; // the camera has come down to the counter
  const sign = k(t, [signAt, signAt + 0.85], [-12, 112], (x) => x);
  const swash = k(t, [signAt + 0.7, signAt + 1.05], [0, 1]);
  const under = k(t, [signAt + 0.9, signAt + 1.3], [0, 1]);
  const wipe = (p: number) => `linear-gradient(97deg, black ${p - 6}%, transparent ${p + 3}%)`;

  const cues: Cue[] = [
    [0, 'page', 0.32], [T.land, 'land', 0.5], [T.land + 0.02, 'metal', 0.65], [T.land + 0.22, 'metal', 0.35], [0.5, 'creak', 0.4],
    [T.thirty, 'soft', 0.22],
    [T.ten - 0.02, 'knife', 0.35], [T.yes, 'stamp', 0.7], [T.no, 'stamp', 0.85], [T.emb + 0.05, 'tear', 0.22],
    [T.fifty, 'page', 0.35], [T.fifty + 0.03, 'metal', 0.3], [T.forgets + 0.1, 'cloth', 0.3], [T.forgets + 0.3, 'creak', 0.35], [T.units, 'flip', 0.35],
    [T.tear, 'tear', 0.55], [huskLand, 'sack', 0.5], [T.more - 0.05, 'page', 0.28], [T.more, 'metal', 0.6], [T.more + 0.14, 'page', 0.22],
    [gust, 'swish', 0.65], [gust + 0.05, 'tear', 0.3], [trueLand, 'land', 0.3], [levelAt, 'latch', 0.45],
    ...sales.filter((_, i) => i < 4 || i % 3 === 0).map((s, i): Cue => [s, 'cloth', i < 4 ? 0.3 : 0.18]),
    ...bells.map((s, i): Cue => [s, 'bell', 0.55 - i * 0.1]),
    [T.v5 - 0.02, 'knife', 0.35], [T.order, 'stamp', 0.85],
    ...restock.filter((_, i) => i < 4 || i % 3 === 0).map((s, i): Cue => [s, 'sack', i < 4 ? 0.48 : 0.26]),
    [signAt, 'pen', 0.3],
  ];

  return (
    <div style={{position: 'absolute', inset: 0, background: th.bg, overflow: 'hidden'}}>
      <InkDefs seed={4} />
      {/* the camera breathes, and recoils once when the slip slams the beam over */}
      <div style={{position: 'absolute', inset: 0, transform: `${drift(t, 4)} translateY(${kicks(t, [T.land, T.land + 0.22], 6, 3, 5)}px)`}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: cam(t, K), transformOrigin: '0 0'}}>
          {/* one shaft of light from the upper left: a soft pool on the balance, a raking band, a pool on the counter top */}
          <div style={{position: 'absolute', left: PLATE.x, top: PLATE.y, width: PLATE.w, height: PLATE.h, background: `radial-gradient(ellipse 34% 22% at 48% 34%, color-mix(in srgb, ${th.ink} 15%, transparent), transparent 100%), radial-gradient(ellipse 70% 42% at 46% 38%, color-mix(in srgb, ${th.ink} 7%, transparent), transparent 100%), radial-gradient(ellipse 46% 5% at 40% 54%, color-mix(in srgb, ${th.ink} 8%, transparent), transparent 100%), linear-gradient(122deg, transparent 22%, color-mix(in srgb, ${th.ink} 5%, transparent) 33%, color-mix(in srgb, ${th.ink} 7%, transparent) 41%, transparent 55%)`}} />
          <View src={plate} r={[0, 0, PLATE.w, PLATE.h]} d={PLATE.d} scale={1} style={{left: PLATE.x, top: PLATE.y}} />
          {/* the pointer's graduated scale on the stirrup window, engraved; its centre tick turns lime once the beam rests level */}
          <svg width={120} height={30} viewBox="480 222 120 30" style={{position: 'absolute', left: 480, top: 222}}>
            {[-15, -12, -9, -6, -3, 3, 6, 9, 12, 15].map((a) => {
              const x = PIV[0] + 175 * Math.tan(rad(a));
              return <line key={a} x1={x} y1={225} x2={x + (a > 0 ? 0.8 : -0.8)} y2={225 + (a % 6 === 0 ? 9 : 5.5)} stroke={th.ink} strokeWidth={1.4} opacity={0.6} />;
            })}
          </svg>
          <div style={{position: 'absolute', left: 538.4, top: 225, width: 3.2, height: 14, background: th.ok, transformOrigin: '50% 0', transform: `scaleY(${k(t, [levelAt - 0.15, levelAt + 0.1], [0, 1])})`}} />
          {/* pans' soft shadows on the counter top (light from the upper left) */}
          <svg width={1080} height={200} viewBox={`0 ${REAR - 40} 1080 200`} style={{position: 'absolute', left: 0, top: REAR - 40}}>
            <defs>
              <filter id="soft" x="-50%" y="-200%" width="200%" height="500%">
                <feGaussianBlur stdDeviation={10} />
              </filter>
            </defs>
            {[[lx, ly], [rx, ry]].map(([x, y], i) => (
              <ellipse key={i} cx={x + 70} cy={REAR + 46} rx={150} ry={12} fill={th.bg} opacity={0.4 + (y - 330) / 400} filter="url(#soft)" />
            ))}
          </svg>
          {/* beam and pointer */}
          <View src={atlas} r={A.beam} scale={1 / S} style={{left: PIV[0] - 340, top: PIV[1] - 184, transformOrigin: '340px 184px', transform: `rotate(${-th0}deg)`}} />
          {/* left pan: the claims */}
          <div style={{position: 'absolute', left: lx, top: ly, transform: `rotate(${phiL}deg)`, transformOrigin: '0 0'}}>
            {panSvg(chains(true))}
            {dish}
            {slips.map((s, i) => slipEl(`s${i}`, s.land, s.x, s.rot, i, 1, 0, <Slip th={th} n={s.n ?? ''} unit={s.unit} note={s.note} blank={s.blank} />))}
            {slipEl('true', trueLand, -6, -1, -1, 1.45, SLIP_H * 1.45 - 24, <Slip th={th} n={String(count)} prev={t - lastChange < 0.2 && lastChange !== trueLand ? String(prevCount) : undefined} since={t - lastChange} />)}
            {panSvg(
              <>
                {chains(false)}
                {lip}
              </>,
            )}
          </div>
          {/* right pan: the goods */}
          <div style={{position: 'absolute', left: rx, top: ry, transform: `rotate(${phiR}deg)`, transformOrigin: '0 0'}}>
            {panSvg(chains(true))}
            <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${psi - phiR}deg)`, transformOrigin: '0 0'}}>
              <svg width={4} height={70} style={{position: 'absolute', left: -2, top: 0}}>
                <line x1={2} y1={0} x2={2} y2={66} stroke={th.muted} strokeWidth={1.8} />
              </svg>
              <View src={atlas} r={A.bell} scale={1.8 / S} style={{left: -36, top: 63}} />
              <div style={{position: 'absolute', left: -6, top: 127, width: 12, height: 12, borderRadius: 6, background: bellLime ? th.ok : th.muted}} />
            </div>
            {dish}
            <svg width={340} height={40} style={{position: 'absolute', left: -170, top: L - 22}}>
              <ellipse cx={170} cy={20} rx={150} ry={7} fill={th.bg} opacity={0.55} />
            </svg>
            {drawOrder.map((s, i) => {
              const st = sackStyle(s);
              return st ? (
                <div key={i} style={{position: 'absolute', width: SW, height: SH, ...st}}>
                  <View src={atlas} r={A.sack(s.v)} scale={0.34} style={{filter: `brightness(${0.74 + ((s.v * 37) % 20) / 100 + s.r * 0.03 - s.x / 1400})`}} />
                  {s === husk && t >= T.tear ? (
                    <svg width={SW} height={SH} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
                      <path d="M8 20 L13 25 L16 21 L21 28 L26 23" pathLength={1} stroke={th.bg} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - k(t, [T.tear, T.tear + 0.18], [0, 1])} />
                    </svg>
                  ) : null}
                </div>
              ) : null;
            })}
            {/* the eight that vanished: dotted outlines where the count says sacks should be */}
            {stack
              .filter((s) => !start(s))
              .map((s, j) => {
                const o = k(t, [T.eight + j * 0.08, T.eight + j * 0.08 + 0.2], [0, 0.8]) * k(t, [T.silently + 0.15, T.silently + 1.0], [1, 0]);
                return o > 0.01 ? (
                  <svg key={`g${j}`} width={SW} height={SH} style={{position: 'absolute', left: s.x - SW / 2, top: s.y - SH - 8 * k(t, [T.silently + 0.15, T.silently + 1.0], [0, 1]), opacity: o, overflow: 'visible'}}>
                    <path d="M12 5 C 9 2, 14 0, 17 3 C 20 0, 25 2, 22 5 L 23 9 C 30 12, 33 22, 33 32 C 33 40, 28 43, 17 43 C 6 43, 1 40, 1 32 C 1 22, 4 12, 11 9 Z" stroke={th.ink} strokeWidth={1.5} strokeDasharray="4 3" fill="none" />
                  </svg>
                ) : null;
              })}
            {/* the hand count, hung on the chain */}
            {(() => {
              const at = T.thirty - 0.1;
              if (t < at) return null;
              const g = k(t, [gust, gust + 0.55], [0, 1], IN);
              if (g >= 1) return null;
              const sw = -70 * (1 - k(t, [at, at + 0.2], [0, 1], IN)) + 14 * settle(t, at + 0.2, 1.8, 0.9) * (t > at + 0.2 ? 1 : 0);
              return (
                <div style={{position: 'absolute', left: -81 - 900 * g, top: 270 - 200 * g, transform: `rotate(${sw - 200 * g}deg)`, transformOrigin: '0 0'}}>
                  <svg width={4} height={26} style={{position: 'absolute', left: -2, top: 0}}>
                    <line x1={2} y1={0} x2={2} y2={26} stroke={th.ink} strokeWidth={0.8} />
                  </svg>
                  <div data-tb-skip style={{position: 'absolute', left: -21, top: 24, width: 42, height: 28, background: paper(th, 78), borderRadius: 3, fontFamily: DIDOT, fontStyle: 'italic', fontSize: 19, lineHeight: '29px', textAlign: 'center', color: th.surface}}>
                    32
                  </div>
                </div>
              );
            })()}
            {panSvg(
              <>
                {chains(false)}
                {lip}
              </>,
            )}
          </div>
          {/* spike and chits */}
          <svg width={60} height={160} style={{position: 'absolute', left: 510, top: 950}}>
            <ellipse cx={30} cy={142} rx={22} ry={6} fill={th.surface} stroke={th.muted} strokeWidth={1.4} />
            <line x1={30} y1={8} x2={30} y2={140} stroke={th.muted} strokeWidth={2.4} />
            <line x1={29} y1={8} x2={29} y2={140} stroke={th.ink} strokeWidth={0.7} opacity={0.6} />
          </svg>
          {chitIn > 0 && chitG < 1 ? (
            <div style={{position: 'absolute', left: 540 - 1100 * chitG, top: chitY, transform: `rotate(${chitRot}deg)`, transformOrigin: '0 0'}}>
              <Chit th={th} head="ORDER" n="10" unit="bags" foot="today!" stamps={[['YES', t - T.yes, -9, 19, 52, 20], ['NO', t - T.no, 12, 26, 60, 44]]} />
            </div>
          ) : null}
          {alertIn > 0 ? (
            <div style={{position: 'absolute', left: 540, top: alertY, transform: `rotate(${alertRot}deg)`, transformOrigin: '0 0'}}>
              <Chit th={th} head="STOCK" n="5" unit="bags left" foot="reorder now" stamps={[['ORDER', t - T.order, -8, 22, 22, 50]]} />
            </div>
          ) : null}
          <svg width={60} height={60} style={{position: 'absolute', left: 510, top: 950}}>
            <line x1={30} y1={8} x2={30} y2={impaled ? 40 : 8} stroke={th.muted} strokeWidth={2.4} />
          </svg>
          {/* the torn sack falls and spills */}
          {t >= huskOff ? (
            <div style={{position: 'absolute', left: huskPos(t)[0] - SW / 2, top: huskPos(t)[1] - SH / 2, width: SW, height: SH, transform: `rotate(${-38 - 52 * k(t, [huskOff, huskLand], [0, 1])}deg) scale(${1.1 + 0.08 * (t > huskLand ? settle(t, huskLand, 4, 1.4) : 0)}, 0.7)`}}>
              <View src={atlas} r={A.sack(8)} scale={0.34} style={{filter: 'brightness(0.8)'}} />
            </div>
          ) : null}
          {t >= pourFrom ? (
            <svg width={1080} height={1200} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
              <ellipse cx={huskTo[0] + 14} cy={FLOOR + 4} rx={30 * k(t, [huskLand - 0.1, pourTo + 0.3], [0.1, 1])} ry={6 * k(t, [huskLand - 0.1, pourTo + 0.3], [0.2, 1])} fill={th.muted} opacity={0.85} />
              {grains.map((g, i) => {
                const te = pourFrom + g.e * (pourTo - pourFrom);
                if (t < te) return null;
                const [x0, y0] = huskPos(te);
                const d = t - te;
                const floor = FLOOR + g.jy;
                const y = Math.min(floor, y0 + g.vy * d + 1300 * d * d);
                const landed = y >= floor;
                const x = landed ? huskTo[0] + 14 + g.jx : x0 + g.vx * d;
                return <ellipse key={i} cx={x} cy={y} rx={1.3 * g.s} ry={landed ? 0.9 : 2 * g.s} fill={th.ink} opacity={0.85} />;
              })}
            </svg>
          ) : null}
          {/* closer: sign-written into the counter's panel, left-set, with a painted drop shade and a swash */}
          {t >= signAt ? (
            <div data-tb="cta" style={{position: 'absolute', left: PANEL[0] + 58, top: PANEL[1] + 24, width: PANEL[2] - PANEL[0] - 116, color: th.ink}}>
              <div style={{position: 'relative', fontFamily: DIDOT, fontSize: 118, lineHeight: '122px', letterSpacing: '0.01em', WebkitMaskImage: wipe(sign), filter: 'url(#ink)'}}>
                <span data-tb-skip aria-hidden style={{position: 'absolute', left: 5, top: 5, color: th.muted, opacity: 0.5}}>
                  {cta.text}
                </span>
                <span style={{position: 'relative'}}>{cta.text}</span>
              </div>
              <svg width={420} height={22} style={{display: 'block', overflow: 'visible'}}>
                <path d="M4 12 C 90 3, 230 20, 414 7" pathLength={1} stroke={th.ink} strokeWidth={3} strokeLinecap="round" fill="none" strokeDasharray="1 1" strokeDashoffset={1 - swash} filter="url(#ink)" />
              </svg>
              {cta.sub ? <div style={{fontFamily: DIDOT, fontStyle: 'italic', fontSize: 30, lineHeight: '38px', color: th.muted, WebkitMaskImage: wipe(under * 115 - 8)}}>{cta.sub}</div> : null}
              {cta.handle ? <div style={{fontFamily: STAMP, fontSize: 18, letterSpacing: '0.3em', color: th.muted, marginTop: 4, opacity: under}}>{cta.handle}</div> : null}
            </div>
          ) : null}
        </div>
      </div>
      {/* light falls off away from the one source */}
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 88% 72% at 42% 42%, transparent 48%, color-mix(in srgb, ${th.bg} 70%, transparent) 100%)`}} />
      <Grain blend="screen" opacity={0.07} />
      <Captions
        style={{top: 1386, fontFamily: DIDOT, fontStyle: 'italic', fontSize: 46, lineHeight: 1.15, color: th.ink, textShadow: `0 0 18px ${th.bg}, 0 2px 4px ${th.bg}`}}
        enter={(p) => ({opacity: p, transform: `translateY(${(1 - p) * 6}px)`})}
        hide={[[T.b7, total + 1]]}
      />
      <Score
        src="music/c1-2026-w41-1.wav"
        shape={[[0, -3], [3.5, 0], [9.5, -1], [17, 1], [24.2, 3], [24.8, -2], [27, 1], [34, 3], [39.5, 2], [42, 0]]}
        hush={[[T.eight - 0.1, T.v1e + 0.15], [T.v4 - 0.42, T.v4 + 0.02]]}
      />
      <Foley cues={cues} />
    </div>
  );
};
