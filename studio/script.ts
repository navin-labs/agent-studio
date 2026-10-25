// Script craft (docs/CREATIVE_BIBLE.md section 13): the words must earn every second. A board declares the storytelling devices
// it uses in meta.devices and its one hard fact in meta.proof; these rules check the voice lines in code. Pure; QA runs it as
// the "script" check, and the Writer runs it before saving. Self-test: node studio/script.test.ts
//   node studio/script.ts <board.json>    prints "ok" or each rule the script breaks
import fs from 'node:fs';

export const DEVICES = ['novelty', 'open-loop', 'reveal', 'contrast', 'proof', 'stakes', 'urgency', 'number', 'second-person', 'pattern-interrupt', 'callback', 'loop', 'failed-attempt'] as const;
export type Device = (typeof DEVICES)[number];
type Board = {scenes: {vo?: string; voice?: {feel: string; pace?: string; hold?: number}}[]; meta?: {devices?: string[]; proof?: {fact: string; source: string}; structure?: string; cta?: string; hook_image?: string; payoff_image?: string}};
// the shape of the story and its call to action; both rotate (studio/styles.ts) so consecutive films are built differently
// no countdown or list: lists lose (docs/research/2026-10-25-forge-faceless-reels.md: 0 of the top 15, 2 of the low 5)
export const STRUCTURES = ['story', 'essay', 'teardown', 'before-after', 'myth-bust', 'gag'] as const;
export const CTAS = ['none', 'question', 'save', 'comment-keyword', 'follow-series'] as const;
// the voice direction (scene.voice): the feels a hook may open on, and whether every channel board must carry it
export const HOOK_FEELS = ['curious', 'tense', 'frustrated', 'surprised', 'wry', 'urgent'];
// the voice tags and the two images become required for every channel board once the w44 boards (written before them) are out
export const REQUIRE_NEXT = false; // ponytail: flip to true after w44
// what kind of gap the first line opens: a question, a number, a contradiction, a "you" claim, or a scene
export const hookType = (hook: string) =>
  /\?/.test(hook) ? 'question' : /\d/.test(hook) ? 'number' : /\b(never|nobody|no one|wrong|actually|without|stop|nothing|until|secret|not)\b/i.test(hook) ? 'contradiction' : /\byou\b/i.test(hook) ? 'you' : 'scene';

