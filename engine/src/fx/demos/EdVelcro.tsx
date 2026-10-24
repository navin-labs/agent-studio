// P4 proof, format A Editorial Object (docs/FILM_PIPELINE_PLAN.md update b), measured against Video-93990. Same Velcro voice
// as P1 (public/duo-test). Real objects act on huge type: the dog lands on 1941, burrs drop around BURRS, a magnifier's lens
// reveals the hidden TINY HOOKS, the sneaker lands over SHOES with its strap circled in red. Focus pulls between beats.
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Foley} from '../../films/kit';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx, THEMES} from '../../themes';
import {Display, Flyers, LensReveal, Line, Marks, Obj, Page, Strike} from '../editorial';
import {PenCircle} from '../energy';

const DUR = [3.24, 1.08, 1.55, 1.86, 2.49];
const AT = DUR.map((_, i) => 0.3 + DUR.slice(0, i).reduce((a, b) => a + b + 0.28, 0));
const C = AT.map((a) => a - 0.12); // cuts (focus pulls) just before each beat's line
export const ED_FRAMES = Math.ceil((AT[4] + DUR[4] + 1.3) * FPS);
const DOG = 'props/dog/dog.png', BURR = 'props/burdock-burr/burdock-burr.png', LENS = 'props/magnifying-glass/magnifying-glass.png', SHOE = 'props/white-sneaker/white-sneaker.png';
const W1 = {dog: AT[0] + (10 / 38) * DUR[0] - 0.1, home: AT[0] + (16 / 38) * DUR[0]};

export const EdVelcro: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  const pulls = [0.12, C[1], C[2], C[4]]; // the film opens out of a blur, as the reference does
  return (
    <ThemeCtx.Provider value={THEMES.editorial}>
      <AbsoluteFill>
        <Page t={t} pulls={pulls}>
          <Marks t={t} note="Burdock (Arctium lappa). A plant of the Alps and the roadside whose seed heads end in hundreds of tiny hooks; they catch on fur and cloth and travel far from the plant that made them." />
          {/* 1: 1941, the dog lands on the year */}
          <Line t={t} at={-0.4} out={C[1] - 0.2} text="In" y={330} size={60} />
          <Display t={t} at={-0.35} out={C[1] - 0.2} text="1941" y={400} size={430} />
          <Obj t={t} at={W1.dog} out={C[1] - 0.15} src={DOG} x={190} y={720} w={700} h={680} from={[0, -900]} />
          <Line t={t} at={W1.home} out={C[1] - 0.2} text="a dog came home from the Alps" y={1460} size={64} italic />
          {/* 2: BURRS, burrs drop around the word, one circled */}
          <Line t={t} at={AT[1]} out={C[2] - 0.2} text="covered in" y={560} size={64} italic />
          <Display t={t} at={AT[1] + 0.05} out={C[2] - 0.2} text="BURRS" y={660} size={340} red />
          {[[150, 1060, 0.05, -14], [430, 1120, 0.18, 6], [720, 1050, 0.3, 18]].map(([x, y, d, r], i) => (
            <Obj key={i} t={t} at={AT[1] + d} out={C[2] - 0.15} src={BURR} x={x} y={y} w={220} h={278} from={[0, -1300]} rot={r} />
          ))}
          <PenCircle t={t} at={AT[1] + 0.55} out={C[2] - 0.2} cx={540} cy={1260} rx={190} ry={200} width={12} />
          {/* 3-4: the magnifier slides over the page; its lens shows the words that are not printed */}
          <Line t={t} at={AT[2]} out={C[4] - 0.2} text="Under a magnifying glass," y={360} size={66} />
          <Display t={t} at={AT[2] + 0.2} out={C[4] - 0.2} text="EVERY BURR" y={470} size={220} />
          <Line t={t} at={AT[3]} out={C[4] - 0.2} text="is full of" y={760} size={64} italic />
          <LensReveal t={t} at={AT[3] - 0.25} out={C[4] - 0.25} src={LENS} cx={540} cy={1200} r={265} w={1200} h={915} lens={[0.28, 0.39]}
            hidden={<div style={{position: 'absolute', left: 0, right: 0, top: 1092, textAlign: 'center', fontFamily: 'Anton, sans-serif', fontSize: 114, lineHeight: 0.95, color: THEMES.editorial.accent}}>TINY<br />HOOKS</div>} />
          {/* 5: the sneaker lands over SHOES; the strap is circled */}
          <Line t={t} at={AT[4]} text="Fourteen years later, they were on your" y={350} size={52} />
          <Obj t={t} at={AT[4] + 0.6} src={SHOE} x={110} y={640} w={860} h={535} from={[0, -1000]} rot={-4} />
          <Display t={t} at={AT[4] + 1.6} text="SHOES." y={1210} size={330} red />
          <PenCircle t={t} at={AT[4] + 2.0} cx={600} cy={770} rx={185} ry={100} width={12} />
          <Strike t={t} at={0.75} y={790} x0={150} x1={930} />
          {/* foreground: burrs drift past the lens out of focus, a few per beat */}
          <Flyers t={t} src={BURR} items={[
            {at: -0.3, dur: 1.3, from: [-200, 300], to: [1300, 640], size: 460},
            {at: 0.5, dur: 1.2, from: [1250, 1700], to: [-250, 1250], size: 380, spin: -120},
            {at: 1.3, dur: 1.2, from: [-220, 1650], to: [1250, 1100], size: 320},
            {at: 2.1, dur: 1.2, from: [1300, 350], to: [-280, 800], size: 420, spin: -90},
            {at: 2.9, dur: 1.2, from: [-260, 950], to: [1300, 500], size: 340},
            {at: 4.0, dur: 1.3, from: [1300, 250], to: [-300, 700], size: 380, spin: -80},
            {at: 5.3, dur: 1.3, from: [-250, 1700], to: [1300, 1300], size: 300},
            {at: 6.4, dur: 1.5, from: [-250, 900], to: [1300, 400], size: 330},
            {at: 8.0, dur: 1.4, from: [1300, 1650], to: [-300, 1400], size: 360, spin: -70},
            {at: 9.4, dur: 1.6, from: [1300, 1500], to: [-300, 1100], size: 400, spin: -100},
            {at: 11.2, dur: 1.4, from: [-250, 350], to: [1300, 600], size: 300},
          ]} />
        </Page>
      </AbsoluteFill>
      {AT.map((a, i) => (
        <Sequence key={i} from={Math.round(a * FPS)} layout="none">
          <Audio src={staticFile(`duo-test/l${i + 1}.wav`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.5, ED_FRAMES / FPS - 1, ED_FRAMES / FPS], [0, 0.2, 0.2, 0], {extrapolateRight: 'clamp'})} loop />
      <Foley cues={[[W1.dog + 0.4, 'land', 0.45], [AT[1] + 0.45, 'drop', 0.3], [AT[1] + 0.6, 'pen', 0.5], [AT[3] - 0.25, 'swish', 0.4], [AT[4] + 1.0, 'land', 0.45], [AT[4] + 2.0, 'pen', 0.5]]} />
    </ThemeCtx.Provider>
  );
};
