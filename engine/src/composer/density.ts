// Visual density: on the Composer path, no gap longer than 2.5 s with nothing new on screen. Pure data, no React (make.mjs and QA use it).
// What counts as "new": a shot switch, a step or row revealed inside a primitive (the same cue frames the primitives use), a click
// or cursor move, a camera/layout change (the split-flap landing, the maze snapping straight). What does not: karaoke or keyword
// caption words changing, the slow ambient push-in, a host's idle bob. Closing cards (spec.closer) are a deliberate hold and exempt.
// Self-test: node studio/density.test.ts
import {cuesOr, FPS} from '../lib/timing.ts';
import {parseAccent} from '../lib/text.ts';
import {SPECS} from '../primitives/specs.ts';
import {sceneCues, sceneFrames, type Storyboard, type Timing} from './storyboard.ts';

export const MAX_GAP_SECONDS = 2.5;
export const SETTLE = 12; // an event keeps the eye busy for this many frames (0.4 s: an entrance spring settling)
const TYPE_FRAMES = 7; // ui-sheet: frames to type one cell by hand
const CURSOR_FRAMES = 8; // Cursor: frames it travels to a target before the click

type Params = Record<string, unknown>;
const n = (x: unknown) => (Array.isArray(x) ? x.length : 0);

// Motion in a scene, in frames from its start: instants (each lasts SETTLE) and spans of continuous motion [from, to].
export const sceneMotion = (primitive: string, p: Params, dur: number, cues: number[]): {events: number[]; spans: [number, number][]} => {
  const events: number[] = [0]; // the shot switch itself
  const spans: [number, number][] = [];
  const steps = (count: number, from: number, to: number) => cuesOr(cues, count, from, to);
  const manual = p.mode === 'manual';
  switch (primitive) {
    case 'ui-inbox': case 'ui-chat': case 'ui-diff': {
      const at = steps(n(p.rows) || n(p.messages) || n(p.lines), primitive === 'ui-inbox' ? 16 : primitive === 'ui-chat' ? 14 : 10, dur - 16);
      at.forEach((t) => (events.push(t), manual && spans.push([t - CURSOR_FRAMES, t])));
      break;
    }
    case 'ui-sheet': {
      const cols = n(p.columns);
      steps(n(p.rows), 12, dur - 18 - (manual ? cols * TYPE_FRAMES : 0)).forEach((t) => (events.push(t), manual && spans.push([t - CURSOR_FRAMES, t + cols * TYPE_FRAMES])));
      break;
    }
    case 'flow-build': steps(n(p.nodes), 6, Math.max(12, dur * 0.7)).forEach((t) => events.push(t)); break;
    case 'flow-run': steps(n(p.nodes), 10, dur - 20).forEach((t) => (events.push(t), spans.push([t, t + 20]))); break; // data travels the link after each step
    case 'phone-buzz': steps(n(p.notes), 8, dur - 14).forEach((t) => events.push(t)); break;
    case 'stamp-hit': steps(Number(p.count) || 1, 6, dur - 12).forEach((t) => events.push(t)); break;
    case 'zoom-dive': steps(n(p.layers), 6, dur - 12).forEach((t) => (events.push(t), spans.push([t - 12, t]))); break; // the camera dives between landings
    case 'highlighter-swipe': {
      const words = parseAccent(String(p.text ?? ''));
      let k = -1;
      words.forEach((w, i) => w.accent && !words[i - 1]?.accent && k++);
      steps(Math.max(1, k + 1), 12, dur - 10).forEach((t) => events.push(t));
      break;
    }
    case 'word-stack-slam': {
      const words = parseAccent(String(p.text ?? ''));
      words.forEach((_, i) => events.push(8 + i * 3));
      if (cues[0] !== undefined) events.push(cues[0]);
      break;
    }
    case 'before-after-split': (cues.length ? steps(2, 8, dur - 30) : [4, Math.round(dur * 0.45)]).forEach((t) => events.push(t)); break;
    case 'chat-pop': events.push(cues[0] ?? 8); break;
    case 'counter-drop': { const s = cues[0] ?? 14; spans.push([s, Math.max(s + 1, Math.min(s + 45, dur - 10))]); break; } // the number ticks
    case 'split-flap': spans.push([4, Math.min(cues[0] ?? dur - 20, dur - 8)]); break; // tiles flip until the last lands
    case 'maze-to-line': { const snap = cues[0] ?? Math.round(dur * 0.45); spans.push([6, snap + 26]); break; } // the dot crawls, then the tangle snaps and it zips
    case 'pile-drop': spans.push([0, dur]); break; // cards rain for the whole shot, then the pile is buried and shakes
    case 'conveyor': { const s = cues[0] ?? 8; const count = Number(p.count) || 1; const gap = Math.max(2, Math.min(6, Math.floor((dur - s - 24) / count))); spans.push([s, s + (count - 1) * gap + 20]); break; }
    case 'rpg-panel': { const at = steps(n(p.stats), 6, Math.round(dur * 0.45)); at.forEach((t) => events.push(t)); spans.push([at.at(-1)! + 14, at.at(-1)! + 14 + String((p.lines as string[] | undefined)?.join(' ') ?? '').length]); break; } // bars fill, then the line types on twos
    case 'point-cloud': { for (let t = 45; t < dur; t += 45) events.push(t); events.push(cues[0] ?? Math.round(dur * 0.45)); break; } // each scan pass (45 frames), the lock
    case 'line-draw': { const at = steps(n(p.steps), 8, dur - 16); at.forEach((t) => events.push(t)); spans.push([0, at.at(-1)!]); break; } // the pen travels between stops
    case 'intertitle': events.push(8, cues[0] ?? Math.round(dur * 0.4), Math.round(dur * 0.72)); break; // the line, the sub line, the flourish
    default: cues.forEach((t) => events.push(t)); // host-hook, host-payoff: the accent lands and the host reacts
  }
  return {events, spans};
};

