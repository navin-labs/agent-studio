// Film c1-2026-w41-3, "the muster roll" (agents/director/DIRECTOR.md). One handwritten attendance-and-wage register seen from
// above. A blue ballpoint does the month's salaries by hand: it overwrites the same figures, a complaint lands on the page, and
// every add, subtract and recheck leaves its route on the paper until the route is a maze. Then the maze is pulled taut into one
// line from attendance in to salary out, the pen is clicked shut and set down, and every month after prints itself.
// Handwriting (Bradley Hand) is the person; print (JetBrains Mono) is the system. Theme muster: green only for automated, paid.
import React from 'react';
import {type Theme, useTheme} from '../themes';
import {BACK, camAt, Captions, type Cue, drift, Foley, Grain, IN, INOUT, InkDefs, k, type Key, lerp, OUT, rng, Score, settle, useFilm, useMemoOnce} from './kit';

type Pt = [number, number];
const HAND = '"Bradley Hand", cursive';
const MONO = '"JetBrains Mono", monospace';
const mix = (c: string, p: number) => `color-mix(in srgb, ${c} ${p}%, transparent)`;

// ---------- the register (world px; the frame at zoom 1 is the world) ----------
const PG = {x: 20, y: 190, w: 1040, h: 1610}; // the open page
const MAR = 110; // red double margin
const NX = 124; // names
const GX = 275; // attendance grid: 31 days
const CW = 15;
const COL = {days: 745, leave: 800, ot: 855, pay: 910, end: 1050};
const R0 = 440; // first staff row
const RH = 64;
const ry = (i: number) => R0 + i * RH;
const mid = (i: number) => ry(i) + 36; // the row's writing line
const TOT = R0 + 15 * RH; // totals row
const IN_: Pt = [GX + 7, mid(0) - 10]; // attendance in: day 1 of the first row
const LA: Pt = [GX + 2, ry(1) - 3]; // the one line: under Raju's row, from his first day of attendance...
const LB: Pt = [COL.end - 8, ry(1) - 3]; // ...to the end of his pay cell
const OUT_ = LB;
const PEND: Pt = [1030, TOT + 36]; // where the printing front ends (the total)
const DESK: Pt = [610, 1866]; // where the pen is laid down, below the page
const FOOT = TOT + 74; // the page's lower margin: captions and the closer are printed here
const HEAD = 238; // the band under the printed title, used for captions in close shots on the top rows
const STAMP = 5.35; // seconds after a month starts printing: PAID, 1st

// Example data (the board's three rows first).
const STAFF: [string, number, number, number, number][] = [
  ['Raju', 28, 2, 4, 13400], ['Sita', 30, 0, 0, 15000], ['Mohan', 26, 4, 6, 11800], ['Anil', 29, 1, 8, 14950], ['Kavita', 27, 3, 0, 12150],
  ['Imran', 30, 0, 12, 16200], ['Lakshmi', 25, 5, 0, 10800], ['Suresh', 28, 2, 6, 13650], ['Pooja', 30, 0, 2, 15200], ['Deepak', 24, 6, 10, 11300],
  ['Farhan', 29, 1, 0, 13900], ['Meena', 27, 3, 4, 12600], ['Ravi', 30, 0, 8, 15800], ['Geeta', 26, 4, 0, 11250], ['Arjun', 28, 2, 14, 14100],
];
const inr = (n: number) => n.toLocaleString('en-IN');
const TOTAL = STAFF.reduce((a, s) => a + s[4], 0);
const SUNDAYS = [3, 10, 17, 24]; // October 2026 starts on a Thursday
const MARKS = STAFF.map(([, , leave], i) => {
  const r = rng(i * 31 + 7);
  const free = Array.from({length: 31}, (_, d) => d).filter((d) => !SUNDAYS.includes(d));
  const ls = i === 0 ? [13, 14] : Array.from({length: leave}, () => free[Math.floor(r() * free.length)]);
  return Array.from({length: 31}, (_, d) => (SUNDAYS.includes(d) ? '–' : ls.includes(d) ? 'L' : 'P'));
});
// figures the hand got wrong first (struck through), per row
const WRONG = STAFF.map(([, , , , pay], i) => {
  if (i === 0) return [13800, 13600];
  const r = rng(i * 13 + 3);
  const d = () => (Math.floor(r() * 10) + 2) * 50 * (r() > 0.5 ? 1 : -1);
  return r() > 0.45 ? [pay + d(), pay + d()] : [pay + d()];
});
const cellX = (d: number) => GX + d * CW + CW / 2;
const QROWS = [0, 2, 4, 6, 8, 10, 12, 14]; // the rows the hook's pen jabs a question mark beside
// how far along the line from attendance in to salary out a point lies (0..1): the printing front follows it
const along = ([x, y]: Pt) => {
  const dx = PEND[0] - IN_[0];
  const dy = PEND[1] - IN_[1];
  return Math.min(1, Math.max(0, ((x - IN_[0]) * dx + (y - IN_[1]) * dy) / (dx * dx + dy * dy)));
};

// ---------- the pen's route: one continuous trajectory, sampled once ----------
type Seg = {t0: number; d: number; f: (u: number) => Pt; lift: number; tag?: string};
const qbez = (a: Pt, b: Pt, bow: number) => (u: number): Pt => {
  const e = INOUT(u);
  const c: Pt = [(a[0] + b[0]) / 2 - (b[1] - a[1]) * bow, (a[1] + b[1]) / 2 + (b[0] - a[0]) * bow];
  const v = 1 - e;
  return [v * v * a[0] + 2 * v * e * c[0] + e * e * b[0], v * v * a[1] + 2 * v * e * c[1] + e * e * b[1]];
};
// handwriting: forward with small loops, the way a ballpoint actually travels while it writes
const writing = (x0: number, y: number, w: number, loops: number) => (u: number): Pt => [x0 + w * u - 4 * Math.sin(u * loops * 2 * Math.PI), y + 7 * Math.cos(u * loops * 2 * Math.PI + 0.6)];
const ring = (cx: number, cy: number, rx: number, rr: number, turns: number) => (u: number): Pt => {
  const a = -2.5 + u * turns * 2 * Math.PI;
  const g = 1 + 0.07 * Math.sin(u * 9);
  return [cx + rx * g * Math.cos(a), cy + rr * g * Math.sin(a)];
};
// a smooth curve through points (Catmull-Rom), u 0..1 over the points
const through = (P: Pt[]) => (u: number): Pt => {
  const m = P.length - 1;
  const f = Math.min(m - 1e-9, Math.max(0, u * m));
  const i = Math.floor(f);
  const s = f - i;
  const [p0, p1, p2, p3] = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(m, i + 2)]];
  const c = (j: 0 | 1) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * s + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * s * s + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * s * s * s);
  return [c(0), c(1)];
};
// a ballpoint going over figures again, from a to b: it never travels evenly, it loops round what it checks (no two loops the
// same size or lean), doubles back over what it just passed and goes on. loop scales how much it fusses.
const scrawl = (a: Pt, b: Pt, seed: number, loop = 1) => {
  const r = rng(seed * 97 + 13);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [dx, dy] = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const at = (q: number, off: number): Pt => [a[0] + dx * L * q - dy * off, a[1] + dy * L * q + dx * off];
  const n = Math.max(2, Math.round(L / (30 + r() * 24)));
  const pts: Pt[] = [a];
  for (let i = 1; i < n; i++) {
    const q = (i + (r() - 0.5) * 0.5) / n;
    if (r() < 0.2 * loop) pts.push(at(q - (0.7 + r() * 1.6) / n, (r() - 0.5) * 12)); // back over it
    const p = at(q, (r() - 0.5) * 18 * Math.min(loop, 1.4));
    pts.push(p);
    if (r() < 0.3 * loop) {
      // a long leaning loop, the way a hand circles a figure in a hurry: narrow, tilted, open where it starts
      const rr = (6 + r() * 14) * Math.min(loop, 1.5);
      const sq = 0.28 + r() * 0.4;
      const lean = (r() - 0.5) * 1.6 + (r() > 0.5 ? 0.5 : -0.5);
      const a0 = r() * Math.PI * 2;
      const dir = r() > 0.3 ? 1 : -1;
      const turn = (0.75 + r() * 0.45) * (r() < 0.2 ? 1.8 : 1); // now and then round again
      const m = Math.round(7 * turn);
      for (let s = 1; s <= m; s++) {
        const g = a0 + dir * (s / m) * Math.PI * 2 * turn;
        const [ox, oy] = [rr * (Math.cos(g) - Math.cos(a0)), rr * sq * (Math.sin(g) - Math.sin(a0))];
        pts.push([p[0] + ox * Math.cos(lean) - oy * Math.sin(lean), p[1] + ox * Math.sin(lean) + oy * Math.cos(lean)]);
      }
    } else if (r() < 0.3 * loop) {
      // a quick scratch back and forth over one figure
      const h = 6 + r() * 10;
      pts.push([p[0] - dx * h + (r() - 0.5) * 6, p[1] - dy * h + (r() - 0.5) * 8], [p[0] + (r() - 0.5) * 6, p[1] + (r() - 0.5) * 6]);
    }
  }
  pts.push(b);
  return through(pts);
};
// the legs of a maze of rechecking, rows from..14: to the row's first day, count across the days, hop through DAYS, LEAVE, OT
// and PAY with loops, and every so often back up to a row already done to check its pay again. [to, weight, fuss]
const DAYX = 772;
const mazeLegs = (r: () => number, from: number): [Pt, number, number][] => {
  const cell = (c: number, row: number): Pt => [[DAYX, 827, 882, 968][c] + (r() - 0.5) * 16, mid(row) - 6 + (r() - 0.5) * 16];
  const legs: [Pt, number, number][] = [];
  for (let row = from; row < 15; row++) {
    const j = row - from;
    legs.push([[GX + 4 + r() * 26, mid(row) - 8 + r() * 10], 0.35, 0.35]);
    legs.push([[735 - r() * 30, mid(row) - 6 + r() * 12], 0.9, 0.55]);
    legs.push([cell(3, row), 0.45, 1.35]);
    if (j % 2 === 1 || j > 5) {
      const back = Math.floor(r() * row);
      legs.push([cell(3, back), 0.5, 0.8]);
      legs.push([cell(Math.floor(r() * 3), back), 0.3, 1.4]);
      legs.push([cell(3, row), 0.45, 0.8]);
    }
  }
  return legs;
};
const query = (x: number, y: number) => (u: number): Pt => {
  if (u < 0.72) {
    const a = Math.PI * (1 + 1.45 * (u / 0.72));
    return [x + 8 * Math.cos(a), y - 9 + 8 * Math.sin(a)];
  }
  const s = (u - 0.72) / 0.28;
  const a = Math.PI * 2.45;
  return [lerp(x + 8 * Math.cos(a), x, s), lerp(y - 9 + 8 * Math.sin(a), y + 7, s)];
};

