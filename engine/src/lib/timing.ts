import type {ReelProps, Scene} from '../types';
import {splitWords} from './text.ts';

export const FPS = 30;
export const LEAD = 4; // frames of silence before VO starts in each scene
export const TAIL_AUDIO = 0.2; // seconds after measured VO ends: with the next LEAD, 0.33 s between lines (clips are trimmed)
// ponytail: one rate for every voice. Measured 2026-10-03 on a 62-word passage with clips trimmed (tts_local.py): C2 Kokoro
// am_fenrir at 1.0 = 3.64 words/s, C1 af_heart at 1.15 = 3.93 (so C1 estimates run slightly long). The real length is measured
// after voicing; per-voice rates if one voice keeps missing the length gate.
export const VOICE_WPS = 3.6;
export const TAIL_EST = 0.25; // seconds after estimated VO ends

// ~155 words per minute plus pauses for punctuation (story format). Storyboards pass VOICE_WPS.
export const estimateSeconds = (vo: string, wps = 2.4) => {
  const words = splitWords(vo);
  const pauses = (vo.match(/[,.!?;:]/g) || []).length;
  return words.length / wps + pauses * 0.1;
};

// Minimum frames a scene needs so its animation finishes and holds for a beat.
export const sceneMinFrames = (s: Scene): number => {
  switch (s.type) {
    case 'hook':
      return 45;
    case 'cta':
      return 75;
    case 'beat':
      return 90;
  }
};

export const voSeconds = (props: ReelProps, i: number) => {
  const measured = props.timing?.durations?.[i];
  return measured ?? estimateSeconds(props.script.scenes[i].vo);
};

export const computeFrames = (props: ReelProps): number[] =>
  props.script.scenes.map((s, i) => {
    const measured = props.timing?.durations?.[i];
    const secs = voSeconds(props, i) + (measured != null ? TAIL_AUDIO : TAIL_EST);
    const byVo = LEAD + Math.ceil(secs * FPS);
    const byMin = s.minSeconds ? Math.ceil(s.minSeconds * FPS) : 0;
    return Math.max(byVo, sceneMinFrames(s), byMin);
  });

// Frames the voice actually occupies inside a scene (used to time captions and word reveals).
export const voSpanFrames = (props: ReelProps, i: number) => Math.max(8, Math.round(voSeconds(props, i) * FPS));

// n cue frames: the given ones first, the missing ones spread evenly after the last given cue (or `from`) up to `to`
export const cuesOr = (cues: number[], n: number, from: number, to: number) => {
  const k = Math.min(cues.length, n);
  const a = k ? Math.max(from, cues[k - 1] + 6) : from;
  const b = Math.max(a, to);
  return Array.from({length: n}, (_, i) => (i < k ? cues[i] : Math.round(a + ((b - a) * (i - k + 0.5)) / (n - k))));
};
