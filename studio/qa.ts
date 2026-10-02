// QA: the last gate before Navin sees a video. Deterministic, no vision model, no --force. Every failed check carries the exact
// error that goes back to Forge. evaluate() is pure (unit-tested in qa.test.ts); runQa() gathers the facts from disk.
//
// node studio/qa.ts <storyboard.json> [--out <render dir>] [--date YYYY-MM-DD] [--recipes <dir>]
//   reads <render dir> (default engine/out/<id>/): reel.mp4, text-boxes.json, contact.png; writes qa.json there. Exit 1 on fail.
import fs from 'node:fs';
import path from 'node:path';
import {lengthIssue, type Storyboard, validateStoryboard} from '../engine/src/composer/storyboard.ts';
import type {TextBox} from '../engine/src/composer/textcheck.ts';
import {type Probe, probeVideo} from '../engine/scripts/probe.ts';
import {loadSchema, validate} from '../schemas/validate.ts';
import {readFingerprints} from './ledger.ts';
import {checkNovelty, type Fingerprint} from './novelty.ts';
import {type Recipe, recipeDate, recipeHash} from './recipe.ts';

export const CHECKS = ['schema', 'text-limits', 'audio', 'format', 'duration', 'safe-zones', 'fingerprint', 'naming'] as const;
export type Check = {name: (typeof CHECKS)[number]; pass: boolean; error?: string};
export type QaResult = {storyboard_id: string; pass: boolean; checks: Check[]; video_path: string; contact_sheet_path: string};
type TextIssue = {level: 'error' | 'warning'; scene: number; primitive: string; text: string; problem: string};

export type QaInputs = {
  doc: Storyboard & {channel?: string};
  file: string; // storyboard file name
  outDir: string;
  probe: Probe | null; // null = no video file
  textBoxes: {measured: number; issues: TextIssue[]} | null;
  sheet: boolean;
  recipe: Recipe | null;
  date: string;
  history: Fingerprint[]; // approved / published videos
  themes?: number; // how many themes the channel renders in (1: the theme-run rule is off)
};

const first = (s = '', re: RegExp) => s.split(re)[0].trim();
export const storyboardFingerprint = (doc: QaInputs['doc'], date: string): Fingerprint => {
  const primitives = doc.scenes.map((s) => s.primitive);
  return {
    id: doc.id,
    channel: doc.channel ?? '',
    date,
    primitives,
    opening: primitives[0],
    theme: doc.theme ?? 'paper',
    hook_pattern: doc.hookPattern ?? '',
    topic_text: first(doc.caption, /\n\s*\n/),
    caption_opener: first(doc.caption, /(?<=[.!?])\s/),
    hero_metaphor: doc.meta?.hero_metaphor,
    hash: recipeHash(doc.theme ?? 'paper', primitives, doc.hookPattern ?? ''),
  };
};

