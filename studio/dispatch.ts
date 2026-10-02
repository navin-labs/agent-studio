// Dispatch: sends approved videos out. YouTube = a job for the n8n upload workflow; Instagram and Facebook = a folder in Forge's publish queue.
// Dry run by default: prints the plan, writes nothing, calls nothing. Live needs BOTH `--live` and DISPATCH_LIVE=on in .env.
// Only the latest ledger line per video counts, and only status "approved" (with approver and time) is ever dispatched;
// QA and the video file are re-checked here, not trusted from approval time.
//
// node studio/dispatch.ts [--live] [--hold]   (--hold: upload to YouTube as private with no publish time)
// node studio/dispatch.ts --resolve <id> <youtube id | none>   after checking YouTube Studio for a stuck video
import {createHmac, timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {appendJsonl, currentStatus, findVideo, type LedgerEntry, ledgerFile, PATHS, type Paths} from './ledger.ts';
import {recipeDate} from './recipe.ts';

// Posting times come from data: Learn (B6) writes the best hour per channel and platform to state/learn/posting-times.json,
// e.g. {"c1-automation": {"youtube": "18:30", "instagram": "20:00"}} (IST). Until there is data, DEFAULT_TIME.
export const DEFAULT_TIME = '19:00';
const IST = '+05:30';
export const postingTimes = (p: Paths): Record<string, Record<string, string>> => {
  const f = path.join(p.state, 'learn', 'posting-times.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
};
// A slot already in the past (late approval) goes out 15 minutes from now instead.
export const slotTime = (date: string, hhmm: string, now: number) => {
  const t = Date.parse(`${date}T${hhmm}:00${IST}`);
  const at = t > now + 5 * 60_000 ? t : now + 15 * 60_000;
  return new Date(at + 5.5 * 3600_000).toISOString().slice(0, 19) + IST;
};

export type YoutubeJob = {storyboard_id: string; channel: string; title: string; description: string; tags: string[]; scheduled_for: string; webhook?: string};
export type Account = {platform: 'instagram' | 'facebook'; handle: string; page_id?: string};
export type InstagramPost = {storyboard_id: string; channel: string; accounts: Account[]; folder: string; scheduled_for: string}; // Forge's queue: Instagram and Facebook
export type Plan = {youtube: YoutubeJob[]; instagram: InstagramPost[]; blocked: string[]; skipped: string[]; resume: string[]; stuck: string[]};
const RESOLVE = (id: string) => `upload state unknown: check YouTube Studio, then run: node studio/dispatch.ts --resolve ${id} <youtube video id | none>`;
const youtubeUrl = (e: LedgerEntry) => e.post_urls?.find((u) => u.includes('youtube.com/'));

// What to send now. "approved" = a fresh send. "dispatching" = a send that stopped part-way (crash, local write failure): if
// YouTube is done or not needed it resumes with local steps only; if YouTube's result is unknown it is stuck until Navin
// resolves it. Nothing is ever uploaded twice.
export const plan = (p: Paths = PATHS, now = Date.now()): Plan => {
  const out: Plan = {youtube: [], instagram: [], blocked: [], skipped: [], resume: [], stuck: []};
  const schema = loadSchema('ledger');
  const times = postingTimes(p);
  for (const [id, e] of currentStatus(p)) {
    if (e.status !== 'approved' && e.status !== 'dispatching') {
      out.skipped.push(`${id}: ${e.status}`);
      continue;
    }
    const resuming = e.status === 'dispatching';
    if (resuming && e.targets!.includes('youtube') && !youtubeUrl(e)) {
      out.stuck.push(`${id}: ${RESOLVE(id)}`);
      continue;
    }
    const bad = validate(schema, e);
    const v = findVideo(id, p);
    const channel = JSON.parse(fs.readFileSync(path.join(p.channels, e.channel, 'channel.json'), 'utf8'));
    const shown = v && fs.existsSync(path.join(v.outDir, 'render.json')) ? JSON.parse(fs.readFileSync(path.join(v.outDir, 'render.json'), 'utf8')).handle : undefined;
    const igHandle = channel.publishers.find((x: {platform: string}) => x.platform === 'instagram')?.handle;
    const why = bad.length ? `ledger entry invalid (${bad.join('; ')})` : !v ? 'storyboard not found' : !v.qa?.pass ? 'QA no longer passes' : !fs.existsSync(path.join(v.outDir, 'reel.mp4')) ? 'video file missing' : !v.recipe ? 'recipe not found'
      : channel.live !== true ? `channel ${e.channel} is not live (set "live": true in its channel.json at go-live)`
      : shown !== igHandle ? `the video shows ${shown ?? 'no recorded handle'} but the channel is ${igHandle}: render it again` : null;
    if (why) {
      (resuming ? out.stuck : out.blocked).push(`${id}: ${why}`);
      continue;
    }
    const date = recipeDate(v!.recipe!);
    const at = (platform: string) => slotTime(date, times[e.channel]?.[platform] ?? DEFAULT_TIME, now);
    const caption = `${v!.doc.caption}\n\n${(v!.doc.hashtags ?? []).join(' ')}`.trim();
    if (resuming) out.resume.push(id);
    else if (e.targets!.includes('youtube'))
      out.youtube.push({storyboard_id: id, channel: e.channel, title: String(v!.doc.caption).split('\n')[0].slice(0, 100), description: caption, tags: (v!.doc.hashtags ?? []).map((h: string) => h.replace(/^#/, '')), scheduled_for: at('youtube'), webhook: channel.publishers.find((x: {platform: string}) => x.platform === 'youtube')?.webhook});
    const accounts: Account[] = channel.publishers.filter((x: Account) => ['instagram', 'facebook'].includes(x.platform) && e.targets!.includes(x.platform) && !x.handle.startsWith('pending')).map((x: Account) => ({platform: x.platform, handle: x.handle, ...(x.page_id ? {page_id: x.page_id} : {})}));
    if (accounts.length) {
      // one queue folder for every channel; each post says which channel and account it is for
      out.instagram.push({storyboard_id: id, channel: e.channel, accounts, folder: path.join(p.state, 'queue', 'instagram', `${date}-${e.channel}-${id}`), scheduled_for: at('instagram')});
    }
  }
  return out;
};

type Fetch = (url: string, init: {method: string; body: FormData}) => Promise<{ok: boolean; status: number; text: () => Promise<string>}>;
type Upload = {kind: 'ok'; url: string} | {kind: 'refused'; why: string} | {kind: 'unknown'; why: string};

// One YouTube upload through n8n. "refused" only when it certainly did not upload (n8n said so, or the connection never
// opened); anything else that is not a clear success is "unknown", which is never retried automatically.
const upload = async (f: Fetch, url: string, form: FormData): Promise<Upload> => {
  let r: Awaited<ReturnType<Fetch>>;
  try {
    r = await f(url, {method: 'POST', body: form});
  } catch (e) {
    const code = (e as {cause?: {code?: string}}).cause?.code ?? (e as {code?: string}).code;
    return ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(code ?? '') ? {kind: 'refused', why: `n8n not reachable (${code})`} : {kind: 'unknown', why: `request failed: ${(e as Error).message}`};
  }
  const reply = await r.text().then((t) => { try { return JSON.parse(t); } catch { return {}; } }, () => ({}));
  if (r.ok && reply.uploaded === true && /^[A-Za-z0-9_-]{11}$/.test(reply.youtube_id ?? '')) return {kind: 'ok', url: `https://www.youtube.com/shorts/${reply.youtube_id}`};
  if (reply.uploaded === false) return {kind: 'refused', why: `HTTP ${r.status}: ${reply.reason ?? 'not uploaded'}`};
  return {kind: 'unknown', why: `HTTP ${r.status}, unexpected reply ${JSON.stringify(reply).slice(0, 120)}`};
};

// Write a queue folder so Forge never sees half of it: files first, post.json last (Forge posts only folders with post.json),
// each through a temp file and rename. Safe to repeat.
const writeQueue = (q: InstagramPost, v: NonNullable<ReturnType<typeof findVideo>>, scheduled: string) => {
  fs.mkdirSync(q.folder, {recursive: true});
  const put = (name: string, write: (tmp: string) => void) => {
    const tmp = path.join(q.folder, `.${name}.tmp`);
    write(tmp);
    fs.renameSync(tmp, path.join(q.folder, name));
  };
  put('reel.mp4', (t) => fs.copyFileSync(path.join(v.outDir, 'reel.mp4'), t));
  put('caption.txt', (t) => fs.writeFileSync(t, `${v.doc.caption}\n\n${(v.doc.hashtags ?? []).join(' ')}\n`));
  put('post.json', (t) => fs.writeFileSync(t, JSON.stringify({storyboard_id: q.storyboard_id, channel: q.channel, accounts: q.accounts, scheduled_for: scheduled}, null, 2) + '\n'));
};

// Live, per video: claim ("dispatching") -> YouTube -> record its URL at once -> queue for Forge -> "dispatched". Every step is
// written before the next starts, so a crash or a local failure resumes where it stopped and never uploads twice.
export const dispatch = async (pl: Plan, opts: {live: boolean; hold?: boolean; youtubeUrl?: string; fetch?: Fetch; now?: number; paths?: Paths}) => {
  if (!opts.live) return {sent: [] as string[], failed: [] as string[]};
  const p = opts.paths ?? PATHS;
  if (pl.youtube.some((j) => !j.webhook) && !opts.youtubeUrl) throw new Error('YOUTUBE_WEBHOOK_URL is not set');
  const f = opts.fetch ?? (globalThis.fetch as unknown as Fetch);
  const at = new Date(opts.now ?? Date.now()).toISOString();
  const sent: string[] = [];
  const failed: string[] = [];
  const write = (row: LedgerEntry) => appendJsonl(ledgerFile(p), [{...row, updated_at: at}]);
  const ids = [...new Set([...pl.youtube.map((j) => j.storyboard_id), ...pl.resume, ...pl.instagram.map((q) => q.storyboard_id)])];
  for (const id of ids) {
    let e = currentStatus(p).get(id)!;
    const approved = e;
    const j = pl.youtube.find((x) => x.storyboard_id === id);
    const q = pl.instagram.find((x) => x.storyboard_id === id);
    if (e.status === 'approved') write((e = {...e, status: 'dispatching'})); // the claim: from here on, never a blind retry
    if (j) {
      // the video travels with the job (n8n in Docker cannot read the Mac's files); n8n asks the Mac receiver before uploading
      const form = new FormData();
      const {webhook, ...job} = j;
      form.set('job', JSON.stringify(opts.hold ? {...job, scheduled_for: ''} : job)); // hold: private, no publish time, stays private
      form.set('video', new Blob([fs.readFileSync(path.join(findVideo(id, p)!.outDir, 'reel.mp4'))], {type: 'video/mp4'}), `${id}.mp4`);
      const r = await upload(f, webhook ?? opts.youtubeUrl!, form); // each YouTube account has its own n8n workflow
      if (r.kind === 'refused') {
        write({...approved}); // certainly not uploaded: release the claim, the next run retries
        failed.push(`youtube ${id}: ${r.why} (will retry)`);
        continue;
      }
      if (r.kind === 'unknown') {
        failed.push(`youtube ${id}: ${r.why}; ${RESOLVE(id)}`); // stays "dispatching": never uploaded twice
        continue;
      }
      write((e = {...e, post_urls: [...(e.post_urls ?? []), r.url]}));
      sent.push(`youtube ${id} ${r.url}`);
    }
    try {
      if (q) {
        writeQueue(q, findVideo(id, p)!, q.scheduled_for);
        sent.push(`forge-queue ${id} (${q.accounts.map((a) => a.platform).join(', ')})`);
      }
      const scheduled = opts.hold ? undefined : (j ?? q)?.scheduled_for; // hold: nothing is scheduled
      write({...e, status: 'dispatched', ...(scheduled ? {scheduled_for: scheduled} : {})});
    } catch (err) {
      failed.push(`forge-queue ${id}: ${(err as Error).message} (YouTube is done; the next run finishes it without uploading again)`);
    }
  }
  return {sent, failed};
};

// Forge writes posted.json ({posted_at, urls: {instagram?, facebook?}}) into a queue folder after posting it. The next tick
// marks the video published once, keeping the YouTube URL and adding Forge's. Bad or unknown files are reported, not trusted.
export const markPublished = (p: Paths = PATHS, now = Date.now()) => {
  const dir = path.join(p.state, 'queue', 'instagram');
  if (!fs.existsSync(dir)) return {published: [] as string[], problems: [] as string[]};
  const status = currentStatus(p);
  const published: string[] = [];
  const problems: string[] = [];
  const rows: LedgerEntry[] = [];
  for (const f of fs.readdirSync(dir)) {
    const posted = path.join(dir, f, 'posted.json');
    if (!fs.existsSync(posted)) continue;
    let post: {storyboard_id?: string};
    let urls: string[];
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f, 'post.json'), 'utf8'));
      const d = JSON.parse(fs.readFileSync(posted, 'utf8'));
      post = j;
      urls = Object.values(d.urls ?? {}).filter((u): u is string => typeof u === 'string' && /^https:\/\/(www\.)?(instagram|facebook)\.com\//.test(u));
      if (!urls.length) throw new Error('no instagram.com or facebook.com URL in urls');
    } catch (e) {
      problems.push(`${f}/posted.json: ${(e as Error).message}`);
      continue;
    }
    const e = status.get(post.storyboard_id ?? '');
    if (!e) problems.push(`${f}: ${post.storyboard_id} is not in the ledger`);
    else if (e.status === 'dispatched') {
      rows.push({...e, status: 'published', post_urls: [...new Set([...(e.post_urls ?? []), ...urls])], updated_at: new Date(now).toISOString()});
      published.push(e.storyboard_id);
    }
  }
  appendJsonl(ledgerFile(p), rows);
  return {published, problems};
};

// Navin's answer for a stuck video (YouTube result unknown): the video id he found in YouTube Studio, or "none" (not uploaded).
export const resolve = (id: string, youtubeId: string, p: Paths = PATHS, now = Date.now()) => {
  const e = currentStatus(p).get(id);
  if (e?.status !== 'dispatching' || youtubeUrl(e)) throw new Error(`${id} is not stuck (status ${e?.status ?? 'unknown'})`);
  const at = new Date(now).toISOString();
  if (youtubeId === 'none') appendJsonl(ledgerFile(p), [{...e, status: 'approved', updated_at: at}]); // retried by the next run
  else if (/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) appendJsonl(ledgerFile(p), [{...e, post_urls: [...(e.post_urls ?? []), `https://www.youtube.com/shorts/${youtubeId}`], updated_at: at}]); // the next run finishes the local steps
  else throw new Error('give the 11-character YouTube video id, or "none"');
};

// The same answer from a Telegram button: a signed query (HMAC with APPROVAL_SECRET, 60 s), verified before anything is written,
// exactly like approvals. Tapped only from Navin's own chat (telegram.ts checks that first).
const resolveSig = (id: string, answer: string, exp: number, secret: string) => createHmac('sha256', secret).update(['resolve', id, answer, exp].join('|')).digest('hex');
export const resolveQuery = (id: string, answer: string, secret: string, exp: number) => new URLSearchParams({id, answer, exp: String(exp), sig: resolveSig(id, answer, exp, secret)}).toString();
export const applyResolve = (raw: string, secret: string, p: Paths = PATHS, now = Date.now()) => {
  if (!secret || secret.length < 16) throw new Error('APPROVAL_SECRET is missing or shorter than 16 characters');
  const q = new URLSearchParams(raw);
  const [id, answer, exp] = [q.get('id') ?? '', q.get('answer') ?? '', Number(q.get('exp'))];
  const got = Buffer.from(q.get('sig') ?? '', 'hex');
  const want = Buffer.from(resolveSig(id, answer, exp, secret), 'hex');
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new Error('resolve signature does not match');
  if (!Number.isInteger(exp) || now > exp * 1000) throw new Error('resolve expired');
  resolve(id, answer, p, now);
};

if (import.meta.main && process.argv[2] === '--resolve') {
  resolve(process.argv[3] ?? '', process.argv[4] ?? '');
  console.log(`${process.argv[3]}: resolved; the next run ${process.argv[4] === 'none' ? 'uploads it again' : 'finishes it without uploading'}`);
} else if (import.meta.main) {
  const envFile = path.join(import.meta.dirname, '..', '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const live = process.argv.includes('--live') && process.env.DISPATCH_LIVE === 'on';
  if (process.argv.includes('--live') && !live) console.log('--live ignored: DISPATCH_LIVE=on is not set in agent-studio/.env (dry run)');
  const pl = plan();
  console.log(`${live ? 'LIVE' : 'DRY RUN'}: ${pl.youtube.length} YouTube, ${pl.instagram.length} Forge queue (Instagram, Facebook)`);
  pl.youtube.forEach((j) => console.log(`  youtube   ${j.storyboard_id} at ${j.scheduled_for}`));
  pl.instagram.forEach((q) => console.log(`  forge     ${q.storyboard_id} (${q.accounts.map((a) => `${a.platform} ${a.handle}`).join(', ')}) at ${q.scheduled_for} -> ${path.relative(path.join(PATHS.state, '..'), q.folder)}`));
  pl.resume.forEach((id) => console.log(`  resume    ${id} (YouTube done, local steps only)`));
  pl.blocked.forEach((b) => console.log(`  BLOCKED   ${b}`));
  pl.stuck.forEach((b) => console.log(`  STUCK     ${b}`));
  const hold = process.argv.includes('--hold');
  if (hold) console.log('hold: YouTube uploads stay private with no publish time');
  const r = await dispatch(pl, {live, hold, youtubeUrl: process.env.YOUTUBE_WEBHOOK_URL});
  r.sent.forEach((s) => console.log(`  sent      ${s}`));
  r.failed.forEach((s) => console.log(`  FAILED    ${s}`));
  if (r.failed.length || pl.blocked.length || pl.stuck.length) process.exit(1);
}
