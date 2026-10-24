// orbit: the camera circles a 3D object on a plinth, rising a little as it goes, eased in and out. F1 ships one prop
// ("specimen": a spiked burr under a glass bell); the prop library (F5) adds the rest.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {INOUT, k} from '../films/kit';
import {useTheme} from '../themes';
import {Stage3D} from './camera';
import type {FxProps} from './registry';

type P = {prop?: 'specimen'; turns?: number};

const Specimen: React.FC = () => {
  const th = useTheme();
  // a burr: a core with spines on a Fibonacci sphere, each spine ending in a hook bent outward
  const spines = useMemo(() => {
    const n = 90;
    return Array.from({length: n}, (_, i) => {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const a = i * Math.PI * (3 - Math.sqrt(5));
      const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      return {pos: dir.clone().multiplyScalar(0.62), q};
    });
  }, []);
  return (
    <group position={[0, 0.2, 0]}>
      <mesh>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshToonMaterial color={th.warn} />
      </mesh>
      {spines.map((s, i) => (
        <group key={i} position={s.pos} quaternion={s.q}>
          <mesh position={[0, 0.2, 0]}>
            <coneGeometry args={[0.035, 0.42, 6]} />
            <meshToonMaterial color={th.warn} />
          </mesh>
          <mesh position={[0.03, 0.42, 0]} rotation={[0, 0, -1.2]}>
            <torusGeometry args={[0.04, 0.012, 6, 10, Math.PI]} />
            <meshToonMaterial color={th.ink} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[1.35, 48, 48, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={th.surface} transparent opacity={0.18} roughness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.95, 0]}>
        <cylinderGeometry args={[1.5, 1.6, 0.35, 64]} />
        <meshToonMaterial color={th.ink} />
      </mesh>
    </group>
  );
};

export const Orbit: React.FC<FxProps<P>> = ({t, dur, p}) => {
  const th = useTheme();
  const a = k(t, [0, dur], [-0.6, -0.6 + Math.PI * 2 * (p.turns ?? 0.5)], INOUT);
  const h = k(t, [0, dur], [0.4, 1.4], INOUT);
  const r = 9.5; // the whole bell and plinth fit the 9:16 width
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: th.bg}} />
      <Stage3D pos={[Math.sin(a) * r, h, Math.cos(a) * r]} look={[0, -0.3, 0]} fov={38}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        <Specimen />
      </Stage3D>
    </>
  );
};
