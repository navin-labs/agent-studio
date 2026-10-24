// S3 proof, format E Memory Windows (dream-3d look, gold-dream suit), measured against Video-84390. A C2 history story: the
// 1859 Carrington Event; two Stitch dream plates, real public-domain photos as windows. The script passes studio/script.ts.
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Foley, k, OUT} from '../../films/kit';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx, THEMES} from '../../themes';
import {Plate} from '../ambient';
import {Burst, Flash} from '../energy';
import {DreamLine, Letterbox, Sparkles, Window} from '../windows';

const DUR = [4.82, 6.09, 4.72, 4.73, 4.21];
const AT = DUR.map((_, i) => 0.25 + DUR.slice(0, i).reduce((a, b) => a + b + 0.35, 0));
const END = AT.map((a, i) => (AT[i + 1] ?? a + DUR[i] + 1.2) - 0.1);
const TEXT = ['In 1859, a storm on the sun set telegraph paper on fire.', 'Operators saw sparks leap from their keys, yet their lines kept working with the batteries unplugged.', 'But the same storm painted auroras so bright that people in Cuba could see them.', 'Today, a storm that size would hit satellites and power grids within hours.', 'And scientists say the sun is overdue for another 1859.'];
export const MEM_FRAMES = Math.ceil((AT[4] + DUR[4] + 1.2) * FPS);
const GOLD = [THEMES['gold-dream'].accent, THEMES['gold-dream'].ink];
const P = (id: string) => `props/${id}/${id}.jpg`;

export const MemC2: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  const total = MEM_FRAMES / FPS;
  const C = AT.map((a) => a - 0.15); // cuts
  const spark = AT[1] + 1.0;
  return (
    <ThemeCtx.Provider value={THEMES['gold-dream']}>
      <AbsoluteFill style={{background: THEMES['gold-dream'].bg}}>
        <AbsoluteFill style={{scale: String(k(t, [0, 1.5], [1.9, 1], OUT)), rotate: `${k(t, [0, 1.2], [-4, 0], OUT)}deg`}}>
          <Plate t={t} a={-0.3} b={C[2]} src="mem-test/sun.jpg" push={0.35} origin="35% 52%" />
        </AbsoluteFill>
        <Plate t={t} a={C[2]} b={C[4]} src="mem-test/earth.jpg" push={0.3} origin="85% 62%" />
        <Plate t={t} a={C[4]} b={total + 1} src="mem-test/sun.jpg" push={0.12} origin="68% 30%" />
        <Sparkles t={t} />
        <Window t={t} at={0.15} until={C[1] - 0.2} src={P('solar-flare-sun')} x={330} y={480} w={480} h={480} from="left" tilt={-6} />
        <Window t={t} at={AT[0] + 2.7} until={C[1] - 0.2} src={P('power-lines')} x={760} y={900} w={400} h={500} from="right" tilt={5} />
        <Window t={t} at={AT[1] + 0.3} until={C[2] - 0.2} src={P('telegraph-key')} x={540} y={760} w={760} h={520} from="below" tilt={-3} />
        <Burst t={t} at={spark} x={540} y={760} n={36} power={620} seed={7} colors={GOLD} />
        <Burst t={t} at={spark + 0.5} x={420} y={700} n={20} power={420} seed={9} colors={GOLD} />
        <Window t={t} at={AT[2] + 0.4} until={C[3] - 0.2} src={P('aurora-borealis')} x={330} y={760} w={480} h={600} from="left" tilt={-5} />
        <Window t={t} at={AT[3] + 2.4} until={C[4] - 0.2} src={P('high-voltage-transmission-tower')} x={330} y={620} w={460} h={560} from="left" tilt={4} />
        <Window t={t} at={AT[4] + 0.5} until={total} src={P('solar-flare-sun')} x={540} y={640} w={560} h={560} from="below" />
        <Letterbox />
        {TEXT.map((x, i) => <DreamLine key={i} t={t} at={AT[i]} end={END[i]} text={x} dur={DUR[i]} />)}
        <Flash t={t} at={C[2]} color={THEMES['gold-dream'].ink} />
        <Flash t={t} at={C[4]} color={THEMES['gold-dream'].ink} />
      </AbsoluteFill>
      {AT.map((a, i) => (
        <Sequence key={i} from={Math.round(a * FPS)} layout="none">
          <Audio src={staticFile(`mem-test/l${i + 1}.wav`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.6, total - 1, total], [0, 0.22, 0.22, 0], {extrapolateRight: 'clamp'})} loop />
      <Foley cues={[[0.3, 'swish', 0.3], [AT[0] + 2.7, 'swish', 0.25], [AT[1] + 0.3, 'swish', 0.25], [spark, 'pop', 0.35], [C[2], 'swish', 0.35], [AT[2] + 0.4, 'swish', 0.25], [AT[3] + 2.4, 'swish', 0.25], [C[4], 'swish', 0.35]]} />
    </ThemeCtx.Provider>
  );
};
