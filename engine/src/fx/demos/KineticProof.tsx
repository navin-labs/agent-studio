// Proof: 15 s of Kinetic Type (kinetic block) on a C1 script, every word on its exact spoken moment (Kokoro word times).
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx} from '../../themes';
import {BlockProvider, blockTheme, BLOCKS, Ground} from '../blocks';
import {KineticType, screensOf, type Word} from '../kinetic';

const DUR = [2.65, 3.54, 2.73, 1.9];
const GAP = 0.35;
const AT = DUR.map((_, i) => 0.04 + DUR.slice(0, i).reduce((a, b) => a + b + GAP, 0));
// the four lines' word times as Kokoro reported them (public/kinetic-test/l*.words.json)
const WORDS: Word[][] = [[{"w":"You","s":0,"e":0.13},{"w":"chase","s":0.13,"e":0.443},{"w":"the","s":0.443,"e":0.593},{"w":"same","s":0.593,"e":0.943},{"w":"invoice","s":0.943,"e":1.643},{"w":"every","s":1.643,"e":2.005},{"w":"single","s":2.005,"e":2.393},{"w":"month","s":2.393,"e":3.043}],[{"w":"Fourteen","s":0.006,"e":0.506},{"w":"reminders","s":0.506,"e":1.181},{"w":"Fourteen","s":1.269,"e":1.819},{"w":"calls","s":1.819,"e":2.331},{"w":"Zero","s":2.419,"e":2.806},{"w":"replies","s":2.806,"e":3.756}],[{"w":"But","s":0,"e":0.111},{"w":"one","s":0.111,"e":0.411},{"w":"rule","s":0.411,"e":0.761},{"w":"sends","s":0.761,"e":1.086},{"w":"every","s":1.086,"e":1.424},{"w":"reminder","s":1.424,"e":1.949},{"w":"by","s":1.949,"e":2.124},{"w":"itself","s":2.124,"e":2.974}],[{"w":"So","s":0.017,"e":0.104},{"w":"the","s":0.104,"e":0.217},{"w":"invoice","s":0.217,"e":0.654},{"w":"chases","s":0.654,"e":1.117},{"w":"them","s":1.117,"e":1.342},{"w":"not","s":1.392,"e":1.654},{"w":"you","s":1.654,"e":2.192}]];
const KEYS = ['invoice', 'zero', 'itself', 'you'];
const SCREENS = WORDS.flatMap((ws, i) => screensOf(ws.map((w) => ({...w, s: w.s + AT[i], e: w.e + AT[i]})), KEYS));
export const KINETIC_FRAMES = Math.ceil((AT[3] + DUR[3] + 1.2) * FPS);

export const KineticProof: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  const total = KINETIC_FRAMES / FPS;
  return (
    <ThemeCtx.Provider value={blockTheme('kinetic')}>
      <BlockProvider id="kinetic">
        <AbsoluteFill style={{fontFamily: BLOCKS.kinetic.display}}>
          <Ground t={t} />
          <KineticType t={t} screens={SCREENS} end={total} />
        </AbsoluteFill>
        {AT.map((a, i) => (
          <Sequence key={i} from={Math.round(a * FPS)} layout="none">
            <Audio src={staticFile(`kinetic-test/l${i + 1}.wav`)} />
          </Sequence>
        ))}
        <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.4, total - 0.8, total], [0, 0.18, 0.18, 0], {extrapolateRight: 'clamp'})} loop />
      </BlockProvider>
    </ThemeCtx.Provider>
  );
};
