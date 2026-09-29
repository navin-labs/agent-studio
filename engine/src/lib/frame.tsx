import React, {createContext, useContext} from 'react';
import {Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// Carousel slides reuse the reel UI components frozen at their final state.
// A StaticFrame value overrides the current frame for everything below it.
export const StaticFrame = createContext<number | null>(null);
export const useF = () => {
  const override = useContext(StaticFrame);
  const frame = useCurrentFrame();
  return override ?? frame;
};
export const useIsStatic = () => useContext(StaticFrame) !== null;

export const SfxEnabled = createContext(true);

// Springy 0 -> 1 progress starting at `start` frames.
export const useSpring = (start: number, config?: {damping?: number; stiffness?: number; mass?: number}) => {
  const frame = useF();
  const {fps} = useVideoConfig();
  if (frame < start) return 0;
  return spring({frame: frame - start, fps, config: {damping: 15, stiffness: 170, mass: 0.7, ...config}});
};

export const springAt = (frame: number, start: number, fps: number, config?: {damping?: number; stiffness?: number; mass?: number}) => {
  if (frame < start) return 0;
  return spring({frame: frame - start, fps, config: {damping: 15, stiffness: 170, mass: 0.7, ...config}});
};

type SfxName = 'pop' | 'whoosh' | 'ding' | 'tick';
const SFX_VOLUME: Record<SfxName, number> = {pop: 0.34, whoosh: 0.26, ding: 0.4, tick: 0.28};

// Plays a short sound effect at a frame. No-op in stills or when disabled.
export const Sfx: React.FC<{at: number; name: SfxName; volume?: number}> = ({at, name, volume}) => {
  const enabled = useContext(SfxEnabled);
  const isStatic = useIsStatic();
  if (!enabled || isStatic) return null;
  return (
    <Sequence from={Math.max(0, Math.round(at))} durationInFrames={20} layout="none">
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume ?? SFX_VOLUME[name]} />
    </Sequence>
  );
};