// samples of the passes that leave ink (writing, rings and strikes are drawn as their own marks); s = share of the inked route
type Smp = {t: number; p: Pt; s: number};
// the inked route in pressure runs: each run a little heavier or lighter than the last, as a hand presses and eases
type Run_ = {a: number; b: number; w: number; o: number};
type Plan = {segs: Seg[]; S: (tag: string) => [number, number]; samples: Smp[]; runs: Run_[]; end: number};
const makePlan = (at: (b: number, frag: string) => number): Plan => {
  const segs: Seg[] = [];
  let cur: Pt = IN_;
  const add = (t0: number, d: number, f: (u: number) => Pt, lift = 0, tag?: string) => {
    segs.push({t0, d, f, lift, tag});
    cur = f(1);
  };
  const move = (t0: number, d: number, b: Pt, bow = 0.12, tag?: string) => add(t0, d, qbez(cur, b, bow), 1, tag);
  let seed = 1;
  const pass = (t0: number, d: number, b: Pt, loop = 1) => add(t0, d, scrawl(cur, b, seed++, loop), 0, 'ink');
  const y0 = mid(0);
  // before frame 0: the pen has already come along Raju's row and written 13,600 over 13,800
  pass(-1.8, 0.9, [735, y0 - 10], 0.5);
  move(-0.9, 0.25, [918, y0 - 14]);
  add(-0.65, 0.5, writing(918, y0 - 14, 84, 5));
  move(-0.12, 0.12, [922, y0 + 8], 0.1);
  // hook: a third figure over the other two, the old one struck, a question mark, then one on every row
  add(0.15, 0.68, writing(922, y0 + 8, 88, 5), 0, 'w13400');
  move(0.86, 0.08, [914, y0 - 6], 0.05);
  add(0.94, 0.13, qbez(cur, [1004, y0 - 9], 0.02), 0, 'strike');
  move(1.08, 0.08, [1030, y0 - 10], 0.2);
  add(1.16, 0.14, query(1036, y0 + 2), 0, 'q0');
  for (const i of QROWS.slice(1)) {
    const tq = 1.38 + (i / 2 - 1) * 0.27;
    move(tq, 0.075, [1028, mid(i) - 9], 0.3);
    add(tq + 0.075, 0.06, query(1036, mid(i) + 2), 0, `q${i}`);
  }
  // one message: the pen goes back to Raju's figure and rings it, hard
  const explain = at(1, 'now you must');
  move(explain - 0.95, 0.75, [910, y0 - 14], 0.08);
  add(explain - 0.15, 1.0, ring(966, y0 + 2, 66, 31, 2.2), 0, 'ring');
  // the register: name, every day, the leaves, the overtime, add, subtract, check and recheck
  const name = at(2, 'every name');
  move(name - 0.6, 0.55, [130, y0 + 18], 0.1);
  add(name - 0.05, 0.26, qbez(cur, [206, y0 + 20], 0.03), 0, 'underline');
  move(name + 0.22, 0.1, [282, y0 - 10], 0.15);
  const leave = at(2, 'every leave') + 0.08;
  pass(name + 0.33, leave - name - 0.33, [470, y0 - 10], 0.45);
  add(leave, 0.36, ring(485, y0, 23, 19, 1.6), 0, 'ringL');
  pass(leave + 0.36, 0.32, [735, y0 - 10], 0.45);
  const ot = at(2, 'every overtime');
  move(Math.max(leave + 0.7, ot - 0.15), 0.15, [882, y0 - 18], 0.2);
  add(Math.max(leave + 0.86, ot), 0.38, ring(882, y0, 21, 19, 1.6), 0, 'ringOT');
  const sum = at(2, 'You add');
  move(sum - 0.3, 0.14, [754, y0 + 6], 0.15);
  add(sum - 0.16, 0.12, qbez(cur, [792, y0], 0.02), 0, 'strike27');
  move(sum - 0.03, 0.06, [760, y0 + 14], 0.1);
  add(sum + 0.03, 0.4, writing(760, y0 + 14, 26, 2), 0, 'w28');
  const sub = at(2, 'you subtract');
  move(sub - 0.2, 0.18, [812, y0 + 16], 0.1);
  add(sub, 0.36, writing(812, y0 + 16, 30, 2), 0, 'wLeave');
  const re = at(2, 'you check');
  // check and recheck: the first rows, back and forth through the figures
  pass(re - 0.8, 0.45, [284, y0 - 4], 0.9);
  pass(re - 0.35, 0.42, [968, mid(1) - 4], 1.1);
  pass(re + 0.07, 0.4, [284, mid(2) - 4], 0.9);
  pass(re + 0.47, 0.42, [968, mid(3) - 4], 1.1);
  // a maze of registers: every row, counted, summed, and checked again against rows already done; faster and faster
  let tt = at(3, 'Attendance in') - 0.1;
  const mazeEnd = at(3, 'It can be') - 0.25;
  const legs = mazeLegs(rng(41), 4);
  const pace = (i: number) => 1.5 - (0.95 * i) / legs.length;
  const unit = (mazeEnd - 0.22 - tt) / legs.reduce((a, l, i) => a + l[1] * pace(i), 0);
  legs.forEach(([to, w, fuss], i) => {
    pass(tt, unit * w * pace(i), to, fuss);
    tt += unit * w * pace(i);
  });
  move(tt, mazeEnd - tt, OUT_, 0.18, 'out');
  // samples of the inked passes: dense enough that the fastest stretch still reads as a line
  const samples: Smp[] = [];
  const runs: Run_[] = [];
  const pr = rng(19);
  let w = 1.6;
  for (const g of segs.filter((x) => x.tag === 'ink')) {
    let len = 0;
    for (let i = 1; i <= 96; i++) len += Math.hypot(g.f(i / 96)[0] - g.f((i - 1) / 96)[0], g.f(i / 96)[1] - g.f((i - 1) / 96)[1]);
    const n = Math.max(6, Math.min(1200, Math.ceil(len / 2.5)));
    const a = samples.length;
    for (let i = 0; i <= n; i++) samples.push({t: g.t0 + (g.d * i) / n, p: g.f(i / n), s: 0});
    for (let j = a; j < samples.length - 1; j += 22) {
      w = 0.55 * w + 0.45 * (0.9 + pr() * 1.9);
      runs.push({a: j, b: Math.min(samples.length - 1, j + 22), w, o: 0.5 + (w - 0.9) * 0.16 + pr() * 0.12});
    }
  }
  let acc = 0;
  samples.forEach((q, i) => {
    if (i) acc += Math.hypot(q.p[0] - samples[i - 1].p[0], q.p[1] - samples[i - 1].p[1]);
    q.s = acc;
  });
  samples.forEach((q) => (q.s /= acc));
  const S = (tag: string): [number, number] => {
    const g = segs.find((x) => x.tag === tag)!;
    return [g.t0, g.t0 + g.d];
  };
  return {segs, S, samples, runs, end: mazeEnd};
};
const penAt = (plan: Plan, t: number): {p: Pt; lift: number; ink: boolean} => {
  let last = plan.segs[0];
  for (const g of plan.segs) {
    if (t < g.t0) break;
    last = g;
  }
  const u = Math.min(1, Math.max(0, (t - last.t0) / last.d));
  return {p: last.f(u), lift: last.lift * Math.sin(Math.PI * u) + (t > last.t0 + last.d ? 0.12 : 0.04), ink: last.tag === 'ink' && u < 1};
};

