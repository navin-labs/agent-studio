import type {ReelProps, Scene} from '../types';
import {splitWords} from './text';

export const FPS = 30;
export const LEAD = 4; // frames of silence before VO starts in each scene
export const TAIL_AUDIO = 0.35; // seconds after measured VO ends
export const TAIL_EST = 0.4; // seconds after estimated VO ends

// ~155 words per minute plus pauses for punctuation.
export const estimateSeconds = (vo: string) => {
  const words = splitWords(vo);
  const pauses = (vo.match(/[,.!?;:]/g) || []).length;
  return words.length / 2.4 + pauses * 0.1;
};

// Minimum frames a scene needs so its animation finishes and holds for a beat.
export const sceneMinFrames = (s: Scene): number => {
  switch (s.type) {
    case 'hook':
    case 'statement':
      return 45;
    case 'inbox':
      return 24 + s.emails.length * 9 + (s.sorted ? 18 + s.emails.length * 6 : 0) + 24;
    case 'sheet':
      return 20 + s.rows.length * (s.fill ? 16 : 6) + (s.highlight?.length ? 12 + s.highlight.length * 8 : 0) + 24;
    case 'chat':
      return 16 + s.messages.reduce((a, m) => a + (m.from === 'them' ? 26 : 14), 0) + 24;
    case 'steps':
      return 16 + s.steps.length * 10 + (s.strike ? 14 + s.steps.length * 6 : 0) + 24;
    case 'flow':
      return 20 + s.nodes.length * 18 + 30;
    case 'notify':
      return 16 + s.items.length * 16 + 30;
    case 'math':
      return 20 + s.lines.length * 12 + 40;
    case 'myth':
      return 80;
    case 'cta':
      return 75;
    case 'beat':
      return 90;
    default:
      return 60;
  }
};

export const TEXT_SCENES = new Set(['hook', 'statement', 'myth', 'cta']);
export const captionsOn = (s: Scene) => s.captions ?? !TEXT_SCENES.has(s.type);

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
