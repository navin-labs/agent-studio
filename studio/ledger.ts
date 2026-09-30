// Ledger: one JSON line per status change in state/ledger.jsonl (latest line per video wins). Dispatch acts only on "approved".
// Approvals arrive as signed links from the weekly page (approval-page.ts). n8n only relays the link's query string here, so it
// cannot forge or widen an approval: the HMAC covers channel, week, ids, approver and expiry. The secret is read from the
// environment (APPROVAL_SECRET), never from code or docs.
//
// node studio/ledger.ts apply '<query string or full approve URL>'   verify + write approved entries (what the n8n webhook runs)
// node studio/ledger.ts status [id]                                   current status per video
import {createHmac, timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import type {Fingerprint} from './novelty.ts';
import {type Recipe, recipeDate} from './recipe.ts';

const ROOT = path.join(import.meta.dirname, '..');
export type Paths = {state: string; content: string[]; out: string; recipes: string; channels: string};
export const PATHS: Paths = {
  state: process.env.STUDIO_STATE ?? path.join(ROOT, 'state'),
  content: [path.join(ROOT, 'content'), path.join(ROOT, 'engine/content/storyboards')], // Writer output, then the engine's own boards
  out: path.join(ROOT, 'engine/out'),
  recipes: path.join(ROOT, 'recipes'),
  channels: path.join(ROOT, 'channels'),
};

export type LedgerEntry = {storyboard_id: string; channel: string; status: string; approved_by?: string; approved_at?: string; targets?: string[]; updated_at: string};
const readLines = <T,>(f: string): T[] => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : []);
const append = (f: string, rows: unknown[]) => {
  fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.appendFileSync(f, rows.map((r) => JSON.stringify(r) + '\n').join(''));
};
export const ledgerFile = (p = PATHS) => path.join(p.state, 'ledger.jsonl');
export const fingerprintFile = (p = PATHS) => path.join(p.state, 'fingerprints.jsonl');
export const currentStatus = (p = PATHS) => new Map(readLines<LedgerEntry>(ledgerFile(p)).map((e) => [e.storyboard_id, e]));
export const readFingerprints = (p = PATHS) => readLines<Fingerprint>(fingerprintFile(p));

// ---- signed approvals ----
export type Approval = {channel: string; week: string; ids: string[]; by: string; exp: number};
const payload = (a: Approval) => ['approve', a.channel, a.week, a.ids.join(','), a.by, a.exp].join('|');
export const sign = (a: Approval, secret: string) => createHmac('sha256', secret).update(payload(a)).digest('hex');
export const approvalQuery = (a: Approval, secret: string) =>
  new URLSearchParams({channel: a.channel, week: a.week, ids: a.ids.join(','), by: a.by, exp: String(a.exp), sig: sign(a, secret)}).toString();

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
// Untrusted input: parse strictly, then check the signature before touching any file.
export const verifyApproval = (raw: string, secret: string, now = Date.now()): Approval => {
  if (!secret || secret.length < 16) throw new Error('APPROVAL_SECRET is missing or shorter than 16 characters');
  const q = new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw);
  const a: Approval = {channel: q.get('channel') ?? '', week: q.get('week') ?? '', ids: (q.get('ids') ?? '').split(',').filter(Boolean), by: q.get('by') ?? '', exp: Number(q.get('exp'))};
  if (!ID.test(a.channel) || !/^\d{4}-W\d{2}$/.test(a.week) || !a.ids.length || a.ids.length > 14 || !a.ids.every((i) => ID.test(i)) || !/^[a-z]{1,20}$/.test(a.by) || !Number.isInteger(a.exp))
    throw new Error('approval link is malformed');
  const got = Buffer.from(q.get('sig') ?? '', 'hex');
  const want = Buffer.from(sign(a, secret), 'hex');
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new Error('approval signature does not match');
  if (now > a.exp * 1000) throw new Error(`approval link expired at ${new Date(a.exp * 1000).toISOString()}`);
  return a;
};

// ---- finding a video by id (naming convention: <id>.json, out/<id>/) ----
export type Video = {id: string; doc: any; qa: {pass: boolean; checks: {name: string; pass: boolean; error?: string}[]} | null; recipe: Recipe | null; outDir: string};
const readJson = (f: string) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
export const allRecipes = (p = PATHS): Recipe[] =>
  fs.existsSync(p.recipes) ? fs.readdirSync(p.recipes, {recursive: true, encoding: 'utf8'}).filter((f) => f.endsWith('.json')).flatMap((f) => readJson(path.join(p.recipes, f)) as Recipe[]) : [];
