// Script format. Forge writes one JSON file per reel or carousel using these shapes.

export type IconName = string; // lucide icon name in kebab or Pascal case, see src/ui/Icon.tsx

export type Email = {from: string; subject: string; time?: string; tag?: string};
export type ChatMsg = {from: 'me' | 'them'; text: string; time?: string};
export type Step = {label: string; icon?: IconName};
export type FlowNode = {label: string; sub?: string; icon?: IconName};
export type Notif = {app: string; title: string; body?: string; icon?: IconName; color?: string};
export type MathLine = {label: string; value: string};

type SceneBase = {
  vo: string; // what the voice says in this scene (one or two short sentences)
  say?: string; // optional: exact text sent to TTS if pronunciation needs fixing
  kicker?: string; // small label above the visual, UI scenes only
  title?: string; // short headline above the visual, UI scenes only (max 6 words)
  captions?: boolean; // override default caption behaviour
  minSeconds?: number;
};

export type Scene =
  | (SceneBase & {type: 'hook'; text: string; sub?: string})
  | (SceneBase & {type: 'statement'; text: string; sub?: string})
  | (SceneBase & {type: 'inbox'; emails: Email[]; sorted?: boolean; label?: string})
  | (SceneBase & {type: 'sheet'; file?: string; columns: string[]; rows: string[][]; highlight?: number[]; fill?: boolean})
  | (SceneBase & {type: 'chat'; contact: string; status?: string; messages: ChatMsg[]})
  | (SceneBase & {type: 'steps'; steps: Step[]; strike?: boolean})
  | (SceneBase & {type: 'flow'; nodes: FlowNode[]})
  | (SceneBase & {type: 'notify'; items: Notif[]})
  | (SceneBase & {type: 'math'; lines: MathLine[]; total: MathLine; note?: string})
  | (SceneBase & {type: 'myth'; myth: string; reality: string})
  | (SceneBase & {type: 'cta'; text: string; sub?: string})
  | (SceneBase & {type: 'beat'}); // story format: visuals come from the template

// Story template "pile-to-flow": what the pile, counter, 4 automation steps and the sample message say.
export type World = {
  item: {title: string; id: string; start?: number; pill: string; amount?: boolean};
  counter: {label: string; icon: IconName};
  nodes: {label: string; sub: string; icon: IconName}[]; // exactly 4
  message: {app: string; text: string};
  done: string;
};

export type ReelScript = {
  format: 'reel' | 'story';
  id: string;
  template?: string; // story format only: "pile-to-flow"
  world?: Partial<World>; // story format only
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

// ---------- Carousel ----------
export type UIBlock =
  | {kind: 'inbox'; emails: Email[]; sorted?: boolean; label?: string}
  | {kind: 'sheet'; file?: string; columns: string[]; rows: string[][]; highlight?: number[]}
  | {kind: 'chat'; contact: string; status?: string; messages: ChatMsg[]}
  | {kind: 'steps'; steps: Step[]; strike?: boolean}
  | {kind: 'flow'; nodes: FlowNode[]}
  | {kind: 'notify'; items: Notif[]};

export type Slide =
  | {type: 'cover'; text: string; sub?: string}
  | {type: 'point'; n?: number; title: string; body?: string; ui?: UIBlock}
  | {type: 'list'; title: string; items: string[]; body?: string}
  | {type: 'statement'; text: string; sub?: string}
  | {type: 'cta'; text: string; sub?: string; action?: string};

export type CarouselDeck = {
  format: 'carousel';
  id: string;
  title?: string;
  pillar?: string;
  roleFamily?: string;
  slides: Slide[];
  caption?: string;
  hashtags?: string[];
};

export type SlideProps = {deck: CarouselDeck; index: number};
