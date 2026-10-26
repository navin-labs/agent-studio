// Format E, Memory Windows, as a reusable film: renders any board whose "film" is "memory-windows" from its direction (a dream
// plate per line with real-photo windows on their words, src/fx/direction.ts). Proven by fx/demos/MemC2.tsx.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {cameraMotion, type WindowsShot, wordTime} from '../fx/direction';
import {faceFor, hash, planCuts, PunchLine, ReframePlate} from '../fx/retention';
import {Burst, Flash} from '../fx/energy';
import {Sparkles, Window} from '../fx/windows';
import {useTheme} from '../themes';
import {type Cue, Foley, k, OUT, Score, useFilm} from './kit';

export const Film: React.FC = () => {
  const {t, beats, script, total, cta} = useFilm();
  const th = useTheme();
  const d = script.direction!;
  const lines = beats.filter((b) => b.vo);
  const shots = d.shots as WindowsShot[];
  const closer = beats.at(-1)!.vo ? null : beats.at(-1)!;
  const cues: Cue[] = [];
  const cut = (i: number) => (i ? lines[i].start : -0.3);
  const end = (i: number) => (i < shots.length - 1 ? lines[i + 1].start : total + 1); // the last shot runs through a voiced closer
  const sceneOf = beats.flatMap((b, i) => (b.vo ? [i] : [])); // each voiced line's scene, for its marked words
  const seed = hash(script.id);
  const face = faceFor(script.id);
  const cutsOf = shots.map((_, i) => planCuts(cut(i), end(i), lines[i].words?.map((w) => w.s) ?? [], seed + i));
  cutsOf.forEach((cs) => cs.slice(1).forEach((c) => cues.push([c.t, 'swish', 0.3])));
  return (
    <AbsoluteFill style={{background: th.bg}}>
      {/* the camera falls into the world in the first 1.5 s */}
      <AbsoluteFill style={{scale: String(k(t, [0, 1.5], [1.9, 1], OUT)), rotate: `${k(t, [0, 1.5], [-4, 0], OUT)}deg`}}>
        {shots.map((s, i) => <ReframePlate key={i} t={t} a={cut(i)} b={end(i)} src={s.plate} cuts={cutsOf[i]} seed={seed + i} />)}
      </AbsoluteFill>
      <Sparkles t={t} />
      {shots.flatMap((s, i) =>
        (s.windows ?? []).map((w, j) => {
          const at = wordTime(lines[i], w.at);
          return <Window key={`${i}-${j}`} t={t} at={at} until={Math.max(at + 0.6, i === shots.length - 1 ? total : end(i) - 0.55)} /* gone before the next world arrives: no ghosting */ src={w.photo} x={w.x} y={w.y} w={w.w} h={w.h} from={w.from} tilt={w.tilt} pos={w.pos} />;
        }),
      )}
      {shots.map((s, i) => {
        if (!s.sparks) return null;
        const at = wordTime(lines[i], s.sparks);
        const w = s.windows?.[0] ?? {x: 540, y: 760};
        cues.push([at, 'pop', 0.35]);
        return <Burst key={i} t={t} at={at} x={w.x} y={w.y} n={36} power={620} seed={7 + i} colors={[th.accent, th.ink]} />;
      })}
      {lines.map((b, i) => <PunchLine key={i} t={t} at={b.vo![0]} end={(lines[i + 1]?.start ?? closer?.start ?? total) - 0.1} vo={script.scenes[sceneOf[i]].vo ?? b.text} starts={b.words?.map((w) => w.s)} dur={b.vo![1] - b.vo![0]} face={face} />)}
      {closer && cta.text ? <PunchLine t={t} at={closer.start} end={total} vo={cta.text} dur={0.6} face={face} /> : null}
      {/* a white flash where the world changes */}
      {shots.map((s, i) => (i && s.plate !== shots[i - 1].plate ? (<Flash key={i} t={t} at={cut(i) - 0.15} color={th.ink} />) : null))}
      {d.music ? <Score src={`music/${script.id}.wav`} /> : null}
      <Foley cues={cues} />
    </AbsoluteFill>
  );
};
