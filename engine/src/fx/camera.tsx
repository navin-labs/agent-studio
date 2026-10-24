// Cameras for effects. Camera2D moves one world-space wrapper over the 1080x1920 frame (film kit's cam(): eased, geometric zoom).
// Stage3D is a real three.js scene (@remotion/three) whose camera is set every frame from the effect's time, so renders are
// deterministic: no clocks, no useFrame.
import {useThree} from '@react-three/fiber';
import {ThreeCanvas} from '@remotion/three';
import React, {useLayoutEffect} from 'react';
import {AbsoluteFill} from 'remotion';
import {cam, type Key} from '../films/kit';
import type {Cam} from './scene';

const PUSH: Cam = {from: [540, 960, 1], to: [540, 960, 1.06]};

export const Camera2D: React.FC<{t: number; dur: number; camera?: Cam; children: React.ReactNode}> = ({t, dur, camera = PUSH, children}) => {
  const keys: Key[] = [
    [0, ...camera.from],
    [dur, ...camera.to],
  ];
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: 1080, height: 1920, transform: cam(t, keys), transformOrigin: '0 0'}}>{children}</div>
    </AbsoluteFill>
  );
};

type V3 = [number, number, number];
const Lens: React.FC<{pos: V3; look: V3; fov: number}> = ({pos, look, fov}) => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(...pos);
    camera.lookAt(...look);
    if ('fov' in camera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }, [camera, pos, look, fov]);
  return null;
};

// A 3D stage the size of the frame. The effect computes the camera for its own time and passes it in.
export const Stage3D: React.FC<{pos: V3; look?: V3; fov?: number; children: React.ReactNode}> = ({pos, look = [0, 0, 0], fov = 35, children}) => (
  <ThreeCanvas width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
    <Lens pos={pos} look={look} fov={fov} />
    {children}
  </ThreeCanvas>
);
