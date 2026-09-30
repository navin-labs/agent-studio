// Storyboard: the Composer's input. A list of primitive shots, each with the vo line shown as captions (and voiced when VOICE=on).
// Pure data + timing + validation, no React, so make.mjs and agent-studio QA can use it.
import {parseAccent, wordStarts} from '../lib/text.ts';
import {estimateSeconds, FPS, LEAD, TAIL_AUDIO, TAIL_EST, VOICE_WPS} from '../lib/timing.ts';
import {SPECS, validateParams} from '../primitives/specs.ts';
import {THEMES, type ThemeName} from '../themes.ts';

export const TRANSITIONS = ['cut', 'whip-pan', 'ink-wipe', 'pixel-wipe'] as const;
export type Transition = (typeof TRANSITIONS)[number];
export const TRANSITION_FRAMES = 12;

export type StoryboardScene = {
  primitive: string;
  params: Record<string, unknown>;
  vo?: string; // caption line; *accent* runs become the primitive's cue frames
  say?: string; // exact TTS text if pronunciation needs fixing
  transition?: Transition; // how this scene enters (default cut)
  captions?: boolean; // default: on, except kinetic-type shots (they already show the words)
};

export const HOST_NAMES = ['chiku', 'bahi', 'tikku'] as const;
export const CAPTION_STYLES = ['keywords', 'karaoke'] as const;

export type Storyboard = {
  format: 'storyboard';
  id: string;
  theme?: ThemeName;
  host?: (typeof HOST_NAMES)[number]; // the channel's mascot, used by host-format shots (default chiku)
  captionStyle?: (typeof CAPTION_STYLES)[number]; // keywords (default) or karaoke (host format: captions always on)
  hookPattern?: string;
  sfx?: boolean;
  scenes: StoryboardScene[];
  caption?: string;
  hashtags?: string[];
  meta?: {source?: string; idea_id?: string; recipe_id?: string};
};

export type Timing = {durations?: (number | null)[]; audio?: (string | null)[]};

const voSecs = (sc: StoryboardScene, i: number, t?: Timing) => t?.durations?.[i] ?? (sc.vo ? estimateSeconds(sc.vo, VOICE_WPS) : 0);

// Frames per scene: long enough for the vo, within the primitive's min/max. Measured voice is never cut.
export const sceneFrames = (sb: Storyboard, t?: Timing): number[] =>
  sb.scenes.map((sc, i) => {
    const [lo, hi] = SPECS[sc.primitive].seconds;
    const measured = t?.durations?.[i] != null;
    const byVo = sc.vo ? LEAD + Math.ceil((voSecs(sc, i, t) + (measured ? TAIL_AUDIO : TAIL_EST)) * FPS) : Math.round(((lo + hi) / 2) * FPS);
    return Math.max(Math.round(lo * FPS), measured ? byVo : Math.min(byVo, Math.round(hi * FPS)));
  });

// Start frame of each vo word, relative to the scene.
export const voWordStarts = (sc: StoryboardScene, i: number, t?: Timing) =>
  sc.vo ? wordStarts(sc.vo, LEAD, Math.max(8, Math.round(voSecs(sc, i, t) * FPS))) : [];

// Cue frames = where each *accent* run starts in the vo.
export const sceneCues = (sc: StoryboardScene, i: number, t?: Timing) => {
  if (!sc.vo) return [];
  const starts = voWordStarts(sc, i, t);
  const acc = parseAccent(sc.vo).map((w) => w.accent);
  return acc.flatMap((a, j) => (a && !acc[j - 1] ? [starts[j]] : []));
};

// Settled frames the TextProbe measures: every 5th frame of each scene, skipping frames inside a transition, plus its last frame.
export const probeFrames = (sb: Storyboard, frames: number[], starts: number[]) =>
  new Set(
    sb.scenes.flatMap((sc, i) => {
      const from = starts[i] + ((sc.transition ?? 'cut') === 'cut' ? 0 : TRANSITION_FRAMES) + 2;
      const to = starts[i] + frames[i] - 1;
      return [...Array.from({length: Math.max(0, Math.floor((to - from) / 5) + 1)}, (_, k) => from + k * 5), to];
    }),
  );

export const captionsOn = (sc: StoryboardScene, sb?: Storyboard) =>
  sc.captions ?? (SPECS[sc.primitive]?.captions !== false && (sb?.captionStyle === 'karaoke' || SPECS[sc.primitive]?.family !== 'kinetic-type'));

// Engine-level checks. Channel rules (CTA mix, hook patterns) live in the channel RULEBOOK and agent-studio QA.
export const validateStoryboard = (sb: Storyboard): {errors: string[]; warnings: string[]} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (sb.theme !== undefined && !THEMES[sb.theme]) errors.push(`unknown theme "${sb.theme}" (use one of: ${Object.keys(THEMES).join(', ')})`);
  if (sb.host !== undefined && !HOST_NAMES.includes(sb.host)) errors.push(`unknown host "${sb.host}" (use one of: ${HOST_NAMES.join(', ')})`);
  if (sb.captionStyle !== undefined && !CAPTION_STYLES.includes(sb.captionStyle)) errors.push(`captionStyle must be one of: ${CAPTION_STYLES.join(', ')}`);
  const sc = Array.isArray(sb.scenes) ? sb.scenes : [];
  if (sc.length < 3 || sc.length > 12) errors.push(`storyboard needs 3 to 12 scenes, got ${sc.length}`);
  sc.forEach((s, i) => {
    const w = `scene ${i + 1} (${s.primitive})`;
    const spec = SPECS[s.primitive];
    if (!spec) return void errors.push(...validateParams(s.primitive, s.params).map((e) => `${w}: ${e}`));
    errors.push(...validateParams(s.primitive, s.params).map((e) => `${w}: ${e}`));
    if (s.transition !== undefined && !TRANSITIONS.includes(s.transition)) errors.push(`${w}: transition must be one of ${TRANSITIONS.join(', ')}`);
    if (i === 0 && s.transition && s.transition !== 'cut') errors.push(`${w}: the first scene cannot have a transition`);
    if (s.vo !== undefined && (typeof s.vo !== 'string' || !s.vo.trim())) errors.push(`${w}: vo must be non-empty text or left out`);
    if (s.vo && estimateSeconds(s.vo, VOICE_WPS) + TAIL_EST > spec.seconds[1]) errors.push(`${w}: vo needs about ${estimateSeconds(s.vo, VOICE_WPS).toFixed(1)}s but ${s.primitive} lasts at most ${spec.seconds[1]}s; shorten it`);
  });
  const closers = Object.keys(SPECS).filter((k) => SPECS[k].closer);
  if (!SPECS[sc.at(-1)?.primitive ?? '']?.closer) errors.push(`last scene must be a closing card (${closers.join(' or ')})`);
  if (errors.length) return {errors, warnings};
  const secs = sceneFrames(sb).reduce((a, b) => a + b, 0) / FPS;
  if (secs < 20 || secs > 45) warnings.push(`estimated length ${secs.toFixed(1)}s, QA expects 20 to 45s`);
  return {errors, warnings};
};
