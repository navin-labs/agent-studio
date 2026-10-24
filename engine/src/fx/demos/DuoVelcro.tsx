// P1 proof, format B Duotone Story (docs/FILM_PIPELINE_PLAN.md update b), measured against Video-28089.
// Voice: five Kokoro clips in public/duo-test (l1..l5). Objects: real cut-outs from the prop library (scripts/assets.mjs).
//  L1 "In 1941, a dog came home from the Alps"   the dog dissolves in on its orbit ring
//  L2 "covered in burrs."                          three burrs pop onto its coat
//  L3 "Under a magnifying glass,"                  a magnifier slides over the burr on its back
//  L4 "every burr was full of tiny hooks."         the lens shows the burr magnified
//  L5 "Fourteen years later, they were on your shoes."   the sneaker
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Foley, k, OUT} from '../../films/kit';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx, THEMES} from '../../themes';
import {Cutout, DuoWorld, LensView, type Line, Orbit, Transcript} from '../duotone';

const DUR = [3.24, 1.08, 1.55, 1.86, 2.49]; // measured clips (seconds)
const LEAD = 0.3, GAP = 0.28;
const AT = DUR.map((_, i) => LEAD + DUR.slice(0, i).reduce((a, b) => a + b + GAP, 0));
const TEXT = ['In *1941*, a *dog* came home from the *Alps*', 'covered in *burrs.*', 'Under a *magnifying glass,*', 'every burr was full of *tiny hooks.*', '*Fourteen years* later, they were on your *shoes.*'];
const line = (i: number, end?: number): Line => ({text: TEXT[i], at: AT[i], dur: DUR[i], end: end ?? (AT[i + 1] ?? 99) - 0.02});
export const DUO_FRAMES = Math.ceil((AT[4] + DUR[4] + 1.3) * FPS);

const WATCH = 'props/antique-pocket-watch/antique-pocket-watch.png', ALPS = 'props/snowy-mountain-peak/snowy-mountain-peak.png';
const DOG = 'props/dog/dog.png', BURR = 'props/burdock-burr/burdock-burr.png', LENS = 'props/magnifying-glass/magnifying-glass.png', SHOE = 'props/white-sneaker/white-sneaker.png';

// One shot per line: it settles in with a small scale snap, then the camera keeps pushing slowly; a shot renders only in its window.
const Shot: React.FC<{t: number; a: number; b: number; push?: number; snap?: number; children: React.ReactNode}> = ({t, a, b, push = 0.16, snap = 0.06, children}) => {
  if (t < a || t >= b) return null;
  const s = k(t, [a, a + 0.35 + snap * 2], [1 + snap, 1], OUT) * (1 + k(t, [a, b], [0, push]));
  return <div style={{position: 'absolute', inset: 0, scale: String(s), transformOrigin: '50% 55%'}}>{children}</div>;
};

