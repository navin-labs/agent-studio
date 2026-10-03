// Dispatch: sends approved platform variants out. YouTube = a job for that channel's n8n upload workflow; Instagram and Facebook = a
// post in queue/<channel>/<platform>/ (Forge's publish queue). One ledger line per variant (studio/variant.ts).
// Dry run by default: prints the plan, writes nothing, calls nothing. Live needs BOTH `--live` and DISPATCH_LIVE=on in .env.
// Only the latest ledger line per variant counts, and only status "approved" (with approver and time) is ever dispatched;
// QA and the video file are re-checked here, not trusted from approval time.
//
// node studio/dispatch.ts [--live] [--hold]   (--hold: upload to YouTube as private with no publish time)
// node studio/dispatch.ts --resolve <id> <youtube id | none>   after checking YouTube Studio for a stuck video
import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {appendJsonl, currentStatus, findVideo, type LedgerEntry, ledgerFile, lkey, PATHS, type Paths, sha256} from './ledger.ts';
import {ownWebhook, type Platform, PLATFORMS, queueDir, queueFile, ROUTE, type Variant, youtubeWebhookPath} from './variant.ts';
import {captionOf, categoryOf, seoCheck, youtubeMeta} from './seo.ts';

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

export type YoutubeJob = {storyboard_id: string; channel: string; platform: 'youtube'; title: string; description: string; tags: string[]; category_id: string; scheduled_for: string; webhook: string}; // category 28 Science & Technology, 27 Education (C2)
// Forge's queue: one folder per channel and platform; each post is its files plus a manifest (written last) that says where it goes
export type QueuePost = {storyboard_id: string; channel: string; platform: 'instagram' | 'facebook'; variant: Variant; folder: string; handle: string; page_id?: string; scheduled_for: string; sha256: string};
export type Plan = {youtube: YoutubeJob[]; queue: QueuePost[]; blocked: string[]; skipped: string[]; resume: string[]; stuck: string[]};
const RESOLVE = (id: string) => `upload state unknown: check YouTube Studio, then run: node studio/dispatch.ts --resolve ${id} <youtube video id | none>`;
const youtubeUrl = (e: LedgerEntry) => e.post_urls?.find((u) => u.includes('youtube.com/'));