// the camera never shows more than a sliver of desk: its centre is held inside the page (centred where the page is smaller)
const view = (t: number, keys: Key[]) => {
  const c = camAt(t, keys);
  const fit = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  return {...c, x: fit(c.x, PG.x + 510 / c.z, PG.x + PG.w - 510 / c.z), y: fit(c.y, PG.y + 830 / c.z, PG.y + PG.h - 780 / c.z)};
};

// A steel gem clip seen from above: two nested wire loops, a highlight on the side toward the light, and a tight contact
// shadow (it lies flat on the paper).
const CLIP = 'M10 66 L10 14 Q10 4 19 4 Q28 4 28 14 L28 80 Q28 94 15 94 Q2 94 2 80 L2 24';
const Clip: React.FC<{th: Theme}> = ({th}) => (
  <svg width={40} height={104} viewBox="-4 -2 40 104" style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
    <path d={CLIP} fill="none" stroke={th.shadow} strokeWidth={3.8} strokeLinecap="round" opacity={0.38} transform="translate(2.4 3.2)" style={{filter: 'blur(1.4px)'}} />
    <path d={CLIP} fill="none" stroke={th.muted} strokeWidth={3.2} strokeLinecap="round" />
    <path d={CLIP} fill="none" stroke={mix(th.bg, 90)} strokeWidth={1.1} strokeLinecap="round" transform="translate(-0.8 -0.8)" />
  </svg>
);

// ---------- things on the desk ----------
// A retractable ballpoint seen from above, tip at (0, 0), body along +x: steel point, clear cone, ribbed blue grip, translucent
// barrel with the blue refill showing through, a steel clip and the push button. Light from the upper left.
// The hand that holds it is above the lens, out of focus; only its shadow reaches the paper: thumb and index pinching the grip,
// the curled fingers, the heel of the hand and the forearm running off the page. It is held higher than the pen, so it falls
// further from it and softer, and it leaves (away) once the pen is laid down.
const HANDSHADOW =
  'M38 -5 C58 -15 96 -22 126 -36 C150 -48 186 -44 206 -22 C262 -20 340 20 400 90 L900 560 L700 760 L300 300 ' +
  'C240 250 190 200 162 160 C126 120 96 76 84 40 C76 18 58 8 38 5 Z';
const Pen: React.FC<{th: Theme; x: number; y: number; ang: number; lift: number; retract: number; away: number; zoom: number}> = ({th, x, y, ang, lift, retract, away, zoom}) => {
  const body = 'M7 -2.4 L40 -7 L110 -8.2 L300 -7.6 L300 7.6 L110 8.2 L40 7 L7 2.4 Z';
  const sh = 7 + lift * 26;
  const hs = 34 + lift * 30;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0}}>
      {away < 1 ? (
        <svg width={1000} height={900} viewBox="-20 -60 1000 900" style={{position: 'absolute', left: -20 + hs * 0.8, top: -60 + hs, transform: `rotate(${ang}deg) translate(${away * 220}px, ${away * 220}px)`, transformOrigin: '20px 60px', overflow: 'visible', filter: `blur(${(11 + lift * 8) * Math.max(1, 2.4 / zoom)}px)`, opacity: (0.4 - lift * 0.06) * (1 - away) * Math.min(1, 0.45 + zoom * 0.22)}}>
          <path d={HANDSHADOW} fill={th.shadow} />
        </svg>
      ) : null}
      <svg width={400} height={60} viewBox="-20 -30 400 60" style={{position: 'absolute', left: -20 + sh * 0.7, top: -30 + sh, transform: `rotate(${ang}deg)`, transformOrigin: '20px 30px', overflow: 'visible', filter: `blur(${2 + lift * 7}px)`, opacity: 0.32 - lift * 0.1}}>
        <path d={body} fill={th.shadow} />
        <rect x={300} y={-5} width={20} height={10} rx={3} fill={th.shadow} />
      </svg>
      <svg width={400} height={60} viewBox="-20 -30 400 60" style={{position: 'absolute', left: -20, top: -30, transform: `rotate(${ang}deg) scale(${1 + lift * 0.035})`, transformOrigin: '20px 30px', overflow: 'visible'}}>
        <path d={`M${retract * 7} -1.1 L${7 + retract * 7} -2.2 L${7 + retract * 7} 2.2 L${retract * 7} 1.1 Z`} fill={th.muted} />
        <path d={body} fill={th.surface} stroke={mix(th.shadow, 55)} strokeWidth={1} />
        <line x1={34} y1={0} x2={296} y2={0} stroke={mix(th.ink, 55)} strokeWidth={3.2} />
        <path d="M44 -7.6 L110 -8.6 L110 8.6 L44 7.6 Z" fill={mix(th.ink, 88)} />
        {Array.from({length: 9}, (_, i) => (
          <line key={i} x1={50 + i * 7} y1={-7.4} x2={50 + i * 7} y2={7.4} stroke={mix(th.bg, 22)} strokeWidth={1.4} />
        ))}
        <path d="M112 -5.6 L298 -5" stroke={mix(th.bg, 85)} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M228 -9.5 L298 -9.5 L298 -4 L236 -4 Q228 -4 228 -7 Z" fill={th.muted} stroke={mix(th.shadow, 50)} strokeWidth={0.8} />
        <rect x={300 - retract * 4} y={-5.2} width={18} height={10.4} rx={3} fill={th.ink} />
      </svg>
    </div>
  );
};

