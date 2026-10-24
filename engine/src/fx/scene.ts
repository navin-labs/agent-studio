// The scene a Director writes for an effect-driven film (storyboard "film": "scene", "scene": {...}). Pure data, no React:
// node scripts import it. Each shot names an effect from src/fx/registry.tsx and sits on a voice beat.
export type Cam = {from: [x: number, y: number, zoom: number]; to: [x: number, y: number, zoom: number]};
export type Shot = {
  beat: number; // the storyboard scene (voice line) this shot belongs to
  from?: number; // seconds after the beat starts (default 0)
  to?: number; // seconds after the beat starts (default: the next shot, or the beat's end)
  fx: string; // effect id
  props?: Record<string, unknown>;
  camera?: Cam; // 2D world camera over the 1080x1920 frame; left out: a slow push so no shot sits still
  focal?: string; // the script entity this shot shows (grounding, F6)
};
export type Scene = {look?: {grain?: number}; shots: Shot[]};

// Shot windows in seconds on the film's timeline, from the beats' starts and ends.
export const shotWindows = (shots: Shot[], beats: {start: number; end: number}[]): [number, number][] =>
  shots.map((s, i) => {
    const b = beats[s.beat];
    const a = b.start + (s.from ?? 0);
    const next = shots[i + 1];
    const nextStart = next && next.beat === s.beat ? b.start + (next.from ?? 0) : b.end;
    return [a, s.to != null ? b.start + s.to : nextStart];
  });

export const sceneErrors = (scene: Scene, beats: number): string[] => {
  const e: string[] = [];
  if (!scene.shots.length) e.push('scene: no shots');
  scene.shots.forEach((s, i) => {
    if (!Number.isInteger(s.beat) || s.beat < 0 || s.beat >= beats) e.push(`scene.shots[${i}]: beat ${s.beat} is not a scene of this board (0 to ${beats - 1})`);
    const prev = scene.shots[i - 1];
    if (prev && (prev.beat > s.beat || (prev.beat === s.beat && (prev.from ?? 0) >= (s.from ?? 0)))) e.push(`scene.shots[${i}]: shots must run in time order`);
  });
  for (let b = 0; b < beats; b++) if (!scene.shots.some((s) => s.beat === b)) e.push(`scene: beat ${b} has no shot`);
  return e;
};