const words = (s: string) => s.replace(/\*/g, '').toLowerCase().match(/[a-z0-9']+/g) ?? [];
const STOP = new Set('this that with from your they them their there were what when then into have just only about been than over every each also very will would could should these those which while because after before'.split(' '));
const GREETING = /^(hey|hi|hello|welcome|so,? today|today (we|i)|in this video|let'?s)\b/i;
const HOOK_TRIGGER = /\?|\d|\b(never|nobody|no one|actually|wrong|secret|without|stop|nothing|everyone|you've|you have|why|how|what if|until)\b/i;
const TURN = /\b(but|instead|actually|so|until|yet|except|turns out|therefore)\b/gi;
const CONTRAST = /\b(then|now|before|after|vs|versus|instead|tiny|huge|small|big|manual|automatic|old|new|once|today|never|always)\b/i;
const BANNED = [/\bin this video\b/i, /\bdon'?t forget\b/i, /\bsmash\b/i, /\blet'?s dive\b/i, /\bgame[- ]changer\b/i, /\bhey guys\b/i, /^\s*(and )?then\b/i];
// the devices every script needs: a reason to stay (novelty or an open loop), a new reveal, a contrast, sourced proof,
// stakes or urgency, and a loop back to the start
const REQUIRED: (Device | Device[])[] = [['novelty', 'open-loop'], 'reveal', 'contrast', 'proof', ['stakes', 'urgency'], 'loop'];

export const scriptErrors = (doc: Board): string[] => {
  const lines = doc.scenes.map((s) => s.vo ?? '').filter((v) => v.trim());
  if (!lines.length) return []; // a board with no voice is judged by its on-screen text elsewhere
  const e: string[] = [];
  const hook = lines[0].replace(/\*/g, '');
  const hw = words(hook);
  if (hw.length > 12) e.push(`hook: ${hw.length} words, keep it to 12 or fewer ("${hook}")`);
  if (GREETING.test(hook)) e.push(`hook: opens with a greeting or a topic label ("${hook}"); open on a violated expectation, a puzzle or a claim`);
  if (doc.meta && !STRUCTURES.includes(doc.meta.structure as never)) e.push(`structure: meta.structure must be one of ${STRUCTURES.join(', ')}`);
  if (doc.meta && !CTAS.includes(doc.meta.cta as never)) e.push(`cta: meta.cta must be one of ${CTAS.join(', ')}`);
  // how it is said: an arc of feelings, a hook that opens a gap, silences that are earned
  const voiced = doc.scenes.filter((s) => s.vo);
  const tagged = voiced.filter((s) => s.voice?.feel);
  if (tagged.length || (REQUIRE_NEXT && doc.meta)) {
    if (tagged.length < voiced.length) e.push(`voice: ${voiced.length - tagged.length} line(s) have no voice.feel; give every line its feel`);
    if (new Set(tagged.map((s) => s.voice!.feel)).size < 3) e.push('voice: fewer than 3 different feels; the voice needs an arc (e.g. curious, tense, surprised, warm)');
    if (voiced[0]?.voice?.feel && !HOOK_FEELS.includes(voiced[0].voice.feel)) e.push(`voice: the hook is ${voiced[0].voice.feel}; open on ${HOOK_FEELS.join(', ')}`);
    if (voiced.filter((s) => s.voice?.hold).length > 2) e.push('voice: more than 2 held silences; keep holds for the reveal');
  }
  // a scene hook (one concrete opening image) wins most often; it counts when the Writer names that image for the Director
  const img = (s?: string) => (s ?? '').trim().split(/\s+/).filter(Boolean).length >= 4;
  if (!HOOK_TRIGGER.test(hook) && !img(doc.meta?.hook_image)) e.push(`hook: no question, number or contradiction ("${hook}"), and no meta.hook_image naming the opening scene; make the viewer notice a gap or open on one concrete image`);
  if (doc.meta && (REQUIRE_NEXT || doc.meta.hook_image || doc.meta.payoff_image)) {
    if (!img(doc.meta.hook_image)) e.push('hook_image: meta.hook_image names the first frame in at least 4 words (one concrete scene: who or what, doing what, where)');
    if (!img(doc.meta.payoff_image)) e.push('payoff_image: meta.payoff_image names the closing picture in at least 4 words (end on an image, not a summary line)');
  }
  const all = lines.join(' ');
  const turns = all.match(TURN)?.length ?? 0;
  if (turns < 2) e.push(`turns: ${turns} turn word (but, instead, actually, so, until); every beat should turn the story, aim for 2 or more`);
  if (!/\d/.test(all) && !/\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|nineteen|twenty)\b/i.test(all)) e.push('specificity: no number or date in the voice lines; say one hard, specific fact');
  if (!CONTRAST.test(all)) e.push('contrast: no contrast frame (then/now, before/after, tiny/huge, manual/automatic)');
  lines.forEach((l, i) => {
    if (words(l).length > 22) e.push(`line ${i + 1}: ${words(l).length} words; one idea per line, 22 words at most`);
    for (const b of BANNED) if (b.test(l)) e.push(`line ${i + 1}: "${l.match(b)![0].trim()}" is a flat or banned phrase`);
  });
  // the loop: the last spoken line hands back to the first (they share a content word)
  const key = (s: string) => new Set(words(s).filter((w) => w.length >= 4 && !STOP.has(w)));
  const first = key(lines[0]);
  if (lines.length > 1 && ![...key(lines.at(-1)!)].some((w) => first.has(w) || first.has(w.replace(/s$/, '')) || first.has(`${w}s`))) e.push('loop: the last line shares no key word with the hook; end on a line that hands back to the start');
  const d = new Set(doc.meta?.devices ?? []);
  for (const x of doc.meta?.devices ?? []) if (!(DEVICES as readonly string[]).includes(x)) e.push(`devices: "${x}" is not a known device (${DEVICES.join(', ')})`);
  for (const r of REQUIRED) {
    const any = Array.isArray(r) ? r : [r];
    if (!any.some((x) => d.has(x))) e.push(`devices: declare ${any.join(' or ')} in meta.devices (and write it into the lines)`);
  }
  const p = doc.meta?.proof;
  if (!p?.fact || !p?.source) e.push('proof: meta.proof needs {fact, source}: one hard fact shown on screen, with where it comes from');
  else if (!/^https?:\/\//.test(p.source)) e.push(`proof: source "${p.source}" is not a link`);
  return e;
};

if (process.argv[1] === import.meta.filename) {
  const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const e = scriptErrors(doc);
  console.log(e.length ? e.map((x) => `FAIL ${x}`).join('\n') : 'ok');
  process.exit(e.length ? 1 : 0);
}