// What to send now, per platform variant (a ledger line). "approved" = a fresh send. "dispatching" = a send that stopped part-way:
// if YouTube is done or not involved it resumes with local steps only; if YouTube's result is unknown it is stuck until Navin
// resolves it. Nothing is ever uploaded twice. Every (channel, platform) pair is checked against the variant's own manifest;
// any mismatch, missing manifest or unknown pair is refused (and reported on Telegram by the hourly tick).
export const plan = (p: Paths = PATHS, now = Date.now()): Plan => {
  const out: Plan = {youtube: [], queue: [], blocked: [], skipped: [], resume: [], stuck: []};
  const schema = loadSchema('ledger');
  const times = postingTimes(p);
  for (const e of currentStatus(p).values()) {
    const key = lkey(e.storyboard_id, e.platform);
    const name = `${e.storyboard_id} ${e.platform}`;
    if (e.status !== 'approved' && e.status !== 'dispatching') {
      out.skipped.push(`${name}: ${e.status}`);
      continue;
    }
    const resuming = e.status === 'dispatching';
    if (resuming && e.platform === 'youtube' && !youtubeUrl(e)) {
      out.stuck.push(`${name}: ${RESOLVE(e.storyboard_id)}`);
      continue;
    }
    const bad = validate(schema, e);
    const v = findVideo(e.storyboard_id, p);
    const r = v?.variants[e.platform];
    const m = r?.manifest;
    const chFile = path.join(p.channels, e.channel, 'channel.json');
    const channel = fs.existsSync(chFile) ? JSON.parse(fs.readFileSync(chFile, 'utf8')) : null;
    const pubs = (channel?.publishers ?? []).filter((x: {platform: string}) => x.platform === e.platform);
    const pub = pubs[0];
    const d = m?.destination;
    const shown = r && fs.existsSync(r.file('render.json')) ? JSON.parse(fs.readFileSync(r.file('render.json'), 'utf8')).handle : undefined;
    const mp4 = r && fs.existsSync(r.file('mp4')) ? r.file('mp4') : null;
    const queued = !resuming && r && e.platform !== 'youtube' && ['manifest.json', 'posted.json'].some((k) => fs.existsSync(queueFile(p.queue, r.variant, k)));
    const why = bad.length ? `ledger entry invalid (${bad.join('; ')})`
      : !PLATFORMS.includes(e.platform) ? `unknown platform ${e.platform}`
      : !channel ? `unknown channel ${e.channel}`
      : !v ? 'storyboard not found' : !v.recipe ? 'recipe not found'
      : v.doc.channel !== e.channel ? `the storyboard belongs to ${v.doc.channel}, the ledger says ${e.channel}: refused`
      : !r ? `no ${e.platform} variant rendered`
      : !m ? `no manifest for the ${e.platform} variant`
      : validate(loadSchema('manifest'), m).length ? `the ${e.platform} manifest is malformed (${validate(loadSchema('manifest'), m).join('; ')})`
      : m.channel !== e.channel || m.platform !== e.platform || m.video_id !== e.storyboard_id || r.variant.channel !== e.channel ? `the manifest says ${m.channel} ${m.platform} ${m.video_id}, the ledger says ${e.channel} ${e.platform} ${e.storyboard_id}: refused`
      : pubs.length !== 1 ? `${e.channel} has ${pubs.length ? 'more than one' : 'no'} ${e.platform} publisher`
      : pub.handle.startsWith('pending') ? `${e.channel} ${e.platform} is still pending (${pub.handle})`
      : pub.via !== ROUTE[e.platform] ? `${e.channel} sends ${e.platform} via ${pub.via}; ${e.platform} goes via ${ROUTE[e.platform]}: refused`
      : e.platform === 'youtube' && !ownWebhook(e.channel, pub.webhook) ? `${e.channel} has no YouTube upload webhook of its own (${youtubeWebhookPath(e.channel)} in channel.json): refused`
      : e.platform === 'facebook' && !pub.page_id ? `${e.channel} facebook has no page_id: refused`
      : !d || d.via !== pub.via || d.handle !== pub.handle || (d.page_id ?? null) !== (pub.page_id ?? null) ? `the variant was rendered for ${d ? `${d.via} ${d.handle}${d.page_id ? ` page ${d.page_id}` : ''}` : 'no destination'}, channel.json now says ${pub.via} ${pub.handle}${pub.page_id ? ` page ${pub.page_id}` : ''}: render it again`
      : !r.qa?.pass ? 'QA no longer passes'
      : r.qa.video_sha256 !== m.video_sha256 ? 'QA checked another file than this video: QA it again'
      : !mp4 ? 'video file missing'
      : !e.sha256 || sha256(mp4) !== e.sha256 || m.video_sha256 !== e.sha256 ? 'the video changed after it was approved: approve the new render again'
      : channel.live !== true ? `channel ${e.channel} is not live (set "live": true in its channel.json at go-live)`
      : shown !== pub.handle ? `the video shows ${shown ?? 'no recorded handle'} but the ${e.platform} account is ${pub.handle}: render it again`
      : queued ? `already in queue/${e.channel}/${e.platform}/ (${path.basename(queueFile(p.queue, r.variant, 'manifest.json'))}): not queued twice`
      : e.platform === 'youtube' ? seoCheck(youtubeMeta(v.doc, captionOf(r.file('caption.txt'))), v.doc).errors.join('; ') || null // the SEO preflight, again right before publishing
      : null;
    if (why) {
      (resuming ? out.stuck : out.blocked).push(`${name}: ${why}`);
      continue;
    }
    const at = slotTime(m!.date, times[e.channel]?.[e.platform] ?? DEFAULT_TIME, now);
    if (resuming) out.resume.push(key);
    else if (e.platform === 'youtube')
      out.youtube.push({storyboard_id: e.storyboard_id, channel: e.channel, platform: 'youtube', ...youtubeMeta(v!.doc, captionOf(r!.file('caption.txt'))), category_id: categoryOf(e.channel), scheduled_for: at, webhook: pub.webhook});
    else out.queue.push({storyboard_id: e.storyboard_id, channel: e.channel, platform: e.platform, variant: r!.variant, folder: queueDir(p.queue, e.channel, e.platform), handle: pub.handle, ...(pub.page_id ? {page_id: pub.page_id} : {}), scheduled_for: at, sha256: e.sha256!});
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

// Write one post into its channel + platform queue folder so Forge never sees half of it: the video and caption first, the manifest
// last (Forge posts only what has a manifest), each through a temp file and rename. Safe to repeat.
const writeQueue = (q: QueuePost, r: NonNullable<ReturnType<typeof findVideo>>['variants'][Platform], p: Paths) => {
  fs.mkdirSync(q.folder, {recursive: true});
  const put = (kind: string, write: (tmp: string) => void) => {
    const dest = queueFile(p.queue, q.variant, kind);
    const tmp = path.join(q.folder, `.${path.basename(dest)}.tmp`);
    write(tmp);
    fs.renameSync(tmp, dest);
  };
  put('mp4', (t) => fs.copyFileSync(r!.file('mp4'), t));
  put('caption.txt', (t) => fs.copyFileSync(r!.file('caption.txt'), t));
  const files = {video: path.basename(queueFile(p.queue, q.variant, 'mp4')), caption: path.basename(queueFile(p.queue, q.variant, 'caption.txt'))};
  const manifest = {channel: q.channel, platform: q.platform, video_id: q.storyboard_id, date: q.variant.date, handle: q.handle, ...(q.page_id ? {page_id: q.page_id} : {}), scheduled_for: q.scheduled_for, video_sha256: q.sha256, files};
  const bad = validate(loadSchema('queue'), manifest);
  if (bad.length) throw new Error(`queue manifest breaks queue.schema.json: ${bad.join('; ')}`);
  if (sha256(queueFile(p.queue, q.variant, 'mp4')) !== q.sha256) throw new Error('the queued video is not the approved one');
  put('manifest.json', (t) => fs.writeFileSync(t, JSON.stringify(manifest, null, 2) + '\n'));
};

// A resumed queue post (it crashed after the claim): the same destination again, from the channel file.
const rebuild = (e: LedgerEntry, r: NonNullable<ReturnType<typeof findVideo>>['variants'][Platform], p: Paths, now = Date.now()): QueuePost => {
  const pub = JSON.parse(fs.readFileSync(path.join(p.channels, e.channel, 'channel.json'), 'utf8')).publishers.find((x: {platform: string}) => x.platform === e.platform);
  const at = e.scheduled_for ?? slotTime(r!.variant.date, postingTimes(p)[e.channel]?.[e.platform] ?? DEFAULT_TIME, now); // its slot, as planned
  return {storyboard_id: e.storyboard_id, channel: e.channel, platform: e.platform as QueuePost['platform'], variant: r!.variant, folder: queueDir(p.queue, e.channel, e.platform), handle: pub.handle, ...(pub.page_id ? {page_id: pub.page_id} : {}), scheduled_for: at, sha256: e.sha256!};
};

// Live, per variant: claim ("dispatching") -> YouTube -> record its URL at once -> queue for Forge -> "dispatched". Every step is
// written before the next starts, so a crash or a local failure resumes where it stopped and never uploads twice.
export const dispatch = async (pl: Plan, opts: {live: boolean; hold?: boolean; fetch?: Fetch; now?: number; paths?: Paths}) => {
  if (!opts.live) return {sent: [] as string[], failed: [] as string[]};
  const p = opts.paths ?? PATHS;
  // each YouTube job goes to its own channel's workflow only (plan() checked the webhook is that channel's); never a shared default
  if (pl.youtube.some((j) => !ownWebhook(j.channel, j.webhook))) throw new Error('a YouTube job has no webhook of its own channel: nothing sent');
  const f = opts.fetch ?? (globalThis.fetch as unknown as Fetch);
  const at = new Date(opts.now ?? Date.now()).toISOString();
  const sent: string[] = [];
  const failed: string[] = [];
  const write = (row: LedgerEntry) => appendJsonl(ledgerFile(p), [{...row, updated_at: at}]);
  const keys = [...new Set([...pl.youtube.map((j) => lkey(j.storyboard_id, 'youtube')), ...pl.resume, ...pl.queue.map((q) => lkey(q.storyboard_id, q.platform))])];
  for (const key of keys) {
    let e = currentStatus(p).get(key)!;
    const approved = e;
    const id = e.storyboard_id;
    const r = findVideo(id, p)!.variants[e.platform]!;
    const j = pl.youtube.find((x) => lkey(x.storyboard_id, 'youtube') === key);
    const q = pl.queue.find((x) => lkey(x.storyboard_id, x.platform) === key);
    const video = fs.readFileSync(r.file('mp4')); // the bytes that are sent are the bytes that are checked
    if (createHash('sha256').update(video).digest('hex') !== e.sha256) {
      failed.push(`${e.platform} ${id}: the video changed after it was approved; not sent`); // changed since plan(): never send unapproved bytes
      continue;
    }
    if (e.status === 'approved') write((e = {...e, status: 'dispatching'})); // the claim: from here on, never a blind retry
    if (j) {
      // the video travels with the job (n8n in Docker cannot read the Mac's files); n8n asks the Mac receiver before uploading
      const form = new FormData();
      const {webhook, ...job} = j;
      form.set('job', JSON.stringify(opts.hold ? {...job, scheduled_for: ''} : job)); // hold: private, no publish time, stays private
      form.set('video', new Blob([video], {type: 'video/mp4'}), path.basename(r.file('mp4')));
      if (fs.existsSync(r.file('thumbnail.png'))) form.set('thumbnail', new Blob([fs.readFileSync(r.file('thumbnail.png'))], {type: 'image/png'}), path.basename(r.file('thumbnail.png'))); // arm A; n8n sets it after the upload
      const res = await upload(f, webhook, form); // each YouTube account has its own n8n workflow
      if (res.kind === 'refused') {
        write({...approved}); // certainly not uploaded: release the claim, the next run retries
        failed.push(`youtube ${id}: ${res.why} (will retry)`);
        continue;
      }
      if (res.kind === 'unknown') {
        failed.push(`youtube ${id}: ${res.why}; ${RESOLVE(id)}`); // stays "dispatching": never uploaded twice
        continue;
      }
      write((e = {...e, post_urls: [...(e.post_urls ?? []), res.url]}));
      sent.push(`youtube ${id} ${res.url}`);
    }
    try {
      const post = q ?? (e.platform !== 'youtube' ? plan(p, opts.now).queue.find((x) => lkey(x.storyboard_id, x.platform) === key) ?? rebuild(e, r, p, opts.now) : null);
      if (post) {
        writeQueue(post, r, p);
        sent.push(`forge-queue ${id} ${post.platform} -> ${path.relative(path.dirname(p.queue), post.folder)}`);
      }
      const scheduled = opts.hold ? undefined : (j ?? post)?.scheduled_for; // hold: nothing is scheduled
      write({...e, status: 'dispatched', ...(scheduled ? {scheduled_for: scheduled} : {})});
    } catch (err) {
      failed.push(`forge-queue ${id} ${e.platform}: ${(err as Error).message} (the next run finishes it)`);
    }
  }
  return {sent, failed};
};

// Forge writes <prefix>.posted.json ({posted_at, url}) next to a post's manifest in queue/<channel>/<platform>/ after posting it.
// The next tick marks that variant published once (a YouTube variant once its scheduled publish time has passed). A posted file
// whose manifest is missing or malformed, whose channel/platform does not match its folder or the ledger, or whose URL is not on
// that platform, is reported and never trusted.
export const markPublished = (p: Paths = PATHS, now = Date.now()) => {
  const published: string[] = [];
  const problems: string[] = [];
  const rows: LedgerEntry[] = [];
  const status = currentStatus(p);
  const host = {instagram: /^https:\/\/(www\.)?instagram\.com\//, facebook: /^https:\/\/(www\.|m\.)?facebook\.com\//} as Record<string, RegExp>;
  for (const channel of fs.existsSync(p.queue) ? fs.readdirSync(p.queue) : [])
    for (const platform of fs.existsSync(path.join(p.queue, channel)) && fs.statSync(path.join(p.queue, channel)).isDirectory() ? fs.readdirSync(path.join(p.queue, channel)).filter((x) => fs.statSync(path.join(p.queue, channel, x)).isDirectory()) : [])
      for (const f of fs.readdirSync(path.join(p.queue, channel, platform)).filter((x) => x.endsWith('.posted.json'))) {
        const dir = path.join(p.queue, channel, platform);
        try {
          const m = JSON.parse(fs.readFileSync(path.join(dir, f.replace(/\.posted\.json$/, '.manifest.json')), 'utf8'));
          const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          const bad = validate(loadSchema('queue'), m);
          if (bad.length) throw new Error(`its manifest is malformed (${bad.join('; ')})`);
          if (m.channel !== channel || m.platform !== platform) throw new Error(`manifest says ${m.channel} ${m.platform}, the folder is ${channel}/${platform}`);
          const url = typeof d.url === 'string' ? d.url : undefined;
          if (!url || !host[platform]?.test(url)) throw new Error(`no ${platform} URL in url`);
          const e = status.get(lkey(m.video_id, platform));
          if (!e) throw new Error(`${m.video_id} ${platform} is not in the ledger`);
          if (e.channel !== channel) throw new Error(`${m.video_id} belongs to ${e.channel}`);
          if (e.status === 'dispatched') {
            rows.push({...e, status: 'published', post_urls: [...new Set([...(e.post_urls ?? []), url])], updated_at: new Date(now).toISOString()});
            published.push(`${e.storyboard_id} ${platform}`);
          }
        } catch (err) {
          problems.push(`${channel}/${platform}/${f}: ${(err as Error).message}`);
        }
      }
  // YouTube makes a scheduled private upload public by itself at its publish time (scheduled_for); a held upload has none and stays private
  for (const e of status.values())
    if (e.platform === 'youtube' && e.status === 'dispatched' && youtubeUrl(e) && e.scheduled_for && Date.parse(e.scheduled_for) <= now) {
      rows.push({...e, status: 'published', updated_at: new Date(now).toISOString()});
      published.push(`${e.storyboard_id} youtube`);
    }
  appendJsonl(ledgerFile(p), rows);
  return {published, problems};
};

// Navin's answer for a stuck video (YouTube result unknown): the video id he found in YouTube Studio, or "none" (not uploaded).
export const resolve = (id: string, youtubeId: string, p: Paths = PATHS, now = Date.now()) => {
  const e = currentStatus(p).get(lkey(id, 'youtube'));
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
  console.log(`${live ? 'LIVE' : 'DRY RUN'}: ${pl.youtube.length} YouTube, ${pl.queue.length} Forge queue (Instagram, Facebook)`);
  pl.youtube.forEach((j) => console.log(`  youtube   ${j.storyboard_id} at ${j.scheduled_for}`));
  pl.queue.forEach((q) => console.log(`  forge     ${q.storyboard_id} ${q.platform} ${q.handle} at ${q.scheduled_for} -> ${path.relative(path.join(PATHS.state, '..'), q.folder)}`));
  pl.resume.forEach((id) => console.log(`  resume    ${id} (YouTube done, local steps only)`));
  pl.blocked.forEach((b) => console.log(`  BLOCKED   ${b}`));
  pl.stuck.forEach((b) => console.log(`  STUCK     ${b}`));
  const hold = process.argv.includes('--hold');
  if (hold) console.log('hold: YouTube uploads stay private with no publish time');
  const r = await dispatch(pl, {live, hold});
  r.sent.forEach((s) => console.log(`  sent      ${s}`));
  r.failed.forEach((s) => console.log(`  FAILED    ${s}`));
  if (r.failed.length || pl.blocked.length || pl.stuck.length) process.exit(1);
}