// one line of handwriting, revealed as it is written (p), optionally struck through (strike)
const Hand: React.FC<{th: Theme; x: number; y: number; s: number; text: string; p?: number; strike?: number; rot?: number; color?: string; weight?: number}> = ({th, x, y, s, text, p = 1, strike = 0, rot = 0, color, weight = 700}) => {
  const w = text.length * s * 0.5;
  return (
    <div data-tb-skip style={{position: 'absolute', left: x, top: y - s * 0.62, transform: `rotate(${rot}deg)`, transformOrigin: '0 50%', whiteSpace: 'nowrap'}}>
      <div style={{fontFamily: HAND, fontWeight: weight, fontSize: s, lineHeight: `${s * 1.2}px`, color: color ?? th.ink, WebkitMaskImage: p < 1 ? `linear-gradient(90deg, black ${p * 112 - 8}%, transparent ${p * 112 - 2}%)` : undefined}}>{text}</div>
      {strike > 0 ? (
        <svg width={w + 12} height={s} style={{position: 'absolute', left: -6, top: s * 0.12, overflow: 'visible'}}>
          <path d={`M0 ${s * 0.62} C ${w * 0.3} ${s * 0.5}, ${w * 0.7} ${s * 0.66}, ${w + 12} ${s * 0.46}`} pathLength={1} stroke={color ?? th.ink} strokeWidth={s * 0.075} fill="none" strokeLinecap="round" strokeDasharray="1 2" strokeDashoffset={1 - strike} />
        </svg>
      ) : null}
    </div>
  );
};

// the printed form both kinds of page share: paper, rules, margin, printed headings
const Form: React.FC<{th: Theme; label: string}> = React.memo(({th, label}) => (
  <>
    <div style={{position: 'absolute', left: PG.x, top: PG.y, width: PG.w, height: PG.h, background: th.bg, boxShadow: `0 10px 26px ${mix(th.shadow, 45)}, 0 1px 3px ${mix(th.shadow, 40)}`}} />
    {/* the gutter where the page curves into the binding */}
    <div style={{position: 'absolute', left: PG.x, top: PG.y, width: 70, height: PG.h, background: `linear-gradient(90deg, ${mix(th.shadow, 22)}, transparent)`}} />
    <svg data-tb-skip width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      {Array.from({length: 17}, (_, i) => (
        <line key={i} x1={PG.x + 8} x2={PG.x + PG.w} y1={ry(i) - (i === 0 ? 64 : 0)} y2={ry(i) - (i === 0 ? 64 : 0)} stroke={th.rule} strokeWidth={i === 0 || i === 15 ? 2 : 1.3} />
      ))}
      {[GX, COL.days, COL.leave, COL.ot, COL.pay].map((x) => (
        <line key={x} x1={x} x2={x} y1={R0 - 64} y2={TOT + 64} stroke={th.rule} strokeWidth={1.4} />
      ))}
      {Array.from({length: 30}, (_, d) => (
        <line key={d} x1={GX + (d + 1) * CW} x2={GX + (d + 1) * CW} y1={R0 - 30} y2={TOT} stroke={th.rule} strokeWidth={0.6} />
      ))}
      <line x1={MAR} x2={MAR} y1={PG.y} y2={PG.y + PG.h} stroke={th.alert} strokeWidth={1.3} opacity={0.6} />
      <line x1={MAR + 5} x2={MAR + 5} y1={PG.y} y2={PG.y + PG.h} stroke={th.alert} strokeWidth={1.3} opacity={0.6} />
      <line x1={PG.x + 8} x2={PG.x + PG.w} y1={346} y2={346} stroke={th.alert} strokeWidth={1.2} opacity={0.5} />
      <g fontFamily={MONO} fontWeight={600} fill={th.muted}>
        <text x={NX} y={228} fontSize={15} letterSpacing={2.4}>MUSTER ROLL CUM REGISTER OF WAGES</text>
        <text x={GX + 3} y={R0 - 50} fontSize={10} letterSpacing={3}>ATTENDANCE</text>
        <text x={NX} y={306} fontSize={13} letterSpacing={1.5}>MONTH</text>
        <text x={770} y={306} fontSize={13} letterSpacing={1.5}>PAID ON</text>
        <text x={NX} y={R0 - 22} fontSize={13} letterSpacing={1.5}>NAME</text>
        {Array.from({length: 31}, (_, d) => (
          <text key={d} x={cellX(d)} y={R0 - 40} fontSize={7.5} textAnchor="middle">{d + 1}</text>
        ))}
        <text x={GX + 4} y={R0 - 46} fontSize={0.1}>.</text>
        <text x={COL.days + 27} y={R0 - 22} fontSize={11} textAnchor="middle">DAYS</text>
        <text x={COL.leave + 27} y={R0 - 22} fontSize={11} textAnchor="middle">LEAVE</text>
        <text x={COL.ot + 27} y={R0 - 22} fontSize={11} textAnchor="middle">OT</text>
        <text x={COL.pay + 70} y={R0 - 22} fontSize={13} textAnchor="middle" letterSpacing={1.5}>PAY</text>
        <text x={NX} y={TOT + 42} fontSize={13} letterSpacing={1.5}>TOTAL</text>
        <text x={1040} y={PG.y + PG.h - 24} fontSize={11} textAnchor="end" letterSpacing={1.5}>{label}</text>
      </g>
    </svg>
  </>
));

// The month as the hand left it: every mark written, every recheck still on the page.
const Handwritten: React.FC<{th: Theme; seed: number; first?: boolean; day?: string}> = React.memo(({th, seed, first, day}) => {
  const r = rng(seed);
  const j = (n: number) => (r() - 0.5) * n;
  // no two glyphs alike: each letter leans and sits a little differently, the way a hand writes
  const hj = (s: string | number) => {
    const c = String(s).split('');
    return {rotate: c.map(() => j(12).toFixed(1)).join(' '), dy: c.map((_, n) => (n ? j(3) : 0).toFixed(1)).join(' '), dx: c.map((_, n) => (n ? j(3.2) - 0.6 : 0).toFixed(1)).join(' ')};
  };
  return (
    <svg data-tb-skip width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
      <g filter="url(#ink)" fontFamily={HAND} fontWeight={700} fill={th.ink}>
        <text x={212} y={308} fontSize={34} transform={`rotate(${j(3)} 212 308)`}>October</text>
        <text x={862} y={300} fontSize={26} opacity={0.85}>1st</text>
        <path d="M856 292 L906 286" stroke={th.ink} strokeWidth={2.4} />
        <text x={908} y={312} fontSize={26} opacity={0.85}>5th</text>
        <path d="M902 304 L952 297" stroke={th.ink} strokeWidth={2.4} />
        <text x={962} y={322} fontSize={30}>7th</text>
        {day ? <text x={700} y={PG.y + PG.h - 70} fontSize={64} transform={`rotate(-5 700 ${PG.y + PG.h - 70})`}>{day}</text> : null}
        {STAFF.map(([nm, days, leave, ot, pay], i) => {
          const y = mid(i) + 10;
          const w = WRONG[i];
          return (
            <g key={i}>
              <text x={NX + 6 + j(6)} y={y + j(4)} fontSize={26} {...hj(nm)}>{nm}</text>
              {MARKS[i].map((m, d) => (
                <text key={d} x={cellX(d) + j(2)} y={y - 2 + j(3)} fontSize={13} textAnchor="middle" fill={m === 'P' ? th.ink : m === 'L' ? th.ink : th.muted} fontWeight={m === 'P' ? 400 : 700}>{m}</text>
              ))}
              <text x={COL.days + 12} y={y + j(3)} fontSize={22} {...hj(days)}>{first && i === 0 ? '27' : days}</text>
              <text x={COL.leave + 18} y={y + j(3)} fontSize={22} {...hj(leave)}>{leave}</text>
              <text x={COL.ot + 18} y={y + j(3)} fontSize={22} {...hj(ot)}>{ot}</text>
              {w.map((v, n) => {
                const wy = y - 20 + n * 9 + j(3);
                const wx = COL.pay + 8 + j(8);
                return (
                  <g key={n} opacity={0.8}>
                    <text x={wx} y={wy} fontSize={21} {...hj(inr(v))}>{inr(v)}</text>
                    {!(first && i === 0 && n === 1) ? <path d={`M${wx - 4} ${wy - 6 + j(3)} L${wx + 66} ${wy - 9 + j(3)}`} stroke={th.ink} strokeWidth={2.2} /> : null}
                  </g>
                );
              })}
              {!(first && i === 0) ? <text x={COL.pay + 12 + j(6)} y={y + 14} fontSize={24} {...hj(inr(pay))}>{inr(pay)}</text> : null}
            </g>
          );
        })}
        <text x={COL.pay - 40} y={TOT + 30} fontSize={22} opacity={0.8}>2,01,700</text>
        <path d={`M${COL.pay - 44} ${TOT + 24} L${COL.pay + 50} ${TOT + 20}`} stroke={th.ink} strokeWidth={2.2} />
        <text x={COL.pay + 20} y={TOT + 50} fontSize={26}>{inr(TOTAL)}?</text>
      </g>
    </svg>
  );
});

