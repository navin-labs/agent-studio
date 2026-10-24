// POC kit: the few pieces both authored videos share (voice, music, sfx, captions, easing). Everything else is per video.
import React from 'react';
import {noise2D} from '@remotion/noise';
import {Audio, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const IN = Easing.bezier(0.7, 0, 0.84, 0);
export const INOUT = Easing.bezier(0.65, 0, 0.35, 1);
export const SPRING = Easing.spring({damping: 14, mass: 0.6});

// seconds-based clamp interpolate: k(t, [0.2, 0.6], [0, 1], OUT)
export const k = (t: number, [a, b]: [number, number], [x, y]: [number, number], easing = OUT) =>
  interpolate(t, [a, b], [x, y], {easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const useT = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return frame / fps;
};

// Grain: fractal noise re-seeded every 2 frames, so it boils at 15 fps like film or paper under a lamp, not like video noise.
// multiply on light grounds, screen on dark ones.
export const Grain: React.FC<{opacity?: number; blend?: 'multiply' | 'screen'}> = ({opacity = 0.1, blend = 'multiply'}) => {
  const f = useCurrentFrame();
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, mixBlendMode: blend, opacity}}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={Math.floor(f / 2)} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={1080} height={1920} filter="url(#grain)" />
    </svg>
  );
};

// Camera drift: a few px and a fraction of a degree of slow noise, so a locked-off frame still breathes. Camera only, never objects.
export const drift = (t: number, amp = 5): string =>
  `translate(${noise2D('dx', t * 0.3, 0) * amp}px, ${noise2D('dy', 0, t * 0.3) * amp}px) rotate(${noise2D('dr', t * 0.2, 1) * amp * 0.03}deg)`;

export const LEAD_S = 4 / 30; // same 4-frame lead the Composer gives each voice line

// Voice: the pipeline's own clips, at the same scene starts as the live render (A/B changes the picture and sound, not the script).
export const Voice: React.FC<{dir: string; starts: number[]}> = ({dir, starts}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      {starts.map((s, i) => (
        <Sequence key={i} from={Math.round((s + LEAD_S) * fps)} layout="none">
          <Audio src={staticFile(`${dir}/s0${i + 1}.wav`)} />
        </Sequence>
      ))}
    </>
  );
};

export type Cue = [at: number, name: string, volume?: number];
// music: a bed file in public/; sfxDir: where cue names resolve. An arranged bed is pre-mixed (volume 1).
export const Sounds: React.FC<{music: string; volume?: number; sfxDir: string; cues: Cue[]; sfx?: number}> = ({music, volume = 1, sfxDir, cues, sfx = 1}) => {
  const {fps} = useVideoConfig();
  return (
    <>
      <Audio src={staticFile(music)} volume={volume} />
      {cues.map(([at, name, v = 0.6], i) => (
        <Sequence key={i} from={Math.round(at * fps)} layout="none">
          <Audio src={staticFile(`${sfxDir}/${name}.wav`)} volume={v * sfx} />
        </Sequence>
      ))}
    </>
  );
};

// Captions: each line split into short phrases timed by character share of its measured clip.
// ponytail: proportional timing, not word timestamps; whisper alignment if drift shows on longer lines.
export const phrases = (line: string, start: number, dur: number, max = 4) => {
  const words = line.split(' ');
  const chunks: string[] = [];
  for (let i = 0; i < words.length; ) {
    let n = Math.min(max, words.length - i);
    const stop = words.slice(i, i + n).findIndex((w) => /[.,!?]$/.test(w)); // end a phrase on punctuation
    if (stop >= 0) n = stop + 1;
    chunks.push(words.slice(i, i + n).join(' '));
    i += n;
  }
  const total = chunks.reduce((a, c) => a + c.length + 2, 0);
  let at = start + LEAD_S;
  return chunks.map((text) => {
    const d = ((text.length + 2) / total) * dur;
    const p = {text, from: at, to: at + d};
    at += d;
    return p;
  });
};

