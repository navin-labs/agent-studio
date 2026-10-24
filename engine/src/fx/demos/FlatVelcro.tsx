// P3 proof, format D Flat Journey (docs/FILM_PIPELINE_PLAN.md update b), measured against Video-45335. Four stations of the
// Velcro story in two inks, the camera travelling sideways, a timeline scrubbing 1941 -> 1955 -> 1969 -> today.
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Foley} from '../../films/kit';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx, THEMES} from '../../themes';
import {Caption, Paper, type Station, Timeline, World} from '../journey';

const DUR = [2.97, 2.97, 2.42, 1.53];
const AT = DUR.map((_, i) => 0.3 + DUR.slice(0, i).reduce((a, b) => a + b + 0.28, 0));
const STATIONS: Station[] = [
  {x: 0, at: AT[0], src: 'flat-test/alps.png', year: '1941', line: 'a walk in the Swiss Alps'},
  {x: 1300, at: AT[1], src: 'flat-test/patent.png', year: '1955', line: 'a patent for hook and loop'},
  {x: 2600, at: AT[2], src: 'flat-test/launch.png', year: '1969', line: 'it flew to the Moon'},
  {x: 3900, at: AT[3], src: 'flat-test/today.png', year: 'Today', line: 'on your shoes'},
];
export const FLAT_FRAMES = Math.ceil((AT[3] + DUR[3] + 1.4) * FPS);

export const FlatVelcro: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  return (
    <ThemeCtx.Provider value={THEMES.journey}>
      <AbsoluteFill>
        <Paper>
          <World t={t} stations={STATIONS} y={600} w={1180} h={881} />
          <Caption t={t} stations={STATIONS} />
          <Timeline t={t} stations={STATIONS} from={1936} to={2026} />
        </Paper>
      </AbsoluteFill>
      {AT.map((a, i) => (
        <Sequence key={i} from={Math.round(a * FPS)} layout="none">
          <Audio src={staticFile(`flat-test/l${i + 1}.wav`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.5, FLAT_FRAMES / FPS - 1, FLAT_FRAMES / FPS], [0, 0.22, 0.22, 0], {extrapolateRight: 'clamp'})} loop />
      <Foley cues={AT.slice(1).map((a) => [a - 0.9, 'swish', 0.3] as [number, 'swish', number])} />
    </ThemeCtx.Provider>
  );
};
