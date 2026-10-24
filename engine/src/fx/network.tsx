// Format C, Network Line (docs/CREATIVE_BIBLE.md section 11; reference: Aixsponza, Video-40262). Abstract subjects, so this
// format is code-native: a violet line out of a black wedge, branches that fan into a network of nodes, a tunnel of rings,
// a planet. Black meets white, one violet light, small calm type. Every piece is a pure function of t (deterministic).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {IN, INOUT, k, OUT, rng} from '../films/kit';
import {useTheme} from '../themes';
import {Stage3D} from './camera';

// ---------- 2D: the line and the black wedge ----------
// The line rises to an apex; a black wedge opens below it (light above), glowing violet where it meets the apex.
// open: 0 closed (just the line) .. 1 wide; grow: 0..1 how far the line has travelled.
export const Wedge: React.FC<{apex: [number, number]; open: number; grow: number; t?: number}> = ({apex: [ax, ay], open, grow, t = 0}) => {
  const th = useTheme();
  const spread = open * 900;
  const top = 1920 - grow * (1920 - ay);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="apex-glow" cx={ax} cy={ay} r={460 + Math.sin(t * 2.2) * 160} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={th.warn} stopOpacity={0.95} />
          <stop offset="0.25" stopColor={th.flow} stopOpacity={0.55} />
          <stop offset="1" stopColor={th.ink} stopOpacity={0} />
        </radialGradient>
        <filter id="line-glow" x="-50%" y="-5%" width="200%" height="110%">
          <feGaussianBlur stdDeviation={6} />
        </filter>
      </defs>
      {open > 0.001 && (
        <>
          <polygon points={`${ax},${ay} ${ax - spread},1920 ${ax + spread},1920`} fill={th.ink} />
          <polygon points={`${ax},${ay} ${ax - spread},1920 ${ax + spread},1920`} fill="url(#apex-glow)" />
        </>
      )}
      <line x1={ax} y1={1920} x2={ax} y2={top} stroke={th.flow} strokeWidth={9} filter="url(#line-glow)" opacity={0.8} />
      <line x1={ax} y1={1920} x2={ax} y2={top} stroke={th.warn} strokeWidth={2.5} />
      {grow > 0.98 && <circle cx={ax} cy={ay} r={10 + open * 6 + Math.sin(t * 3.1) * 4} fill={th.surface} filter="url(#line-glow)" />}
    </svg>
  );
};

// A short phrase in small, calm type that fades in out of a soft blur.
export const Phrase: React.FC<{t: number; at: number; out?: number; text: string; x?: number; y: number; align?: 'left' | 'center' | 'right'; dark?: boolean}> = ({t, at, out = 1e9, text, x = 540, y, align = 'center', dark}) => {
  const th = useTheme();
  const o = Math.min(k(t, [at, at + 0.5], [0, 1], OUT), k(t, [out, out + 0.35], [1, 0], IN));
  if (o <= 0) return null;
  const left = align === 'left' ? x : align === 'right' ? x - 900 : x - 450;
  return (
    <div style={{position: 'absolute', left, width: 900, top: y, textAlign: align, fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 50, letterSpacing: '-0.01em', lineHeight: 1.2, color: dark ? th.surface : th.ink, opacity: o, filter: o < 0.98 ? `blur(${(1 - o) * 8}px)` : undefined}}>
      {text}
    </div>
  );
};

// ---------- 3D pieces ----------
// A thin tube along points (three.js lines are always 1 px, which vanishes on a phone). Grow it with drawRange on its index.
const lineOf = (pts: THREE.Vector3[], color: string, opacity = 1, radius = 0.012, closed = false) => {
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), Math.max(8, pts.length), radius, 6, closed);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({color, transparent: opacity < 1, opacity}));
};
const grow = (m: THREE.Mesh, g: number) => m.geometry.setDrawRange(0, Math.floor((m.geometry.index?.count ?? 0) * g / 6) * 6);
const Node: React.FC<{p: THREE.Vector3; r: number; color: string; s: number}> = ({p, r, color, s}) =>
  s <= 0.001 ? null : (
    <mesh position={p} scale={s * r}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshStandardMaterial color={color} roughness={0.32} metalness={0.05} />
    </mesh>
  );

