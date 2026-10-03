// Scene-level retention (concept from darkzOGx/youtube-automation-agent, MIT; code ours). YouTube's retention curve (share of
// viewers still watching at evenly spaced points) is mapped onto the scene spans in the YouTube variant's render.json. A scene's
// hold is the share of viewers present at its start who are still there at its end. Holds are compared with the channel's average hold at
// the same scene position (openers always lose most on Shorts), so a primitive is judged against the slot it played in.
// Self-test: node studio/learn.test.ts
export type Span = {primitive: string; start: number; end: number};
export type SceneHold = {primitive: string; index: number; hold: number};

// curve[i] = watch ratio at (i + 1) / curve.length of the video. Sparse or broken curves give nothing (never a fake reading).
export const sceneHolds = (curve: number[], scenes: Span[]): SceneHold[] => {
  const total = scenes.at(-1)?.end ?? 0;
  if (curve.length < 20 || !total || curve.some((x) => !(x >= 0))) return [];
  const at = (t: number) => (t <= 0 ? Math.max(curve[0], 1) : curve[Math.min(curve.length - 1, Math.max(0, Math.round((t / total) * curve.length) - 1))]);
  return scenes.map((s, index) => ({primitive: s.primitive, index, hold: at(s.start) > 0 ? at(s.end) / at(s.start) : 0}));
};

// Per primitive: mean hold relative to the channel's mean at that position (1 = average, below 1 loses viewers there).
export const relativeHolds = (videos: SceneHold[][]) => {
  const pos = new Map<number, number[]>();
  for (const v of videos) for (const s of v) pos.set(s.index, [...(pos.get(s.index) ?? []), s.hold]);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const base = new Map([...pos].map(([i, xs]) => [i, mean(xs)]));
  const by = new Map<string, {rel: number[]; videos: number}>();
  videos.forEach((v) => {
    for (const p of new Set(v.map((s) => s.primitive))) by.set(p, {rel: by.get(p)?.rel ?? [], videos: (by.get(p)?.videos ?? 0) + 1});
    for (const s of v) if (base.get(s.index)! > 0) by.get(s.primitive)!.rel.push(s.hold / base.get(s.index)!);
  });
  return [...by].map(([primitive, x]) => ({primitive, rel: mean(x.rel), n: x.videos})).sort((a, b) => b.rel - a.rel);
};