// a week's worth of the same work: the same rechecking route as the first page, every row, with returns to rows done
const scribble = (seed: number) => {
  const r = rng(seed);
  let p: Pt = [282, mid(0) - 6];
  const pts: Pt[] = [p];
  mazeLegs(r, 0).forEach(([q, , fuss], i) => {
    const f = scrawl(p, q, seed * 50 + i, fuss);
    const n = Math.max(8, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2));
    for (let j = 1; j <= n; j++) pts.push(f(j / n));
    p = q;
  });
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L');
};

// The month that prints itself: one line first, then the front of print follows it across the page.
type Run = {t0: number; sc: number; slips: boolean};
const Printed: React.FC<{th: Theme; t: number; run: Run; month: string}> = ({th, t, run, month}) => {
  const {t0, sc} = run;
  const at = (x: number) => t0 + x * sc;
  const front = (p: Pt) => at(0.12) + along(p) * 0.95 * sc;
  return (
    <>
      <svg data-tb-skip width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <g fontFamily={MONO} fontWeight={600}>
          <text x={212} y={306} fontSize={24} fill={th.ink} letterSpacing={2} opacity={k(t, [at(0), at(0.1)], [0, 1])}>{month} 2026</text>
          {STAFF.map(([nm], i) => (
            <text key={i} x={NX + 6} y={mid(i) + 8} fontSize={20} fill={th.ink} opacity={k(t, [front([NX, mid(i)]), front([NX, mid(i)]) + 0.08], [0, 1])}>{nm}</text>
          ))}
          {MARKS.map((row, i) =>
            row.map((m, d) => {
              const s = front([cellX(d), mid(i)]);
              return t >= s ? (
                <text key={`${i}-${d}`} x={cellX(d)} y={mid(i) + 5} fontSize={10.5} textAnchor="middle" fill={m === 'P' ? th.muted : th.ink}>{m}</text>
              ) : null;
            }),
          )}
          {STAFF.map(([, days, leave, ot], i) => {
            const s = front([COL.days, mid(i)]);
            return t >= s ? (
              <g key={i} fontSize={17} fill={th.ink}>
                <text x={COL.days + 27} y={mid(i) + 7} textAnchor="middle">{days}</text>
                <text x={COL.leave + 27} y={mid(i) + 7} textAnchor="middle">{leave}</text>
                <text x={COL.ot + 27} y={mid(i) + 7} textAnchor="middle">{ot}</text>
              </g>
            ) : null;
          })}
        </g>
      </svg>
      {/* pay: each figure struck whole, one row after the next, like a print head going down the column */}
      {STAFF.map(([, , , , pay], i) => {
        const s = at(1.15 + i * 0.06);
        if (t < s) return null;
        const hit = k(t, [s, s + 0.06], [0, 1]);
        return (
          <div key={i} data-tb-skip style={{position: 'absolute', left: COL.pay + 14, top: mid(i) - 15, fontFamily: MONO, fontWeight: 700, fontSize: 24, lineHeight: '30px', color: th.ink, letterSpacing: '0.02em', opacity: 0.4 + hit * 0.6, transform: `scale(${1.05 - hit * 0.05})`, transformOrigin: '0 50%'}}>{inr(pay)}</div>
        );
      })}
      {/* payslips: a printed slip lifts off each PAY row, flies down and lands in the lower margin, fifteen fanned in a hand */}
      {run.slips
        ? STAFF.map(([nm, days, leave, ot, pay], i) => {
            const s = at(2.8 + i * 0.095);
            if (t < s) return null;
            const lift = k(t, [s, s + 0.1], [0, 1]);
            const fly = k(t, [s + 0.06, s + 0.44], [0, 1], INOUT);
            const land = s + 0.44;
            const [x0, y0] = [COL.pay - 30, mid(i) - 40];
            const [x1, y1] = [372 + i * 30, 1556 + (i % 3) * 8];
            const up = Math.sin(Math.PI * fly);
            const rot = lerp(-3, ((i * 37) % 7) - 3, fly) * 0.9 + (t > land ? 1.6 * settle(t, land, 3.4, 1.8) : 0);
            return (
              <div key={i} data-tb-skip style={{position: 'absolute', left: lerp(x0, x1, fly), top: lerp(y0, y1, fly) - up * 70, width: 214, height: 118, transform: `rotate(${rot}deg) scale(${lerp(0.66, 1, fly) * (1 + up * 0.05)})`, transformOrigin: '0 0', opacity: lift}}>
                {/* its shadow on the page: far and soft in the air, tight once it lands */}
                <div style={{position: 'absolute', inset: 0, background: th.shadow, opacity: 0.22 - up * 0.08, filter: `blur(${1.5 + up * 12}px)`, transform: `translate(${2 + up * 18}px, ${3 + up * 24}px)`}} />
                <div style={{position: 'absolute', inset: 0, background: th.bg, borderTop: `1px solid ${mix(th.shadow, 12)}`, WebkitMaskImage: 'radial-gradient(circle at 6px 0, transparent 3.2px, black 3.8px)', WebkitMaskSize: '12px 100%', padding: '11px 14px 0 14px', boxSizing: 'border-box', fontFamily: MONO, color: th.ink}}>
                  <div style={{fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: th.muted, lineHeight: '12px'}}>PAYSLIP · {month} 2026</div>
                  <div style={{fontSize: 17, fontWeight: 700, lineHeight: '24px', letterSpacing: '0.04em'}}>{nm.toUpperCase()}</div>
                  <div style={{fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', color: th.muted, lineHeight: '13px'}}>{days} DAYS · {leave} LEAVE · {ot} OT</div>
                  <div style={{borderTop: `1px dashed ${th.rule}`, margin: '6px 0 3px'}} />
                  <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between'}}>
                    <span style={{fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: th.muted}}>NET</span>
                    <span style={{fontSize: 22, fontWeight: 700, lineHeight: '26px'}}>{inr(pay)}</span>
                  </div>
                  <div style={{fontSize: 8.5, fontWeight: 700, letterSpacing: '0.16em', color: th.ok, lineHeight: '12px', marginTop: 1}}>SENT ON WHATSAPP</div>
                </div>
              </div>
            );
          })
        : null}
      {/* paid: a printed tick on every row, then the count and the date */}
      <svg data-tb-skip width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {STAFF.map((_, i) => {
          const s = at(4.3 + i * 0.05);
          return t >= s ? <path key={i} d={`M${1024} ${mid(i) - 2} l7 8 l13 -17`} pathLength={1} stroke={th.ok} strokeWidth={4} fill="none" strokeLinecap="square" strokeDasharray="1 2" strokeDashoffset={1 - k(t, [s, s + 0.1], [0, 1])} /> : null;
        })}
        {t >= at(STAMP - 0.4) ? (
          <g fontFamily={MONO} fontWeight={700}>
            <text x={COL.pay + 14} y={TOT + 44} fontSize={24} fill={th.ink}>{inr(TOTAL)}</text>
            <text x={COL.days} y={TOT + 44} fontSize={17} fill={th.ok}>15 / 15 PAID</text>
          </g>
        ) : null}
      </svg>
      {t >= at(STAMP) ? (
        <div data-tb-skip style={{position: 'absolute', left: 866, top: 238, width: 172, height: 96, border: `4px solid ${th.ok}`, borderRadius: 10, color: th.ok, fontFamily: MONO, fontWeight: 700, textAlign: 'center', transform: `rotate(-5deg) scale(${1 + 0.25 * k(t, [at(STAMP), at(STAMP) + 0.09], [1, 0], IN)})`, opacity: k(t, [at(STAMP), at(STAMP) + 0.05], [0, 1]), filter: 'url(#ink-strong)'}}>
          <div style={{fontSize: 18, letterSpacing: '0.4em', lineHeight: '28px', marginTop: 8, paddingLeft: '0.4em'}}>PAID</div>
          <div style={{fontSize: 38, letterSpacing: '0.04em', lineHeight: '44px'}}>1 {month}</div>
        </div>
      ) : null}
    </>
  );
};

// A page that turns over the spine on the left. Front until 90 degrees, then its blank back.
const Turn: React.FC<{th: Theme; a: number; back?: boolean; children: React.ReactNode}> = ({th, a, children, back = true}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transformStyle: 'preserve-3d', transformOrigin: `${PG.x}px 960px`, transform: `perspective(5200px) rotateY(${-a}deg)`}}>
    <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden'}}>
      {children}
      <div style={{position: 'absolute', left: PG.x, top: PG.y, width: PG.w, height: PG.h, background: `linear-gradient(90deg, transparent, ${mix(th.shadow, Math.round(Math.sin((a * Math.PI) / 180) * 30))})`, pointerEvents: 'none'}} />
    </div>
    {back ? <div style={{position: 'absolute', left: PG.x, top: PG.y, width: PG.w, height: PG.h, background: th.surface, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden'}} /> : null}
  </div>
);

export const Film: React.FC = () => {
  const {t, beats, total, cta} = useFilm();
  const th = useTheme();
  // when a phrase of a voice line is spoken (share of characters across the measured clip)
  const at = (b: number, frag: string) => {
    const B = beats[b];
    const i = Math.max(0, B.text.indexOf(frag));
    return B.vo![0] + (i / B.text.length) * (B.vo![1] - B.vo![0]);
  };
  const plan = useMemoOnce(() => makePlan(at));
  const S = plan.S;
  const y0 = mid(0);
  const B4 = beats[4].start;
  const B5 = beats[5].start;
  const B6 = beats[6].start;
  const B7 = beats[7].start;

  // ---- the pen ----
  const strait = at(3, 'one line') - 0.42; // the pull begins
  const taut = strait + 0.78;
  const click = B4 - 0.12;
  const laid = click + 0.6;
  const flip0 = laid - 0.02;
  const live = penAt(plan, Math.min(t, plan.end));
  const toDesk = k(t, [click + 0.08, laid], [0, 1], INOUT);
  const penP: Pt = [lerp(live.p[0], DESK[0], toDesk), lerp(live.p[1], DESK[1], toDesk) - Math.sin(Math.PI * toDesk) * 40];
  const penLift = t < plan.end ? live.lift : 0.08 + Math.sin(Math.PI * toDesk) * 0.9;
  // held the way a right hand writes: the barrel points back toward the writer, down and to the right
  const penAng = lerp(46 + 3 * Math.sin(t * 1.7) * (t < plan.end ? 1 : 0), -7, toDesk) + (t > laid ? 1.4 * settle(t, laid, 2.6, 1.4) : 0);
  const retract = k(t, [click, click + 0.06], [0, 1]);

  // ---- the route (only the checking passes leave ink) and the pull ----
  const green = k(t, [taut - 0.3, taut + 0.15], [0, 1]);
  let nVis = plan.samples.findIndex((q) => q.t > t);
  if (nVis < 0 || t >= strait) nVis = plan.samples.length;
  const pull = (q: Smp): Pt => {
    const m = 1 - Math.abs(2 * q.s - 1);
    const e = k(t, [strait + 0.2 * m, strait + 0.2 * m + 0.56], [0, 1], BACK);
    return [lerp(q.p[0], lerp(LA[0], LB[0], q.s), e), lerp(q.p[1], lerp(LA[1], LB[1], q.s), e)];
  };
  const pt = (i: number): Pt => (t >= strait ? pull(plan.samples[i]) : plan.samples[i].p);
  const runs = plan.runs
    .filter((r) => r.a < nVis - 1 || (r.a < nVis && live.ink))
    .map((r) => {
      const b = Math.min(r.b, nVis - 1);
      const p = Array.from({length: b - r.a + 1}, (_, j) => pt(r.a + j));
      if (b < r.b && live.ink && t < plan.end) p.push(live.p);
      return {...r, d: 'M' + p.map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')};
    });
  // the one line: a ballpoint stroke laid hard, a touch heavier where the nib lands and where it stops
  const lineD = `M${LA[0]} ${LA[1] - 4.8} Q${(LA[0] + LB[0]) / 2} ${LA[1] - 3.2} ${LB[0]} ${LB[1] - 4.2} L${LB[0]} ${LB[1] + 4.2} Q${(LA[0] + LB[0]) / 2} ${LA[1] + 3.4} ${LA[0]} ${LA[1] + 4.8} Z`;

  // ---- the complaint: a folded chit with a steel clip, dropped across the names under Raju's row ----
  const chitIn = at(1, 'One message') + 0.02;
  const fall = k(t, [chitIn, chitIn + 0.42], [0, 1], IN);
  const land = chitIn + 0.42;
  const unfold = k(t, [chitIn + 0.62, chitIn + 1.02], [0, 1], OUT);
  const skid = t > land ? 8 * (1 - Math.exp(-(t - land) * 10)) : 0;
  const jolt = t > land ? 3.5 * Math.exp(-(t - land) * 12) * Math.cos((t - land) * 38) : 0;

  // ---- pages and months ----
  const nov: Run = {t0: flip0 + 0.55, sc: 1, slips: true};
  // one more month after November, printed slowly enough to read, stamped as the camera arrives on it
  const flips = [at(5, 'Just paid') + 0.35];
  const months: [string, Run][] = [
    ['NOV', nov],
    ['DEC', {t0: flips[0] + 0.32, sc: 0.4, slips: false}],
  ];
  const flipAt = [flip0, ...flips];
  const LAST = months.length;
  const ang = (i: number) => 180 * k(t, [flipAt[i], flipAt[i] + 0.55], [0, 1], INOUT);
  // the visible pages: from the first not yet turned over, down through every page that is turning, to the first lying flat
  const first = flipAt.findIndex((f) => t < f + 0.55);
  const shown: number[] = [];
  for (let i = first < 0 ? LAST : first; i <= LAST; i++) {
    shown.push(i);
    if (i === LAST || t < flipAt[i]) break;
  }

  // ---- a week of it: seven loose sheets dropped on the paid page, burying it but for its foot ----
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const week0 = at(6, 'Actually') + 0.05;
  const weekD = (at(6, 'by hand') + 0.3 - week0) / 6;
  const sheets = useMemoOnce(() => {
    const r = rng(77);
    // off to the left and up: the paid page's PAY column, its ticks, its stamp and its foot still show beside the pile
    return DAYS.map((d, i) => ({d, dx: -250 + (r() - 0.5) * 50, dy: -430 + (r() - 0.5) * 60, rot: (i % 2 ? 1 : -1) * (0.8 + r() * 2.4), path: scribble(300 + i)}));
  });
  const sheetDown = (i: number) => k(t, [week0 + i * weekD, week0 + i * weekD + 0.22], [0, 1], IN);

  // ---- camera ----
  const re = at(2, 'you check');
  const K: Key[] = [
    [0, 962, y0 - 2, 4.6], [1.2, 964, y0, 4.3], [3.2, 799, 900, 1.95], [chitIn - 0.1, 799, 900, 1.95],
    [chitIn + 0.62, 330, 650, 2.05], [S('ring')[0] - 0.9, 345, 640, 2.15], [S('ring')[0], 890, 470, 3.0], [beats[2].start, 886, 468, 3.1],
    [S('underline')[0], 250, 462, 3.1], [S('ringL')[0] + 0.1, 470, 462, 3.1], [S('ringOT')[0] + 0.2, 760, 465, 3.05], [S('wLeave')[1], 800, 468, 3.0],
    [re + 0.5, 540, 1020, 1.0], [strait - 0.05, 540, 1020, 1.0], [taut, 660, 830, 1.3], [click + 0.05, 660, 830, 1.3], [laid + 0.15, 540, 1020, 1.0],
    [nov.t0 + 2.3, 540, 1020, 1.0], [nov.t0 + 2.75, 690, 1250, 1.5], [nov.t0 + 4.4, 700, 1240, 1.52], [nov.t0 + STAMP - 0.15, 845, 545, 2.4], [B5 - 0.3, 845, 550, 2.5],
    [B5 + 0.5, 330, 498, 2.7], [at(5, 'No manual') - 0.55, 340, 498, 2.75], [at(5, 'No manual') + 0.05, 949, y0, 4.6], [at(5, 'No month-end') - 0.4, 949, y0, 4.35],
    [at(5, 'No month-end') + 0.5, 760, 1405, 2.0], [flips[0] - 0.75, 740, 1410, 2.05], [flips[0] - 0.05, 540, 1020, 1.0], [B6 - 0.2, 540, 1020, 1.0],
    [B6 + 0.6, 845, 545, 2.4], [week0 - 0.1, 845, 548, 2.45], [week0 + 0.65, 540, 1020, 1.0], [total + 0.2, 540, 1016, 1.02],
  ];
  const c = view(t, K);

  // ---- captions: printed in the page's lower margin when it is in shot, under the title in close shots on the top rows,
  // and nowhere else (never over a figure) ----
  const foot = 960 + (FOOT - c.y) * c.z;
  const head = 960 + (HEAD - c.y) * c.z;
  const capTop = foot >= 300 && foot <= 1440 ? foot : c.z >= 2.3 && head >= 252 && head <= 1440 ? head : null;

  // ---- the closer: printed in the paid page's lower margin, below the week of sheets ----
  const ctaAt = B7 + 0.25;
  const typed = Math.floor(k(t, [ctaAt, ctaAt + 0.35], [0, cta.text.length + 0.99], (x) => x));
  const subP = k(t, [ctaAt + 0.4, ctaAt + 0.8], [0, 1]);

  const cues: Cue[] = [
    [S('w13400')[0], 'pen', 0.5], [S('strike')[0], 'pen', 0.32], [S('q0')[0], 'pen', 0.22],
    ...[4, 8, 12].map((i): Cue => [S(`q${i}`)[0], 'pen', 0.14]),
    [chitIn, 'page', 0.38], [land, 'land', 0.4], [land + 0.02, 'metal', 0.22], [chitIn + 0.62, 'soft', 0.32],
    [S('ring')[0], 'pen', 0.55], [S('ring')[0] + 0.45, 'pen', 0.5],
    [S('underline')[0], 'pen', 0.32], [S('ringL')[0], 'pen', 0.3], [S('ringOT')[0], 'pen', 0.3], [S('strike27')[0], 'pen', 0.3], [S('w28')[0], 'pen', 0.38], [S('wLeave')[0], 'pen', 0.38],
    ...[0, 0.45, 0.87, 1.27].map((d): Cue => [re - 0.8 + d, 'pen', 0.22]),
    ...Array.from({length: 8}, (_, i): Cue => [at(3, 'Attendance in') - 0.1 + i * 0.4, 'pen', 0.14 + i * 0.02]),
    [taut - 0.12, 'catch', 0.55],
    [click, 'latch', 0.42], [laid, 'soft', 0.4], [flip0 + 0.05, 'flip', 0.6],
    [nov.t0, 'press', 0.28], [nov.t0 + 1.15, 'press', 0.18],
    ...[0, 5, 10].map((i): Cue => [nov.t0 + 2.8 + i * 0.095, 'tear', 0.24]),
    ...[2, 8, 14].map((i): Cue => [nov.t0 + 2.8 + i * 0.095 + 0.44, 'soft', 0.2]),
    [nov.t0 + STAMP, 'stamp', 0.75],
    ...flips.map((f): Cue => [f + 0.05, 'flip', 0.45]),
    [months[1][1].t0 + 0.12 * 0.4, 'press', 0.2], [months[1][1].t0 + STAMP * 0.4, 'stamp', 0.55],
    ...DAYS.map((_, i): Cue => [week0 + i * weekD + 0.2, 'page', 0.3 + (i % 2) * 0.08]),
    [ctaAt, 'press', 0.3],
  ];

  return (
    // the desk under the book: dark slate, a little lighter where the daylight falls
    <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 40% 38%, color-mix(in srgb, ${th.shadow} 70%, ${th.muted}), color-mix(in srgb, ${th.shadow} 88%, ${th.muted}))`, overflow: 'hidden'}}>
      <InkDefs seed={9} />
      <div style={{position: 'absolute', inset: 0, transform: `${drift(t, 3)} translateY(${jolt}px)`}}>
        <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `translate(540px, 960px) rotate(${c.r}deg) scale(${c.z}) translate(${-c.x}px, ${-c.y}px)`, transformOrigin: '0 0'}}>
          {/* the register's block of pages under the open one, its edges stepping out toward the light's far side */}
          {[10, 7, 4].map((o) => (
            <div key={o} style={{position: 'absolute', left: PG.x + 2, top: PG.y + o * 0.5, width: PG.w + o * 0.6, height: PG.h + o, background: o === 7 ? th.surface : th.bg, boxShadow: `0 1px 2px ${mix(th.shadow, 35)}`}} />
          ))}
          {/* the pages, from the one beneath to the one on top */}
          {[...shown].reverse().map((i) => {
            const content =
              i === 0 ? (
                <>
                  <Form th={th} label="OCT" />
                  <Handwritten th={th} seed={5} first />
                  {/* what the pen writes while we watch */}
                  <Hand th={th} x={922} y={y0 + 10} s={25} text="13,400" p={k(t, S('w13400'), [0, 1], (x) => x)} rot={-2} />
                  {QROWS.map((i2) => (
                    t > S(`q${i2}`)[0] ? <Hand key={i2} th={th} x={1028} y={mid(i2) + 2} s={i2 ? 22 : 28} text="?" p={k(t, S(`q${i2}`), [0, 1], (x) => x)} /> : null
                  ))}
                  <Hand th={th} x={760} y={y0 + 22} s={24} text="28" p={k(t, S('w28'), [0, 1], (x) => x)} rot={-3} />
                  <Hand th={th} x={812} y={y0 + 26} s={22} text="−2" p={k(t, S('wLeave'), [0, 1], (x) => x)} rot={-4} />
                  {/* the complaint: falls, lands with its weight, skids a little and settles; then its fold opens */}
                  {fall > 0 ? (
                    <div style={{position: 'absolute', left: 118, top: 548, width: 0, height: 0, transform: `translate(${(1 - fall) * -160 + skid}px, ${(1 - fall) * -300}px) rotate(${-14 + fall * 9 + (t > land ? 1.6 * settle(t, land, 3, 1.6) : 0)}deg) scale(${1.4 - fall * 0.4})`, transformOrigin: '200px 80px'}}>
                      <div style={{position: 'absolute', left: 3 + (1 - fall) * 46, top: 5 + (1 - fall) * 60, width: 400, height: 80 + unfold * 80, background: th.shadow, opacity: 0.3 - (1 - fall) * 0.12, filter: `blur(${2 + (1 - fall) * 18}px)`}} />
                      <div style={{position: 'absolute', left: 0, top: 0, width: 400, height: 80, background: th.surface, borderBottom: `1px solid ${mix(th.shadow, 18)}`}}>
                        <Hand th={th} x={22} y={46} s={32} text="Sir, my salary is short" color={th.muted} weight={700} p={unfold > 0.6 ? 1 : 0} />
                      </div>
                      <div style={{position: 'absolute', left: 0, top: 80, width: 400, height: 80, transformOrigin: '0 0', transform: `perspective(900px) rotateX(${(1 - unfold) * 178}deg)`, background: unfold > 0.5 ? th.surface : `color-mix(in srgb, ${th.surface} 80%, ${th.shadow})`}}>
                        {unfold > 0.5 ? (
                          <>
                            <Hand th={th} x={22} y={30} s={32} text="this month!" color={th.muted} />
                            <Hand th={th} x={250} y={58} s={28} text="– Raju" color={th.muted} rot={-3} />
                          </>
                        ) : null}
                      </div>
                      <div style={{position: 'absolute', left: 30, top: -40, transform: 'rotate(-6deg) scale(1.15)', transformOrigin: '0 0'}}>
                        <Clip th={th} />
                      </div>
                    </div>
                  ) : null}
                  <svg data-tb-skip width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
                    {/* dashes "1 2" with offset 1 - p: a mark not yet begun shows nothing at all */}
                    <g filter="url(#ink)" fill="none" stroke={th.ink} strokeLinecap="butt">
                      <path d={`M916 ${y0 - 6} L1004 ${y0 - 9}`} strokeWidth={2.2} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k(t, S('strike'), [0, 1], (x) => x)} />
                      <ellipse cx={966} cy={y0 + 2} rx={66} ry={31} strokeWidth={3} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k(t, S('ring'), [0, 1], (x) => x)} transform={`rotate(-4 966 ${y0})`} />
                      <ellipse cx={964} cy={y0 + 4} rx={60} ry={27} strokeWidth={2.4} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k(t, [S('ring')[0] + 0.45, S('ring')[1]], [0, 1], (x) => x)} transform={`rotate(3 964 ${y0})`} />
                      <path d={`M130 ${y0 + 20} Q170 ${y0 + 26} 206 ${y0 + 18}`} strokeWidth={2.6} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k(t, S('underline'), [0, 1], (x) => x)} />
                      <ellipse cx={485} cy={y0} rx={23} ry={19} strokeWidth={2.2} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k(t, S('ringL'), [0, 1], (x) => x)} />
                      <ellipse cx={882} cy={y0} rx={21} ry={19} strokeWidth={2.2} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k(t, S('ringOT'), [0, 1], (x) => x)} />
                      <path d={`M754 ${y0 + 6} L792 ${y0}`} strokeWidth={2.2} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - k(t, S('strike27'), [0, 1], (x) => x)} />
                    </g>
                    {/* the route: every checking pass of the pen, pressed harder and softer, until it is a maze; then pulled taut */}
                    <g fill="none" strokeLinejoin="round" strokeLinecap="round" stroke={`color-mix(in srgb, ${th.ok} ${Math.round(k(t, [strait + 0.2, taut], [0, 100]))}%, ${th.ink})`}>
                      {runs.map((r) => (
                        <path key={r.a} d={r.d} strokeWidth={lerp(r.w, 5, green)} opacity={r.o * (1 - green * 0.92)} />
                      ))}
                    </g>
                    {green > 0 ? (
                      <g opacity={green} filter="url(#ink)" fill={th.ok}>
                        <path d={lineD} />
                        <circle cx={LA[0] + 1} cy={LA[1]} r={6.2} />
                        <circle cx={LB[0] - 1} cy={LB[1]} r={5.6} />
                        {/* what the line joins, re-inked in the same green: the attendance it starts from, the pay it ends in */}
                        <g fontFamily={MONO} fontWeight={700} stroke="none">
                          <text x={GX + 3} y={R0 - 50} fontSize={10} letterSpacing={3}>ATTENDANCE</text>
                          <text x={COL.pay + 70} y={R0 - 22} fontSize={13} textAnchor="middle" letterSpacing={1.5}>PAY</text>
                        </g>
                      </g>
                    ) : null}
                  </svg>
                </>
              ) : (
                <>
                  <Form th={th} label={months[i - 1][0]} />
                  <Printed th={th} t={t} run={months[i - 1][1]} month={months[i - 1][0]} />
                </>
              );
            return i < LAST ? (
              <Turn key={i} th={th} a={ang(i)}>
                {content}
              </Turn>
            ) : (
              <React.Fragment key={i}>{content}</React.Fragment>
            );
          })}
          {/* the closer: printed in the paid page's lower margin, with the same green tick the rows got */}
          {t >= ctaAt ? (
            <div data-tb="cta" style={{position: 'absolute', left: 150, top: FOOT - 6, color: th.ink, fontFamily: MONO, whiteSpace: 'nowrap'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <svg width={34} height={34} viewBox="0 0 34 34">
                  <path d="M5 18 l9 10 l16 -22" pathLength={1} stroke={th.ok} strokeWidth={5} fill="none" strokeLinecap="square" strokeDasharray="1 2" strokeDashoffset={1 - k(t, [ctaAt, ctaAt + 0.12], [0, 1])} />
                </svg>
                <div style={{fontWeight: 700, fontSize: 40, lineHeight: '46px', letterSpacing: '0.06em'}}>{cta.text.slice(0, typed)}</div>
              </div>
              {cta.sub ? (
                <div style={{fontWeight: 600, fontSize: 20, lineHeight: '28px', color: th.muted, letterSpacing: '0.02em', marginLeft: 50, clipPath: `inset(0 ${(1 - subP) * 100}% 0 0)`}}>
                  {cta.sub}
                  {cta.handle ? `  ·  ${cta.handle}` : ''}
                </div>
              ) : null}
            </div>
          ) : null}
          {/* the pen: works, is clicked shut, is laid on the desk and never moves again */}
          <Pen th={th} x={penP[0]} y={penP[1]} ang={penAng} lift={penLift} retract={retract} away={k(t, [laid - 0.05, laid + 0.6], [0, 1], IN)} zoom={c.z} />
          {/* a week of it: seven loose sheets dropped on the paid page; they stay */}
          {t >= week0
            ? sheets.map((s, i) => {
                const down = sheetDown(i);
                if (down <= 0) return null;
                return (
                  <div key={i} style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `translate(${s.dx}px, ${s.dy - (1 - down) * 80}px) rotate(${s.rot}deg) scale(${1.1 - down * 0.1})`, transformOrigin: '540px 960px', opacity: k(down, [0, 0.3], [0, 1])}}>
                    <Form th={th} label={s.d.toUpperCase()} />
                    <Handwritten th={th} seed={20 + i} day={s.d} />
                    <svg data-tb-skip width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
                      <path d={s.path} fill="none" stroke={th.ink} strokeWidth={1.4} strokeLinejoin="round" opacity={0.55} />
                    </svg>
                  </div>
                );
              })
            : null}
        </div>
      </div>
      {/* daylight from the upper left, falling off toward the lower right */}
      <div style={{position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 120% 85% at 22% 12%, transparent 45%, ${mix(th.shadow, 26)} 100%)`}} />
      <Grain blend="multiply" opacity={0.09} />
      {capTop !== null ? (
        <Captions
          style={{top: capTop, left: 0, right: 0, width: 'fit-content', maxWidth: 840, margin: '0 auto', fontFamily: MONO, fontWeight: 600, fontSize: 34, lineHeight: 1.15, letterSpacing: '0.01em', color: th.ink}}
          hide={[[at(3, 'It can be') - 0.05, taut + 0.3], [at(4, 'Fifteen people') - 0.45, B5], [B7, total + 1]]}
        />
      ) : null}
      <Score
        src="music/c1-2026-w41-3.wav"
        shape={[[0, -2], [3.7, 0], [beats[3].start, 2], [strait - 0.5, 3], [taut + 0.4, 0], [B4 + 2, 1], [B6, -1], [B7, 1], [total, 0]]}
        hush={[[strait - 0.45, taut + 0.05]]}
      />
      <Foley cues={cues} />
    </div>
  );
};
