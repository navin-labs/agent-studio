// Which visual world each format style wears on its composite scenes (composer/worlds.tsx). Pure data: the router reads it
// to keep two videos in a row from sharing a world, the Composer to draw it.
export const WORLD_IDS = ['clean', 'papercut', 'blueprint', 'newsreel', 'halftone', 'comic', 'scrapbook', 'inkwash', 'watercolor', 'crayon', 'impasto'] as const;
export type WorldId = (typeof WORLD_IDS)[number];
export const WORLD_OF: Record<string, WorldId> = {
  'terminal-dark': 'comic', hud: 'blueprint', investigation: 'scrapbook', 'orbit-intel': 'blueprint', 'ops-board': 'comic', blueprint: 'blueprint',
  'dark-keynote': 'clean', 'sixties-titles': 'halftone', newsreel: 'newsreel', 'light-table': 'scrapbook', engraving: 'inkwash', woodcut: 'inkwash',
  constructivist: 'halftone', 'art-deco': 'papercut', 'data-story': 'clean', countdown: 'comic', 'swiss-motion': 'clean', 'headline-bar': 'newsreel',
  'news-desk': 'newsreel', pictogram: 'crayon', isometric: 'blueprint', risograph: 'halftone', screenprint: 'impasto', halftone: 'halftone',
  'paper-cut': 'papercut', 'game-show': 'comic', whiteboard: 'watercolor', 'line-draw': 'blueprint', telestrator: 'scrapbook',
};
export const worldOf = (style?: string): WorldId => WORLD_OF[style ?? ''] ?? 'clean';
