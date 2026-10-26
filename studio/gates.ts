// The free, deterministic gates a board must pass before any paid call is spent on it (the Critic) and that decide what a repair
// has to fix. Pure: the script gate (studio/script.ts), the visual-density gate (engine/src/composer/density.ts) and the audio-timing
// gate (the re-hook rule on voice length). Self-test: node studio/costguard.test.ts
import {densityIssues} from '../engine/src/composer/density.ts';
import {VOICE_WPS, estimateSeconds} from '../engine/src/lib/timing.ts';
import {rehookIssue, scriptErrors, sentences} from './script.ts';

export type Scene = {primitive: string; vo?: string; params?: unknown; [k: string]: unknown};
export type Board = {id?: string; film?: string; scenes: Scene[]; meta?: Record<string, unknown>; [k: string]: unknown};

export const scriptGate = (b: Board) => scriptErrors(b as never);
// a format film's motion is judged by the temporal QA on its render; the primitive density rule is for Composer boards
export const storyboardDensityGate = (b: Board) => (b.film ? [] : densityIssues(b as never));
// the re-hook rule on voice length: measured clip seconds when the clips exist, the speech-rate estimate until then
export const audioTimingGate = (b: Board, seconds?: (number | null)[]) => {
  const secs = b.scenes.map((s, i) => seconds?.[i] ?? (s.vo ? estimateSeconds(s.vo, VOICE_WPS) : null));
  const e = rehookIssue(b.scenes.map((s) => s.vo), secs);
  return e ? [e] : [];
};
export const freeGates = (b: Board, seconds?: (number | null)[]) => ({script: scriptGate(b), density: storyboardDensityGate(b), audio: audioTimingGate(b, seconds)});
export const gateFailures = (b: Board, seconds?: (number | null)[]) => Object.values(freeGates(b, seconds)).flat();

// Which scene a failing error belongs to, so only that line goes to a repair. Errors about the whole script (turns, proof, devices,
// structure, voice arc) belong to no single line: they are returned as unplaced and need a human.
export type Target = {scene: number; errors: string[]};
export const targetsOf = (b: Board, errors: string[]): {targets: Target[]; unplaced: string[]} => {
  const voiced = b.scenes.map((s, i) => (s.vo?.trim() ? i : -1)).filter((i) => i >= 0);
  const by = new Map<number, string[]>();
  const unplaced: string[] = [];
  const put = (scene: number | undefined, e: string) => (scene === undefined || scene < 0 || scene >= b.scenes.length ? unplaced.push(e) : by.set(scene, [...(by.get(scene) ?? []), e]));
  const owning = (needle: string) => voiced.find((i) => b.scenes[i].vo!.replace(/\*/g, '').includes(needle));
  for (const e of errors) {
    let m: RegExpMatchArray | null;
    if ((m = e.match(/^sentence (\d+):/))) {
      let n = Number(m[1]);
      let hit: number | undefined;
      for (const i of voiced) {
        const k = sentences(b.scenes[i].vo!).length;
        if (n <= k) { hit = i; break; }
        n -= k;
      }
      put(hit, e);
    } else if ((m = e.match(/^line (\d+):/))) put(voiced[Number(m[1]) - 1], e);
    else if (e.startsWith('hook:')) put(voiced[0], e);
    else if (e.startsWith('loop:')) put(voiced.at(-1), e);
    else if ((m = e.match(/^density: .*\(scene (\d+),/))) put(Number(m[1]) - 1, e);
    else if ((m = e.match(/^re-hook: .*up to scene (\d+)\)/))) put(Number(m[1]) - 1, e);
    else if ((m = e.match(/^re-hook: .*near "(.+?)\.\.\."/))) put(owning(m[1]), e);
    else if (e.startsWith('readability:')) {
      // the average is too high: shorten the scene holding the longest sentence
      const longest = voiced.map((i) => [i, Math.max(...sentences(b.scenes[i].vo!).map((s) => s.split(/\s+/).length))] as const).sort((a, c) => c[1] - a[1])[0];
      put(longest?.[0], e);
    } else unplaced.push(e);
  }
  return {targets: [...by].sort((a, c) => a[0] - c[0]).map(([scene, errors]) => ({scene, errors})), unplaced};
};