export const evaluate = (x: QaInputs): QaResult => {
  const checks: Check[] = [];
  const add = (name: Check['name'], errors: string[]) => checks.push(errors.length ? {name, pass: false, error: errors.join('; ')} : {name, pass: true});
  const p = x.probe;

  add('schema', validate(loadSchema('storyboard'), x.doc));
  add('text-limits', validateStoryboard(x.doc).errors);
  add('audio', !p ? ['no video file'] : p.audio ? [] : ['the video has no audio stream']);
  add('format', !p ? ['no video file'] : [
    ...(p.container === 'mp4' ? [] : [`container is ${p.container}, needs mp4`]),
    ...(p.width === 1080 && p.height === 1920 ? [] : [`frame is ${p.width}x${p.height}, needs 1080x1920`]),
    ...(Math.abs(p.fps - 30) < 0.01 ? [] : [`${p.fps.toFixed(2)} fps, needs 30`]),
  ]);
  const long = p ? lengthIssue(x.doc, p.seconds) : 'no video file';
  add('duration', long ? [long] : []);
  add('safe-zones', !x.textBoxes ? ['no text-boxes.json: the render did not measure text'] : !x.textBoxes.measured ? ['text boxes measured on 0 frames'] :
    x.textBoxes.issues.filter((i) => i.level === 'error').map((i) => `scene ${i.scene + 1} (${i.primitive}) "${i.text}": ${i.problem}`));

  const fp = storyboardFingerprint(x.doc, x.date);
  const recipeErrors: string[] = [];
  if (!x.recipe) recipeErrors.push(`recipe ${x.doc.meta?.recipe_id ?? '(none)'} not found in recipes/`);
  else {
    const r = x.recipe;
    const tr = x.doc.scenes.map((s) => s.transition ?? 'cut');
    if (r.primitives.join('>') !== fp.primitives.join('>')) recipeErrors.push(`shots differ from recipe ${r.id}: ${fp.primitives.join(' > ')} vs ${r.primitives.join(' > ')}`);
    if (r.theme !== fp.theme) recipeErrors.push(`theme ${fp.theme} differs from recipe ${r.id} (${r.theme})`);
    if (r.hook_pattern !== fp.hook_pattern) recipeErrors.push(`hook pattern ${fp.hook_pattern} differs from recipe ${r.id} (${r.hook_pattern})`);
    if (r.transitions.join('>') !== tr.join('>')) recipeErrors.push(`transitions differ from recipe ${r.id}: ${tr.join(' > ')} vs ${r.transitions.join(' > ')}`);
  }
  add('fingerprint', [...recipeErrors, ...checkNovelty(fp, x.history.filter((h) => h.id !== fp.id), {themes: x.themes}).map((v) => `${v.rule}: ${v.error}`)]);

  add('naming', [
    ...(x.file === `${x.doc.id}.json` ? [] : [`file is ${x.file}, must be ${x.doc.id}.json`]),
    ...(path.basename(x.outDir) === x.doc.id ? [] : [`render folder is ${path.basename(x.outDir)}, must be ${x.doc.id}`]),
    ...(x.sheet ? [] : ['no contact.png next to the video']),
  ]);

  return {storyboard_id: x.doc.id, pass: checks.every((c) => c.pass), checks, video_path: path.join(x.outDir, 'reel.mp4'), contact_sheet_path: path.join(x.outDir, 'contact.png')};
};

const ROOT = path.join(import.meta.dirname, '..');
const readJson = (f: string) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const allRecipes = (dir: string): Recipe[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {recursive: true, encoding: 'utf8'}).filter((f) => f.endsWith('.json')).flatMap((f) => readJson(path.join(dir, f)) as Recipe[]);
};

export const runQa = async (boardPath: string, opts: {outDir?: string; date?: string; recipes?: string} = {}): Promise<QaResult> => {
  const doc = readJson(boardPath);
  const outDir = path.resolve(opts.outDir ?? path.join(ROOT, 'engine/out', String(doc.id)));
  const video = path.join(outDir, 'reel.mp4');
  const recipe = allRecipes(path.resolve(opts.recipes ?? path.join(ROOT, 'recipes'))).find((r) => r.id === doc.meta?.recipe_id) ?? null;
  const result = evaluate({
    doc,
    file: path.basename(boardPath),
    outDir,
    probe: fs.existsSync(video) ? await probeVideo(video) : null,
    textBoxes: readJson(path.join(outDir, 'text-boxes.json')),
    sheet: fs.existsSync(path.join(outDir, 'contact.png')),
    recipe,
    date: opts.date ?? (recipe ? recipeDate(recipe) : new Date().toISOString().slice(0, 10)),
    history: readFingerprints(), // approved videos, appended by ledger.ts on approval
    themes: readJson(path.join(ROOT, 'channels', String(doc.channel), 'channel.json'))?.themes?.length,
  });
  const rel = (f: string) => path.relative(ROOT, f);
  const out = {...result, video_path: rel(result.video_path), contact_sheet_path: rel(result.contact_sheet_path)};
  const bad = validate(loadSchema('qa'), out);
  if (bad.length) throw new Error(`qa result breaks qa.schema.json: ${bad.join('; ')}`);
  if (fs.existsSync(outDir)) fs.writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(out, null, 2) + '\n');
  return out;
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const board = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!board) {
    console.error('usage: node studio/qa.ts <storyboard.json> [--out <render dir>] [--date YYYY-MM-DD] [--recipes <dir>]');
    process.exit(2);
  }
  const r = await runQa(board, {outDir: opt('--out'), date: opt('--date'), recipes: opt('--recipes')});
  for (const c of r.checks) console.log(`${c.pass ? 'pass' : 'FAIL'} ${c.name.padEnd(12)}${c.error ? c.error : ''}`);
  console.log(r.pass ? `QA passed: ${r.storyboard_id}` : `QA failed: ${r.storyboard_id} (errors above go back to Forge)`);
  process.exit(r.pass ? 0 : 1);
}