export const weekRecipes = (channel: string, week: string, p = PATHS) => allRecipes(p).filter((r) => r.channel === channel && r.week === week).sort((a, b) => a.slot - b.slot);
export const findVideo = (id: string, p = PATHS): Video | null => {
  const file = p.content.flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d, {recursive: true, encoding: 'utf8'}).map((f) => path.join(d, f)) : [])).find((f) => path.basename(f) === `${id}.json`);
  if (!file) return null;
  const doc = readJson(file);
  const recipeId = doc.meta?.recipe_id;
  const recipe = allRecipes(p).find((r) => r.id === recipeId) ?? null;
  const outDir = path.join(p.out, id);
  return {id, doc, qa: readJson(path.join(outDir, 'qa.json')), recipe, outDir};
};

// ---- apply: the only code path that writes "approved" ----
export const applyApproval = (raw: string, secret: string, opts: {now?: number; paths?: Paths} = {}) => {
  const p = opts.paths ?? PATHS;
  const now = opts.now ?? Date.now();
  const a = verifyApproval(raw, secret, now);
  const channel = readJson(path.join(p.channels, a.channel, 'channel.json'));
  if (!channel) throw new Error(`unknown channel ${a.channel}`);
  const targets = [...new Set<string>(channel.publishers.map((x: {platform: string}) => x.platform))];
  const status = currentStatus(p);
  const at = new Date(now).toISOString();
  const written: LedgerEntry[] = [];
  const skipped: string[] = [];
  const prints: Fingerprint[] = [];
  const schema = loadSchema('ledger');
  for (const id of a.ids) {
    const prev = status.get(id)?.status;
    if (prev && ['approved', 'dispatched', 'published'].includes(prev)) {
      skipped.push(`${id}: already ${prev}`);
      continue;
    }
    const v = findVideo(id, p);
    if (!v) skipped.push(`${id}: storyboard not found`);
    else if (v.doc.channel !== a.channel) skipped.push(`${id}: belongs to ${v.doc.channel}, not ${a.channel}`);
    else if (v.recipe?.week !== a.week) skipped.push(`${id}: not in week ${a.week}`);
    else if (!v.qa?.pass) skipped.push(`${id}: QA has not passed`);
    else {
      const e: LedgerEntry = {storyboard_id: id, channel: a.channel, status: 'approved', approved_by: a.by, approved_at: at, targets, updated_at: at};
      const bad = validate(schema, e);
      if (bad.length) throw new Error(`ledger entry breaks ledger.schema.json: ${bad.join('; ')}`);
      written.push(e);
      const prim = v.doc.scenes.map((s: {primitive: string}) => s.primitive);
      prints.push({id, channel: a.channel, date: recipeDate(v.recipe), primitives: prim, opening: prim[0], theme: v.doc.theme, hook_pattern: v.doc.hookPattern, topic_text: String(v.doc.caption).split(/\n\s*\n/)[0].trim(), caption_opener: String(v.doc.caption).split(/(?<=[.!?])\s/)[0].trim(), ...(v.doc.meta?.hero_metaphor ? {hero_metaphor: v.doc.meta.hero_metaphor} : {}), hash: v.recipe.fingerprint});
    }
  }
  append(ledgerFile(p), written);
  append(fingerprintFile(p), prints);
  return {written, skipped};
};

if (import.meta.main) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'apply' && arg) {
    const envFile = path.join(ROOT, '.env');
    if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
    try {
      const r = applyApproval(arg, process.env.APPROVAL_SECRET ?? '');
      r.written.forEach((e) => console.log(`approved ${e.storyboard_id} -> ${e.targets!.join(', ')}`));
      r.skipped.forEach((s) => console.log(`skipped  ${s}`));
    } catch (e) {
      console.error(`refused: ${(e as Error).message}`);
      process.exit(1);
    }
  } else if (cmd === 'status') {
    for (const [id, e] of currentStatus()) if (!arg || id === arg) console.log(`${id.padEnd(28)} ${e.status.padEnd(17)} ${e.updated_at}`);
  } else {
    console.error("usage: node studio/ledger.ts apply '<query>' | status [id]");
    process.exit(2);
  }
}
