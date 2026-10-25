// Format F, Doodle on Footage, as a reusable film: renders any board whose "film" is "doodle-footage" from its direction (real
// footage with a jump cut per line, the doodle's face per line, cut-out stickers and doodled icons on their words,
// src/fx/direction.ts). Proven by fx/demos/DoodleC1.tsx.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {type DoodleShot, FEEL_FACE, wordTime} from '../fx/direction';
import {Doodle, Envelope, FilmPlate, Hand, Scribble} from '../fx/doodle';
import {useTheme} from '../themes';
import {BACK, type Cue, Foley, Grain, k, Score, useFilm} from './kit';

const IX = (n: number) => Array.from({length: n}, (_, i) => 540 + (i - (n - 1) / 2) * Math.min(175, 880 / Math.max(1, n - 1)));

export const Film: React.FC = () => {
  const {t, beats, script, total, cta} = useFilm();
  const th = useTheme();
  const d = script.direction!;
  const lines = beats.filter((b) => b.vo);
  const shots = d.shots as DoodleShot[];
  const closer = beats.at(-1)!.vo ? null : beats.at(-1)!;
  const cues: Cue[] = [];
  const i = Math.min(shots.length - 1, Math.max(0, lines.filter((b) => t >= b.start).length - 1)); // a voiced closer keeps the last face
  const talk = lines.some((b) => t >= b.vo![0] && t <= b.vo![1]);
  const feels = script.scenes.filter((s) => s.vo).map((s) => s.voice?.feel);
  const face = (j: number) => shots[j].face ?? FEEL_FACE[feels[j] ?? ''] ?? 'calm';
  // the icon row: born in one shot, ticked one by one from a later word, flown away on another
  const born = shots.findIndex((s) => s.icons);
  const icons = born >= 0 ? shots[born].icons! : null;
  const tickShot = shots.findIndex((s) => s.tick), flyShot = shots.findIndex((s) => s.fly);
  const tick = tickShot >= 0 ? wordTime(lines[tickShot], shots[tickShot].tick!) : undefined;
  const fly = flyShot >= 0 ? wordTime(lines[flyShot], shots[flyShot].fly!) : undefined;
  if (icons) IX(icons.count).forEach((_, j) => cues.push([wordTime(lines[born], icons.at) + j * 0.18, 'pop', 0.2]));
  if (tick !== undefined && icons) IX(icons.count).forEach((_, j) => cues.push([tick + j * 0.3, 'pen', 0.25]));
  if (fly !== undefined) cues.push([fly, 'swish', 0.3]);
  // the doodle pops on a scribble or on a face change
  const pops = shots.map((s, j) => (s.scribble ? wordTime(lines[j], s.scribble.at) : j && face(j) !== face(j - 1) ? lines[j].start : -9));
  return (
    <AbsoluteFill style={{background: th.bg}}>
      <FilmPlate t={t} src={d.footage!} rate={1.2} cuts={shots.map((s, j) => ({at: j ? lines[j].start - 0.15 : 0, from: s.from ?? j * 5}))} />
      {icons ? IX(icons.count).map((x, j) => <Envelope key={j} t={t} x={x} y={330 + (j % 2) * 40} at={wordTime(lines[born], icons.at) + j * 0.18} tick={tick === undefined ? undefined : tick + j * 0.3} fly={fly === undefined ? undefined : fly + j * 0.15} seed={j * 40} />) : null}
      {shots.flatMap((s, j) =>
        (s.stickers ?? []).map((x, n) => {
          const at = wordTime(lines[j], x.at);
          const until = lines[j + 1]?.start ?? total;
          if (t < at || t > until) return null;
          cues.push([at, 'pop', 0.25]);
          return <Img key={`${j}-${n}`} src={staticFile(x.src)} style={{position: 'absolute', left: x.x - x.w / 2, top: x.y - x.w / 2, width: x.w, filter: `drop-shadow(0 0 0 ${th.ink}) drop-shadow(6px 6px 0 ${th.bg})`, scale: String(k(t, [at, at + 0.3], [0, 1], BACK)), rotate: `${Math.sin(t * 2 + n) * 3}deg`}} />;
        }),
      )}
      {shots.map((s, j) => (s.scribble ? (cues.push([wordTime(lines[j], s.scribble.at), 'pen', 0.35]), <Scribble key={j} t={t} at={wordTime(lines[j], s.scribble.at)} until={(lines[j + 1]?.start ?? total) - 0.1} text={s.scribble.text} x={540} y={620} />) : null))}
      <Doodle t={t} x={470} y={1010} face={face(i)} talk={talk} pop={Math.max(...pops.filter((p) => p <= t), -9)} />
      {lines.map((b, j) => <Hand key={j} t={t} at={b.vo![0]} end={(lines[j + 1]?.start ?? closer?.start ?? total) - 0.1} text={b.text} dur={b.vo![1] - b.vo![0]} />)}
      {closer && cta.text ? <Hand t={t} at={closer.start} end={total} text={cta.text} dur={0.6} /> : null}
      <Grain opacity={0.14} blend="overlay" />
      {d.music ? <Score src={`music/${script.id}.wav`} /> : null}
      <Foley cues={cues} />
    </AbsoluteFill>
  );
};