// Branches: strands that fan up out of one point into a lattice; nodes pop on as the strands reach them. p: 0..1 growth.
export const Branches: React.FC<{p: number; origin: [number, number, number]; n?: number; seed?: number}> = ({p, origin, n = 18, seed = 4}) => {
  const th = useTheme();
  const strands = useMemo(() => {
    const r = rng(seed);
    const o = new THREE.Vector3(...origin);
    return Array.from({length: n}, (_, i) => {
      const sx = ((i / (n - 1)) * 2 - 1) * 2.6, sz = (r() - 0.5) * 2.4, wave = (i % 2 ? 1 : -1) * 0.5;
      const curve = new THREE.CatmullRomCurve3([o.clone(), o.clone().add(new THREE.Vector3(0, 0.5, 0)), o.clone().add(new THREE.Vector3(sx * 0.35 + wave, 1.6, sz * 0.4)), o.clone().add(new THREE.Vector3(sx * 0.8 - wave, 3.0, sz)), o.clone().add(new THREE.Vector3(sx * 1.25, 4.6, sz * 1.3))]);
      const pts = curve.getPoints(60);
      const nodes = [0.3, 0.5, 0.7, 0.9].filter(() => r() < 0.8).map((u) => ({u, p: curve.getPointAt(u), r: 0.035 + r() * 0.055, c: r()}));
      return {line: lineOf(pts, th.flow, 0.6, 0.007), nodes};
    });
  }, [n, seed, origin, th.flow]);
  const tone = (c: number) => (c < 0.5 ? th.surface : c < 0.8 ? th.ink : th.flow);
  return (
    <group>
      {strands.map((s, i) => {
        const g = Math.max(0, Math.min(1, p * 1.25 - (i % 5) * 0.04));
        grow(s.line, g);
        return (
          <group key={i}>
            <primitive object={s.line} />
            {s.nodes.map((nd, j) => <Node key={j} p={nd.p} r={nd.r} color={tone(nd.c)} s={k(g, [nd.u, nd.u + 0.08], [0, 1], OUT)} />)}
          </group>
        );
      })}
    </group>
  );
};

// Tunnel: rings of light running away from the camera, joined by spiral strands, nodes riding on them, turning slowly.
export const Tunnel: React.FC<{t: number; rings?: number; seed?: number}> = ({t, rings = 26, seed = 9}) => {
  const th = useTheme();
  const {loops, spirals, nodes} = useMemo(() => {
    const r = rng(seed);
    const loops = Array.from({length: rings}, (_, i) => {
      const R = 2.3 + Math.sin(i * 0.7) * 0.25;
      return lineOf(Array.from({length: 48}, (_, j) => new THREE.Vector3(Math.cos((j / 48) * Math.PI * 2) * R, Math.sin((j / 48) * Math.PI * 2) * R, -i * 1.5)), th.flow, 0.6, 0.009, true);
    });
    const spirals = Array.from({length: 6}, (_, s) => lineOf(Array.from({length: 160}, (_, j) => {
      const z = -(j / 159) * rings * 1.5, a = (s / 6) * Math.PI * 2 + z * 0.18;
      return new THREE.Vector3(Math.cos(a) * 2.35, Math.sin(a) * 2.35, z);
    }), th.flow, 0.5, 0.009));
    const nodes = Array.from({length: rings * 4}, () => {
      const i = Math.floor(r() * rings), a = r() * Math.PI * 2, R = 2.3;
      return {p: new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, -i * 1.5), r: 0.06 + r() * 0.1, c: r()};
    });
    return {loops, spirals, nodes};
  }, [rings, seed, th.flow]);
  const tone = (c: number) => (c < 0.5 ? th.surface : c < 0.8 ? th.ink : th.flow);
  return (
    <group rotation={[0, 0, t * 0.22]}>
      {loops.map((l, i) => <primitive key={`l${i}`} object={l} />)}
      {spirals.map((l, i) => <primitive key={`s${i}`} object={l} />)}
      {nodes.map((n, i) => <Node key={i} p={n.p} r={n.r} color={tone(n.c)} s={1} />)}
    </group>
  );
};

// Planet: a huge soft sphere lit from the upper left with a violet rim from behind, a small moon, a line flying past.
export const Planet: React.FC<{t: number; at: number}> = ({t, at}) => {
  const th = useTheme();
  const arrive = k(t, [at, at + 1.6], [1, 0], INOUT);
  const fly = useMemo(() => lineOf([new THREE.Vector3(-9, -6, 1), new THREE.Vector3(-3, -3.2, 1), new THREE.Vector3(3, -0.5, 1)], th.flow, 0.9, 0.02), [th.flow]);
  grow(fly, k(t, [at + 0.4, at + 1.8], [0, 1], OUT));
  return (
    <group position={[arrive * 9, 0, 0]}>
      <mesh position={[4.2, -0.6, -2]}>
        <sphereGeometry args={[4.6, 96, 64]} />
        <meshStandardMaterial color={th.surface} roughness={0.95} />
      </mesh>
      <mesh position={[2.2, 2.0, 1.5]}>
        <sphereGeometry args={[0.32, 48, 32]} />
        <meshStandardMaterial color={th.muted} roughness={0.5} />
      </mesh>
      <primitive object={fly} />
    </group>
  );
};

// The 3D stage of this format: the light side as background, soft key light, a violet rim from behind.
export const NetStage: React.FC<{pos: [number, number, number]; look?: [number, number, number]; fov?: number; children: React.ReactNode}> = ({pos, look = [0, 0, 0], fov = 40, children}) => {
  const th = useTheme();
  return (
    <Stage3D pos={pos} look={look} fov={fov}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[-6, 8, 6]} intensity={2.2} />
      <pointLight position={[6, -2, -6]} intensity={60} color={th.flow} />
      {children}
    </Stage3D>
  );
};
