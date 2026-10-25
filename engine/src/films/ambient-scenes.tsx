// Format G, Ambient Scenes, as a reusable film: renders any board whose "film" is "ambient-scenes" from its direction (one lit
// plate per voice line, src/fx/direction.ts). Proven by fx/demos/AmbC1.tsx.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {type AmbientShot, cameraMotion, wordTime} from '../fx/direction';
import {Fog, Lamp, Plate, Rain, ScreenGlow, Sunrise, Whisper} from '../fx/ambient';
import {useTheme} from '../themes';
import {type Cue, Foley, Score, useFilm} from './kit';

export const Film: React.FC = () => {
  const {t, beats, script, total, cta} = useFilm();
  const th = useTheme();
  const d = script.direction!;
  const lines = beats.filter((b) => b.vo);
  const shots = d.shots as AmbientShot[];
  const cues: Cue[] = [];
  const cam = cameraMotion(d.style.camera);
  const closer = beats.at(-1)!.vo ? null : beats.at(-1)!;
  return (
    <AbsoluteFill style={{background: th.bg}}>
      {shots.map((s, i) => {
        const b = lines[i];
        const a = i ? b.start : -0.3, end = i < shots.length - 1 ? lines[i + 1].start : total + 1; // the last shot runs through a voiced closer
        s.lamps?.forEach((l) => l.on && cues.push([wordTime(b, l.on), 'switch', 0.3]));
        s.screens?.forEach((x) => x.pings?.forEach((p) => cues.push([wordTime(b, p), 'pop', 0.22])));
        return (
          <Plate key={i} t={t} a={a} b={end} src={s.plate} push={(s.push ?? 0.08) * cam.push} drift={cam.drift} origin={s.origin}>
            {s.lamps?.map((l, j) => <Lamp key={j} t={t} on={l.on ? wordTime(b, l.on) : a + 0.25} x={l.x} y={l.y} r={l.r} cone={l.cone} />)}
            {s.screens?.map((x, j) => <ScreenGlow key={j} t={t} x={x.x} y={x.y} w={x.w} h={x.h} pings={x.pings?.map((p) => wordTime(b, p))} />)}
            {s.rain ? <Rain t={t} amount={s.rain} /> : null}
            {s.fog ? <Fog t={t} amount={s.fog} /> : null}
            {s.sunrise ? <Sunrise t={t} from={a} to={a + 3.5} /> : null}
          </Plate>
        );
      })}
      {lines.map((b, i) => <Whisper key={i} t={t} at={b.vo![0]} end={(lines[i + 1]?.start ?? closer?.start ?? total) - 0.1} text={b.text} dur={b.vo![1] - b.vo![0]} />)}
      {closer && cta.text ? <Whisper t={t} at={closer.start} end={total} text={cta.text} dur={0.6} /> : null}
      {d.music ? <Score src={`music/${script.id}.wav`} /> : null}
      <Foley cues={cues} />
    </AbsoluteFill>
  );
};
