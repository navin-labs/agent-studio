// P2 proof, format C Network Line (docs/FILM_PIPELINE_PLAN.md update b), measured against Aixsponza (Video-40262). C1 line:
//  A "From manual work,"             dark: a violet line rises; the black wedge's apex sinks and light opens above it
//  B "to a workflow,"                the wedge closes into the line; strands fan up out of its tip into a network of nodes
//  C "to a system that runs itself." the camera flies down a tunnel of rings, spirals and nodes
//  D "That is how we work now."      a planet rolls in, a small moon, a line flying past
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {Foley, IN, INOUT, k, OUT} from '../../films/kit';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx, THEMES} from '../../themes';
import {Branches, NetStage, Phrase, Planet, Tunnel, Wedge} from '../network';

const AT = [0.8, 3.9, 7.1, 11.0]; // when each line is spoken
const PH = {b: 3.5, c: 6.9, d: 10.6}; // phase cuts
export const NET_FRAMES = Math.round(13.8 * FPS);
const APEX: [number, number] = [540, 1150]; // the line's tip on screen; the 3D strands start exactly there
const ORIGIN: [number, number, number] = [0, -(APEX[1] - 960) * ((10 * Math.tan((20 * Math.PI) / 180)) / 960), 0];

export const NetC1: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  const th = THEMES.signal;
  // A: the apex sinks from above the frame to its place while the line climbs to meet it; B: the wedge narrows shut
  const ay = k(t, [0, 1.5], [-500, APEX[1]], OUT); // moving from frame 0, settled before the first words
  const open = t < PH.b ? 1 : k(t, [PH.b, PH.b + 0.5], [1, 0], IN);
  const grow = k(t, [0, 1.2], [0.35, 1], OUT);
  const tanA = 0.5 * open * (1 + k(t, [1.2, PH.b], [0, 0.45], INOUT)); // the wedge keeps opening slowly while the words hold
  // B: strands grow, the camera rises slowly; at the end it pushes up into the canopy
  const bp = k(t, [PH.b + 0.35, PH.c - 0.4], [0, 1], INOUT);
  const rise = k(t, [PH.b, PH.c], [0, 1.6], INOUT) + k(t, [PH.c - 0.5, PH.c], [0, 2.2], IN);
  // C: the camera flies down the tunnel
  const cz = k(t, [PH.c, PH.d + 0.3], [5, -16], INOUT);
  const fadeC = Math.min(k(t, [PH.c, PH.c + 0.3], [0, 1]), k(t, [PH.d, PH.d + 0.4], [1, 0]));
  return (
    <ThemeCtx.Provider value={th}>
      <AbsoluteFill style={{background: th.bg}}>
        {t < PH.b + 0.6 && (
          <AbsoluteFill style={{scale: String(1 + k(t, [1.0, PH.b], [0, 0.16], INOUT)), transformOrigin: `${APEX[0]}px ${APEX[1]}px`}}>
            <Wedge t={t} apex={[APEX[0], ay]} open={tanA / 0.5 > 0 ? (1920 - ay) * tanA / 900 : 0} grow={grow} />
          </AbsoluteFill>
        )}
        {t >= PH.b && t < PH.c + 0.3 && (
          <AbsoluteFill style={{opacity: k(t, [PH.c, PH.c + 0.3], [1, 0])}}>
            <NetStage pos={[0, rise * 0.6, 10 - rise * 2.2]} look={[0, ORIGIN[1] + rise, 0]}>
              <Branches p={bp} origin={ORIGIN} />
            </NetStage>
          </AbsoluteFill>
        )}
        {t >= PH.c && t < PH.d + 0.5 && (
          <AbsoluteFill style={{opacity: fadeC}}>
            <NetStage pos={[0.4, 0.2, cz]} look={[0, 0, cz - 8]} fov={55}>
              <Tunnel t={t} />
            </NetStage>
          </AbsoluteFill>
        )}
        {t >= PH.d && (
          <AbsoluteFill style={{opacity: k(t, [PH.d, PH.d + 0.5], [0, 1])}}>
            <NetStage pos={[0, 0, 10]}>
              <Planet t={t} at={PH.d} />
            </NetStage>
          </AbsoluteFill>
        )}
        <Phrase t={t} at={AT[0] - 0.1} out={PH.b} text="From manual work," y={780} />
        <Phrase t={t} at={AT[1] - 0.1} out={PH.c - 0.2} text="to a workflow," y={1560} />
        <Phrase t={t} at={AT[2] - 0.1} out={PH.d - 0.2} text="to a system that runs itself." y={920} />
        <Phrase t={t} at={AT[3] - 0.1} text="That is how we work now." x={90} y={900} align="left" />
      </AbsoluteFill>
      {AT.map((a, i) => (
        <Sequence key={i} from={Math.round(a * FPS)} layout="none">
          <Audio src={staticFile(`net-test/l${i + 1}.wav`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.6, 12.8, 13.8], [0, 0.2, 0.2, 0], {extrapolateRight: 'clamp'})} loop />
      <Foley cues={[[0.1, 'swish', 0.25], [PH.b, 'swish', 0.25], [PH.c, 'swish', 0.3], [PH.d, 'soft', 0.35]]} />
    </ThemeCtx.Provider>
  );
};
