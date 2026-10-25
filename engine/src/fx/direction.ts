// The direction a Director writes for a format film (storyboard "film": "<format id>", "direction": {...}): the chosen style
// (studio/styles.ts), one shot per voice line, and the music. Pure data, no React: studio/direction.ts validates it.
// Times are words, not seconds: "at": "telegraph" means the moment that word is spoken in the shot's line.

export type At = string; // a word of the shot's voice line
type XY = {x: number; y: number}; // pixels in the 1080 x 1920 frame
export type AmbientShot = {plate: string; push?: number; origin?: string; lamps?: (XY & {r?: number; cone?: number; on?: At})[]; screens?: (XY & {w: number; h: number; pings?: At[]})[]; rain?: number; fog?: number; sunrise?: boolean};
export type WindowsShot = {plate: string; push?: number; origin?: string; windows?: (XY & {photo: string; at: At; w: number; h: number; from?: 'left' | 'right' | 'below'; tilt?: number; pos?: string})[]; sparks?: At}; // pos: CSS object-position, to frame part of a photo
export type DoodleShot = {face?: 'tired' | 'shock' | 'calm' | 'happy' /* left out: from the line's voice.feel (FEEL_FACE) */; from?: number; stickers?: (XY & {src: string; at: At; w: number})[]; icons?: {at: At; count: number}; tick?: At; fly?: At; scribble?: {text: string; at: At}}; // icons stay until a later shot's fly; tick checks them one by one
export type Direction = {
  style: {format: string; look: string; suit: string; hook?: string; structure?: string; cta?: string; series?: string}; // studio/styles.ts
  music?: {caption: string; bpm: number; seed?: number};
  footage?: string; // doodle-footage: the footage plate (public/...)
  shots: (AmbientShot | WindowsShot | DoodleShot)[];
};
// the doodle's face for a line's feel (the Writer's voice direction), unless the shot sets one
export const FEEL_FACE: Record<string, 'tired' | 'shock' | 'calm' | 'happy'> = {frustrated: 'tired', tense: 'tired', curious: 'calm', calm: 'calm', surprised: 'shock', urgent: 'shock', warm: 'happy', wry: 'happy', triumphant: 'happy'};
export const FORMAT_FILMS = ['ambient-scenes', 'memory-windows', 'doodle-footage'] as const; // formats with a renderer

const words = (s: string): string[] => s.replace(/\*/g, '').toLowerCase().match(/[a-z0-9%']+/g) ?? [];
const norm = (w: string) => words(w)[0] ?? '';

// when a word is spoken: the line's voice window split evenly by word (Kokoro reads at an even pace; good to about 0.2 s)
export const wordTime = (beat: {vo: [number, number] | null; start: number; text: string}, at: At) => {
  if (!beat.vo) return beat.start;
  const w = words(beat.text);
  const i = Math.max(0, w.indexOf(norm(at)));
  return beat.vo[0] + (i / Math.max(1, w.length)) * (beat.vo[1] - beat.vo[0]);
};

// what a direction breaks: shapes, words that are not in their line, files that are missing, things outside the frame
export const directionErrors = (doc: {film?: string; scenes: {vo?: string}[]; direction?: Direction}, exists: (publicPath: string) => boolean): string[] => {
  const d = doc.direction;
  if (!d) return ['a format film needs "direction"'];
  const e: string[] = [];
  if (!FORMAT_FILMS.includes(doc.film as never)) e.push(`film "${doc.film}" has no format renderer (${FORMAT_FILMS.join(', ')})`);
  if (d.style?.format !== doc.film) e.push(`direction.style.format (${d.style?.format}) must be the film (${doc.film})`);
  const lines = doc.scenes.filter((s) => s.vo);
  if (d.shots.length !== lines.length) e.push(`direction.shots: ${d.shots.length} shots for ${lines.length} voice lines (one each)`);
  const file = (where: string, p: string | undefined) => {
    if (!p || !exists(p)) e.push(`${where}: file public/${p} is missing`);
  };
  const word = (i: number, where: string, at: At | undefined) => {
    if (at !== undefined && !words(lines[i]?.vo ?? '').includes(norm(at))) e.push(`${where}: "${at}" is not a word of line ${i + 1}`);
  };
  const inFrame = (where: string, o: XY) => {
    if (!(o.x >= 0 && o.x <= 1080 && o.y >= 0 && o.y <= 1920)) e.push(`${where}: (${o.x}, ${o.y}) is outside the 1080 x 1920 frame`);
  };
  if (doc.film === 'doodle-footage') file('direction.footage', d.footage);
  d.shots.forEach((s, i) => {
    const w = `direction.shots[${i}]`;
    if ('plate' in s) file(w, s.plate);
    if ('lamps' in s) s.lamps?.forEach((l, j) => (inFrame(`${w}.lamps[${j}]`, l), word(i, `${w}.lamps[${j}].on`, l.on)));
    if ('screens' in s) s.screens?.forEach((l, j) => (inFrame(`${w}.screens[${j}]`, l), l.pings?.forEach((p) => word(i, `${w}.screens[${j}].pings`, p))));
    if ('windows' in s) s.windows?.forEach((x, j) => (file(`${w}.windows[${j}]`, x.photo), inFrame(`${w}.windows[${j}]`, x), word(i, `${w}.windows[${j}].at`, x.at)));
    if ('sparks' in s) word(i, `${w}.sparks`, s.sparks);
    if (doc.film === 'doodle-footage' && 'face' in s && s.face !== undefined) {
      if (!['tired', 'shock', 'calm', 'happy'].includes(s.face)) e.push(`${w}.face: ${s.face} is not tired, shock, calm or happy`);
      s.stickers?.forEach((x, j) => (file(`${w}.stickers[${j}]`, x.src), inFrame(`${w}.stickers[${j}]`, x), word(i, `${w}.stickers[${j}].at`, x.at)));
      if (s.icons) word(i, `${w}.icons.at`, s.icons.at);
      word(i, `${w}.tick`, s.tick);
      word(i, `${w}.fly`, s.fly);
      if (s.scribble) word(i, `${w}.scribble.at`, s.scribble.at);
    }
  });
  return e;
};
