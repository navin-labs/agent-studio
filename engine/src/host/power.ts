// Power words: a *marked* word pops to 1.2x on a spring when it is spoken and eases back once the next word starts.
// Pure (remotion's spring and interpolate only), so a Node test can check it. Self-test: node studio/power.test.ts
import {interpolate, spring} from 'remotion';

export const POWER_SCALE = 1.2;
export const powerScale = (f: number, start: number, next: number | undefined, fps: number) => {
  if (f < start) return 1;
  const pop = spring({frame: f - start, fps, config: {damping: 12, stiffness: 220, mass: 0.7}});
  const back = next === undefined ? 0 : interpolate(f - next, [0, 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return 1 + (POWER_SCALE - 1) * pop * (1 - back);
};
