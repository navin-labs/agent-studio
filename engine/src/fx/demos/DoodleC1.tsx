// S3 proof, format F Doodle on Footage (lofi-film-doodle look, film suit), measured against Video-90405. Footage: "ICE 9574 on
// LGV Est window view" (Wikimedia Commons, CC0). The script passes studio/script.ts (number hook, sourced proof, contrast, loop).
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Foley, Grain} from '../../films/kit';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx, THEMES} from '../../themes';
import {Doodle, Envelope, type Face, FilmPlate, Hand, Scribble} from '../doodle';

const DUR = [3.26, 5.2, 4.76, 4.86];
const AT = DUR.map((_, i) => 0.3 + DUR.slice(0, i).reduce((a, b) => a + b + 0.35, 0));
const END = AT.map((a, i) => (AT[i + 1] ?? a + DUR[i] + 1.2) - 0.1);
const TEXT = ['You answer the same 5 emails every single morning.', 'Office workers spend about 28 percent of their week on email, McKinsey found.', 'But now, one saved template and one rule answers those 5 automatically.', 'So the morning train ride is yours again, and the 5 emails still get answered.'];
export const DOODLE_FRAMES = Math.ceil((AT[3] + DUR[3] + 1.2) * FPS);
const EX = [190, 365, 540, 715, 890];

export const DoodleC1: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  const total = DOODLE_FRAMES / FPS;
  const shock = AT[1] + 2.0, tick = AT[2] + 2.4, fly = AT[3] + 0.6;
  const face: Face = t < shock ? 'tired' : t < AT[2] ? 'shock' : t < tick ? 'calm' : 'happy';
  const talk = AT.some((a, i) => t >= a && t <= a + DUR[i]);
  return (
    <ThemeCtx.Provider value={THEMES.film}>
      <AbsoluteFill style={{background: THEMES.film.bg}}>
        <FilmPlate t={t} src="doodle-test/train.mp4" rate={1.2} cuts={[{at: 0, from: 0}, {at: AT[1] - 0.15, from: 11}, {at: AT[2] - 0.15, from: 4.6}, {at: AT[3] - 0.15, from: 17.5}]} />
        {EX.map((x, i) => <Envelope key={i} t={t} x={x} y={330 + (i % 2) * 40} at={AT[0] + 1.2 + i * 0.18} tick={tick + i * 0.3} fly={fly + i * 0.15} seed={i * 40} />)}
        <Scribble t={t} at={shock} until={END[1]} text="28%" x={540} y={620} />
        <Doodle t={t} x={470} y={1010} face={face} talk={talk} pop={shock} />
        {TEXT.map((x, i) => <Hand key={i} t={t} at={AT[i]} end={END[i]} text={x} dur={DUR[i]} />)}
        <Grain opacity={0.14} blend="overlay" />
      </AbsoluteFill>
      {AT.map((a, i) => (
        <Sequence key={i} from={Math.round(a * FPS)} layout="none">
          <Audio src={staticFile(`doodle-test/l${i + 1}.wav`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.6, total - 1, total], [0, 0.22, 0.22, 0], {extrapolateRight: 'clamp'})} loop />
      <Foley cues={[...EX.map((_, i) => [AT[0] + 1.2 + i * 0.18, 'pop', 0.2] as [number, 'pop', number]), [shock, 'pen', 0.35], ...EX.map((_, i) => [tick + i * 0.3, 'pen', 0.25] as [number, 'pen', number]), [fly, 'swish', 0.3]]} />
    </ThemeCtx.Provider>
  );
};
