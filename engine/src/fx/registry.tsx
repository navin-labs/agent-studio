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
import {Card} from './blocks';
import {BarFill, BlurIn, Checklist, CountUp, Pop, PunchIn, Reframe, Rise, SlideIn, Typewriter} from './moves';

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

// The ten named moves (moves.tsx), each callable by name with its parameters only; the scene's style block sets their feel.
const center = (c: React.ReactNode) => <div style={{position: 'absolute', left: 108, right: 108, top: 560, display: 'flex', justifyContent: 'center', fontSize: 84}}>{c}</div>;
const card = (text: string) => <Card style={{textAlign: 'center'}}>{text}</Card>;
const mv = (about: string, cues: string, example: Record<string, unknown>, Render: React.FC<FxProps>): Fx => ({layer: 'set-piece', about, cues, seconds: [1, 4], example, Render});
const moves: Record<string, Fx> = {
  'move:rise': mv('A card fades in while rising.', 'a calm statement, a label', {text: 'Invoices sent'}, ({t, p}) => center(<Rise t={t} at={p.at} chime={p.chime}>{card(p.text)}</Rise>)),
  'move:pop': mv('A card pops from 0.6 to full size with a little overshoot.', 'a result, a verdict, a one-word answer', {text: 'Paid'}, ({t, p}) => center(<Pop t={t} at={p.at} chime={p.chime}>{card(p.text)}</Pop>)),
  'move:count-up': mv('A number rolls up to its value, with the counter sound.', 'a spoken amount, count or percentage', {to: 48500, prefix: '₹'}, ({t, p}) => center(<Card><CountUp t={t} at={p.at} to={p.to} from={p.from} prefix={p.prefix} suffix={p.suffix} chime={p.chime} style={{fontSize: 150}} /></Card>)),
  'move:checklist': mv('Lines get a tick one by one, a tick sound each.', 'steps done, things checked', {items: ['Challan matched', 'Order checked', 'Invoice approved']}, ({t, p}) => center(<Card><Checklist t={t} at={p.at} items={p.items} chime={p.chime} style={{fontSize: 60}} /></Card>)),
  'move:typewriter': mv('A sentence types itself letter by letter.', 'a message, a search, a command', {text: 'Reminder sent at 3 AM.'}, ({t, p}) => center(<Card><Typewriter t={t} at={p.at} text={p.text} chime={p.chime} style={{fontSize: 70}} /></Card>)),
  'move:slide-in': mv('A card slides in from the side.', 'the next item, the other side', {text: 'From the right', from: 'right'}, ({t, p}) => center(<SlideIn t={t} at={p.at} from={p.from}>{card(p.text)}</SlideIn>)),
  'move:blur-in': mv('A card comes into focus from a blur.', 'a realisation, a memory, a reveal', {text: 'Into focus'}, ({t, p}) => center(<BlurIn t={t} at={p.at}>{card(p.text)}</BlurIn>)),
  'move:punch-in': mv('The whole frame zooms in 15% fast, then holds.', 'the key word, the moment of surprise', {text: 'Look closer'}, ({t, p}) => <PunchIn t={t} at={p.at} amount={p.amount}>{center(card(p.text))}</PunchIn>),
  'move:reframe': mv('A full-screen panel shrinks into a card below while a new card lands on top.', 'zooming out to the bigger picture', {text: 'The bigger picture'}, ({t, p}) => <Reframe t={t} at={p.at} panel={<div style={{width: '100%', height: '100%'}} />} top={card(p.text)} />),
  'move:bar-fill': mv('A progress bar fills, with the fill sound.', 'progress, completion, a share of a whole', {label: 'Renewals done', to: 100}, ({t, p}) => center(<Card style={{width: 820}}><BarFill t={t} at={p.at} to={p.to} label={p.label} chime={p.chime} style={{fontSize: 52}} /></Card>)),
};

export const FX: Record<string, Fx> = {...own, ...moves, ...prims};
