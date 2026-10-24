// The creative brief: the contract between a story and its film, written by the Director before any scene code
// (agents/director/DIRECTOR.md). Prose fields say what the film is; `coords` place it in a small descriptive space so the
// uniqueness rules (studio/creative.ts) can measure how far it is from recent films. Coordinates describe a film after it is
// conceived; they are not presets to pick from. Pure data, no React.

export const COORDS = {
  luminance: ['dark', 'mid', 'bright'],
  temperature: ['warm', 'neutral', 'cool', 'mono'],
  rendering: ['vector-illustration', 'painted', 'sketch', 'engraving', 'typographic', 'geometric', 'diagram', 'paper-craft', 'collage', 'procedural', 'photographic'],
  space: ['flat', 'layered', 'world-space', 'macro', 'isometric', 'single-object'],
  camera: ['locked', 'push-pull', 'tracking', 'scroll', 'handheld', 'cut-based', 'orbit'],
  motion: ['physical', 'elastic', 'mechanical', 'fluid', 'stepped', 'typographic', 'organic'],
  texture: ['clean', 'grain', 'paper', 'ink', 'film', 'halftone', 'watercolour'],
  type: ['serif-editorial', 'grotesk', 'mono-technical', 'typewriter', 'display', 'handwritten', 'condensed', 'minimal'],
  hook: ['macro', 'scale', 'contradiction', 'transformation', 'misdirection', 'mystery', 'silence', 'typographic', 'physical-interaction', 'impossible', 'countdown'],
  sound: ['foley-led', 'music-led', 'silence-led', 'tonal', 'rhythmic'],
} as const;
export type Coords = {[K in keyof typeof COORDS]: (typeof COORDS)[K][number]};

export type Brief = {
  story_core: string; // what the story is really about, one sentence
  emotion: string; // what the viewer should feel, and the turn
  hook: string; // exactly what happens 0 to 3 s, frame 0 included, without big text
  visual_question: string; // what the viewer wonders at 1 s
  metaphor: string; // the single dominant visual metaphor
  world: string; // the visual world the film lives in
  camera: string; // shot and camera language
  motion: string; // the animation language (weight, rhythm, pauses)
  typography: string; // how words appear and what they do
  material: string; // material, light and colour (theme name included)
  transitions: string; // how one beat becomes the next (motivated, never presets)
  sound: string; // foley and silence plan
  music: {caption: string; bpm: number; key?: string; seed?: number}; // ACE-Step cue, instrumental
  payoff: string; // the ending and the one moment people remember
  coords: Coords;
};
