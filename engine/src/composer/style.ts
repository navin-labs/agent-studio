// Style presets (docs/MOTION.md "Presets"): a channel's look and motion as data in styles/<id>.json, chosen per channel with one
// setting (channel.json "style"). The engine only knows the building blocks below; a new style is a new file, not new code.
// make.mjs loads the preset and hands it to the Composer as `preset` (render time, like the handle).

export const OPENERS = ['none', 'arrow-fold', 'year-flap'] as const; // the first 0.6 s of every video
export const OVERLAYS = ['none', 'thread', 'thread-paper'] as const; // drawn over the whole video (thread: in the reveal colour)

// Camera move per shot role, as a fraction of zoom: positive pushes in over the shot (eased in and out), negative starts
// pushed in and pulls out (eased out, done by 60% of the shot), 0 holds still. Left out: the legacy slow drift.
export type Camera = {pain: number; result: number; other: number};

export type StylePreset = {
  id: string;
  channel: string;
  version: number;
  about: string;
  expect?: string; // what this version should improve (shown with a Tier 2 proposal)
  theme: string;
  transitions: string[]; // what Recipe draws scene transitions from
  opener: (typeof OPENERS)[number];
  overlay: (typeof OVERLAYS)[number];
  camera?: Camera;
  strike: boolean; // before-after-split: strike through the manual steps, one pulse of `ok` on the automatic half
};

// A storyboard rendered without a preset (stills, old tests) looks exactly as before presets existed.
export const NO_STYLE: Pick<StylePreset, 'opener' | 'overlay' | 'camera' | 'strike'> = {opener: 'none', overlay: 'none', strike: false};
