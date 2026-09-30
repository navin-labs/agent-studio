// Host layer: the channel's mascot acting on screen (idle bob, blink, tilt toward the active panel, react, lip-sync),
// the night stage behind it, and karaoke captions. Voice comes from VoiceCtx (set per scene by the Composer).
import {getWaveformPortion, useAudioData} from '@remotion/media-utils';
import React, {useContext} from 'react';
import {AbsoluteFill, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {chunkWords, parseAccent, splitWords} from '../lib/text';
import {LEAD} from '../lib/timing';
import {TYPE} from '../theme';
import {useTheme} from '../themes';
import {blinkAt, mouthFromAmplitude, mouthFromWords} from './acting';
import {type Acting, Bahi, Chiku, DitherDefs, Stage, Tikku} from './mascots';

export const HOSTS = {chiku: Chiku, bahi: Bahi, tikku: Tikku} as const;
export type HostName = keyof typeof HOSTS;

// Per scene: word start frames of the vo line, and the voice clip (public/ path) if one was generated.
export const VoiceCtx = React.createContext<{starts: number[]; audio?: string | null}>({starts: []});
export const HostCtx = React.createContext<HostName>('chiku');

export type Mood = 'idle' | 'happy' | 'pain';
export type HostPose = {x?: number; y?: number; scale?: number; look?: -1 | 0 | 1; mood?: Mood; moodAt?: number};

// ---- mouth: from the real voice loudness when there is a clip, else pulsed on the caption word timings ----
const MouthFromAudio: React.FC<{src: string; children: (m: number) => React.ReactNode}> = ({src, children}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const data = useAudioData(staticFile(src)); // holds the render (delayRender) until decoded
  const t = (f - LEAD) / fps;
  if (!data || t < 0 || t > data.durationInSeconds) return <>{children(0)}</>;
  const [bar] = getWaveformPortion({audioData: data, startTimeInSeconds: t, durationInSeconds: 1 / fps, numberOfSamples: 1});
  return <>{children(mouthFromAmplitude(bar.amplitude))}</>;
};

const Body: React.FC<HostPose & {mouth: number}> = ({x = 540, y = 1250, scale = 1, look = 0, mood = 'idle', moodAt = 0, mouth}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const Mascot = HOSTS[useContext(HostCtx)];
  const bob = Math.sin((f / fps) * Math.PI * 1.1) * 8; // slow idle breathing
  const lean = spring({frame: f, fps, config: {damping: 16, stiffness: 90}}) * look * 7; // tilt toward the active panel
  const since = f - moodAt;
  const hop = mood === 'happy' && since >= 0 ? Math.sin(Math.min(Math.PI, (since / 14) * Math.PI)) * -60 : 0;
  const shake = mood === 'pain' && since >= 0 && since < 24 ? Math.sin(since * 1.6) * 7 * (1 - since / 24) : 0;
  const acting: Acting = {mouth, blink: blinkAt(f), tilt: lean + shake}; // pain = head shake with eyes open
  return (
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <DitherDefs />
      {/* the mascot is drawn with its feet at (540, 1250); move and scale it from there */}
      <g transform={`translate(${x - 540 * scale} ${y + bob + hop - 1250 * scale}) scale(${scale})`}>
        <Mascot {...acting} />
      </g>
    </svg>
  );
};

export const Host: React.FC<HostPose> = (pose) => {
  const f = useCurrentFrame();
  const v = useContext(VoiceCtx);
  return v.audio ? <MouthFromAudio src={v.audio}>{(m) => <Body {...pose} mouth={m} />}</MouthFromAudio> : <Body {...pose} mouth={mouthFromWords(f, v.starts)} />;
};

// The host format's stage: starfield + warm glow, with a slow push-in like every shot.
export const HostStage: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const f = useCurrentFrame();
  const z = 1 + 0.04 * interpolate(f, [0, dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Stage f={f} glowY={1000} />
      <AbsoluteFill style={{transformOrigin: '540px 900px', transform: `scale(${z})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---- karaoke captions: bottom third, max 6 words a line, active word in lime ----
export const KARAOKE_TOP = 1330;
export const KaraokeCaptions: React.FC<{vo: string; starts: number[]}> = ({vo, starts}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const words = splitWords(vo);
  if (!words.length || f < starts[0] - 1) return null;
  const chunks = chunkWords(words, 6, 30);
  const ci = chunks.reduce((c, ch, i) => (starts[ch.startIdx] <= f ? i : c), 0);
  const chunk = chunks[ci];
  const active = starts.reduce((a, s, i) => (s <= f ? i : a), -1);
  const pop = interpolate(f - starts[chunk.startIdx], [0, 4], [0.92, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const accent = parseAccent(vo).map((w) => w.accent);
  return (
    <div data-tb="caption" style={{position: 'absolute', top: KARAOKE_TOP, left: 80, right: 80, height: 150, display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', columnGap: 16, fontFamily: TYPE.title, fontSize: 60, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em', color: th.ink, transform: `scale(${pop})`}}>
      {chunk.words.map((w, j) => {
        const i = chunk.startIdx + j;
        return (
          <span key={i} style={{display: 'inline-block', color: i === active || (accent[i] && i < active) ? th.accent : th.ink, opacity: i <= active ? 1 : 0.45}}>
            {w}
          </span>
        );
      })}
    </div>
  );
};
