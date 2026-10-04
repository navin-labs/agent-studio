// Ledger: one JSON line per status change in state/ledger.jsonl (latest line per video wins). Dispatch acts only on "approved".
// Approvals arrive as signed links from the weekly page (approval-page.ts). n8n only relays the link's query string here, so it
// cannot forge or widen an approval: the HMAC covers channel, week, ids, approver and expiry. The secret is read from the
// environment (APPROVAL_SECRET), never from code or docs.
//
// node studio/ledger.ts apply '<query string or full approve URL>'   verify + write approved entries (what the n8n webhook runs)
// node studio/ledger.ts reject <id...>                               take back approvals that have not gone out
// node studio/ledger.ts status [id]                                   current status per video
import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import type {Fingerprint} from './novelty.ts';
import {type Recipe, recipeDate} from './recipe.ts';
import {file as vfile, findVariants, sendable, type Platform, PLATFORMS, type Variant} from './variant.ts';

const ROOT = path.join(import.meta.dirname, '..');
export type Paths = {state: string; content: string[]; out: string; recipes: string; channels: string; queue: string};
export const PATHS: Paths = {
  state: process.env.STUDIO_STATE ?? path.join(ROOT, 'state'),
  content: [path.join(ROOT, 'content'), path.join(ROOT, 'engine/content/storyboards')], // Writer output, then the engine's own boards
  out: path.join(ROOT, 'engine/out'),
  recipes: process.env.STUDIO_RECIPES ?? path.join(ROOT, 'recipes'),
  channels: path.join(ROOT, 'channels'),
  queue: path.join(ROOT, 'queue'), // Forge's publish queue: queue/<channel>/<platform>/
};

// One line per platform variant (studio/variant.ts): a video's YouTube, Instagram and Facebook versions move on their own.
// sha256: the exact video approved (dispatch sends only that file); approval: the link it came from (a link is used once).
export type LedgerEntry = {storyboard_id: string; platform: Platform; channel: string; status: string; approved_by?: string; approved_at?: string; sha256?: string; approval?: string; scheduled_for?: string; post_urls?: string[]; style?: string; updated_at: string};
export const lkey = (id: string, platform: string) => `${id}|${platform}`;
// Append-only JSONL, crash-safe: a crash mid-append can leave a torn last line. Readers ignore a torn LAST line (that row never
// completed); a broken line anywhere else is real corruption and stops everything. Appends first cut a torn last row off
// (it never completed), so a new row never glues onto it.
export const readJsonl = <T,>(f: string): T[] => {
  if (!fs.existsSync(f)) return [];
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  return lines.flatMap((l, i) => {
    if (!l.trim()) return [];
    try {
      return [JSON.parse(l) as T];
    } catch {
      if (lines.slice(i + 1).every((x) => !x.trim())) return []; // torn last line
      throw new Error(`${path.basename(f)} line ${i + 1} is not valid JSON (corrupted)`);
    }
  });
};
export const appendJsonl = (f: string, rows: unknown[]) => {
  if (!rows.length) return;
  fs.mkdirSync(path.dirname(f), {recursive: true});
  if (fs.existsSync(f)) {
    const text = fs.readFileSync(f, 'utf8');
    if (text && !text.endsWith('\n')) fs.truncateSync(f, Buffer.byteLength(text.slice(0, text.lastIndexOf('\n') + 1))); // drop the torn row
  }
  fs.appendFileSync(f, rows.map((r) => JSON.stringify(r) + '\n').join(''));
};
const readLines = readJsonl;
const append = appendJsonl;
export const ledgerFile = (p = PATHS) => path.join(p.state, 'ledger.jsonl');
export const fingerprintFile = (p = PATHS) => path.join(p.state, 'fingerprints.jsonl');
// The latest line per variant, keyed lkey(id, platform).
export const currentStatus = (p = PATHS) => new Map(readLines<LedgerEntry>(ledgerFile(p)).map((e) => [lkey(e.storyboard_id, e.platform), e]));
export const readFingerprints = (p = PATHS) => [...new Map(readLines<Fingerprint>(fingerprintFile(p)).map((f) => [f.id, f])).values()]; // one per video

