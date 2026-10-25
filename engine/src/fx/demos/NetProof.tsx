// Proof: 12 s network-line set-piece (Aixsponza reference) with the black-to-white arc: a bottleneck on black (one line squeezed
// into a closing wedge) becomes a value hub on white (strands grow out, nodes expand) under one slow orbiting camera.
import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {INOUT, k, OUT} from '../../films/kit';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx, THEMES} from '../../themes';
import {Branches, NetStage, Phrase, Wedge} from '../network';

const DUR = [2.88, 4.16];
const AT = [0.4, 4.6];
const TURN = 4.0; // black becomes white
export const NETPROOF_FRAMES = Math.round(12 * FPS);
const ORIGIN: [number, number, number] = [0, -2.6, 0];
const APEX = 900;

// Orders as light: dots rise up the line from below the frame and queue under the apex, where only one gets through at a time.
const Queue: React.FC<{t: number}> = ({t}) => {
  const th = THEMES.signal;
  const dots = Array.from({length: 26}, (_, i) => {
    const born = -1.2 + i * 0.22; // already on the way at frame 0
    const passed = Math.floor(Math.max(0, t - 0.6) / 1.1); // one order through every 1.1 s
    const slot = i - passed; // place in the queue (below the apex)
    const free = 1920 - (t - born) * 1500; // where it would be if nothing waited
    const y = slot < 0 ? APEX - (t - 0.6 - (i + 1) * 1.1) * 1500 : Math.max(free, APEX + 46 + slot * 44);
    return {y, gone: slot < 0 && y < -40, i};
  });
  // a flash at the apex each time one order squeezes through
  const since = (Math.max(0, t - 0.6) % 1.1);
  const flash = t > 0.6 ? Math.max(0, 1 - since / 0.35) : 0;
  return (
    <>
      <div style={{position: 'absolute', left: 540 - 220, top: APEX - 220, width: 440, height: 440, borderRadius: '50%', background: `radial-gradient(circle, ${th.flow} 0%, transparent 65%)`, opacity: flash * 0.9, scale: String(0.6 + 0.6 * (1 - flash))}} />
      {dots.filter((d) => !d.gone && d.y < 1960).map((d) => (
        <div key={d.i} style={{position: 'absolute', left: 540 - 15, top: d.y - 15, width: 30, height: 30, borderRadius: '50%', background: th.flow, boxShadow: `0 0 18px ${th.flow}, 0 0 40px ${th.flow}`}} />
      ))}
    </>
  );
};

export const NetProof: React.FC = () => {
  ensureFonts();
  const t = useCurrentFrame() / FPS;
  const th = THEMES.signal;
  const arc = k(t, [TURN, TURN + 1.2], [0, 100], INOUT); // % of white
  const squeeze = k(t, [0, TURN], [1, 0.05], INOUT); // the wedge closes on the line: the bottleneck
  const bp = k(t, [TURN + 0.2, 10], [0, 1], INOUT);
  const a = t * 0.16; // a slow orbit
  return (
    <ThemeCtx.Provider value={th}>
      <AbsoluteFill style={{background: `color-mix(in srgb, ${th.bg} ${arc}%, ${th.shadow})`}}>
        {t < TURN + 1.2 && (
          <AbsoluteFill style={{opacity: k(t, [TURN, TURN + 1.0], [1, 0]), scale: String(k(t, [0, 1.1], [1.9, 1], OUT) + k(t, [1.1, TURN], [0, 0.22], INOUT)), transformOrigin: '540px 900px'}}>
            <Wedge t={t} apex={[540, k(t, [0, 0.6], [400, APEX], OUT)]} open={squeeze} grow={k(t, [0, 0.5], [0.6, 1], OUT)} />
            <Queue t={t} />
          </AbsoluteFill>
        )}
        {t >= TURN && (
          <AbsoluteFill style={{opacity: k(t, [TURN, TURN + 0.6], [0, 1])}}>
            <NetStage pos={[Math.sin(a) * 9, 0.6 + bp * 0.8, Math.cos(a) * 9]} look={[0, ORIGIN[1] + 1.6 + bp, 0]}>
              <Branches p={bp} origin={ORIGIN} n={22} />
            </NetStage>
          </AbsoluteFill>
        )}
        <Phrase t={t} at={AT[0]} out={TURN} text="One inbox. Every order." y={1450} dark />
        <Phrase t={t} at={AT[1]} text="Every order finds its way." y={1450} />
      </AbsoluteFill>
      {AT.map((a0, i) => (
        <Sequence key={i} from={Math.round(a0 * FPS)} layout="none">
          <Audio src={staticFile(`net-proof/l${i + 1}.wav`)} />
        </Sequence>
      ))}
      <Audio src={staticFile('hook-test/music-calm.wav')} volume={(f) => interpolate(f / FPS, [0, 0.5, 11, 12], [0, 0.2, 0.2, 0], {extrapolateRight: 'clamp'})} loop />
    </ThemeCtx.Provider>
  );
};
