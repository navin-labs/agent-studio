// Film c2-2026-w41-1, "the fold is a seam" (agents/director/DIRECTOR.md). A Swiss Scherenschnitt: black silhouette paper cut and
// laid on cream rag paper, everything mirrored about one fold. A burr unfolds from a single cut wedge; two walkers and their
// dogs collect burrs in the Alps; a chain of paper dolls brushes them off while the one in the middle keeps one for the
// microscope; we dive through it into hooks catching loops (the only red: the grip); the field of view shrinks into a jacket
// button that pops; scissors cut the whole sheet down its fold, one snip a year, and the two halves of the world rip apart and
// press back together like hook and loop. Puppets move on twos like cut-paper animation; only the camera is smooth.
import React, {useMemo} from 'react';
import {useTheme} from '../themes';
import {BACK, type Beat, camAt, type Cue, Foley, Grain, IN, INOUT, k, type Key, lerp, OUT, rng, Score, settle, useFilm} from './kit';

type Pt = [number, number];
const FUTURA = '"Futura", "Futura PT", "Avenir Next", sans-serif';
const R = Math.PI / 180;
const pol = (r: number, a: number): Pt => [r * Math.cos(a * R), r * Math.sin(a * R)];
const P = ([x, y]: Pt) => `${x.toFixed(2)} ${y.toFixed(2)}`;
const poly = (pts: Pt[]) => `M${pts.map(P).join(' L')} Z`;
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const dir = (deg: number, len: number): Pt => [Math.sin(deg * R) * len, Math.cos(deg * R) * len]; // angle from straight down, + is forward (+x)
const step = (t: number) => Math.floor(t * 12) / 12; // cut-paper animation on twos
const MIRROR = 'translate(1080 0) scale(-1 1)';
const mix = (c: string, p: number, to = 'transparent') => `color-mix(in srgb, ${c} ${p}%, ${to})`;

// when a word is spoken, by its character share of the measured clip
const when = (b: Beat, word: string) => b.vo![0] + (b.text.indexOf(word) / b.text.length) * (b.vo![1] - b.vo![0]);
const times = (b: Beat[]) => {
  const cut0 = b[4].start + 0.45;
  return {
    covered: when(b[0], 'They return'),
    brush: when(b[1], 'brush'),
    forget: when(b[1], 'forget'),
    put: when(b[1], 'He put'),
    dive: b[2].start + 0.1,
    lift: when(b[2], 'grabbing'),
    nature: when(b[2], 'Nature'),
    swap: b[3].start - 0.3,
    buttons: when(b[3], 'buttons'),
    zips: when(b[3], 'stuck'),
    after: when(b[3], 'After'),
    press: when(b[3], 'press'),
    pull: when(b[3], 'pull'),
    b4: b[4].start,
    cut0,
    cut1: cut0 + 1.0,
    stick: when(b[4], 'stick'),
    unstick: when(b[4], 'unstick'),
    close: b[5].start + 0.05,
  };
};
type Times = ReturnType<typeof times>;

// ---------- the burr: one 45 degree wedge, cut while folded, unfolded three times ----------
// a bract: a spine tapering from the cup to a fine point that turns over into a tiny hook
const spine = (a: number, r0: number, r1: number, h: number, curl: 1 | -1, splay = 0) => {
  const u = pol(1, a + splay);
  const p0 = pol(r0, a);
  const p1 = add(p0, [u[0] * (r1 - r0), u[1] * (r1 - r0)]);
  const w: Pt = [-u[1], u[0]];
  const n: Pt = curl > 0 ? w : [-w[0], -w[1]];
  const c: Pt = [p1[0] + h * n[0], p1[1] + h * n[1]];
  const v: Pt = [p1[0] - c[0], p1[1] - c[1]];
  const al = curl * 200 * R;
  const e: Pt = [c[0] + v[0] * Math.cos(al) - v[1] * Math.sin(al), c[1] + v[0] * Math.sin(al) + v[1] * Math.cos(al)];
  const side = (p: Pt, s: number): Pt => [p[0] + w[0] * s, p[1] + w[1] * s];
  return {body: poly([side(p0, 2), side(p1, 0.55), side(p1, -0.55), side(p0, -2)]), hook: `M${P(p1)} A${h} ${h} 0 1 ${curl > 0 ? 1 : 0} ${P(e)}`};
};
// the cupped receptacle: a scalloped rim (each scallop the base of a bract) with two rows of overlapping scales cut into it
const CUP_RIM = Array.from({length: 5}, (_, i) => `Q${P(pol(36.5, i * 9 + 4.5))} ${P(pol(32, (i + 1) * 9))}`).join(' ');
const CORE = `M0 0 L32 0 ${CUP_RIM} Z`;
// overlapping cupule scales, pointed like an artichoke's, in two staggered rows; the ones on the wedge's edges are halves
// that the unfold completes
const SCALES = [...[7.5, 22.5, 37.5].map((a) => [24, a, 7]), ...[0, 15, 30, 45].map((a) => [13, a, 11])]
  .map(([r, a, w]) => `M${P(pol(r - 5, a))} Q${P(pol(r, a - w))} ${P(pol(r + 5.5, a))} Q${P(pol(r, a + w))} ${P(pol(r - 5, a))} Z`)
  .join(' ');