// ---- signed approvals ----
export type Approval = {channel: string; week: string; ids: string[]; by: string; exp: number};
const payload = (a: Approval) => ['approve', a.channel, a.week, a.ids.join(','), a.by, a.exp].join('|');
export const sign = (a: Approval, secret: string) => createHmac('sha256', secret).update(payload(a)).digest('hex');
export const sha256 = (f: string) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
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

// ---- finding a video by id: its board (<id>.json), its recipe, and its platform variants (engine/out/<channel>/<date>/<id>/<platform>/) ----
export type Qa = {pass: boolean; checks: {name: string; pass: boolean; error?: string; warning?: string}[]; video_sha256?: string};
export type VariantRender = {variant: Variant; file: (kind: string) => string; manifest: Record<string, any> | null; qa: Qa | null};
export type Video = {id: string; doc: any; recipe: Recipe | null; variants: Partial<Record<Platform, VariantRender>>};
// The variant shown when one picture stands for the video (Telegram, the approval page): YouTube, else the first rendered.
export const shown = (v: Video) => v.variants.youtube ?? v.variants.instagram ?? v.variants.facebook ?? null;
// The video's QA across its variants: it can be approved once at least one variant passed; the others are held, with why
// (a platform with no render at all is held too, so a missing variant is never silent).
export const qaSummary = (v: Video) => {
  const rs = PLATFORMS.flatMap((pl) => (v.variants[pl] ? [{pl, qa: v.variants[pl]!.qa}] : []));
  return {
    checked: rs.length > 0 && rs.every((r) => r.qa),
    passed: rs.filter((r) => r.qa?.pass).map((r) => r.pl),
    held: [...rs.filter((r) => r.qa && !r.qa.pass).map((r) => `${r.pl}: ${r.qa!.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.error}`).join('; ')}`), ...PLATFORMS.filter((pl) => rs.length && !v.variants[pl]).map((pl) => `${pl}: not rendered`)],
    warnings: [...new Set(rs.flatMap((r) => r.qa?.checks.filter((c) => c.warning).map((c) => `${r.pl} ${c.name}: ${c.warning}`) ?? []))],
  };
};
// A variant still needs Navin: it passed QA and has no approval for this exact render (none yet, taken back, or given to an older
// render). Sent (or being sent) is final.
export const needsApproval = (v: Video, status = currentStatus()) =>
  qaSummary(v).passed.some((pl) => {
    const e = status.get(lkey(v.id, pl));
    return !e || !['approved', 'dispatching', 'dispatched', 'published'].includes(e.status) || (e.status === 'approved' && e.sha256 !== v.variants[pl]!.manifest?.video_sha256);
  });
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
  const variants: Video['variants'] = {};
  for (const v of findVariants(p.out, id)) variants[v.platform] = {variant: v, file: (k) => vfile(p.out, v, k), manifest: readJson(vfile(p.out, v, 'manifest.json')), qa: readJson(vfile(p.out, v, 'qa.json'))};
  return {id, doc, recipe, variants};
};

// ---- apply: the only code path that writes "approved" ----
// The written board for each of a week's recipes (matched by meta.recipe_id), in slot order; null = not written yet.
export const weekVideos = (channel: string, week: string, p = PATHS) => {
  const boards = p.content.flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d, {recursive: true, encoding: 'utf8'}).filter((f) => f.endsWith('.json')).map((f) => path.join(d, f)) : []));
  const docs = boards.map((f) => {
    try {
      return {f, d: JSON.parse(fs.readFileSync(f, 'utf8'))};
    } catch {
      return null;
    }
  });
  return weekRecipes(channel, week, p).map((r) => {
    const hit = docs.find((x) => x?.d?.meta?.recipe_id === r.id && x.d.channel === channel);
    return {recipe: r, video: hit ? findVideo(path.basename(hit.f, '.json'), p) : null};
  });
};

export const applyApproval = (raw: string, secret: string, opts: {now?: number; paths?: Paths} = {}) => {
  const p = opts.paths ?? PATHS;
  const now = opts.now ?? Date.now();
  const a = verifyApproval(raw, secret, now);
  // a link approves once: replaying it (say after Navin rejected the video) is refused before anything is read or written
  const used = new URLSearchParams(raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw).get('sig')!.slice(0, 16);
  if (readLines<LedgerEntry>(ledgerFile(p)).some((e) => e.approval === used)) throw new Error('this approval link was already used; approve again from Telegram or a new page');
  repairFingerprints(p);
  const channel = readJson(path.join(p.channels, a.channel, 'channel.json'));
  if (!channel) throw new Error(`unknown channel ${a.channel}`);
  // a publisher whose username is still pending (handle "pending_...") is not a target until it is claimed (Facebook with a page_id is: studio/variant.ts sendable)
  const targets = [...new Set<Platform>(channel.publishers.filter(sendable).map((x: {platform: Platform}) => x.platform))];
  const status = currentStatus(p);
  const at = new Date(now).toISOString();
  const written: LedgerEntry[] = [];
  const skipped: string[] = [];
  const prints: Fingerprint[] = [];
  const schema = loadSchema('ledger');
  for (const id of a.ids) {
    const v = findVideo(id, p);
    if (!v) skipped.push(`${id}: storyboard not found`);
    else if (v.doc.channel !== a.channel) skipped.push(`${id}: belongs to ${v.doc.channel}, not ${a.channel}`);
    else if (v.recipe?.week !== a.week) skipped.push(`${id}: not in week ${a.week}`);
    else {
      // one tap covers the video and its platform variants; a variant that failed QA is held alone, the others are approved
      let any = false;
      for (const platform of targets) {
        const last = status.get(lkey(id, platform));
        const prev = last?.status;
        const r = v.variants[platform];
        // sent (or being sent) is final; an approval stands only for the render it was given to (a re-render needs a new one)
        if (prev && ['dispatching', 'dispatched', 'published'].includes(prev)) skipped.push(`${id} ${platform}: already ${prev}`);
        else if (prev === 'approved' && last!.sha256 === r?.manifest?.video_sha256) skipped.push(`${id} ${platform}: already approved`);
        else if (!r) skipped.push(`${id} ${platform}: not rendered`);
        else if (!r.qa?.pass) skipped.push(`${id} ${platform}: held, QA has not passed`);
        else if (!fs.existsSync(r.file('mp4')) || r.manifest?.video_sha256 !== sha256(r.file('mp4')) || r.qa.video_sha256 !== r.manifest?.video_sha256) skipped.push(`${id} ${platform}: held, the video is not the one QA checked (render and QA again)`);
        else {
          const style = r.manifest?.style_version;
          const e: LedgerEntry = {storyboard_id: id, platform, channel: a.channel, status: 'approved', approved_by: a.by, approved_at: at, sha256: r.manifest!.video_sha256, approval: used, ...(style ? {style} : {}), updated_at: at};
          const bad = validate(schema, e);
          if (bad.length) throw new Error(`ledger entry breaks ledger.schema.json: ${bad.join('; ')}`);
          written.push(e);
          any = true;
        }
      }
      if (any && !readFingerprints(p).some((f) => f.id === id)) prints.push(fingerprintOf(v));
    }
  }
  // ledger first, then fingerprints; a crash between the two is healed by repairFingerprints (every approval and every tick)
  append(ledgerFile(p), written);
  append(fingerprintFile(p), prints);
  return {written, skipped};
};

// What the render recorded (the shown variant's render.json): the style preset and the scene spans.
const rendered = (v: Video): {style?: string; scenes?: {end: number}[]} => {
  const f = shown(v)?.file('render.json');
  return f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
};

// The novelty fingerprint of an approved video (what Recipe and QA compare new videos against), plus what Learn scores it by:
// its style preset, its closing CTA and its rendered length.
export const fingerprintOf = (v: Video): Fingerprint => {
  const prim = v.doc.scenes.map((s: {primitive: string}) => s.primitive);
  const cap = String(v.doc.caption ?? '');
  const r = rendered(v);
  const cta = String(v.doc.scenes.at(-1)?.params?.text ?? '').replace(/\*/g, '').trim();
  const seconds = r.scenes?.at(-1)?.end;
  return {...(r.style ? {style: r.style} : {}), ...(cta ? {cta} : {}), ...(seconds ? {seconds: Math.round(seconds * 10) / 10} : {}), id: v.id, channel: v.doc.channel, date: recipeDate(v.recipe!), primitives: prim, opening: prim[0], theme: v.doc.theme, hook_pattern: v.doc.hookPattern, topic_text: cap.split(/\n\s*\n/)[0].trim(), caption_opener: cap.split(/(?<=[.!?])\s/)[0].trim(), ...(v.doc.meta?.hero_metaphor ? {hero_metaphor: v.doc.meta.hero_metaphor} : {}), hash: v.recipe!.fingerprint};
};

// Every approved (or later) video has exactly one fingerprint. Writes the missing ones; idempotent.
export const repairFingerprints = (p = PATHS) => {
  const have = new Set(readFingerprints(p).map((f) => f.id));
  const missing = [...currentStatus(p).values()].filter((e) => ['approved', 'dispatching', 'dispatched', 'published'].includes(e.status) && !have.has(e.storyboard_id));
  const rows = [...new Set(missing.map((e) => e.storyboard_id))].map((id) => findVideo(id, p)).filter((v): v is Video => !!v?.recipe).map(fingerprintOf);
  append(fingerprintFile(p), rows);
  return rows.map((f) => f.id);
};

// Navin takes back an approval before it went out. Only "approved" variants are rejected; a variant already dispatching or sent is
// left as it is (reported), so this can never orphan an upload.
export const reject = (ids: string[], p = PATHS, now = Date.now()) => {
  const lines = [...currentStatus(p).values()].filter((e) => ids.includes(e.storyboard_id));
  const ok = lines.filter((e) => e.status === 'approved');
  const kept = lines.filter((e) => e.status !== 'approved').map((e) => `${e.storyboard_id} ${e.platform} is ${e.status}`);
  if (!ok.length) throw new Error(`only approved videos can be rejected: ${kept.join(', ') || `${ids.join(', ')}: not in the ledger`}`);
  append(ledgerFile(p), ok.map((e) => ({...e, status: 'rejected', updated_at: new Date(now).toISOString()})));
  return {rejected: ok.map((e) => `${e.storyboard_id} ${e.platform}`), kept};
};

if (import.meta.main) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'apply' && arg) {
    const envFile = path.join(ROOT, '.env');
    if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
    try {
      const r = applyApproval(arg, process.env.APPROVAL_SECRET ?? '');
      r.written.forEach((e) => console.log(`approved ${e.storyboard_id} ${e.platform}`));
      r.skipped.forEach((s) => console.log(`skipped  ${s}`));
    } catch (e) {
      console.error(`refused: ${(e as Error).message}`);
      process.exit(1);
    }
  } else if (cmd === 'reject' && arg) {
    const r = reject(process.argv.slice(3));
    console.log(`rejected ${r.rejected.join(', ')}${r.kept.length ? `; left as they are: ${r.kept.join(', ')}` : ''}`);
  } else if (cmd === 'status') {
    for (const e of currentStatus().values()) if (!arg || e.storyboard_id === arg) console.log(`${e.storyboard_id.padEnd(24)} ${e.platform.padEnd(10)} ${e.status.padEnd(17)} ${e.updated_at}`);
  } else {
    console.error("usage: node studio/ledger.ts apply '<query>' | reject <id...> | status [id]");
    process.exit(2);
  }
}
