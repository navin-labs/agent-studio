// Effect registry: every effect a scene shot can name (docs/FILM_PIPELINE_PLAN.md). An effect is a pure function of its local
// time t (seconds, 0 at the shot's start), the shot's length and its props. SceneFilm places it on the voice timeline and wraps
// it in the shot's camera and the film's look. The specs are what the Director reads to choose; `example` drives the gallery.
// Every primitive (src/primitives) is also an effect, as `prim:<id>`, so nothing tested is thrown away.
import type React from 'react';
import {FPS} from '../lib/timing';
import {PRIMITIVES} from '../primitives/index';
import {SPECS} from '../primitives/specs';
import {Orbit} from './orbit';
import {Title} from './title';

export type Layer = 'set-piece' | 'camera' | 'transition' | 'look';
export type FxProps<P = any> = {t: number; dur: number; p: P};
export type Fx = {
  layer: Layer;
  about: string; // what it shows, in one sentence
  cues: string; // which script moments call for it
  seconds: [number, number];
  example: Record<string, unknown>;
  Render: React.FC<FxProps>;
};

const own: Record<string, Fx> = {
  title: {
    layer: 'set-piece',
    about: 'Kinetic headline: words land one by one with weight, the key word marked, set large in the film type.',
    cues: 'a hook line, a claim, a name or a date the viewer must read',
    seconds: [1.5, 6],
    example: {text: 'One burr. *Hundreds* of hooks.'},
    Render: Title,
  },
  orbit: {
    layer: 'camera',
    about: 'Real 3D: the camera circles an object on a plinth, rising slightly, so its shape reads from every side.',
    cues: 'an object the story turns on, an invention, a product, the thing being explained',
    seconds: [2, 8],
    example: {prop: 'specimen', turns: 0.5},
    Render: Orbit,
  },
};

const prims = Object.fromEntries(
  (Object.keys(PRIMITIVES) as (keyof typeof SPECS)[]).map((id): [string, Fx] => {
    const P = PRIMITIVES[id];
    const s = SPECS[id];
    // primitives count in frames from their Sequence start, which SceneFilm provides
    const Render: React.FC<FxProps> = ({dur, p}) => <P p={p} dur={Math.round(dur * FPS)} cues={[]} />;
    return [`prim:${id}`, {layer: 'set-piece', about: s.about, cues: s.family, seconds: s.seconds, example: s.example, Render}];
  }),
);

export const FX: Record<string, Fx> = {...own, ...prims};
