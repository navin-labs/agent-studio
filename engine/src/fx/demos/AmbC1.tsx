// S3 proof, format G Ambient Scenes (pixel-night look, sodium-night suit), measured against Video-65602 / Video-40696. A C1
// story told in four quiet scenes; the script passes studio/script.ts (novelty, contrast, number, reveal, stakes, loop).
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Foley} from '../../films/kit';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx, THEMES} from '../../themes';
import {Fog, Lamp, Plate, Rain, ScreenGlow, Sunrise, Whisper} from '../ambient';

const DUR = [4.15, 4.65, 3.86, 4.71];
const AT = DUR.map((_, i) => 0.4 + DUR.slice(0, i).reduce((a, b) => a + b + 0.5, 0));
const END = AT.map((a, i) => (AT[i + 1] ?? a + DUR[i] + 1.4) - 0.15);
const TEXT = ['At 3 AM, most shop owners are asleep. Their invoices are not.', 'Fourteen unpaid bills, each one waiting for a reminder nobody sent.', 'But now, a simple workflow sends every reminder by itself.', 'So by sunrise, the owner is still asleep, and the invoices are getting paid.'];
export const AMB_FRAMES = Math.ceil((AT[3] + DUR[3] + 1.4) * FPS);

export const AmbC1: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  const C = AT.map((a) => a - 0.35); // scene cuts
  const total = AMB_FRAMES / FPS;
  return (
    <ThemeCtx.Provider value={THEMES['sodium-night']}>
      <AbsoluteFill style={{background: THEMES['sodium-night'].bg}}>
        <Plate t={t} a={-0.3} b={C[1]} src="amb-test/shop.jpg">
          <Lamp t={t} on={0.25} x={773} y={721} r={300} cone={520} />
          <Rain t={t} amount={0.5} />
          <Fog t={t} y={1350} amount={0.25} />
        </Plate>
        <Plate t={t} a={C[1]} b={C[2]} src="amb-test/desk.jpg">
          <ScreenGlow t={t} x={594} y={1108} w={300} h={220} />
          <Lamp t={t} on={AT[1] + 1.6} x={1005} y={950} r={180} />
        </Plate>
        <Plate t={t} a={C[2]} b={C[3]} src="amb-test/phone.jpg">
          <ScreenGlow t={t} x={540} y={1196} w={260} h={140} pings={[AT[2] + 0.9, AT[2] + 1.5, AT[2] + 2.1, AT[2] + 2.7]} />
        </Plate>
        <Plate t={t} a={C[3]} b={total + 1} src="amb-test/roof.jpg">
          <Sunrise t={t} from={C[3]} to={C[3] + 3.5} y={756} />
          <Fog t={t} y={1100} amount={0.18} />
        </Plate>
        {TEXT.map((x, i) => <Whisper key={i} t={t} at={AT[i]} end={END[i]} text={x} dur={DUR[i]} />)}
      </AbsoluteFill>
      {AT.map((a, i) => (
        <Sequence key={i} from={Math.round(a * FPS)} layout="none">
          <Audio src={staticFile(`amb-test/l${i + 1}.wav`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.8, total - 1, total], [0, 0.25, 0.25, 0], {extrapolateRight: 'clamp'})} loop />
      <Foley cues={[[0.25, 'switch', 0.35], [AT[2] + 0.9, 'pop', 0.25], [AT[2] + 1.5, 'pop', 0.25], [AT[2] + 2.1, 'pop', 0.25], [AT[2] + 2.7, 'pop', 0.25]]} />
    </ThemeCtx.Provider>
  );
};
