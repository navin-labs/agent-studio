import type {ThemeName} from './themes';
// Script format. Forge writes one story JSON per video using these shapes.

export type IconName = string; // lucide icon name in kebab or Pascal case, see src/ui/Icon.tsx


type SceneBase = {
  vo: string; // what the voice says in this scene (one or two short sentences)
  say?: string; // optional: exact text sent to TTS if pronunciation needs fixing
  captions?: boolean; // override default caption behaviour
  minSeconds?: number;
};

export type Scene =
  | (SceneBase & {type: 'hook'; text: string; sub?: string})
  | (SceneBase & {type: 'beat'}) // visuals come from the template
  | (SceneBase & {type: 'cta'; text: string; sub?: string});

// Story template "pile-to-flow": what the pile, counter, 4 automation steps and the sample message say.
export type World = {
  item: {title: string; id: string; start?: number; pill: string; amount?: boolean};
  counter: {label: string; icon: IconName};
  nodes: {label: string; sub: string; icon: IconName}[]; // exactly 4
  message: {app: string; text: string};
  done: string;
};

export type ReelScript = {
  format: 'story';
  id: string;
  template?: string; // "pile-to-flow"
  world?: Partial<World>;
  theme?: ThemeName; // default "paper"
  title?: string;
  pillar?: string;
  roleFamily?: string;
  music?: string; // optional file inside public/music
  sfx?: boolean; // default true
  scenes: Scene[];
  caption?: string;
  hashtags?: string[];
};

export type ReelTiming = {
  durations?: (number | null)[]; // measured VO seconds per scene (set by make.mjs)
  audio?: (string | null)[]; // VO file per scene, relative to public/
  music?: string | null;
};

export type ReelProps = {
  script: ReelScript;
  timing?: ReelTiming;
  frames?: number[]; // filled in by calculateMetadata
};