// The longest stretch with nothing new, over the whole video, in seconds (and where it starts).
export const longestStill = (sb: Storyboard, t?: Timing): {seconds: number; at: number; scene: number} => {
  const frames = sceneFrames(sb, t);
  const starts = frames.map((_, i) => frames.slice(0, i).reduce((a, b) => a + b, 0));
  const busy: [number, number][] = [];
  sb.scenes.forEach((sc, i) => {
    if (SPECS[sc.primitive]?.closer) return busy.push([starts[i], starts[i] + frames[i]]); // a closing card holds on purpose
    const m = sceneMotion(sc.primitive, sc.params as Params, frames[i], sceneCues(sc, i, t));
    m.events.forEach((e) => busy.push([starts[i] + e, starts[i] + e + SETTLE]));
    m.spans.forEach(([a, b]) => busy.push([starts[i] + Math.max(0, a), starts[i] + b + SETTLE]));
  });
  busy.sort((a, b) => a[0] - b[0]);
  const end = starts.at(-1)! + frames.at(-1)!;
  let reach = 0, worst = {seconds: 0, at: 0, scene: 0};
  const gap = (from: number, to: number) => {
    if ((to - from) / FPS > worst.seconds) worst = {seconds: (to - from) / FPS, at: from, scene: starts.filter((s) => s <= from).length - 1};
  };
  for (const [a, b] of busy) {
    if (a > reach) gap(reach, a);
    reach = Math.max(reach, b);
  }
  gap(reach, end);
  return worst;
};

export const densityIssues = (sb: Storyboard, t?: Timing): string[] => {
  const w = longestStill(sb, t);
  return w.seconds > MAX_GAP_SECONDS
    ? [`density: ${w.seconds.toFixed(1)} s with nothing new on screen from ${(w.at / FPS).toFixed(1)} s (scene ${w.scene + 1}, ${sb.scenes[w.scene]?.primitive}); the limit is ${MAX_GAP_SECONDS} s. Add accent cues, steps or rows, or pick a primitive that keeps moving`]
    : [];
};
