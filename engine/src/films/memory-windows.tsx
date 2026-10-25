// Format E, Memory Windows, as a reusable film: renders any board whose "film" is "memory-windows" from its direction (a dream
// plate per line with real-photo windows on their words, src/fx/direction.ts). Proven by fx/demos/MemC2.tsx.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {cameraMotion, type WindowsShot, wordTime} from '../fx/direction';
import {Plate} from '../fx/ambient';
import {Burst, Flash} from '../fx/energy';
import {DreamLine, Sparkles, Window} from '../fx/windows';
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
  const cam = cameraMotion(d.style.camera);
  const cut = (i: number) => (i ? lines[i].start : -0.3);
  const end = (i: number) => (i < shots.length - 1 ? lines[i + 1].start : total + 1); // the last shot runs through a voiced closer
  return (
    <AbsoluteFill style={{background: th.bg}}>
      {/* the camera falls into the world in the first 1.5 s */}
      <AbsoluteFill style={{scale: String(k(t, [0, 1.5], [1.9, 1], OUT)), rotate: `${k(t, [0, 1.5], [-4, 0], OUT)}deg`}}>
        {shots.map((s, i) => <Plate key={i} t={t} a={cut(i)} b={end(i)} src={s.plate} push={(s.push ?? 0.3) * cam.push} drift={cam.drift} origin={s.origin} />)}
      </AbsoluteFill>
      <Sparkles t={t} />
      {shots.flatMap((s, i) =>
        (s.windows ?? []).map((w, j) => {
          const at = wordTime(lines[i], w.at);
          return <Window key={`${i}-${j}`} t={t} at={at} until={i === shots.length - 1 ? total : end(i) - 0.55} /* gone before the next world arrives: no ghosting */ src={w.photo} x={w.x} y={w.y} w={w.w} h={w.h} from={w.from} tilt={w.tilt} pos={w.pos} />;
        }),
      )}
      {shots.map((s, i) => {
        if (!s.sparks) return null;
        const at = wordTime(lines[i], s.sparks);
        const w = s.windows?.[0] ?? {x: 540, y: 760};
        cues.push([at, 'pop', 0.35]);
        return <Burst key={i} t={t} at={at} x={w.x} y={w.y} n={36} power={620} seed={7 + i} colors={[th.accent, th.ink]} />;
      })}
      {lines.map((b, i) => <DreamLine key={i} t={t} at={b.vo![0]} end={(lines[i + 1]?.start ?? closer?.start ?? total) - 0.1} text={b.text} dur={b.vo![1] - b.vo![0]} />)}
      {closer && cta.text ? <DreamLine t={t} at={closer.start} end={total} text={cta.text} dur={0.6} /> : null}
      {/* a white flash where the world changes */}
      {shots.map((s, i) => (i && s.plate !== shots[i - 1].plate ? (<Flash key={i} t={t} at={cut(i) - 0.15} color={th.ink} />) : null))}
      {d.music ? <Score src={`music/${script.id}.wav`} /> : null}
      <Foley cues={cues} />
    </AbsoluteFill>
  );
};