// many fine bracts, each ending in a tiny hook, fanning out of the cup
const BRACTS: [number, number, 1 | -1][] = Array.from({length: 13}, (_, i) => [1.7 + i * 3.47, [52, 62, 56, 66, 58, 64, 70, 63, 57, 65, 55, 61, 51][i], i % 2 ? 1 : -1]);
const SPINES = BRACTS.map(([a, r1, c]) => spine(a, 31, r1, 1.7, c, (a - 22.5) * 0.45));
const Wedge = () => (
  <>
    <path d={CORE} fill="currentColor" />
    <path d={SCALES} fill="var(--cut)" />
    <path d={SPINES.map((s) => s.body).join(' ')} fill="currentColor" />
    <path d={SPINES.map((s) => s.hook).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" />
  </>
);
const refl = (phi: number, c: number) => `rotate(${phi}) scale(1 ${c}) rotate(${-phi})`;
// c: the three unfolds, 1 = still folded on top, -1 = open. A flap catches the light as it turns edge-on.
// halo: a fine cut line of cream around a burr that sits on another black shape, so it reads as its own piece of paper
// plain: no scales cut in the cup (the burr the camera dives into, so the push goes through solid black paper)
const Burr: React.FC<{x: number; y: number; r: number; c?: [number, number, number]; rot?: number; ink: string; bg: string; halo?: boolean; plain?: boolean}> = ({x, y, r, c = [-1, -1, -1], rot = 0, ink, bg, halo, plain}) => {
  if (halo)
    return (
      <>
        <Burr x={x} y={y} r={r * 1.22} rot={rot} ink={bg} bg={bg} />
        <Burr x={x} y={y} r={r} rot={rot} ink={ink} bg={bg} plain={plain} />
      </>
    );
  const col = (v: number) => (v === -1 ? undefined : {color: `color-mix(in srgb, ${ink} ${100 - 42 * (1 - Math.abs(v))}%, ${bg})`});
  const l1 = (
    <>
      <Wedge />
      <g transform={refl(45, c[0])} style={col(c[0])}>
        <Wedge />
      </g>
    </>
  );
  const l2 = (
    <>
      {l1}
      <g transform={refl(90, c[1])} style={col(c[1])}>
        {l1}
      </g>
    </>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${r / 100}) rotate(${-112.5 + rot})`} style={{color: ink, '--cut': plain ? ink : bg} as React.CSSProperties}>
      {l2}
      <g transform={refl(180, c[2])} style={col(c[2])}>
        {l2}
      </g>
    </g>
  );
};

// ---------- puppets (side view, facing +x, feet on y = 0) ----------
// Built like real Scherenschnitt figures: every part is one black shape, and every detail (seams, eyelets, lacing, lace rows,
// knots, toes) is cut through it to the light, never drawn on top.
const Limb: React.FC<{a: Pt; b: Pt; wa: number; wb: number}> = ({a, b, wa, wb}) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: Pt = [(a[1] - b[1]) / L, (b[0] - a[0]) / L];
  const s = (p: Pt, w: number, m: number): Pt => [p[0] + (n[0] * w * m) / 2, p[1] + (n[1] * w * m) / 2];
  return (
    <>
      <path d={poly([s(a, wa, 1), s(b, wb, 1), s(b, wb, -1), s(a, wa, -1)])} />
      <circle cx={a[0]} cy={a[1]} r={wa / 2} />
      <circle cx={b[0]} cy={b[1]} r={wb / 2} />
    </>
  );
};
const along = (a: Pt, b: Pt, f: number): Pt => [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
const across = (a: Pt, b: Pt, f: number, w: number) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: Pt = [(((a[1] - b[1]) / L) * w) / 2, (((b[0] - a[0]) / L) * w) / 2];
  const c = along(a, b, f);
  return `M${P([c[0] + n[0], c[1] + n[1]])} L${P([c[0] - n[0], c[1] - n[1]])}`;
};
const diamond = ([x, y]: Pt, s: number) => poly([[x, y - s], [x + s * 0.7, y], [x, y + s], [x - s * 0.7, y]]);
const spread = (a: Pt, b: Pt, n: number) => Array.from({length: n}, (_, i) => along(a, b, i / (n - 1)));
const cub = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, s: number): Pt => {
  const m = 1 - s;
  return [m ** 3 * p0[0] + 3 * m * m * s * p1[0] + 3 * m * s * s * p2[0] + s ** 3 * p3[0], m ** 3 * p0[1] + 3 * m * m * s * p1[1] + 3 * m * s * s * p2[1] + s ** 3 * p3[1]];
};
// tufts of fur or barbs of a feather along a cubic: little blades leaning back along the curve, on one side (or both)
const tufts = (c: [Pt, Pt, Pt, Pt], n: number, len: number, side: 1 | -1, both = false) =>
  Array.from({length: n}, (_, i) => {
    const s = (i + 0.5) / n;
    const p = cub(...c, s);
    const q = cub(...c, Math.min(1, s + 0.04));
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const u: Pt = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    const blade = (sd: number) => {
      const nn: Pt = [-u[1] * sd, u[0] * sd];
      const l = len * (1 - 0.35 * Math.abs(s - 0.45));
      return poly([add(p, [u[0] * 1.6, u[1] * 1.6]), add(p, [nn[0] * l - u[0] * l * 0.55, nn[1] * l - u[1] * l * 0.55]), add(p, [-u[0] * 1.4, -u[1] * 1.4])]);
    };
    return both ? `${blade(1)} ${blade(-1)}` : blade(side);
  }).join(' ');
// a hand: open (palm and four fingers, a thumb) or closed round something (a fist with its knuckles cut); ang is the
// direction from the wrist to the fingertips, in degrees from straight down
const Hand: React.FC<{at: Pt; ang: number; open?: boolean; bg: string}> = ({at, ang, open, bg}) => {
  const u = dir(ang, 1);
  const n = dir(ang + 90, 1);
  if (!open)
    return (
      <>
        <circle cx={at[0]} cy={at[1]} r={4} />
        <path d={[-1.7, 0, 1.7].map((o) => `M${P(add(at, [n[0] * o + u[0] * 0.6, n[1] * o + u[1] * 0.6]))} l${P([u[0] * 3, u[1] * 3])}`).join(' ')} stroke={bg} strokeWidth={0.75} fill="none" />
      </>
    );
  return (
    <>
      <circle cx={at[0]} cy={at[1]} r={3.1} />
      <path
        d={[-27, -9, 9, 27].map((o, i) => `M${P(add(at, [u[0] * 1.5, u[1] * 1.5]))} l${P(dir(ang + o, i === 0 || i === 3 ? 4.2 : 5.2))}`).join(' ') + ` M${P(at)} l${P(dir(ang + 78, 4))}`}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
      />
    </>
  );
};
// a head in profile around hc: skull, nose, moustache, chin, a cut ear, hair at the nape, and an Alpine hat (brim turned up
// at the back, pinched crown, a cut cord, a chamois-feather spray with its barbs); the walker smokes a pipe
const FEATHER: [Pt, Pt, Pt, Pt] = [[-7, -14], [-15, -19], [-19, -31], [-12, -37]];
const Head: React.FC<{hc: Pt; bg: string; pipe?: boolean}> = ({hc, bg, pipe}) => {
  const o = (x: number, y: number) => P(add(hc, [x, y]));
  const fc = FEATHER.map((p) => add(hc, p)) as [Pt, Pt, Pt, Pt];
  return (
    <>
      <path d={`M${o(-9, 2)} C${o(-11, -8)} ${o(-4, -11)} ${o(3, -10)} C${o(8, -9)} ${o(10, -5)} ${o(10, -1)} L${o(14, 3)} L${o(10, 5)} C${o(10, 8)} ${o(7, 11)} ${o(3, 11)} L${o(-1, 14)} L${o(-6, 9)} C${o(-9, 7)} ${o(-10, 5)} ${o(-9, 2)} Z`} stroke="none" />
      <path d={`M${o(7, 4.6)} Q${o(13.5, 4.4)} ${o(13.4, 8)} Q${o(10, 6.8)} ${o(7, 7.2)} Z`} stroke="none" />
      <path d={`M${o(-9, -1)} l-3.6 2.6 l3 0.6 l-3.2 3 l3.6 -0.4`} stroke="none" />
      <ellipse cx={hc[0] - 3} cy={hc[1] + 1} rx={1.5} ry={2.6} fill={bg} stroke="none" />
      <path d={`M${o(-15, -5)} Q${o(-18, -11)} ${o(-13, -9.5)} L${o(15, -9)} Q${o(19, -8)} ${o(16, -5.5)} Z`} stroke="none" />
      <path d={`M${o(-9, -8)} L${o(-7, -20)} Q${o(-3, -24)} ${o(0, -20.5)} Q${o(3, -24)} ${o(8, -20)} L${o(10, -8)} Z`} stroke="none" />
      <path d={`M${o(-8.4, -11.6)} L${o(9.6, -11.2)}`} stroke={bg} strokeWidth={1.1} fill="none" />
      {[-4.5, 0, 4.5].map((x) => (
        <circle key={x} cx={hc[0] + x} cy={hc[1] - 13.9} r={0.75} fill={bg} stroke="none" />
      ))}
      <path d={`M${P(fc[0])} C${P(fc[1])} ${P(fc[2])} ${P(fc[3])}`} strokeWidth={1.5} fill="none" />
      <path d={tufts(fc, 9, 4.2, 1, true)} stroke="none" />
      {pipe ? (
        <>
          <path d={`M${o(8.5, 6.2)} Q${o(13, 9.5)} ${o(17, 8.2)}`} strokeWidth={1.4} fill="none" />
          <path d={`M${o(15.4, 2.6)} L${o(19.2, 2.6)} L${o(18.8, 8.4)} Q${o(17.3, 9.8)} ${o(15.8, 8.4)} Z`} stroke="none" />
          <path d={`M${o(17.3, 1.4)} c-2.4 -3 2.6 -5 0.6 -8.4 c-1.6 -2.8 2.8 -4.6 1.4 -8`} strokeWidth={1} fill="none" />
        </>
      ) : null}
    </>
  );
};
const manRig = (ph: number, a: number) => {
  const legs = [ph, ph + Math.PI].map((s) => {
    const th = 26 * a * Math.sin(s);
    const sh = th - a * 34 * Math.max(0, Math.cos(s));
    return {th, sh, len: 36 * Math.cos(th * R) + 33 * Math.cos(sh * R)};
  });
  const H: Pt = [0, -Math.max(...legs.map((l) => l.len))];
  const joints = legs.map((l) => {
    const K = add(H, dir(l.th, 36));
    return {K, A: add(K, dir(l.sh, 33))};
  });
  return {H, S: add(H, [2, -50]) as Pt, joints};
};
// knickerbockers bunched under a cut garter with its tassel, a patterned woollen stocking, a laced mountain boot with a welt
const Leg: React.FC<{H: Pt; K: Pt; A: Pt; bg: string}> = ({H, K, A, bg}) => {
  const o = (x: number, y: number) => add(A, [x, y]);
  const g = along(H, K, 0.86);
  return (
    <>
      <Limb a={H} b={K} wa={17} wb={12.5} />
      <Limb a={K} b={A} wa={9} wb={6} />
      <path d={poly([o(-5.5, -10), o(4.5, -10), o(6.5, -6), o(14, -4.5), o(18, -2), o(18.5, 0.5), o(17, 1.8), o(-6, 1.8), o(-6.8, -1.5)])} />
      <path d={`M${P(add(g, [-6.2, 0]))} l-1.6 6.5 M${P(add(g, [-6.2, 0]))} l0.6 7`} stroke="currentColor" strokeWidth={1} fill="none" />
      <g fill="none" stroke={bg} strokeLinecap="round">
        <path d={across(H, K, 0.86, 14)} strokeWidth={1.2} />
        <path d={`M${P(o(0.5, -8.8))} L${P(o(4.2, -7))} L${P(o(2.4, -5.8))} L${P(o(7.4, -4.8))} L${P(o(5.8, -3.6))} L${P(o(10.8, -3.2))}`} strokeWidth={0.8} />
        <path d={`M${P(o(-6, -0.1))} L${P(o(17.4, -0.1))}`} strokeWidth={0.7} />
      </g>
      <path d={`${diamond(along(K, A, 0.3), 1.9)} ${diamond(along(K, A, 0.56), 1.5)}`} fill={bg} />
    </>
  );
};
// the walker: rucksack with a bedroll, a fitted coat whose tails swing on the step, lace eyelets along its hem and a pierced
// heart at the hip, an open far hand, the near fist round an alpenstock bound with knots and a tassel
const Man: React.FC<{ph: number; a: number; bg: string}> = ({ph, a, bg}) => {
  const {H, S, joints} = manRig(ph, a);
  const hc = add(S, [3, -15]);
  const sh = add(S, [4, 4]);
  const ua = 28 + 8 * a * Math.sin(ph);
  const E = add(sh, dir(ua, 24));
  const hand = add(E, dir(ua + 52, 20));
  const bs = add(S, [-3, 4]);
  const ba = -22 * a * Math.sin(ph);
  const bE = add(bs, dir(ba, 24));
  const bH = add(bE, dir(ba + 12, 18));
  const tail = 4 * a * Math.sin(ph * 2);
  const o = (p: Pt, x: number, y: number) => P(add(p, [x, y]));
  const foot: Pt = [hand[0] + 22, 0];
  const L = Math.hypot(hand[0] - foot[0], hand[1] - foot[1]);
  const top = add(hand, [((hand[0] - foot[0]) / L) * 32, ((hand[1] - foot[1]) / L) * 32]);
  const coat = `M${o(S, -10, 0)} Q${o(S, 1, -6)} ${o(S, 11, 1)} C${o(S, 15, 16)} ${o(H, 13, -22)} ${o(H, 14, -2)} L${o(H, 17, 11)} Q${o(H, 4, 15)} ${o(H, -4, 13)} L${o(H, -10 + tail, 21)} L${o(H, -18 + tail, 16)} C${o(H, -17, -6)} ${o(S, -14, 24)} ${o(S, -10, 0)} Z`;
  return (
    <g fill="currentColor" stroke="none" strokeLinecap="round" strokeLinejoin="round">
      <Limb a={bs} b={bE} wa={8.5} wb={7} />
      <Limb a={bE} b={bH} wa={6.5} wb={5} />
      <Hand at={bH} ang={ba + 12} open bg={bg} />
      {joints.map(({K, A}, i) => (
        <Leg key={i} H={H} K={K} A={A} bg={bg} />
      ))}
      <path d={`M${o(S, -11, 3)} C${o(S, -25, -1)} ${o(S, -32, 6)} ${o(S, -31, 19)} L${o(S, -29, 33)} Q${o(S, -20, 38)} ${o(S, -11, 33)} Z`} />
      <ellipse cx={S[0] - 21} cy={S[1] - 1.5} rx={10.5} ry={4.6} />
      <path d={coat} />
      <path d={`M${o(S, -4, 26)} l2.6 -5 l2.6 5 Z`} />
      <g fill="none" stroke={bg} strokeLinecap="round">
        <path d={`M${o(S, -30.6, 15)} q2.6 3.2 5.2 0 q2.6 3.2 5.2 0 q2.6 3.2 5.2 0 q2.6 3.2 5.2 0`} strokeWidth={1.1} />
        <path d={`M${o(S, -31.5, -4)} a2.6 2.6 0 1 0 0.1 0 M${o(S, -31.2, -2.4)} a1 1 0 1 0 0.1 0`} strokeWidth={0.8} />
        <path d={`M${o(S, -7, 1)} Q${o(S, 4, 3)} ${o(S, 8, 22)}`} strokeWidth={1} />
        <path d={`M${o(S, 4, -2)} L${o(S, 9, 13)} L${o(S, 12.5, 8)}`} strokeWidth={1.1} />
        <path d={`M${o(H, -16.5, -6)} L${o(H, 13.6, -7.5)}`} strokeWidth={1.2} />
      </g>
      <g fill={bg}>
        {[0, 60, 120, 180, 240, 300].map((r) => (
          <ellipse key={r} cx={S[0] - 21} cy={S[1] + 25} rx={0.9} ry={2.1} transform={`rotate(${r} ${S[0] - 21} ${S[1] + 25}) translate(0 -2)`} />
        ))}
        {spread(add(S, [11.5, 15]), add(H, [12.4, -11]), 3).map(([x, y], i) => (
          <circle key={`b${i}`} cx={x} cy={y} r={1.15} />
        ))}
        {spread(add(H, [-14.5, 12]), add(H, [13.5, 9]), 7).map(([x, y], i) => (
          <circle key={`h${i}`} cx={x} cy={y} r={1.15} />
        ))}
        <path d={HEART(H[0] - 4, H[1] - 19, 4)} />
      </g>
      <path d={HEART(H[0] - 4, H[1] - 18.8, 1.6)} />
      <path d={`M${P(S)} L${P(add(hc, [0, 9]))}`} stroke="currentColor" strokeWidth={7} fill="none" />
      <Head hc={hc} bg={bg} pipe />
      <path d={`M${P(top)} L${P(foot)}`} stroke="currentColor" strokeWidth={3.2} fill="none" />
      <circle cx={top[0]} cy={top[1]} r={2.7} />
      <path d={`M${o(top, 0.5, 3)} q-3 4 -2 9 M${o(top, 0.5, 3)} q-1 4.5 0.6 9.5`} stroke="currentColor" strokeWidth={0.9} fill="none" />
      <path d={[0.12, 0.17, 0.62, 0.67, 0.93].map((f) => across(top, foot, f, 4.4)).join(' ')} stroke={bg} strokeWidth={0.8} fill="none" />
      <Limb a={sh} b={E} wa={9.5} wb={7.5} />
      <Limb a={E} b={hand} wa={7} wb={5.5} />
      <path d={across(E, hand, 0.7, 8)} stroke={bg} strokeWidth={1.1} fill="none" />
      <Hand at={hand} ang={ua + 52} bg={bg} />
    </g>
  );
};
// a Bernese mountain dog: a fur fringe along the back and belly, a chest ruff, a plumed tail, a drop ear, a blaze down the
// muzzle and a collar with its bell, all cut; burrs sit on the outline (back, belly fringe, tail) where their hooks read
const DOG_BURRS: Pt[] = [[-14, -50], [7, -50], [-21, -26], [-36, -50]];
const TAIL: [Pt, Pt, Pt, Pt] = [[-30, -43], [-42, -50], [-45, -64], [-37, -69]];
const BACK_FUR: [Pt, Pt, Pt, Pt] = [[-31, -47], [-20, -54], [4, -55], [24, -50]];
const Dog: React.FC<{ph: number; a: number; sniff: number; bg: string}> = ({ph, a, sniff, bg}) => {
  const hd = 8 * sniff;
  const leg = (x: number, o: number) => {
    const s = 18 * a * Math.sin(ph + o);
    const top: Pt = [x, -34];
    const knee = add(top, dir(s, 17));
    const paw = add(knee, dir(s * 0.3 - 6, 14.5));
    return (
      <g key={x}>
        <Limb a={top} b={knee} wa={8} wb={5} />
        <Limb a={knee} b={paw} wa={5} wb={4} />
        <ellipse cx={paw[0] + 2.4} cy={paw[1] - 0.2} rx={4.4} ry={2.3} />
        <path d={`M${paw[0] + 3} ${paw[1] - 1.8} l0.5 1.9 M${paw[0] + 4.8} ${paw[1] - 1.5} l0.5 1.7`} stroke={bg} strokeWidth={0.6} fill="none" />
      </g>
    );
  };
  const y = (v: number) => v + hd;
  return (
    <g fill="currentColor" stroke="none" strokeLinecap="round" strokeLinejoin="round">
      {leg(-25, 0)}
      {leg(-19, Math.PI)}
      {leg(14, Math.PI)}
      {leg(20, 0)}
      <path d="M-32 -42 C-31 -51 -12 -54 6 -53 C17 -53 24 -50 27 -45 L30 -35 C20 -28 -20 -27 -31 -33 Z" />
      <path d={tufts(BACK_FUR, 11, 4.6, -1)} />
      <path d={`M-27 -32 ${Array.from({length: 8}, (_, i) => `L${-24 + i * 5} -23 L${-21 + i * 5} -30`).join(' ')} L19 -32 Z`} />
      <path d={`M${TAIL[0].map((v) => v.toFixed(1)).join(' ')} C${TAIL.slice(1).map(P).join(' ')}`} stroke="currentColor" strokeWidth={5.5} fill="none" />
      <path d={tufts(TAIL, 8, 5.5, 1)} />
      <path d={poly([[16, -48], [27, -37], [35, y(-46)], [30, y(-58)]])} />
      <path d={Array.from({length: 4}, (_, i) => poly([[27 + i * 1.2, -45 + i * 3.6], [33 + i * 1, -42 + i * 3.6], [27.6 + i * 1.2, -41.5 + i * 3.6]])).join(' ')} />
      <circle cx={33} cy={y(-52)} r={8} />
      <path d={poly([[37, y(-58)], [50, y(-53.5)], [50.5, y(-48)], [37, y(-45.5)]])} />
      <circle cx={50} cy={y(-52.5)} r={1.9} />
      <path d={`M28 ${y(-59)} Q23.5 ${y(-55)} 25.2 ${y(-46)} L29.6 ${y(-48.5)} Z`} />
      <g fill="none" stroke={bg} strokeLinecap="round">
        <path d={`M28.6 ${y(-58)} Q26.6 ${y(-54)} 28.2 ${y(-49)}`} strokeWidth={0.8} />
        <path d={`M34.5 ${y(-60)} Q40 ${y(-58.5)} 46 ${y(-54.6)}`} strokeWidth={0.9} />
        <path d={`M23.5 ${y(-53)} L31 ${y(-44)} M21.6 ${y(-50.6)} L29 ${y(-41.8)}`} strokeWidth={0.8} />
        {[-22, -13, -4, 5].map((x, i) => (
          <path key={x} d={`M${x} ${-44 - (i % 2)} q2.2 1.8 5 1.4`} strokeWidth={0.85} />
        ))}
      </g>
      <circle cx={37.5} cy={y(-54.5)} r={1.3} fill={bg} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={23 + i * 2.6} cy={y(-50.6 + i * 3.1) - hd * 0.1 * i} r={0.7} fill={bg} />
      ))}
      <circle cx={27.8} cy={y(-40)} r={2.3} />
      <path d={`M26.4 ${y(-39.4)} L29.2 ${y(-39.4)}`} stroke={bg} strokeWidth={0.6} fill="none" />
    </g>
  );
};
// one of the many: the same walker, stopped, bent over and brushing his own trouser leg (s: hand from knee to boot)
const Brusher: React.FC<{bend: number; s: number; bg: string}> = ({bend, s, bg}) => {
  const H: Pt = [0, -69];
  const S: Pt = [2, -119];
  const a = bend * R;
  const rot = (p: Pt): Pt => [H[0] + (p[0] - H[0]) * Math.cos(a) - (p[1] - H[1]) * Math.sin(a), H[1] + (p[0] - H[0]) * Math.sin(a) + (p[1] - H[1]) * Math.cos(a)];
  const sh = rot(add(S, [4, 6]));
  const down = bend > 12;
  const hand: Pt = down ? [17, lerp(-50, -12, s)] : add(sh, [10, 42]);
  const elbow: Pt = down ? [(sh[0] + hand[0]) / 2 + 9, (sh[1] + hand[1]) / 2 - 5] : add(sh, [8, 22]);
  const hc = add(S, [3, -15]);
  const wrist = Math.atan2(hand[0] - elbow[0], hand[1] - elbow[1]) / R;
  // knickerbockers bunched at a cut knee band with its tassel, a patterned woollen stocking, a laced nailed boot with a heel
  const leg = (ox: number) => (
    <g key={ox}>
      <path d={`M${ox - 8} -72 L${ox + 9} -72 C${ox + 12} -57 ${ox + 12} -46 ${ox + 9} -39 L${ox - 9} -37 C${ox - 13} -47 ${ox - 12} -59 ${ox - 8} -72 Z`} />
      <path d={`M${ox - 7.5} -40.5 L${ox + 8.5} -42`} stroke={bg} strokeWidth={1.1} fill="none" />
      <path d={`M${ox - 8.6} -40 l-1.4 6.4 M${ox - 8.6} -40 l0.6 6.8`} stroke="currentColor" strokeWidth={1} fill="none" />
      <path d={`M${ox - 7} -38 C${ox - 11} -29 ${ox - 8} -19 ${ox - 5.5} -12 L${ox + 5} -12 C${ox + 6} -21 ${ox + 7} -30 ${ox + 6.5} -38 Z`} />
      <path d={`${diamond([ox - 0.8, -31], 1.9)} ${diamond([ox - 0.2, -22], 1.5)}`} fill={bg} />
      <path d={poly([[ox - 7.5, -14], [ox + 5.5, -14], [ox + 8, -8], [ox + 18, -5.5], [ox + 20, -1.5], [ox + 19, 0], [ox + 1, 0], [ox, -2], [ox - 4, -2], [ox - 5, 0], [ox - 9, 0], [ox - 9, -4]])} />
      <path d={`M${ox + 1} -12.6 L${ox + 5} -10.4 L${ox + 3} -9.2 L${ox + 8.4} -7.6 L${ox + 6.6} -6.4 L${ox + 12} -5.4 M${ox - 8.4} -2.6 L${ox + 19} -1.6`} stroke={bg} strokeWidth={0.75} fill="none" />
    </g>
  );
  return (
    <g fill="currentColor" stroke="none" strokeLinecap="round" strokeLinejoin="round">
      {leg(down ? -8 : -3)}
      {leg(down ? 8 : 4)}
      <g transform={`rotate(${bend} ${H[0]} ${H[1]})`}>
        {/* a fitted walking coat flared over the hips: lapel, pocket slit and three buttons cut out, a lace row of eyelets
            along the hem and a pierced heart at the hip */}
        <path d="M-15 -55 C-17 -78 -16 -101 -10 -119 Q-2 -125 9 -121 C14 -107 16 -87 15 -67 L19 -57 Z" />
        <g fill="none" stroke={bg} strokeLinecap="round">
          <path d="M4 -71 L13.5 -72" strokeWidth={1.2} />
          <path d="M3 -121 L8 -106 L12 -112" strokeWidth={1.1} />
          <path d="M-15.6 -66 L15.4 -67.5" strokeWidth={1.1} />
        </g>
        <g fill={bg}>
          {[-102, -92, -82].map((y) => (
            <circle key={y} cx={11.5} cy={y} r={1.25} />
          ))}
          {spread([-13, -59], [16, -59.6], 7).map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.15} />
          ))}
          <path d={HEART(-4, -83, 4.2)} />
        </g>
        <path d={HEART(-4, -82.8, 1.7)} />
        <path d={`M${P(add(S, [1, -2]))} L${P(add(hc, [0, 9]))}`} stroke="currentColor" strokeWidth={7} fill="none" />
        <Head hc={hc} bg={bg} />
      </g>
      {/* the arm: a sleeve to the elbow, a cuff cut, the forearm, an open hand brushing */}
      <Limb a={sh} b={elbow} wa={9} wb={7.5} />
      <Limb a={elbow} b={hand} wa={6.5} wb={5} />
      <path d={across(elbow, hand, 0.68, 7.5)} stroke={bg} strokeWidth={1.1} fill="none" />
      <Hand at={hand} ang={wrist} open bg={bg} />
    </g>
  );
};

// ---------- the sheet's left half (drawn twice: as is, and mirrored about the fold) ----------
const fir = (x: number, y: number, h: number) =>
  [0, 1, 2, 3].map((i) => poly([[x - h * (0.36 - i * 0.07), y - 8 - h * i * 0.22], [x, y - 8 - h * (0.34 + i * 0.22)], [x + h * (0.36 - i * 0.07), y - 8 - h * i * 0.22]])).join(' ') + ` M${x - 3} ${y} L${x - 3} ${y - 10} L${x + 3} ${y - 10} L${x + 3} ${y} Z`;
const HEART = (x: number, y: number, s: number) => `M${x} ${y + s} C${x - s * 1.4} ${y + s * 0.1} ${x - s * 0.9} ${y - s * 0.9} ${x} ${y - s * 0.3} C${x + s * 0.9} ${y - s * 0.9} ${x + s * 1.4} ${y + s * 0.1} ${x} ${y + s} Z`;
// plant heads that leap onto the walkers: [head, target 'dog' | 'man', index]
const HEADS: {at: Pt; to: 'dog' | 'man'; i: number}[] = [
  {at: [511, 452], to: 'dog', i: 0},
  {at: [505, 478], to: 'man', i: 0},
  {at: [519, 470], to: 'dog', i: 1},
  {at: [512, 500], to: 'man', i: 1},
  {at: [524, 490], to: 'dog', i: 2},
  {at: [508, 520], to: 'man', i: 2},
  {at: [526, 512], to: 'dog', i: 3},
];
const DOLLS = [1, 2, 3, 4, 5, 6, 7];

const walkers = (q: number) => {
  const mx = 340 + 90 * k(q, [0.2, 6.3], [0, 1], INOUT);
  const dx = 402 + 78 * k(q, [0.2, 4.9], [0, 1], INOUT);
  const ma = 1 - k(q, [5.8, 6.4], [0, 1]);
  const da = 1 - k(q, [4.5, 4.95], [0, 1]);
  return {mx, dx, mph: ((mx - 340) / 40) * Math.PI, dph: ((dx - 402) / 17) * Math.PI, ma, da};
};

const Half: React.FC<{t: number; T: Times; ink: string; bg: string}> = ({t, T, ink, bg}) => {
  const q = step(t);
  const w = walkers(q);
  const rig = manRig(w.mph, w.ma);
  const manPt = (i: number): Pt => {
    const [a, b] = rig.joints;
    const p: Pt = i === 0 ? add(a.K, [7, 0]) : i === 1 ? [(b.K[0] + b.A[0]) / 2 + 5, (b.K[1] + b.A[1]) / 2] : add(rig.H, [-18, 9]);
    return [w.mx + p[0], 560 + p[1]];
  };
  const dogPt = (i: number): Pt => [w.dx + DOG_BURRS[i][0], 560 + DOG_BURRS[i][1]];
  return (
    <g>
      {/* the alps' sides: firs and a chalet on the meadow */}
      <path d={[fir(80, 560, 96), fir(140, 560, 120), fir(196, 560, 84), fir(330, 380, 46)].join(' ')} fill={ink} />
      <path d={`${poly([[222, 524], [252, 494], [300, 524]])} M232 522 L290 522 L290 560 L232 560 Z M244 532 L254 532 L254 544 L244 544 Z M268 532 L278 532 L278 544 L268 544 Z M258 546 L264 546 L264 560 L258 560 Z`} fill={ink} fillRule="evenodd" />
      <path d="M410 168 q8 -7 16 0 q8 -7 16 0" fill="none" stroke={ink} strokeWidth={2.4} strokeLinecap="round" />
      {/* walker and dog */}
      <g transform={`translate(${w.mx} 560)`} style={{color: ink}}>
        <Man ph={w.mph} a={w.ma} bg={bg} />
      </g>
      <g transform={`translate(${w.dx} 560)`} style={{color: ink}}>
        <Dog ph={w.dph} a={w.da} sniff={k(q, [4.95, 5.3], [0, 1])} bg={bg} />
      </g>
      {/* burdock heads that leap onto them */}
      {HEADS.map((h, j) => {
        const t0 = T.covered + 0.15 + j * 0.27;
        const to = h.to === 'dog' ? dogPt(h.i) : manPt(h.i);
        const p = k(q, [t0, t0 + 0.34], [0, 1], INOUT);
        const pos: Pt = [lerp(h.at[0], to[0], p), lerp(h.at[1], to[1], p) - 46 * Math.sin(Math.PI * p)];
        // big enough to read when the camera is pushed in on the dog (about an eighth of the frame each)
        const r = h.to === 'dog' ? 11 : 9;
        const sq = q > t0 + 0.34 ? 1 + 0.18 * settle(q, t0 + 0.34, 3, 1.4) : 1;
        const grow = k(t, [1.55 + j * 0.07, 1.9 + j * 0.07], [0, 1], BACK);
        return grow > 0 ? <Burr key={j} x={pos[0]} y={pos[1]} r={lerp(7.5, r, p) * sq * grow} rot={j * 23 + 140 * p} ink={ink} bg={bg} halo={p > 0.5} /> : null;
      })}
      {/* the many: the same walker seven times, all bent over brushing the burrs off, then turning their backs on them */}
      {DOLLS.map((i) => {
        const x = 540 - 66 * i;
        const o = i * 0.05;
        const bend = 62 * k(q, [T.brush - 0.2 + o, T.brush + 0.05 + o], [0, 1], OUT) * (1 - k(q, [T.forget - 0.05 + o, T.forget + 0.2 + o], [0, 1]));
        const c = Math.floor((q - T.brush) * 12 + i) % 4;
        const away = q >= T.forget + 0.35 + o;
        return (
          <g key={i}>
            <g transform={`translate(${x} 900) scale(${away ? -0.85 : 0.85} 0.85)`} style={{color: ink}}>
              <Brusher bend={bend} s={[0.05, 0.5, 0.95, 0.5][c]} bg={bg} />
            </g>
            {[0, 1].map((n) => {
              const tb = T.brush + 0.2 + 0.09 * i + 0.4 * n + 0.15 * (i % 2);
              const d = Math.max(0, q - tb);
              const y = Math.min(894, (n ? 890 : 868) + 1500 * d * d);
              return <Burr key={n} x={x + (n ? 9 : 10) + 22 * Math.min(d, 0.3)} y={y} r={7} rot={i * 40 + n * 70 + 300 * Math.min(d, 0.35)} ink={ink} bg={bg} halo />;
            })}
          </g>
        );
      })}
      <path d={[fir(150, 1660, 230), fir(300, 1660, 150)].join(' ')} fill={ink} />
      <path d="M110 1300 q10 -8 20 0 q10 -8 20 0 M180 1340 q8 -6 16 0 q8 -6 16 0" fill="none" stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
};

// ---------- the centre: everything that sits on the fold (drawn once until the scissors cut it) ----------
const MOUNT: Pt[] = [[22, 380], [22, 318], [62, 290], [104, 316], [152, 282], [204, 312], [262, 262], [318, 300], [360, 284], [402, 300], [444, 258], [482, 296], [508, 270]];
const MOUNTAINS = poly([...MOUNT, [522, 252], [531, 230], [541, 214], [553, 211], [559, 217], [551, 224], [556, 250], [572, 270], ...MOUNT.slice(0, -1).reverse().map(([x, y]) => [1080 - x, y] as Pt)]);
const snow = (x: number, y: number, w: number) => poly([[x, y + 4], [x + w * 0.5, y + 4 + w * 0.7], [x + w * 0.22, y + 4 + w * 0.5], [x, y + 4 + w * 0.85], [x - w * 0.22, y + 4 + w * 0.5], [x - w * 0.5, y + 4 + w * 0.7]]);
const FOREST = Array.from({length: 38}, (_, i) => 50 + i * 26.2).map((x, i) => poly([[x - 8, 377], [x, 344 - (i % 3) * 7], [x + 8, 377]])).join(' '); // firs cut out of the foot of the range
const SNOW = [FOREST,snow(444, 258, 26), snow(262, 262, 28), snow(152, 282, 22), snow(636, 258, 26), snow(818, 262, 28), snow(928, 282, 22), snow(545, 222, 20)].join(' ');
const SLIDE = 1071; // the kept burr's centre on the glass slide, where the camera dives in
const CORE_R = 0.365 * 20; // the kept burr's solid black cup (radius in world units at r = 20): the lens opens inside it
const PAPER_H = 2440; // the rag paper runs on below the cut sheet's border: a margin where the cut-offs land
// the herdsman's jacket, left half (the right is its mirror): a stand collar, puffed sleeve caps, a scalloped lace hem and
// cuffs, an eyelet yoke, a cut edelweiss on the breast and a lace column down the front, a welt pocket with a zip
const HEM_R = Array.from({length: 8}, (_, i) => `Q${450 + i * 12} 1672 ${456 + i * 12} 1660`).join(' ');
const COAT_L = `M540 1306 Q523 1305 515 1290 L482 1294 L446 1306 C449 1380 454 1440 452 1500 C450 1560 446 1610 444 1660 ${HEM_R} L540 1660 Z`;
const SLEEVE_L = 'M446 1306 C424 1295 403 1313 404 1350 C405 1360 409 1366 411 1371 L399 1589 L431 1593 L446 1390 Z';
const COLLAR_L = 'M540 1306 Q523 1305 515 1290 L513 1277 Q517 1270.5 522 1276.5 Q526 1271.5 531 1278 Q535.5 1273 540 1279.5 Z';
const CUFF_L = 'M399 1589 L431 1593 L430.6 1603 Q426.6 1611 422.6 1602.5 Q418.6 1610.5 414.6 1602 Q410.6 1610 406.6 1601.5 Q402.6 1609.5 398.6 1601 Z';
const ZX0 = 458;
const ZX1 = 522;
const ZY = 1556;
const Front: React.FC<{side: -1 | 1; g: number; ink: string; bg: string; red: string; strip: number; zip: number; jam: number; buttons: React.ReactNode}> = ({side, g, ink, bg, red, strip, zip, jam, buttons}) => (
  <g transform={side > 0 ? MIRROR : undefined}>
    <g transform={`rotate(${g} 432 1306)`}>
      <g filter="url(#felt)">
        <path d={COAT_L} fill={ink} />
        <path d={SLEEVE_L} fill={ink} />
        <path d={COLLAR_L} fill={ink} />
        <path d={CUFF_L} fill={ink} />
      </g>
      {/* every detail is cut out of the black, never drawn on it */}
      <g fill="none" stroke={bg} strokeLinecap="round">
        <path d="M515 1290 Q523 1305 540 1306" strokeWidth={1.3} />
        <path d="M399.4 1590 L430.6 1594 M444 1640 L540 1640" strokeWidth={1.2} />
        {/* gathers in the puffed sleeve cap */}
        <path d="M413 1320 L418 1335 M420 1312 L423 1329 M428 1308 L429 1325 M436 1306 L435 1321" strokeWidth={1.1} />
        {/* the yoke: a scalloped seam from collar to shoulder */}
        <path d={Array.from({length: 7}, (_, i) => `M${510 - i * 9} ${1306 + i * 2.6} q-4.5 5 -9 2.6`).join(' ')} strokeWidth={1.1} />
      </g>
      <g fill={bg}>
        {spread([511, 1299], [452, 1314], 8).map(([x, y], i) => (
          <circle key={`y${i}`} cx={x} cy={y} r={1.6} />
        ))}
        {spread([403, 1597], [428, 1600], 4).map(([x, y], i) => (
          <circle key={`c${i}`} cx={x} cy={y} r={1.3} />
        ))}
        {Array.from({length: 8}, (_, i) => (
          <circle key={`s${i}`} cx={450 + i * 12} cy={1664} r={1.5} />
        ))}
        {Array.from({length: 10}, (_, i) => (
          <path key={`h${i}`} d={HEART(452 + i * 9.2, 1650, 2.6)} />
        ))}
        {/* the lace column down the front edge: diamonds and eyelets */}
        {Array.from({length: 25}, (_, i) =>
          i % 2 ? <circle key={`l${i}`} cx={527} cy={1336 + i * 12} r={1.2} /> : <path key={`l${i}`} d={diamond([527, 1336 + i * 12], 3)} />,
        )}
        {/* the edelweiss: nine woolly pointed petals round a cut-ringed heart, two leaves and a stem, hearts either side */}
        {Array.from({length: 9}, (_, i) => (
          <path key={`p${i}`} d="M0 -5 Q3.2 -12 0 -20 Q-3.2 -12 0 -5 Z" transform={`translate(482 1408) rotate(${i * 40})`} />
        ))}
        <path d="M482 1424 Q480 1446 483 1466 M482 1440 Q470 1432 462 1440 Q472 1447 482 1440 Z M483 1452 Q495 1444 503 1452 Q493 1459 483 1452 Z" />
        <path d={`${HEART(458, 1470, 5.5)} ${HEART(506, 1470, 5.5)}`} />
      </g>
      <path d="M482 1424 Q480 1446 483 1466" fill="none" stroke={bg} strokeWidth={1.4} />
      {Array.from({length: 8}, (_, i) => {
        const [x, y] = add([482, 1408], pol(2.6, i * 45));
        return <circle key={i} cx={x} cy={y} r={0.75} fill={bg} />;
      })}
      <path d={`${HEART(458, 1470.4, 2.2)} ${HEART(506, 1470.4, 2.2)}`} fill={ink} />
      {/* the welt pocket and its zip: teeth interlock behind the slider and stand apart ahead of it; at the jam a tuck of
          lining is caught in the slider's mouth */}
      <path d={`M${ZX0} ${ZY - 5.5} L${ZX1} ${ZY - 5.5} Q${ZX1 + 3} ${ZY} ${ZX1} ${ZY + 5.5} L${ZX0} ${ZY + 5.5} Q${ZX0 - 3} ${ZY} ${ZX0} ${ZY - 5.5} Z`} fill={bg} />
      {Array.from({length: 20}, (_, i) => {
        const x = ZX0 + 2.5 + i * 3;
        const shut = x < zip - 3;
        return (
          <g key={i} fill={ink}>
            <rect x={x - 0.9} y={ZY - 5} width={1.8} height={shut ? 5.9 : 3.4} />
            <rect x={x + 0.6} y={shut ? ZY - 0.9 : ZY + 1.6} width={1.8} height={shut ? 5.9 : 3.4} />
          </g>
        );
      })}
      <g transform={`translate(${zip} ${ZY})`}>
        <path d="M-5 -3.8 L5 -6 L5 6 L-5 3.8 Z" fill={ink} />
        <path d="M-2.6 4 L2.6 4 L2.2 15.5 Q0 18.5 -2.2 15.5 Z" fill={bg} />
        <circle cy={12} r={1.15} fill={ink} />
        {jam > 0 ? <path d="M5 -3.6 L8.4 -5.3 L9.4 -2.4 L12.6 -3.6 L10.8 0.2 L13.2 3.2 L9.4 2.8 L8.2 5.4 L5 3.6 Z" fill={ink} transform={`scale(${jam} 1)`} /> : null}
      </g>
      {strip > 0 ? (
        side < 0 ? (
          <g clipPath="url(#strip-clip)">
            <rect x={533} y={1300} width={7} height={360 * strip} fill={red} />
            {Array.from({length: 26}, (_, i) => (
              <path key={i} d={`M538 ${1306 + i * 14} q5 -1 4 4`} fill="none" stroke={red} strokeWidth={1.4} opacity={g > 0.6 ? 1 : 0} />
            ))}
          </g>
        ) : (
          <g>
            <rect x={533} y={1300} width={7} height={360 * strip} fill={ink} />
            {Array.from({length: Math.floor(51 * strip)}, (_, i) => (
              <circle key={i} cx={536.5} cy={1304 + i * 7} r={2} fill="none" stroke={bg} strokeWidth={0.9} />
            ))}
          </g>
        )
      ) : null}
      {side < 0 ? buttons : null}
    </g>
  </g>
);
// paper and wool fibres: fractal noise in world units (fine at the sheet's scale, a visible weave when the camera is close),
// tinted and kept inside the shape it is applied to
const Fibres: React.FC<{id: string; color: string; gain: number; freq?: string}> = ({id, color, gain, freq = '0.85 0.55'}) => (
  <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={3} seed={11} result="noise" />
    <feColorMatrix in="noise" type="luminanceToAlpha" result="lum" />
    <feComponentTransfer in="lum" result="amt">
      <feFuncA type="linear" slope={gain} intercept={-0.1} />
    </feComponentTransfer>
    <feFlood floodColor={color} result="tint" />
    <feComposite in="tint" in2="amt" operator="in" result="speck" />
    <feComposite in="speck" in2="SourceGraphic" operator="in" result="inside" />
    <feMerge>
      <feMergeNode in="SourceGraphic" />
      <feMergeNode in="inside" />
    </feMerge>
  </filter>
);
// a button cut from two layers of cream card, lit from the upper left (its lower-right rim in shade), a pressed dish, four
// holes punched through to the black wool, sewn on with a cross of linen thread
type Pal = {ink: string; bg: string; thread: string; shade: string; dish: string};
const Button: React.FC<{x: number; y: number; rot?: number; pal: Pal}> = ({x, y, rot = 0, pal}) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <g filter="url(#fibre)">
      <circle r={9} fill={pal.shade} />
      <circle cx={-0.4} cy={-0.5} r={8.5} fill={pal.bg} />
      <circle cx={-0.15} cy={-0.15} r={6.2} fill={pal.dish} />
      <circle cx={-0.4} cy={-0.5} r={5.6} fill={pal.bg} />
      {[[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].map(([a, b], i) => (
        <circle key={i} cx={a} cy={b} r={1.3} fill={pal.ink} />
      ))}
      <path d="M-2.1 -2.1 L2.1 2.1 M2.1 -2.1 L-2.1 2.1" stroke={pal.thread} strokeWidth={0.7} strokeLinecap="round" />
      <path d="M-1.7 -2.5 L2.5 1.7 M2.5 -1.7 L-1.7 2.5" stroke={pal.thread} strokeWidth={0.4} strokeLinecap="round" />
    </g>
  </g>
);

const Center: React.FC<{t: number; T: Times; ink: string; bg: string; red: string; pal: Pal}> = ({t, T, ink, bg, red, pal}) => {
  const q = step(t);
  // hero burr: unfolds three times in the first second
  const uf = (a: number, b: number) => Math.cos(Math.PI * k(t, [a, b], [0, 1], BACK));
  // the one burr the middle doll keeps, and carries to the microscope
  const raise = k(q, [T.put - 0.05, T.put + 0.3], [0, 1], BACK);
  const hand: Pt = [lerp(560, 569, raise), lerp(846, 786, raise)];
  const tr0 = T.put + 0.6;
  const tr = k(t, [tr0, tr0 + 0.85], [0, 1], INOUT);
  const bz = (p: number): Pt => [(1 - p) ** 2 * hand[0] + 2 * (1 - p) * p * 650 + p * p * 540, (1 - p) ** 2 * hand[1] + 2 * (1 - p) * p * 930 + p * p * SLIDE];
  const kept = bz(tr);
  // the jacket
  const strain = q > T.buttons - 0.55 && q < T.buttons ? 0.35 + 0.25 * Math.sin(q * 40) : 0;
  const popped = q >= T.buttons;
  let g = strain + (popped ? 0.9 + 0.5 * settle(q, T.buttons, 3, 1.3) : 0);
  if (q >= T.after + 0.4) g = lerp(0.9, 3.6, k(q, [T.after + 0.4, T.after + 0.75], [0, 1], OUT));
  if (q >= T.press - 0.08) g = 3.6 * (1 - k(t, [T.press - 0.08, T.press], [0, 1], IN)) + (t > T.press ? 0.35 * settle(t, T.press, 4, 1.6) : 0);
  if (q >= T.pull) g = 3.2 * k(t, [T.pull, T.pull + 0.12], [0, 1], OUT) + 0.4 * settle(t, T.pull + 0.12, 3, 1.4) * (t > T.pull + 0.12 ? 1 : 0);
  if (t >= T.b4 - 0.08) g = 3.2 * (1 - k(t, [T.b4 - 0.08, T.b4 + 0.04], [0, 1], IN));
  g = Math.max(0, g);
  const strip = k(q, [T.after + 0.55, T.after + 1.05], [0, 1]);
  // the zip runs, jams on a tuck of lining with a jolt, is tugged twice and goes nowhere
  const tug = (t0: number) => 3.2 * Math.sin(Math.PI * k(q, [t0, t0 + 0.17], [0, 1]));
  const zip = 464 + 28 * k(q, [T.zips - 0.05, T.zips + 0.3], [0, 1], IN) + (q > T.zips + 0.3 ? 1.6 * settle(q, T.zips + 0.3, 6, 2.2) : 0) - tug(T.zips + 0.55) - tug(T.zips + 0.85);
  const jam = k(q, [T.zips + 0.28, T.zips + 0.4], [0, 1], BACK);
  const fall = (t0: number, vx: number, vy: number, x0: number, y0: number, spin: number) => {
    const d = Math.max(0, t - t0);
    return {x: x0 + vx * d, y: y0 + vy * d + 900 * d * d, rot: spin * d};
  };
  const mid = fall(T.buttons, 150, -230, 540, 1460, 760);
  const top = fall(T.after + 0.08, -40, 0, 540, 1390, -200);
  const bot = fall(T.after + 0.26, 30, 0, 540, 1530, 240);
  const buttons = (
    <>
      {t < T.after + 0.08 ? <Button x={540} y={1390} pal={pal} /> : null}
      {t < T.after + 0.26 ? <Button x={540} y={1530} pal={pal} /> : null}
      {!popped ? <Button x={540} y={1460} pal={pal} /> : <path d="M539 1459 q4 5 0 9 M541 1460 q-3 4 2 8" fill="none" stroke={pal.thread} strokeWidth={0.6} strokeLinecap="round" />}
    </>
  );
  return (
    <g>
      {/* frame and border */}
      <rect x={20} y={20} width={1040} height={1880} fill="none" stroke={ink} strokeWidth={7} />
      <rect x={34} y={34} width={1012} height={1852} fill="none" stroke={ink} strokeWidth={1.6} />
      {[[60, 60], [1020, 60], [60, 1660], [1020, 1660]].map(([x, y], i) => (
        <path key={i} d={HEART(x, y, 12)} fill={ink} />
      ))}
      {/* the alps */}
      <path d={`${MOUNTAINS} ${SNOW}`} fill={ink} fillRule="evenodd" />
      <path d="M440 186 L470 186 L462 207 L470 228 L440 228 L450 207 Z M640 186 L610 186 L618 207 L610 228 L640 228 L630 207 Z" fill={ink} />
      <rect x={466} y={182} width={148} height={50} fill={ink} />
      <text data-tb-skip x={540} y={220} textAnchor="middle" fontFamily={FUTURA} fontWeight={700} fontSize={36} letterSpacing={4} fill={bg}>
        1941
      </text>
      <path d={`M24 560 ${Array.from({length: 52}, (_, i) => `L${30 + i * 20} ${i % 2 ? 560 : 552}`).join(' ')} L1056 560 L1056 592 L24 592 Z`} fill={ink} />
      {/* the burdock on the fold: leaves, stems, heads */}
      {/* the stem is cut out from the burr downward as the camera pulls back, so frame 0 holds only the folded wedge */}
      <g fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round">
        <path d="M540 428 L540 560" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - k(t, [1.2, 1.9], [0, 1], INOUT)} />
        {HEADS.flatMap((h, j) => {
          const p = k(t, [1.45 + j * 0.07, 1.8 + j * 0.07], [0, 1]);
          return [
            `M540 ${h.at[1] + 22} Q${(540 + h.at[0]) / 2} ${h.at[1] + 6} ${h.at[0]} ${h.at[1]}`,
            `M540 ${h.at[1] + 22} Q${(1620 - h.at[0]) / 2} ${h.at[1] + 6} ${1080 - h.at[0]} ${h.at[1]}`,
          ].map((d, s) => (p > 0 ? <path key={`${j}${s}`} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} /> : null));
        })}
      </g>
      {[-1, 1].map((s) => (
        <path key={s} d={`M540 548 C${540 + s * 14} 540 ${540 + s * 30} 528 ${540 + s * 44} 506 C${540 + s * 28} 512 ${540 + s * 14} 522 540 534 Z`} fill={ink} transform={`translate(540 548) scale(${k(t, [1.85, 2.25], [0, 1], BACK)}) translate(-540 -548)`} />
      ))}
      <Burr x={540} y={428} r={15} c={[uf(0.12, 0.42), uf(0.5, 0.82), uf(0.88, 1.22)]} ink={ink} bg={bg} />
      {/* separators */}
      <path d={`M40 680 L1040 680 ${Array.from({length: 16}, (_, i) => `M${80 + i * 61.3} 673 L${87 + i * 61.3} 680 L${80 + i * 61.3} 687 L${73 + i * 61.3} 680 Z`).join(' ')}`} fill={ink} stroke={ink} strokeWidth={1.4} />
      <path d={`M24 900 L1056 900 L1056 912 L24 912 Z`} fill={ink} />
      <path d={`M40 1236 L1040 1236 ${Array.from({length: 16}, (_, i) => `M${80 + i * 61.3} 1229 L${87 + i * 61.3} 1236 L${80 + i * 61.3} 1243 L${73 + i * 61.3} 1236 Z`).join(' ')}`} fill={ink} stroke={ink} strokeWidth={1.4} />
      {/* the middle doll keeps one: the same walker, front on, standing on the fold */}
      <g fill={ink} stroke="none" strokeLinecap="round" strokeLinejoin="round">
        {[-1, 1].map((s) => (
          <g key={s} transform={s > 0 ? MIRROR : undefined}>
            <path d="M531 846 L539.5 846 L539.5 871 L529 872 C526.5 863 527.5 853 531 846 Z" />
            <path d="M529.5 869.5 L539 869" stroke={bg} strokeWidth={1.1} />
            <path d="M530 871 L538.5 871 L537.5 891 L531.5 891 C529.5 884 529 877 530 871 Z" />
            <path d={poly([[530, 890], [538.5, 890], [539, 900], [524, 900], [524.5, 896]])} />
            <path d="M540 805 L528 807 Q522 811 522.5 822 L524 845 L520 853 L540 853 Z" />
            <path d={poly([[533, 806], [540, 806], [540, 823]])} fill={bg} />
          </g>
        ))}
        {[830, 840].map((y) => (
          <circle key={y} cx={540} cy={y} r={1.3} fill={bg} />
        ))}
        <path d="M524.5 811 L519 831 L517 848" stroke={ink} strokeWidth={6.5} fill="none" />
        <g style={{color: ink}}>
          <Hand at={[516.8, 850]} ang={4} open bg={bg} />
          <Hand at={hand} ang={lerp(-10, 175, raise)} open bg={bg} />
        </g>
        <path d={`M555.5 811 L${lerp(561, 566, raise)} ${lerp(831, 812, raise)} L${hand[0]} ${hand[1]}`} stroke={ink} strokeWidth={6.5} fill="none" />
        {/* lace eyelets along the coat hem */}
        {spread([524, 849.5], [556, 849.5], 6).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.05} fill={bg} />
        ))}
        <rect x={537} y={797} width={6} height={10} />
        <ellipse cx={540} cy={789} rx={8.5} ry={10.5} />
        <ellipse cx={531.5} cy={790} rx={2} ry={3.2} />
        <ellipse cx={548.5} cy={790} rx={2} ry={3.2} />
        <path d="M523 781.5 Q521 777 526 778 L554 778 Q559 777 557 781.5 Z" />
        <path d="M530 779 L532 768.5 Q536 765 540 767.5 Q544 765 548 768.5 L550 779 Z" />
        <path d="M530.6 775.6 L549.4 775.6" stroke={bg} strokeWidth={1.1} />
        <path d="M547 771 C552 768 556 765 555 760.5 M551 768.6 l2.5 2 M553.6 765.5 l3 1" stroke={ink} strokeWidth={1.6} fill="none" />
      </g>
      <Burr x={tr > 0 ? kept[0] : hand[0] + 5} y={tr > 0 ? kept[1] : hand[1] - 8} r={tr > 0 ? lerp(12, 20, tr) : 12} rot={200 * tr} ink={ink} bg={bg} halo plain />
      {/* the microscope, cut symmetric about the fold like a Scherenschnitt ornament (so the rip splits it into two true
          halves): eyepiece and body tube with its rings on the fold, a curved limb either side like a lyre, each with its
          rack, a knurled coarse-focus knob, a pillar with a fine-focus knob and a horseshoe foot with its arch; between
          them the stage with clips and the glass slide, and the substage mirror catching the lightbox */}
      <g fill={ink}>
        {[-1, 1].map((s) => (
          <g key={s} transform={s < 0 ? MIRROR : undefined}>
            <rect x={546} y={978} width={12} height={46} />
            <path d="M556 980 C592 976 612 1010 610 1050 C609 1080 600 1112 597 1152 L578 1152 C582 1114 590 1082 591 1052 C592 1022 580 1002 556 1004 Z" />
            <circle cx={566} cy={1001} r={11} />
            <circle cx={566} cy={1001} r={6.2} fill="none" stroke={bg} strokeWidth={1.3} />
            {Array.from({length: 14}, (_, i) => {
              const [x, y] = add([566, 1001], pol(11.2, i * (360 / 14)));
              return <circle key={i} cx={x} cy={y} r={1.1} fill={bg} />;
            })}
            <rect x={578} y={1150} width={20} height={38} />
            <circle cx={588} cy={1152} r={9.5} />
            <circle cx={588} cy={1152} r={2.6} fill={bg} />
            <path d="M540 1216 L540 1186 L624 1186 L636 1216 L589 1216 Q568 1194 547 1216 Z" />
          </g>
        ))}
        <rect x={527} y={944} width={26} height={5.5} rx={1.5} />
        <rect x={531} y={949} width={18} height={15} />
        <path d="M533 963 L547 963 L547 1030 L533 1030 Z M533 986 L547 986 L547 988 L533 988 Z M533 1012 L547 1012 L547 1014 L533 1014 Z" fillRule="evenodd" />
        <path d={poly([[529, 1029], [551, 1029], [548, 1039], [532, 1039]])} />
        <path d={poly([[535, 1038], [545, 1038], [544, 1048], [542.5, 1052], [537.5, 1052], [536, 1048]])} />
        <rect x={474} y={1091} width={132} height={9} rx={1.5} />
        <path d={`${poly([[490, 1091], [512, 1085.5], [513, 1087.5], [494, 1091]])} ${poly([[590, 1091], [568, 1085.5], [567, 1087.5], [586, 1091]])}`} />
        <rect x={492} y={1086.5} width={96} height={4.5} />
        <path d={poly([[499, 1087.6], [581, 1087.6], [579, 1088.7], [501, 1088.7]])} fill={bg} />
        <rect x={531} y={1100} width={18} height={11} />
        <path d="M540 1111 L540 1125" stroke={ink} strokeWidth={4} />
        <ellipse cx={540} cy={1131} rx={15} ry={7} />
        <ellipse cx={540} cy={1130} rx={11} ry={4.4} fill={bg} />
      </g>
      {/* the jacket on its hanger */}
      <path d="M540 1288 L540 1270 C540 1254 556 1252 558 1264 M540 1286 L428 1304 M540 1286 L652 1304" fill="none" stroke={ink} strokeWidth={3.4} strokeLinecap="round" />
      <defs>
        <clipPath id="strip-clip">
          <rect x={520} y={1296} width={40} height={370} />
        </clipPath>
        <Fibres id="felt" color={bg} gain={0.16} />
        <Fibres id="fibre" color={pal.shade} gain={0.3} />
      </defs>
      <Front side={1} g={g} ink={ink} bg={bg} red={red} strip={strip} zip={zip} jam={jam} buttons={null} />
      <Front side={-1} g={g} ink={ink} bg={bg} red={red} strip={strip} zip={zip} jam={jam} buttons={buttons} />
      {popped && mid.y < 2100 ? <Button x={mid.x} y={mid.y} rot={mid.rot} pal={pal} /> : null}
      {t >= T.after + 0.08 && top.y < 2100 ? <Button x={top.x} y={top.y} rot={top.rot} pal={pal} /> : null}
      {t >= T.after + 0.26 && bot.y < 2100 ? <Button x={bot.x} y={bot.y} rot={bot.rot} pal={pal} /> : null}
      {/* bottom band, where the closer is cut */}
      <path d={`M24 1702 ${Array.from({length: 26}, (_, i) => `Q${44 + i * 40} 1682 ${64 + i * 40} 1702`).join(' ')} L1056 1702 L1056 1896 L24 1896 Z`} fill={ink} />
    </g>
  );
};

// ---------- under the lens: hooks catching loops, in screen space ----------
const FX = 540;
const FY = 860;
const HOOKS = Array.from({length: 7}, (_, i) => ({x: 540 + (i - 3) * 118 + (i % 2 ? 9 : -6), tip: 690 + (i % 3) * 26, curl: (i % 2 ? 1 : -1) as 1 | -1}));
const BUTTON_ZOOM = 26; // the field of view closes down to exactly the jacket's middle button at this camera zoom
// open: the field of view while it opens inside the burr's black cup (radius and centre on screen); until the camera has
// pushed all the way in, the burr's own paper is the surround and the sheet stays visible around it
const Micro: React.FC<{t: number; T: Times; ink: string; bg: string; red: string; muted: string; surface: string; pal: Pal; open: {r: number; x: number; y: number}}> = ({t, T, ink, bg, red, muted, surface, pal, open}) => {
  const q = step(t);
  const opening = t < T.swap - 0.45;
  const iris = opening ? open.r : lerp(450, 9 * BUTTON_ZOOM, k(t, [T.swap - 0.45, T.swap], [0, 1], INOUT));
  const cx = opening ? open.x : FX;
  const cy = opening ? open.y : lerp(FY, 960, k(t, [T.swap - 0.45, T.swap], [0, 1], INOUT));
  const surround = t >= T.dive + 0.42;
  const fade = 1 - k(t, [T.swap - 0.45, T.swap - 0.1], [0, 1]);
  // the hooks come down behind the loops, slide under them, then lift and drag them up (with a second tug)
  const down = 205 * k(q, [T.dive + 0.3, T.lift - 0.15], [0, 1], OUT);
  const side = k(q, [T.lift - 0.15, T.lift + 0.08], [0, 1], OUT);
  const up = 120 * k(q, [T.lift + 0.25, T.lift + 0.9], [0, 1], BACK) + 40 * k(q, [T.nature + 0.9, T.nature + 1.2], [0, 1], BACK);
  const push = lerp(1, 1.32, k(t, [T.nature - 0.2, T.swap - 0.5], [0, 1], INOUT));
  const caught = q >= T.lift + 0.08;
  const rnd = rng(17);
  const back = Array.from({length: 15}, (_, i) => ({x: 120 + i * 60 + rnd() * 30, tip: 560 + rnd() * 160, curl: (i % 2 ? 1 : -1) as 1 | -1, apex: 860 + rnd() * 140}));
  const hookD = (x: number, tip: number, h: number, curl: 1 | -1) => `M${x} ${tip} C${x} ${tip + h * 1.6} ${x + curl * h * 2} ${tip + h * 1.8} ${x + curl * h * 2} ${tip + h * 0.6}`;
  const loopD = (x: number, apexX: number, apexY: number, w: number) =>
    `M${x - w} 1340 C${x - w * 1.8} ${apexY + 70} ${apexX - w * 0.9} ${apexY} ${apexX} ${apexY} C${apexX + w * 0.9} ${apexY} ${x + w * 1.8} ${apexY + 70} ${x + w} 1340`;
  // a loop rests beside its hook; once caught, its crown sits in the hook's crook and is dragged up with it
  const fronts = HOOKS.map((h, i) => {
    const tipY = h.tip + down - (caught ? up : 0);
    const hx = h.x + h.curl * 24 * side;
    const apexRest = 905 + (i % 3) * 22;
    const slope = (hx - (540 + (hx - 540) * 0.6)) / (tipY - 300);
    return {tipY, hx, curl: h.curl, x0: hx - slope * (tipY - 300), base: h.x + h.curl * 58, apexX: caught ? hx + h.curl * 34 : h.x + h.curl * 58, apexY: caught ? Math.min(apexRest, tipY + 32) : apexRest};
  });
  return (
    <div style={{position: 'absolute', inset: 0}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="field" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor={bg} />
            <stop offset="100%" stopColor={mix(surface, 100 * fade, bg)} />
          </radialGradient>
        </defs>
        <clipPath id="field-clip">
          <circle cx={cx} cy={cy} r={iris} />
        </clipPath>
        <circle cx={cx} cy={cy} r={iris + 4} fill="url(#field)" />
        <g clipPath="url(#field-clip)">
          <g opacity={fade} transform={`translate(${cx} ${cy}) scale(${(opening ? iris / 450 : 1) * push}) translate(${-FX} ${-FY})`}>
            {/* the back layer: more hooks and fibres, a paper layer further away */}
            <g fill="none" stroke={muted} strokeLinecap="round" opacity={0.55}>
              {back.map((b, i) => (
                <g key={i}>
                  <path d={loopD(b.x + 20, b.x + 20, b.apex - (caught ? up * 0.5 : 0), 18)} strokeWidth={5} />
                  <path d={`M${b.x} 380 L${b.x} ${b.tip + down * 0.7 - up * 0.5}`} strokeWidth={8} />
                  <path d={hookD(b.x, b.tip + down * 0.7 - up * 0.5, 9, b.curl)} strokeWidth={6} />
                </g>
              ))}
            </g>
            {/* the front layer: the burr's spines with red hooks, the loops of wool over them, then each hook's point over
                its loop, so a caught loop visibly passes through its hook */}
            {fronts.map((f, i) => (
              <g key={`s${i}`}>
                <path d={poly([[f.x0 - 15, 300], [f.x0 + 15, 300], [f.hx + 7, f.tipY - 60], [f.hx - 7, f.tipY - 60]])} fill={ink} />
                <path d={`M${f.hx} ${f.tipY - 62} L${f.hx} ${f.tipY}`} stroke={red} strokeWidth={13} strokeLinecap="round" />
                <path d={hookD(f.hx, f.tipY, 26, f.curl)} fill="none" stroke={red} strokeWidth={12} strokeLinecap="round" />
              </g>
            ))}
            <g fill="none" stroke={ink} strokeLinecap="round">
              {fronts.map((f, i) => (
                <path key={`l${i}`} d={loopD(f.base, f.apexX, f.apexY, 30)} strokeWidth={10} />
              ))}
              {[160, 330, 610, 790, 950].map((x, i) => (
                <path key={`f${i}`} d={loopD(x, x + 14, 1010 + (i % 2) * 50 - (caught ? 14 : 0), 24)} strokeWidth={8} />
              ))}
            </g>
            {fronts.map((f, i) => (
              <path key={`p${i}`} d={hookD(f.hx, f.tipY, 26, f.curl)} pathLength={1} strokeDasharray="0.36 1" strokeDashoffset={-0.64} fill="none" stroke={red} strokeWidth={12} strokeLinecap="round" />
            ))}
          </g>
        </g>
        {/* as the field closes, its disc of light becomes the button: holes, thread and rim surface out of it */}
        {fade < 1 ? (
          <g opacity={k(t, [T.swap - 0.3, T.swap - 0.02], [0, 1], INOUT)} transform={`translate(${cx} ${cy}) scale(${iris / 9})`}>
            <Button x={0} y={0} pal={pal} />
          </g>
        ) : null}
        {/* the black paper around the field of view: a cut rim inside the burr's own black cup while the camera pushes in,
            then the whole frame */}
        <path
          d={`${surround ? 'M-10 -10 L1090 -10 L1090 1930 L-10 1930 Z' : `M${cx + iris * 1.2} ${cy} A${iris * 1.2} ${iris * 1.2} 0 1 0 ${cx - iris * 1.2} ${cy} A${iris * 1.2} ${iris * 1.2} 0 1 0 ${cx + iris * 1.2} ${cy} Z`} M${cx + iris} ${cy} A${iris} ${iris} 0 1 0 ${cx - iris} ${cy} A${iris} ${iris} 0 1 0 ${cx + iris} ${cy} Z`}
          fill={ink}
          fillRule="evenodd"
          style={{filter: `drop-shadow(5px 8px 7px ${mix(ink, 60)})`}}
        />
        {Array.from({length: 48}, (_, i) => {
          const a = i * 7.5;
          const [x0, y0] = add([cx, cy], pol(iris + 10, a));
          const [x1, y1] = add([cx, cy], pol(iris + (i % 4 ? 20 : 34), a));
          return <path key={i} d={`M${x0} ${y0} L${x1} ${y1}`} stroke={muted} strokeWidth={2} opacity={fade * k(t, [T.dive + 0.4, T.dive + 0.7], [0, 1])} />;
        })}
      </svg>
    </div>
  );
};

// ---------- the scissors ----------
// steel blades with a ground bevel and black japanned bows, so they read over the black jacket as well as on cream;
// tilt: turned over to lie on the paper's margin
const Scissors: React.FC<{open: number; ink: string; bg: string; steel: string; tilt: number}> = ({open, ink, bg, steel, tilt}) => {
  const arm = (s: 1 | -1) => (
    <g transform={`rotate(${s * open} 0 -78)`}>
      <path d={poly([[-5.5, -78], [5.5, -78], [s * 1.5 + 1, 0], [s * 1.5 - 1, -2]])} fill={steel} stroke={ink} strokeWidth={1} strokeLinejoin="round" />
      <path d={`M${s * 1.2} -74 L${s * 1.4} -8`} stroke={bg} strokeWidth={0.9} opacity={0.7} />
      <path d={`M0 -78 L${s * 10} -104`} stroke={ink} strokeWidth={7} strokeLinecap="round" />
      <circle cx={s * 17} cy={-122} r={16} fill="none" stroke={ink} strokeWidth={6.5} />
      <circle cx={s * 17} cy={-122} r={16} fill="none" stroke={steel} strokeWidth={1.6} />
    </g>
  );
  return (
    <g transform={`scale(1.5) rotate(${tilt})`}>
      {arm(1)}
      {arm(-1)}
      <circle cx={0} cy={-78} r={3} fill={bg} stroke={ink} strokeWidth={1} />
    </g>
  );
};

// the years 1942 to 1955, cut as small numerals beside the fold, one for each snip as the scissors pass it
const Years: React.FC<{ys: number[]; shown: number; ink: string; bg: string}> = ({ys, shown, ink, bg}) => (
  <g data-tb-skip fontFamily={FUTURA} fontWeight={700} fontSize={17} letterSpacing={0.6}>
    {ys.slice(0, shown).map((y, i) => (
      <g key={i}>
        <path d={`M541 ${y} L547 ${y}`} stroke={ink} strokeWidth={1.4} />
        <text x={550} y={y + 6} fill={ink} stroke={bg} strokeWidth={3.2} paintOrder="stroke" strokeLinejoin="round">
          {1942 + i}
        </text>
      </g>
    ))}
  </g>
);

// ---------- the closer, cut out of the bottom border ----------
// The story's last line is cut first (its outline shows as a hairline of light), then each letter's black piece lifts out
// and drops away, leaving the words open to the lightbox; the platform's line and the handle are cut along after it.
const LAST_LINE = 'look closer.';
const Closer: React.FC<{t: number; t0: number; cta: {text: string; sub: string; handle: string}; ink: string; bg: string}> = ({t, t0, cta, ink, bg}) => {
  const chars = [...LAST_LINE];
  // each piece pops up, drops, and comes to rest where it lands on the paper's margin below the border
  const fall = chars.map((_, i) => {
    const land = 370 + ((i * 53) % 7) * 26;
    const tLand = (240 + Math.sqrt(240 * 240 + 4 * 2600 * land)) / 5200;
    const tp = Math.min(tLand, Math.max(0, t - (t0 + 0.2 + i * 0.05)));
    return {x: (((i * 37) % 9) - 4) * 55 * tp, y: -240 * tp + 2600 * tp * tp, r: tp * (i % 2 ? 150 : -130)};
  });
  const reveal = k(t, [t0 + 0.55, t0 + 1.0], [0, 1], INOUT);
  const word = {x: 540, y: 1792, textAnchor: 'middle', fontFamily: FUTURA, fontWeight: 700, fontSize: 112, letterSpacing: 2} as const;
  const line = [cta.text.replace(/\*/g, ''), cta.sub].filter(Boolean).join(' · ');
  return (
    <g>
      <defs>
        <clipPath id="closer-reveal">
          <rect x={100} y={1800} width={880 * reveal} height={90} />
        </clipPath>
      </defs>
      <g data-tb="cta">
        <text {...word} fill={bg}>
          {LAST_LINE}
        </text>
        <g clipPath="url(#closer-reveal)">
          <text x={540} y={1842} textAnchor="middle" fontFamily={FUTURA} fontWeight={700} fontSize={36} letterSpacing={1} fill={bg}>
            {line}
          </text>
          {cta.handle ? (
            <text x={540} y={1874} textAnchor="middle" fontFamily={FUTURA} fontWeight={500} fontSize={22} letterSpacing={4} fill={bg}>
              {cta.handle}
            </text>
          ) : null}
        </g>
      </g>
      <text data-tb-skip {...word} fill={ink} rotate={fall.map((f) => f.r.toFixed(1)).join(' ')}>
        {chars.map((c, i) => (
          <tspan key={i} dx={(fall[i].x - (i ? fall[i - 1].x : 0)).toFixed(2)} dy={(fall[i].y - (i ? fall[i - 1].y : 0)).toFixed(2)}>
            {c}
          </tspan>
        ))}
      </text>
    </g>
  );
};

// ---------- captions: a few words cut through a strip of black paper ----------
// Never the voice verbatim: each strip adds what the voice leaves out. The letters are holes: through them you see the paper
// underneath, with the strip's own shadow falling into the top-left of every cut. Laid on black (the lens surround) the
// strip vanishes and the words read as cut straight through the sheet.
type Cap = {text: string; from: number; to: number; at: Pt; screen?: boolean};
const caps = (b: Beat[], T: Times): Cap[] => [
  // the second strip is cut on the snag: the moment the first burr lands in the dog's fur
  {text: 'George de Mestral, b. 1907', from: 2.8, to: T.covered + 0.1, at: [540, 632]},
  {text: 'burdock seed heads', from: T.covered + 0.49, to: b[0].vo![1] + 0.2, at: [600, 395]},
  {text: 'nobody kept one', from: T.brush - 0.1, to: T.put - 0.15, at: [540, 726]},
  {text: 'he looked closer', from: T.put, to: T.dive - 0.75, at: [300, 962]},
  {text: 'every spine ends in a hook', from: T.dive + 0.55, to: T.nature - 0.1, at: [540, 1420], screen: true},
  {text: 'so seeds ride away on fur', from: T.nature, to: T.swap - 0.5, at: [540, 1420], screen: true},
  // laid on the black bottom border, so its words read as cut through the sheet, clear of the ornament lines
  {text: 'velours + crochet = Velcro', from: T.after + 0.55, to: b[3].vo![1] + 0.15, at: [540, 1772]},
];
const CAP_SIZE = 46;
const capW = (text: string) => Math.round(text.length * CAP_SIZE * 0.56 + 84);
const CutStrip: React.FC<{text: string; e: number; ink: string; bg: string; shade: string}> = ({text, e, ink, bg, shade}) => {
  const w = capW(text);
  const h = 74;
  const type = {x: w / 2, y: h / 2 + CAP_SIZE * 0.34, textAnchor: 'middle', fontFamily: FUTURA, fontWeight: 700, fontSize: CAP_SIZE, letterSpacing: 0.5} as const;
  return (
    <div
      data-tb="caption"
      style={{
        width: w,
        height: h,
        // cut from left to right with scissors: uneven edges, never a clean rectangle
        clipPath: `polygon(0% 9%, 2% 0%, ${e * 55}% 4%, ${e * 100 - 2}% 1%, ${e * 100}% 7%, ${e * 100 - 0.6}% 93%, ${e * 100 - 3}% 100%, ${e * 50}% 95%, 3% 99%, 0.5% 90%)`,
      }}
    >
      <svg width={w} height={h} style={{display: 'block'}}>
        <defs>
          {/* a hard luminance mask: theme colours pushed to full on (the strip) and full off (the cut letters) */}
          <filter id="mask-on">
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
          </filter>
          <filter id="mask-off">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
          </filter>
          <mask id="cut-words" maskUnits="userSpaceOnUse" x={-10} y={-10} width={w + 20} height={h + 20}>
            <rect x={-10} y={-10} width={w + 20} height={h + 20} fill={bg} filter="url(#mask-on)" />
            <text {...type} fill={ink} filter="url(#mask-off)">
              {text}
            </text>
          </mask>
          <clipPath id="cut-holes">
            <text {...type}>{text}</text>
          </clipPath>
        </defs>
        <g clipPath="url(#cut-holes)">
          <rect width={w} height={h} fill={bg} />
          <g transform="translate(2.2 3)">
            <rect x={-10} y={-10} width={w + 20} height={h + 20} fill={shade} mask="url(#cut-words)" />
          </g>
        </g>
        <rect width={w} height={h} fill={ink} mask="url(#cut-words)" />
      </svg>
    </div>
  );
};

export const Film: React.FC = () => {
  const th = useTheme();
  const {t, beats, cta} = useFilm();
  const T = useMemo(() => times(beats), [beats]);
  const ink = th.ink;
  const bg = th.bg;
  const red = th.reveal ?? th.ok;
  const table = mix(th.shadow, 80, bg); // a warm wooden worktable, light enough for the black scissors to read on it
  const pal: Pal = {ink, bg, thread: th.muted, shade: mix(th.shadow, 38, bg), dish: mix(th.surface, 60, bg)};

  // the closing frame holds the whole sheet, set so the closer cut into its bottom border clears the platform UI (y < 1500)
  // reached while the torn halves hang open, so the sheet presses shut in the final frame and the camera never moves again
  // the sheet fills the frame: its lower paper margin (where the scissors and the cut-out letters come to rest) runs off
  // the bottom of the frame, so no table shows below it
  const END: Key = [T.close + 0.05, 540, 1262, 0.86];
  const KEYS: Key[] = [
    // frame 0: the folded wedge fills half the frame's width
    [0, 540, 423, 86],
    [1.3, 540, 428, 23],
    // the plant grows down out of the burr: framed from the forest's edge to the ground it stands in
    [2.1, 540, 490, 6.5],
    [3.1, 540, 455, 2.6],
    [T.covered - 0.1, 528, 468, 3.1],
    // in on the dog as the first burr leaps and hooks into its fur, held while the rest land on dog and walker
    [T.covered + 0.45, 470, 490, 7.0],
    [T.covered + 2.25, 466, 488, 7.4],
    // a slow push down the row of brushers toward the one in the middle, the one who keeps a burr
    [7.9, 540, 830, 2.6],
    [T.forget + 0.15, 532, 846, 3.5],
    // off centre: the doll keeps one on the right, the burr's flight to the stage stays clear of the words on the left
    [T.put + 0.05, 470, 1000, 2.7],
    [T.put + 1.5, 475, 1004, 2.75],
    // in until the burr fills the frame, a breath while the lens opens in its black cup, then through it
    [T.dive - 0.7, 540, SLIDE, 3.4],
    [T.dive - 0.1, 540, SLIDE, 34],
    [T.dive + 0.42, 540, SLIDE, 420],
    [T.swap - 0.5, 540, 1460, BUTTON_ZOOM],
    [T.swap, 540, 1460, BUTTON_ZOOM],
    // the jacket framed tight (the bottom border stays out of frame), then in to the straining button, down to the jammed
    // zip, and back out for the strips
    [T.swap + 0.9, 540, 1405, 3.3],
    [T.buttons - 0.7, 540, 1407, 3.35],
    [T.buttons - 0.08, 538, 1461, 6.6],
    [T.buttons + 0.3, 532, 1472, 6.0],
    [T.zips - 0.15, 492, 1557, 7.4],
    [T.after - 0.05, 494, 1557, 7.6],
    // back out to the jacket whole, with the bottom border below it, where the strip's words are cut
    [T.after + 0.55, 540, 1478, 2.05],
    [T.b4, 540, 1482, 2.1],
    [T.cut0 + 0.05, 540, 960, 1.0],
    [T.cut1, 540, 960, 0.92],
    [T.unstick + 0.1, 540, 960, 0.92],
    END,
    [T.close + 3, END[1], END[2] + 3, END[3] * 0.995],
  ];
  const c = camAt(t, KEYS);
  const z = c.z * (t > T.stick ? 1 + 0.01 * settle(t, T.stick, 3, 1.5) : 1) * (t > T.close ? 1 + 0.008 * settle(t, T.close, 3, 1.5) : 1);
  const view = `translate(540 960) scale(${z}) translate(${-c.x} ${-c.y})`;
  const toScreen = (x: number, y: number): Pt => [540 + (x - c.x) * z, 960 + (y - c.y) * z];
  const so = Math.min(9, 1.6 + 1.1 * Math.sqrt(z));
  // very close, the lifted paper casts a hard, offset shadow from the lamp (frame 0 is an object on a lightbox)
  const hard = k(z, [12, 70], [0, 1], (x) => x);
  const shadow = `drop-shadow(${lerp(so, 22, hard)}px ${lerp(so * 1.3, 30, hard)}px ${lerp(so * 0.9, 5, hard)}px ${mix(th.shadow, lerp(55, 78, hard))})`;

  // the scissors: fourteen snips down the fold, faster as the years go
  const snips = Array.from({length: 15}, (_, i) => T.cut0 + (T.cut1 - T.cut0) * Math.pow(i / 14, 0.8));
  const n = snips.filter((s) => t >= s).length; // snips done
  // the fourteen snips cover the picture (a year each, its numeral cut beside the fold); the bottom border goes in one run
  const yAt = (i: number) => 24 + (1690 - 24) * (i / 14);
  const years = Array.from({length: 14}, (_, i) => yAt(i + 1));
  let sy = -400;
  let sx = 540;
  let tilt = 0;
  let open = 10;
  if (t >= T.cut0 - 0.5 && t < T.cut0) sy = lerp(-400, 24, k(t, [T.cut0 - 0.5, T.cut0], [0, 1], OUT));
  else if (t >= T.cut0 && n < 15) {
    const a = snips[n - 1];
    const b = snips[n];
    const u = (t - a) / (b - a);
    open = 10 * (u < 0.55 ? OUT(u / 0.55) : 1 - IN((u - 0.55) / 0.45));
    sy = lerp(yAt(n - 1), yAt(n), k(u, [0.5, 1], [0, 1], IN));
  } else if (n >= 15) {
    // through the bottom border in one run, then laid down on the paper's margin below it
    const p = k(t, [T.cut1 + 0.12, T.cut1 + 0.45], [0, 1], OUT);
    sx = lerp(540, 360, p);
    sy = lerp(lerp(1690, 1905, k(t, [T.cut1, T.cut1 + 0.12], [0, 1], IN)), 2080, p);
    tilt = 78 * p;
    open = 0;
  }
  const cutTo = t >= T.cut0 ? Math.min(1896, sy) : 0;
  const cutOn = t >= T.cut0;

  // the two halves of the world: rip apart, hang open and still in silence (the hook edge and the loop edge face each
  // other), stick, unstick, stick for good
  let d = 40 * k(t, [T.cut1 + 0.12, T.cut1 + 0.34], [0, 1], OUT);
  if (t >= T.stick - 0.12) d = 40 * (1 - k(t, [T.stick - 0.12, T.stick], [0, 1], IN));
  if (t >= T.unstick) d = 60 * k(t, [T.unstick, T.unstick + 0.15], [0, 1], OUT) + (t > T.unstick + 0.15 ? 8 * settle(t, T.unstick + 0.15, 2.5, 1.2) : 0);
  if (t >= T.close - 0.1) d = 60 * (1 - k(t, [T.close - 0.1, T.close], [0, 1], IN));
  d = Math.max(0, d);
  const rot = d * 0.03;
  const sideT = (s: number) => `translate(${s * d} 0) rotate(${s * rot} ${s < 0 ? 0 : 1080} 1920)`;
  const fringe = Math.min(28, d * 0.8);

  const half = <Half t={t} T={T} ink={ink} bg={bg} />;
  const center = <Center t={t} T={T} ink={ink} bg={bg} red={red} pal={pal} />;
  const microOn = t >= T.dive - 0.45 && t < T.swap;
  // the lens opens from a point at the centre of the kept burr's black cup, always inside it, then settles at the field
  const lens = k(t, [T.dive - 0.45, T.dive + 0.4], [0, 1], INOUT);
  const burrAt = toScreen(540, SLIDE);
  const field = {r: lens < 1 ? Math.min(450 * lens, 0.8 * CORE_R * z) : 450, x: lerp(burrAt[0], FX, lens), y: lerp(burrAt[1], FY, lens)};

  const cutAt = T.close + 0.3; // the closer's knife goes in once the sheet has pressed shut
  const cues: Cue[] = [
    [0.12, 'page', 0.5],
    [0.5, 'flip', 0.55],
    [0.88, 'page', 0.4],
    ...HEADS.map((_, j) => [T.covered + 0.15 + j * 0.27 + 0.32, 'soft', 0.22] as Cue),
    [T.brush, 'swish', 0.3],
    [T.brush + 0.45, 'swish', 0.25],
    [T.brush + 0.9, 'swish', 0.22],
    [T.put + 1.45, 'glass', 0.55],
    [T.dive - 0.42, 'flip', 0.45],
    [T.lift + 0.05, 'soft', 0.3],
    [T.lift + 0.32, 'cloth', 0.45],
    [T.nature + 0.9, 'cloth', 0.35],
    [T.buttons, 'pop', 0.65],
    [T.zips + 0.3, 'metal', 0.45],
    [T.zips + 0.6, 'latch', 0.35],
    [T.zips + 0.9, 'latch', 0.3],
    [T.after + 0.08, 'knife', 0.4],
    [T.after + 0.26, 'knife', 0.35],
    [T.after + 0.6, 'cloth', 0.35],
    [T.press, 'press', 0.65],
    [T.pull, 'tear', 0.65],
    [T.b4 + 0.02, 'soft', 0.35],
    ...snips.slice(1).map((s, i) => [s - 0.02, 'knife', 0.2 + 0.012 * i] as Cue),
    [T.cut1 + 0.02, 'knife', 0.32],
    [T.cut1 + 0.12, 'tear', 0.55],
    [T.stick, 'press', 0.75],
    [T.stick + 0.03, 'thump', 0.3],
    [T.unstick, 'tear', 0.8],
    [T.close, 'press', 0.75],
    [cutAt + 0.05, 'knife', 0.28],
    [cutAt + 0.27, 'page', 0.2],
    [cutAt + 0.5, 'page', 0.15],
    [cutAt + 0.62, 'knife', 0.2],
  ];

  // captions: one short cut strip at a time, pinned to the sheet in clear cream (or fixed on screen inside the lens and over
  // the jacket's shoulders); a strip's half-width is clamped so it never leaves the caption area
  const capList = useMemo(() => caps(beats, T), [beats, T]);
  const cap = (() => {
    const c = capList.find((x) => t >= x.from && t < x.to);
    if (!c) return null;
    const w = capW(c.text);
    const [px, py] = c.screen ? c.at : toScreen(...c.at);
    const i = capList.indexOf(c);
    return {
      text: c.text,
      x: Math.min(960 - w / 2, Math.max(60 + w / 2, px)),
      y: Math.min(1460, Math.max(290, py)),
      tilt: [-0.7, 0.5, -0.4, 0.8, -0.6, 0.4, -0.5][i],
      e: k(t, [c.from, c.from + 0.22], [0, 1]),
    };
  })();

  return (
    <div style={{position: 'absolute', inset: 0, background: table, overflow: 'hidden'}}>
      {/* the worktable's grain, long and fine (seen only beside and below the sheet, where the camera holds still) */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <defs>
          <Fibres id="wood" color={ink} gain={0.5} freq="0.0025 0.06" />
        </defs>
        <rect width={1080} height={1920} fill={table} filter="url(#wood)" />
      </svg>
      {/* the cream rag paper the silhouette is mounted on */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="lightbox" cx="40%" cy="32%" r="80%">
            <stop offset="0%" stopColor={bg} />
            <stop offset="100%" stopColor={mix(th.surface, 70, bg)} />
          </radialGradient>
        </defs>
        <g transform={view}>
          {!cutOn ? (
            <rect x={0} y={0} width={1080} height={PAPER_H} fill="url(#lightbox)" />
          ) : (
            [-1, 1].map((s) => (
              <g key={s} transform={sideT(s)}>
                <rect x={s < 0 ? 0 : 540} y={0} width={540} height={PAPER_H} fill={bg} />
              </g>
            ))
          )}
        </g>
      </svg>
      {/* the cut silhouette, lifted off the paper */}
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, filter: shadow}}>
        <defs>
          <clipPath id="left-of-fold">
            <rect x={-10} y={-10} width={550} height={1940} />
          </clipPath>
          <clipPath id="right-of-fold">
            <rect x={540} y={-10} width={550} height={1940} />
          </clipPath>
        </defs>
        <g transform={view}>
          {!cutOn ? (
            <>
              {half}
              <g transform={MIRROR}>{half}</g>
              {center}
            </>
          ) : (
            [-1, 1].map((s) => (
              <g key={s} transform={sideT(s)}>
                {s < 0 ? half : <g transform={MIRROR}>{half}</g>}
                <g clipPath={`url(#${s < 0 ? 'left' : 'right'}-of-fold)`}>{center}</g>
                {s > 0 ? <Years ys={years} shown={Math.max(0, n - 1)} ink={ink} bg={bg} /> : null}
                {fringe > 0.8
                  ? Array.from({length: Math.ceil(PAPER_H / 16) - 2}, (_, i) =>
                      s < 0 ? (
                        <path key={i} d={`M540 ${30 + i * 16} l${fringe * 0.62} 0 q${fringe * 0.38} 0 ${fringe * 0.38} 6 q0 5 -5 3`} fill="none" stroke={red} strokeWidth={2.8} strokeLinecap="round" />
                      ) : (
                        <ellipse key={i} cx={540 - fringe * 0.45} cy={36 + i * 16} rx={fringe * 0.45} ry={6} fill="none" stroke={bg} strokeWidth={2.2} />
                      ),
                    )
                  : null}
              </g>
            ))
          )}
          {cutOn && d < 0.5 && cutTo > 24 ? <path d={`M540 22 L540 ${cutTo}`} stroke={table} strokeWidth={2.2 / z} /> : null}
          {t >= cutAt ? <Closer t={t} t0={cutAt} cta={cta} ink={ink} bg={bg} /> : null}
        </g>
      </svg>
      {/* the scissors ride higher above the paper: a longer, softer shadow, which shortens as they come to rest on the margin */}
      {t >= T.cut0 - 0.5 ? (
        <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, filter: `drop-shadow(${so * lerp(2.4, 0.8, tilt / 78)}px ${so * lerp(3.2, 1.1, tilt / 78)}px ${so * lerp(2.2, 0.9, tilt / 78)}px ${mix(th.shadow, 45)})`}}>
          <g transform={view}>
            <g transform={`translate(${sx} ${sy})`}>
              <Scissors open={open} ink={ink} bg={bg} steel={mix(th.muted, 55, bg)} tilt={tilt} />
            </g>
          </g>
        </svg>
      ) : null}
      {microOn ? <Micro t={t} T={T} ink={ink} bg={bg} red={red} muted={th.muted} surface={th.surface} pal={pal} open={field} /> : null}
      {/* light falls off away from the lamp at upper left */}
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(ellipse 85% 70% at 38% 30%, transparent 50%, ${mix(th.shadow, 26)} 100%)`}} />
      <Grain opacity={0.08} />
      {cap ? (
        <div style={{position: 'absolute', left: cap.x, top: cap.y, transform: `translate(-50%, -50%) rotate(${cap.tilt}deg)`, filter: `drop-shadow(2px 3px 2.5px ${mix(th.shadow, 50)})`}}>
          <CutStrip text={cap.text} e={cap.e} ink={ink} bg={bg} shade={mix(th.shadow, 70, bg)} />
        </div>
      ) : null}
      <Score
        src="music/c2-2026-w41-1.wav"
        shape={[[0, -4], [1.3, 0], [7, 0], [13, -4], [13.6, 1], [18, 1], [24.6, 2], [T.cut1, 3], [T.close, 4], [30.5, 4]]}
        hush={[[T.dive - 0.06, T.dive + 0.25], [T.cut1 - 0.18, T.stick - 0.02]]}
      />
      <Foley cues={cues} />
    </div>
  );
};
