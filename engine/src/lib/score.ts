// Music level in dB at time s (seconds): the bed's shape, ducked while a voice line speaks, silenced in hush spans.
// Pure (remotion's interpolate only) so a Node test can check the ducking. Used by Score (films/kit.tsx).
import {Easing, interpolate} from 'remotion';

const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const k = (t: number, [a, b]: [number, number], [x, y]: [number, number]) => interpolate(t, [a, b], [x, y], {easing: OUT, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export type ScoreOpts = {shape?: [number, number][]; hush?: [number, number][]; duck?: number; base?: number; talk: [number, number][]};
export const scoreDb = (s: number, {shape = [[0, 0]], hush = [], duck = 10, base = -17, talk}: ScoreOpts) => {
  const i = shape.findIndex((p) => p[0] > s);
  const lvl = i < 0 ? shape.at(-1)![1] : i === 0 ? shape[0][1] : interpolate(s, [shape[i - 1][0], shape[i][0]], [shape[i - 1][1], shape[i][1]]);
  const talking = Math.max(0, ...talk.map(([a, b]) => Math.min(k(s, [a - 0.25, a], [0, 1]), k(s, [b, b + 0.4], [1, 0]))));
  const hushed = Math.max(0, ...hush.map(([a, b]) => Math.min(k(s, [a - 0.12, a], [0, 1]), k(s, [b, b + 0.3], [1, 0]))));
  return base + lvl - talking * duck - hushed * 60;
};
