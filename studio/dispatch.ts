// Dispatch: sends approved videos out. YouTube = a job for the n8n upload workflow; Instagram = a folder in Forge's publish queue.
// Dry run by default: prints the plan, writes nothing, calls nothing. Live needs BOTH `--live` and DISPATCH_LIVE=on in .env.
// Only the latest ledger line per video counts, and only status "approved" (with approver and time) is ever dispatched;
// QA and the video file are re-checked here, not trusted from approval time.
//
// node studio/dispatch.ts [--live] [--hold]   (--hold: upload to YouTube as private with no publish time)
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {currentStatus, findVideo, type LedgerEntry, ledgerFile, PATHS, type Paths} from './ledger.ts';
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

export type YoutubeJob = {storyboard_id: string; channel: string; title: string; description: string; tags: string[]; scheduled_for: string};
export type InstagramPost = {storyboard_id: string; channel: string; handles: string[]; folder: string; scheduled_for: string};
export type Plan = {youtube: YoutubeJob[]; instagram: InstagramPost[]; blocked: string[]; skipped: string[]};

export const plan = (p: Paths = PATHS, now = Date.now()): Plan => {
  const out: Plan = {youtube: [], instagram: [], blocked: [], skipped: []};
  const schema = loadSchema('ledger');
  const times = postingTimes(p);
  for (const [id, e] of currentStatus(p)) {
    if (e.status !== 'approved') {
      out.skipped.push(`${id}: ${e.status}`);
      continue;
    }
    const bad = validate(schema, e);
    const v = findVideo(id, p);
    const why = bad.length ? `ledger entry invalid (${bad.join('; ')})` : !v ? 'storyboard not found' : !v.qa?.pass ? 'QA no longer passes' : !fs.existsSync(path.join(v.outDir, 'reel.mp4')) ? 'video file missing' : !v.recipe ? 'recipe not found' : null;
    if (why) {
      out.blocked.push(`${id}: ${why}`);
      continue;
    }
    const date = recipeDate(v!.recipe!);
    const at = (platform: string) => slotTime(date, times[e.channel]?.[platform] ?? DEFAULT_TIME, now);
    const caption = `${v!.doc.caption}\n\n${(v!.doc.hashtags ?? []).join(' ')}`.trim();
    if (e.targets!.includes('youtube'))
      out.youtube.push({storyboard_id: id, channel: e.channel, title: String(v!.doc.caption).split('\n')[0].slice(0, 100), description: caption, tags: (v!.doc.hashtags ?? []).map((h: string) => h.replace(/^#/, '')), scheduled_for: at('youtube')});
    if (e.targets!.includes('instagram')) {
      const channel = JSON.parse(fs.readFileSync(path.join(p.channels, e.channel, 'channel.json'), 'utf8'));
      const handles = channel.publishers.filter((x: {platform: string}) => x.platform === 'instagram').map((x: {handle: string}) => x.handle);
      // one queue folder for every channel; each post says which channel and account it is for
      out.instagram.push({storyboard_id: id, channel: e.channel, handles, folder: path.join(p.state, 'queue', 'instagram', `${date}-${e.channel}-${id}`), scheduled_for: at('instagram')});
    }
  }
  return out;
};

type Fetch = (url: string, init: {method: string; body: FormData}) => Promise<{ok: boolean; status: number; text: () => Promise<string>}>;

// Live: YouTube first, then the Instagram queue, then the video is marked dispatched. If YouTube fails, nothing is queued and the
// entry stays approved, so the next run retries both and Instagram can never be queued twice.
export const dispatch = async (pl: Plan, opts: {live: boolean; hold?: boolean; youtubeUrl?: string; fetch?: Fetch; now?: number; paths?: Paths}) => {
  if (!opts.live) return {sent: [] as string[], failed: [] as string[]};
  const p = opts.paths ?? PATHS;
  if (pl.youtube.length && !opts.youtubeUrl) throw new Error('YOUTUBE_WEBHOOK_URL is not set');
  const f = opts.fetch ?? (globalThis.fetch as unknown as Fetch);
  const at = new Date(opts.now ?? Date.now()).toISOString();
  const status = currentStatus(p);
  const sent: string[] = [];
  const failed: string[] = [];
  const done = new Set<string>();
  const urls = new Map<string, string[]>();
  for (const j of pl.youtube) {
    // the video travels with the job (n8n in Docker cannot read the Mac's files); n8n asks the Mac receiver before uploading
    const form = new FormData();
    form.set('job', JSON.stringify(opts.hold ? {...j, scheduled_for: ''} : j)); // hold: private, no publish time, stays private
    form.set('video', new Blob([fs.readFileSync(path.join(findVideo(j.storyboard_id, p)!.outDir, 'reel.mp4'))], {type: 'video/mp4'}), `${j.storyboard_id}.mp4`);
    const r = await f(opts.youtubeUrl!, {method: 'POST', body: form}).catch(() => ({ok: false, status: 0, text: async () => ''}));
    const reply = r.ok ? await r.text().then((t) => { try { return JSON.parse(t); } catch { return {}; } }) : {};
    if (r.ok && reply.uploaded === true && /^[A-Za-z0-9_-]{11}$/.test(reply.youtube_id ?? '')) {
      sent.push(`youtube ${j.storyboard_id} https://www.youtube.com/shorts/${reply.youtube_id}`);
      done.add(j.storyboard_id);
      urls.set(j.storyboard_id, [`https://www.youtube.com/shorts/${reply.youtube_id}`]);
    } else failed.push(`youtube ${j.storyboard_id}: ${r.ok ? `unexpected reply ${JSON.stringify(reply).slice(0, 120)}` : `HTTP ${r.status}`}`);
  }
  for (const q of pl.instagram) {
    if (pl.youtube.some((j) => j.storyboard_id === q.storyboard_id) && !done.has(q.storyboard_id)) continue; // YouTube failed: queue nothing, retry both next run
    const v = findVideo(q.storyboard_id, p)!;
    fs.mkdirSync(q.folder, {recursive: true});
    fs.copyFileSync(path.join(v.outDir, 'reel.mp4'), path.join(q.folder, 'reel.mp4'));
    fs.writeFileSync(path.join(q.folder, 'caption.txt'), `${v.doc.caption}\n\n${(v.doc.hashtags ?? []).join(' ')}\n`);
    fs.writeFileSync(path.join(q.folder, 'post.json'), JSON.stringify({storyboard_id: q.storyboard_id, channel: q.channel, handles: q.handles, scheduled_for: q.scheduled_for}, null, 2) + '\n');
    sent.push(`instagram ${q.storyboard_id}`);
    done.add(q.storyboard_id);
  }
  const rows: LedgerEntry[] = [...done].map((id) => ({
    ...status.get(id)!,
    status: 'dispatched',
    ...(opts.hold ? {} : {scheduled_for: [...pl.youtube, ...pl.instagram].find((x) => x.storyboard_id === id)!.scheduled_for}), // hold: nothing is scheduled
    ...(urls.has(id) ? {post_urls: urls.get(id)} : {}),
    updated_at: at,
  }));
  if (rows.length) fs.appendFileSync(ledgerFile(p), rows.map((r) => JSON.stringify(r) + '\n').join(''));
  return {sent, failed};
};

if (import.meta.main) {
  const envFile = path.join(import.meta.dirname, '..', '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const live = process.argv.includes('--live') && process.env.DISPATCH_LIVE === 'on';
  if (process.argv.includes('--live') && !live) console.log('--live ignored: DISPATCH_LIVE=on is not set in agent-studio/.env (dry run)');
  const pl = plan();
  console.log(`${live ? 'LIVE' : 'DRY RUN'}: ${pl.youtube.length} YouTube, ${pl.instagram.length} Instagram`);
  pl.youtube.forEach((j) => console.log(`  youtube   ${j.storyboard_id} at ${j.scheduled_for}`));
  pl.instagram.forEach((q) => console.log(`  instagram ${q.storyboard_id} (${q.handles.join(', ')}) at ${q.scheduled_for} -> ${path.relative(path.join(PATHS.state, '..'), q.folder)}`));
  pl.blocked.forEach((b) => console.log(`  BLOCKED   ${b}`));
  const hold = process.argv.includes('--hold');
  if (hold) console.log('hold: YouTube uploads stay private with no publish time');
  const r = await dispatch(pl, {live, hold, youtubeUrl: process.env.YOUTUBE_WEBHOOK_URL});
  r.sent.forEach((s) => console.log(`  sent      ${s}`));
  r.failed.forEach((s) => console.log(`  FAILED    ${s}`));
  if (r.failed.length || pl.blocked.length) process.exit(1);
}