export const DuoVelcro: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  const C = AT.map((a) => a - 0.12); // cuts land just before each line is spoken
  const W = {dog: AT[0] + (10 / 38) * DUR[0] - 0.1, alps: AT[0] + (21 / 38) * DUR[0] - 0.15}; // word times in line 1 (character share)
  const mw = 680, mh = 518; // magnifier box (photo 690x526); its lens centre sits at 27% / 30% of the photo
  const slide = k(t, [C[2], C[2] + 0.6], [760, 0], OUT);
  const LC = {x: 540, y: 1000}; // lens centre once it has slid in
  // L4: the camera pushes through the lens: the lens view grows to fill the frame
  const dive = k(t, [C[3], C[3] + 0.7], [0, 1], OUT);
  const lr = 145 + dive * 300; // stays a lens: the bottom of the frame keeps a light ground for the words
  return (
    <ThemeCtx.Provider value={THEMES.periwinkle}>
      <AbsoluteFill>
        <DuoWorld>
          <Shot t={t} a={0} b={W.dog + 0.4} push={0.2} snap={0.35}>
            <Orbit t={t} at={-0.4} out={W.dog} cx={540} cy={1380} rx={300} />
            <Cutout id="watch" t={t} src={WATCH} x={300} y={640} w={480} h={588} at={-0.3} out={W.dog} seed={5} cells={10} rot={-6} />
          </Shot>
          <Shot t={t} a={W.dog} b={C[1]} push={0.16}>
            <Cutout id="alps" t={t} src={ALPS} x={170} y={420} w={740} h={868} at={W.alps} seed={4} cells={12} />
            <Orbit t={t} at={W.dog} cx={540} cy={1450} rx={400} />
            <Cutout id="dog" t={t} src={DOG} x={150} y={720} w={780} h={760} at={W.dog} seed={3} />
          </Shot>
          <Shot t={t} a={C[1]} b={C[2]} push={0.2}>
            <Orbit t={t} at={C[1]} cx={540} cy={1390} rx={330} />
            <Cutout id="burr-big" t={t} src={BURR} x={290} y={640} w={500} h={640} at={C[1]} seed={8} cells={10} />
            {[[230, 760, 0.25, -30], [820, 1150, 0.4, 25]].map(([x, y, d, r], i) => (
              <Cutout key={i} id={`burr${i}`} t={t} src={BURR} x={x - 70} y={y - 88} w={140} h={176} at={C[1] + d} seed={9 + i} cells={6} rot={r} />
            ))}
          </Shot>
          <Shot t={t} a={C[2]} b={C[3]} push={0.14}>
            <Cutout id="burr-under" t={t} src={BURR} x={340} y={700} w={400} h={512} at={C[2] - 0.4} seed={12} cells={10} />
            <LensView t={t} at={C[2] + 0.45} src={BURR} cx={LC.x + slide} cy={LC.y} r={145} w={430} h={545} />
            <Cutout id="lens" t={t} src={LENS} x={LC.x - 0.27 * mw + slide} y={LC.y - 0.3 * mh} w={mw} h={mh} at={C[2]} seed={11} rot={-8} />
          </Shot>
          <Shot t={t} a={C[3]} b={C[4]} push={0.12}>
            <LensView t={t} at={C[3] - 0.3} src={BURR} cx={LC.x} cy={LC.y} r={lr} w={430 + dive * 900} h={545 + dive * 1140} />
          </Shot>
          <Shot t={t} a={C[4]} b={99} push={0.16}>
            <Orbit t={t} at={C[4]} cx={540} cy={1390} rx={430} />
            <Cutout id="shoe" t={t} src={SHOE} x={120} y={880} w={840} h={523} at={C[4]} seed={21} />
          </Shot>
          <Transcript t={t} line={line(0)} y={200} />
          <Transcript t={t} line={line(1)} y={220} align="right" />
          <Transcript t={t} line={line(2)} y={230} size={118} />
          <Transcript t={t} line={line(3)} y={1580} size={140} align="right" />
          <Transcript t={t} line={line(4, 99)} y={230} />
        </DuoWorld>
      </AbsoluteFill>
      {AT.map((a, i) => (
        <Sequence key={i} from={Math.round(a * FPS)} layout="none">
          <Audio src={staticFile(`duo-test/l${i + 1}.wav`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.5, DUO_FRAMES / FPS - 1, DUO_FRAMES / FPS], [0, 0.22, 0.22, 0], {extrapolateRight: 'clamp'})} loop />
      <Foley cues={[[0.05, 'soft', 0.4], [AT[0] + 0.75, 'pop', 0.3], [AT[1], 'pop', 0.35], [AT[1] + 0.2, 'pop', 0.3], [AT[1] + 0.4, 'pop', 0.3], [AT[2] - 0.12, 'swish', 0.4], [AT[3] - 0.12, 'swish', 0.3], [AT[4] - 0.1, 'soft', 0.4]]} />
    </ThemeCtx.Provider>
  );
};
