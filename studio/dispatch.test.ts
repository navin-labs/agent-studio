// node studio/dispatch.test.ts : only approved platform variants go out, each to its own (channel, platform) destination: YouTube
// to that channel's own n8n webhook, Instagram and Facebook to queue/<channel>/<platform>/ with a manifest; any mismatch, missing
// manifest, unknown pair, wrong destination, changed video or second queueing is refused. Dry run sends and writes nothing.
// Temp folder only.
import assert from 'node:assert';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {handle} from './approve-server.ts';
import {dispatch, markPublished, plan, resolve, slotTime} from './dispatch.ts';
import {renderVariants} from './fixtures/variants.ts';
import {currentStatus, type LedgerEntry, ledgerFile, lkey, type Paths, reject} from './ledger.ts';
import {file, type Platform, queueFile} from './variant.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(ROOT, 'studio/fixtures/recipes'), channels: path.join(tmp, 'channels'), queue: path.join(tmp, 'queue')};
// a live copy of C1 with a claimed Facebook page (the real one is not live, and its Facebook username is pending); C2 as it is
const c1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c1-automation/channel.json'), 'utf8'));
const FB = {platform: 'facebook', handle: '@theautomationguy.fb', via: 'forge-queue', page_id: '1429203763599559'};
const C1_HOOK = 'http://localhost:5678/webhook/agent-studio-youtube-c1-automation';
const setChannel = (patch: object) => {
  fs.mkdirSync(path.join(p.channels, 'c1-automation'), {recursive: true});
  fs.writeFileSync(path.join(p.channels, 'c1-automation', 'channel.json'), JSON.stringify({...c1, live: true, publishers: c1.publishers.map((x: {platform: string}) => (x.platform === 'facebook' ? FB : x)), ...patch}));
};
const withYoutube = (yt: object) => ({publishers: [...c1.publishers.filter((x: {platform: string}) => x.platform === 'instagram'), {platform: 'youtube', handle: '@theautomationguynavin', via: 'n8n', ...yt}, FB]});
setChannel({});
fs.cpSync(path.join(ROOT, 'channels/c2-reach'), path.join(p.channels, 'c2-reach'), {recursive: true});
const board = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/test/boards/host-supplier-bills.json'), 'utf8'));
fs.mkdirSync(p.content[0], {recursive: true});
fs.mkdirSync(p.state, {recursive: true});
const DATE = '2026-10-01'; // the fixture recipe's slot date

const T = '2026-10-01T10:00:00.000Z';
const sha = (id: string, platform: string) => createHash('sha256').update(`video ${id} ${platform}`).digest('hex'); // the fixture's video bytes
const ok = {approved_by: 'navin', approved_at: T, updated_at: T};
const video = (id: string, o: Partial<Parameters<typeof renderVariants>[2]> = {}) => {
  const doc = {...board, id};
  fs.writeFileSync(path.join(p.content[0], `${id}.json`), JSON.stringify(doc));
  renderVariants(p, doc, {date: DATE, ...o});
};
// an approval carries the hash of the exact video approved
const ledger = (rows: Partial<LedgerEntry>[]) => fs.appendFileSync(ledgerFile(p), rows.map((r) => JSON.stringify({channel: 'c1-automation', platform: 'youtube', ...r, ...(r.approved_by && !r.sha256 ? {sha256: sha(r.storyboard_id!, r.platform ?? 'youtube')} : {})}) + '\n').join(''));
const all = (id: string, extra: Partial<LedgerEntry> = {}) => (['youtube', 'instagram', 'facebook'] as const).map((platform) => ({storyboard_id: id, platform, status: 'approved', ...ok, ...extra}));
const vf = (id: string, platform: Platform, kind: string) => file(p.out, {channel: 'c1-automation', date: DATE, id, platform}, kind);
const editManifest = (id: string, platform: Platform, change: (m: any) => void) => {
  const m = JSON.parse(fs.readFileSync(vf(id, platform, 'manifest.json'), 'utf8'));
  change(m);
  fs.writeFileSync(vf(id, platform, 'manifest.json'), JSON.stringify(m));
};

for (const id of ['v-approved', 'v-pending', 'v-rejected', 'v-revoked', 'v-hand-edit', 'v-dispatched', 'v-mismatch', 'v-no-manifest', 'v-bad-manifest', 'v-wrong-dest', 'v-wrong-page', 'v-stale', 'v-other-channel', 'v-qa-other-file']) video(id);
video('v-qa-now-fails', {qa: {instagram: false}});
video('v-no-video', {mp4: false});
editManifest('v-mismatch', 'instagram', (m) => (m.channel = 'c2-reach'));
fs.rmSync(vf('v-no-manifest', 'facebook', 'manifest.json'));
editManifest('v-bad-manifest', 'facebook', (m) => delete m.destination);
editManifest('v-wrong-dest', 'instagram', (m) => (m.destination.handle = '@someone.else'));
editManifest('v-wrong-page', 'facebook', (m) => (m.destination.page_id = '999'));
const qaOther = vf('v-qa-other-file', 'youtube', 'qa.json');
fs.writeFileSync(qaOther, JSON.stringify({...JSON.parse(fs.readFileSync(qaOther, 'utf8')), video_sha256: 'f'.repeat(64)})); // QA passed another file
fs.writeFileSync(vf('v-stale', 'youtube', 'mp4'), 'a render made after the approval');
ledger([
  ...all('v-approved'),
  {storyboard_id: 'v-pending', status: 'pending-approval', updated_at: T},
  {storyboard_id: 'v-rejected', status: 'rejected', updated_at: T},
  {storyboard_id: 'v-revoked', status: 'approved', ...ok},
  {storyboard_id: 'v-revoked', status: 'rejected', updated_at: T}, // latest line wins
  {storyboard_id: 'v-hand-edit', status: 'approved', updated_at: T}, // typed into the file: no approver, no time, no video hash
  {storyboard_id: 'v-qa-now-fails', platform: 'instagram', status: 'approved', ...ok}, // held alone: its YouTube line still goes
  {storyboard_id: 'v-qa-now-fails', platform: 'youtube', status: 'approved', ...ok},
  {storyboard_id: 'v-no-video', status: 'approved', ...ok},
  {storyboard_id: 'v-dispatched', status: 'approved', ...ok},
  {storyboard_id: 'v-dispatched', status: 'dispatched', ...ok},
  {storyboard_id: 'v-mismatch', platform: 'instagram', status: 'approved', ...ok},
  {storyboard_id: 'v-no-manifest', platform: 'facebook', status: 'approved', ...ok},
  {storyboard_id: 'v-bad-manifest', platform: 'facebook', status: 'approved', ...ok},
  {storyboard_id: 'v-wrong-dest', platform: 'instagram', status: 'approved', ...ok},
  {storyboard_id: 'v-wrong-page', platform: 'facebook', status: 'approved', ...ok},
  {storyboard_id: 'v-stale', status: 'approved', ...ok},
  {storyboard_id: 'v-other-channel', channel: 'c2-reach', status: 'approved', ...ok}, // C1's video on C2's ledger line
  {storyboard_id: 'v-qa-other-file', status: 'approved', ...ok},
  {storyboard_id: 'v-approved', platform: 'tiktok' as never, status: 'approved', ...ok}, // an unknown pair
]);

const NOW = Date.parse(T); // 15:30 IST, before the 19:00 slot
const pl = plan(p, NOW);
assert.deepEqual(pl.youtube.map((j) => j.storyboard_id).sort(), ['v-approved', 'v-qa-now-fails']);
assert.deepEqual(pl.queue.map((q) => `${q.storyboard_id} ${q.platform}`), ['v-approved instagram', 'v-approved facebook']);
const blocked = Object.fromEntries(pl.blocked.map((b) => [b.slice(0, b.indexOf(':')), b.slice(b.indexOf(':') + 2)]));
assert.deepEqual(Object.keys(blocked).sort(), ['v-approved tiktok', 'v-bad-manifest facebook', 'v-hand-edit youtube', 'v-mismatch instagram', 'v-no-manifest facebook', 'v-no-video youtube', 'v-other-channel youtube', 'v-qa-now-fails instagram', 'v-qa-other-file youtube', 'v-stale youtube', 'v-wrong-dest instagram', 'v-wrong-page facebook']);
assert.match(blocked['v-hand-edit youtube'], /missing "approved_by"/);
assert.match(blocked['v-approved tiktok'], /ledger entry invalid/);
assert.match(blocked['v-mismatch instagram'], /the manifest says c2-reach instagram v-mismatch, the ledger says c1-automation instagram v-mismatch: refused/);
assert.match(blocked['v-no-manifest facebook'], /no manifest for the facebook variant/);
assert.match(blocked['v-bad-manifest facebook'], /manifest is malformed .*missing "destination"/);
assert.match(blocked['v-wrong-dest instagram'], /rendered for forge-queue @someone.else, channel.json now says forge-queue @theautomationguynavin: render it again/);
assert.match(blocked['v-wrong-page facebook'], /page 999, channel.json now says forge-queue @theautomationguy.fb page 1429203763599559/);
assert.match(blocked['v-stale youtube'], /the video changed after it was approved/);
assert.match(blocked['v-other-channel youtube'], /belongs to c1-automation, the ledger says c2-reach: refused/);
assert.match(blocked['v-qa-now-fails instagram'], /QA no longer passes/);
assert.match(blocked['v-qa-other-file youtube'], /QA checked another file than this video/);
assert.match(blocked['v-no-video youtube'], /video file missing/);
assert.deepEqual(pl.skipped.sort(), ['v-dispatched youtube: dispatched', 'v-pending youtube: pending-approval', 'v-rejected youtube: rejected', 'v-revoked youtube: rejected']);
const job = pl.youtube.find((j) => j.storyboard_id === 'v-approved')!;
assert.deepEqual([job.channel, job.platform, job.scheduled_for, job.tags, job.webhook], ['c1-automation', 'youtube', '2026-10-01T19:00:00+05:30', ['automation', 'n8n', 'smallbusinessindia', 'accountspayable'], C1_HOOK]);
assert.match(job.description, /DM AUDIT to @theautomationguynavin on Instagram/, 'the YouTube description is the YouTube variant\'s own caption');
assert.match(job.description, /Voiceover: AI-generated voice\./);
assert.deepEqual([pl.queue[0].folder, pl.queue[0].handle, pl.queue[1].page_id], [path.join(p.queue, 'c1-automation', 'instagram'), '@theautomationguynavin', '1429203763599559']);

// not live, a pending platform, a video that shows another account, no webhook of its own, the wrong route: blocked, nothing sent
const why = (key: string) => plan(p, NOW).blocked.find((b) => b.startsWith(key)) ?? '';
setChannel({live: false});
assert.match(why('v-approved youtube'), /not live/);
// a pending username: Facebook without a page_id and Instagram are held (Facebook with a page_id posts to the page: simulate.ts)
setChannel({publishers: c1.publishers.map((q: {platform: string}) => (q.platform === 'facebook' ? {...q, page_id: undefined} : q))});
assert.match(why('v-approved facebook'), /still pending \(pending_retry/);
setChannel({publishers: c1.publishers.map((q: {platform: string}) => (q.platform === 'instagram' ? {...q, handle: 'pending_retry'} : q))});
assert.match(why('v-approved instagram'), /still pending \(pending_retry/);
setChannel(withYoutube({}));
assert.match(why('v-approved youtube'), /no YouTube upload webhook of its own \(\/webhook\/agent-studio-youtube-c1-automation/, 'no shared default: a channel without its own webhook sends nothing');
setChannel(withYoutube({webhook: 'http://localhost:5678/webhook/agent-studio-youtube-c2-reach'}));
assert.match(why('v-approved youtube'), /no YouTube upload webhook of its own/, 'C2\'s workflow can never receive C1\'s video');
setChannel({publishers: c1.publishers.map((x: {platform: string}) => (x.platform === 'instagram' ? {...x, via: 'n8n'} : x.platform === 'facebook' ? FB : x))});
assert.match(why('v-approved instagram'), /sends instagram via n8n; instagram goes via forge-queue: refused/);
setChannel({publishers: c1.publishers.map((x: {platform: string}) => (x.platform === 'facebook' ? {...FB, page_id: undefined} : x))});
assert.match(why('v-approved facebook'), /facebook has no page_id: refused/);
setChannel({});
const rj = vf('v-approved', 'youtube', 'render.json');
const rjText = fs.readFileSync(rj, 'utf8');
fs.writeFileSync(rj, JSON.stringify({handle: '@preview.only'}));
assert.match(why('v-approved youtube'), /shows @preview.only but the youtube account is @theautomationguynavin/);
fs.writeFileSync(rj, rjText);
fs.rmSync(path.join(p.channels, 'c2-reach'), {recursive: true});
assert.match(why('v-other-channel youtube'), /unknown channel c2-reach/);
fs.cpSync(path.join(ROOT, 'channels/c2-reach'), path.join(p.channels, 'c2-reach'), {recursive: true});

// posting times come from data, per platform; a slot already past goes out 15 minutes from now
fs.mkdirSync(path.join(p.state, 'learn'), {recursive: true});
fs.writeFileSync(path.join(p.state, 'learn', 'posting-times.json'), JSON.stringify({'c1-automation': {youtube: '18:30', instagram: '20:15'}}));
const timed = plan(p, NOW);
assert.deepEqual([timed.youtube[0].scheduled_for, timed.queue[0].scheduled_for, timed.queue[1].scheduled_for], ['2026-10-01T18:30:00+05:30', '2026-10-01T20:15:00+05:30', '2026-10-01T19:00:00+05:30']);
fs.rmSync(path.join(p.state, 'learn'), {recursive: true});
assert.equal(slotTime('2026-10-01', '09:00', NOW), '2026-10-01T15:45:00+05:30');

// n8n's pre-upload check on the Mac receiver: yes only for the YouTube variant the dispatcher would send, asked by its own channel
const check = (q: string, now = NOW) => handle(`/dispatch-check?${q}`, 'x'.repeat(16), {paths: p, now}).status;
const ask = (id: string, channel = 'c1-automation', platform = 'youtube') => `id=${id}&channel=${channel}&platform=${platform}`;
assert.equal(check(ask('v-approved')), 200);
assert.equal(check('id=v-approved'), 403, 'channel and platform are required');
assert.equal(check('id=v-approved&channel=c1-automation'), 403, 'no default platform');
assert.equal(check(ask('v-approved', 'c2-reach')), 403, 'another channel\'s workflow (credential) cannot upload it');
assert.equal(check(ask('v-approved', 'c1-automation', 'instagram')), 403, 'a wrong pair is refused');
for (const id of ['v-pending', 'v-hand-edit', 'v-revoked', 'v-dispatched', 'v-stale', 'v-other-channel', 'nope']) assert.equal(check(ask(id)), 403, id);

// dry run: no call, no file, no ledger line
const before = fs.readFileSync(ledgerFile(p), 'utf8');
const noCall = () => {
  throw new Error('dry run must not call out');
};
assert.deepEqual(await dispatch(pl, {live: false, fetch: noCall, paths: p}), {sent: [], failed: []});
assert.equal(fs.readFileSync(ledgerFile(p), 'utf8'), before);
assert.ok(!fs.existsSync(p.queue));
await assert.rejects(dispatch({...pl, youtube: [{...job, webhook: 'http://localhost:5678/webhook/agent-studio-youtube-c2-reach'}]}, {live: true, fetch: noCall, paths: p}), /no webhook of its own channel: nothing sent/);
assert.equal(fs.readFileSync(ledgerFile(p), 'utf8'), before);

const status = (id: string, platform = 'youtube') => currentStatus(p).get(lkey(id, platform))!.status;
const reply = (code: number, body: string) => async () => ({ok: code < 300, status: code, text: async () => body});
const ytOnly = (x = plan(p, NOW)) => ({...x, youtube: x.youtube.filter((j) => j.storyboard_id === 'v-approved'), queue: [], resume: x.resume.filter((k) => k.startsWith('v-approved|'))});

// n8n certainly did not upload (it said so, or the connection never opened): the claim is released, the next run retries
const refused = await dispatch(ytOnly(), {live: true, fetch: reply(403, '{"uploaded":false,"reason":"not approved for dispatch"}'), paths: p});
assert.match(refused.failed[0], /HTTP 403: not approved for dispatch \(will retry\)/);
assert.equal(status('v-approved'), 'approved');
const noN8n = await dispatch(ytOnly(), {live: true, fetch: async () => { throw Object.assign(new TypeError('fetch failed'), {cause: {code: 'ECONNREFUSED'}}); }, paths: p});
assert.match(noN8n.failed[0], /not reachable \(ECONNREFUSED\) \(will retry\)/);
assert.equal(status('v-approved'), 'approved');
assert.equal(currentStatus(p).get(lkey('v-approved', 'youtube'))!.sha256, sha('v-approved', 'youtube'), 'a released claim keeps the approved hash');

// result unknown (5xx, timeout, garbled 200): stays "dispatching", never uploaded again by itself; Navin resolves it
for (const fetch of [reply(502, ''), reply(200, 'garbage'), async () => { throw new Error('timeout'); }]) {
  const r = await dispatch(ytOnly(), {live: true, fetch, paths: p});
  assert.match(r.failed[0], /--resolve v-approved/);
  assert.equal(status('v-approved'), 'dispatching');
  const stuck = ytOnly();
  assert.deepEqual([stuck.youtube.length, stuck.resume, plan(p, NOW).stuck.some((s) => s.startsWith('v-approved youtube'))], [0, [], true]);
  assert.deepEqual(await dispatch(stuck, {live: true, fetch: noCall, paths: p}), {sent: [], failed: []}, 'a stuck video is never sent again');
  resolve('v-approved', 'none', p); // "not in YouTube Studio": back to approved
  assert.equal(status('v-approved'), 'approved');
}
// the claim records the slot, so an unknown upload resolved by Navin keeps its publish time (needed to mark it published)
{
  const slot = ytOnly().youtube[0].scheduled_for;
  await dispatch(ytOnly(), {live: true, fetch: reply(200, 'garbage'), paths: p});
  assert.deepEqual([status('v-approved'), currentStatus(p).get(lkey('v-approved', 'youtube'))!.scheduled_for], ['dispatching', slot]);
  resolve('v-approved', 'none', p);
}
assert.throws(() => resolve('v-approved', 'none', p), /not stuck/);

// the file changed between plan and send: nothing is sent, nothing is claimed
const swapped = plan(p, NOW);
const real = fs.readFileSync(vf('v-approved', 'youtube', 'mp4'));
fs.writeFileSync(vf('v-approved', 'youtube', 'mp4'), 'swapped in after the plan');
assert.match((await dispatch(ytOnly(swapped), {live: true, fetch: noCall, paths: p})).failed[0], /youtube v-approved: the video changed after it was approved; not sent/);
assert.equal(status('v-approved'), 'approved');
fs.writeFileSync(vf('v-approved', 'youtube', 'mp4'), real);

// live: the approved video's three variants go to their three destinations, each marked dispatched on its own line
const calls: {url: string; job: Record<string, unknown>; video: number; thumb: boolean}[] = [];
const live = plan(p, NOW);
const up = await dispatch({...live, youtube: live.youtube.filter((j) => j.storyboard_id === 'v-approved')}, {live: true, fetch: async (u, i) => (calls.push({url: u, job: JSON.parse(String(i.body.get('job'))), video: (i.body.get('video') as File).size, thumb: i.body.has('thumbnail')}), {ok: true, status: 200, text: async () => JSON.stringify({uploaded: true, youtube_id: 'Q8sNfIm_PMU'})}), now: NOW, paths: p});
assert.deepEqual(calls.map((c) => [c.url, c.job.storyboard_id, c.job.channel, c.job.platform, c.video, c.thumb]), [[C1_HOOK, 'v-approved', 'c1-automation', 'youtube', 'video v-approved youtube'.length, true]], 'C1\'s own workflow, nothing else');
assert.deepEqual(up.sent, ['youtube v-approved https://www.youtube.com/shorts/Q8sNfIm_PMU', 'forge-queue v-approved instagram -> queue/c1-automation/instagram', 'forge-queue v-approved facebook -> queue/c1-automation/facebook']);
const qv = (platform: 'instagram' | 'facebook') => ({channel: 'c1-automation', date: DATE, id: 'v-approved', platform});
const pre = (pf: string) => `c1-automation-${pf}-2026-10-01-v-approved`;
assert.deepEqual(fs.readdirSync(path.join(p.queue, 'c1-automation', 'instagram')).sort(), [`${pre('instagram')}.caption.txt`, `${pre('instagram')}.manifest.json`, `${pre('instagram')}.mp4`], 'every file carries channel, platform, date and id; no temp files left');
const fbManifest = JSON.parse(fs.readFileSync(queueFile(p.queue, qv('facebook'), 'manifest.json'), 'utf8'));
assert.deepEqual(fbManifest, {channel: 'c1-automation', platform: 'facebook', video_id: 'v-approved', date: DATE, handle: '@theautomationguy.fb', page_id: '1429203763599559', scheduled_for: '2026-10-01T19:00:00+05:30', video_sha256: sha('v-approved', 'facebook'), files: {video: `${pre('facebook')}.mp4`, caption: `${pre('facebook')}.caption.txt`}});
assert.deepEqual(validate(loadSchema('queue'), fbManifest), []);
assert.equal(fs.readFileSync(queueFile(p.queue, qv('instagram'), 'mp4'), 'utf8'), 'video v-approved instagram', 'Instagram gets its own render, not YouTube\'s');
assert.match(fs.readFileSync(queueFile(p.queue, qv('instagram'), 'caption.txt'), 'utf8'), /DM AUDIT and I will look/);
for (const pf of ['youtube', 'instagram', 'facebook']) assert.equal(status('v-approved', pf), 'dispatched');
const last = currentStatus(p).get(lkey('v-approved', 'youtube'))!;
assert.deepEqual([last.post_urls, last.scheduled_for], [['https://www.youtube.com/shorts/Q8sNfIm_PMU'], '2026-10-01T19:00:00+05:30']);
assert.deepEqual(validate(loadSchema('ledger'), last), []);
assert.equal(check(ask('v-approved')), 403, 'dispatched videos cannot be uploaded again');

// next run: nothing of it left to send
const again = plan(p, NOW);
assert.deepEqual([again.youtube.some((j) => j.storyboard_id === 'v-approved'), again.queue.length], [false, 0]);

// a second approval of something already in the queue (a hand-made ledger line, a restored ledger): never queued twice
ledger([{storyboard_id: 'v-approved', platform: 'instagram', status: 'approved', ...ok}]);
assert.match(why('v-approved instagram'), /already in queue\/c1-automation\/instagram\/ \(c1-automation-instagram-2026-10-01-v-approved\.manifest\.json\): not queued twice/);
ledger([{storyboard_id: 'v-approved', platform: 'instagram', status: 'dispatched', ...ok}]);

// hold: YouTube gets no publish time and the ledger claims no schedule
video('v-hold');
ledger([{storyboard_id: 'v-hold', status: 'approved', ...ok}]);
const sentJobs: {scheduled_for: string}[] = [];
const h = plan(p, NOW);
await dispatch({...h, youtube: h.youtube.filter((j) => j.storyboard_id === 'v-hold')}, {live: true, hold: true, fetch: async (_u, i) => (sentJobs.push(JSON.parse(String(i.body.get('job')))), {ok: true, status: 200, text: async () => JSON.stringify({uploaded: true, youtube_id: 'abcdefghijk'})}), now: NOW, paths: p});
assert.equal(sentJobs[0].scheduled_for, '');
const held = currentStatus(p).get(lkey('v-hold', 'youtube'))!;
assert.deepEqual([held.status, held.scheduled_for, held.post_urls], ['dispatched', undefined, ['https://www.youtube.com/shorts/abcdefghijk']]);

// the Instagram queue write failed after the claim: the next run finishes it, and nothing goes to YouTube for it
video('v-crash');
ledger([{storyboard_id: 'v-crash', platform: 'instagram', status: 'approved', ...ok}]);
const blocker = queueFile(p.queue, {channel: 'c1-automation', date: DATE, id: 'v-crash', platform: 'instagram'}, 'mp4');
fs.mkdirSync(blocker, {recursive: true}); // a folder where the video must go makes the write fail
const half = await dispatch({...plan(p, NOW), youtube: []}, {live: true, fetch: noCall, now: NOW, paths: p});
assert.match(half.failed[0], /forge-queue v-crash instagram: .*the next run finishes it/);
assert.equal(status('v-crash', 'instagram'), 'dispatching');
fs.rmSync(blocker, {recursive: true});
const next = plan(p, NOW);
assert.deepEqual(next.resume, ['v-crash|instagram']);
const done = await dispatch({...next, youtube: []}, {live: true, fetch: noCall, now: NOW, paths: p});
assert.deepEqual([done.failed, status('v-crash', 'instagram'), fs.readFileSync(blocker, 'utf8')], [[], 'dispatched', 'video v-crash instagram']);

// the process died after the YouTube claim, before YouTube answered: unknown, so stuck; Navin finds it in YouTube Studio
video('v-died');
ledger([{storyboard_id: 'v-died', status: 'dispatching', ...ok}]);
assert.match(plan(p, NOW).stuck.join(), /v-died youtube: upload state unknown/);
resolve('v-died', 'diedvideo01', p);
const fin = plan(p, NOW);
const finR = await dispatch({...fin, youtube: [], queue: [], resume: fin.resume.filter((k) => k.startsWith('v-died'))}, {live: true, fetch: noCall, now: NOW, paths: p});
assert.deepEqual([finR.failed, status('v-died'), currentStatus(p).get(lkey('v-died', 'youtube'))!.post_urls], [[], 'dispatched', ['https://www.youtube.com/shorts/diedvideo01']]);

// n8n's pre-upload check accepts a fresh claim (the upload in flight) from its own channel, not a stale one
video('v-flight');
ledger([{storyboard_id: 'v-flight', status: 'dispatching', ...ok, updated_at: new Date(NOW).toISOString()}]);
assert.equal(check(ask('v-flight'), NOW + 60_000), 200);
assert.equal(check(ask('v-flight', 'c2-reach'), NOW + 60_000), 403);
assert.equal(check(ask('v-flight'), NOW + 3600_000), 403);

// a torn last ledger line (crash mid-write) is ignored, and the next write starts on a fresh line
fs.appendFileSync(ledgerFile(p), '{"storyboard_id": "v-to');
assert.equal(status('v-crash', 'instagram'), 'dispatched');
resolve('v-flight', 'none', p);
assert.equal(status('v-flight'), 'approved');

// Forge posted it: <prefix>.posted.json next to the manifest marks that variant published once
const posted = queueFile(p.queue, qv('instagram'), 'posted.json');
fs.writeFileSync(posted, JSON.stringify({posted_at: '2026-10-01T13:30:00Z', url: 'https://www.instagram.com/reel/ABC123/'}));
assert.deepEqual(markPublished(p, NOW), {published: ['v-approved instagram'], problems: []});
assert.deepEqual([status('v-approved', 'instagram'), status('v-approved', 'facebook')], ['published', 'dispatched'], 'each platform on its own');
assert.deepEqual(markPublished(p, NOW).published, [], 'only once');
assert.deepEqual(validate(loadSchema('ledger'), currentStatus(p).get(lkey('v-approved', 'instagram'))), []);
const fbPosted = queueFile(p.queue, qv('facebook'), 'posted.json');
fs.writeFileSync(fbPosted, JSON.stringify({url: 'https://www.instagram.com/reel/XYZ/'}));
assert.match(markPublished(p, NOW).problems[0], /no facebook URL in url/, 'a URL must be on the variant\'s own platform');
fs.copyFileSync(queueFile(p.queue, qv('instagram'), 'manifest.json'), queueFile(p.queue, qv('facebook'), 'manifest.json'));
fs.writeFileSync(fbPosted, JSON.stringify({url: 'https://www.facebook.com/reel/1/'}));
assert.match(markPublished(p, NOW).problems[0], /manifest says c1-automation instagram, the folder is c1-automation\/facebook/);
fs.writeFileSync(queueFile(p.queue, qv('facebook'), 'manifest.json'), JSON.stringify({channel: 'c1-automation', platform: 'facebook'}));
assert.match(markPublished(p, NOW).problems[0], /its manifest is malformed/);
assert.equal(status('v-approved', 'facebook'), 'dispatched', 'a mismatch is never trusted');

// rejected after the plan was made (while earlier uploads ran): nothing of it is claimed, uploaded or queued
video('v-race');
ledger(all('v-race'));
const race = plan(p, NOW);
const only = <T extends {storyboard_id: string}>(xs: T[]) => xs.filter((x) => x.storyboard_id === 'v-race');
assert.deepEqual([only(race.youtube).length, only(race.queue).length], [1, 2], 'v-race is planned on every platform');
reject(['v-race'], p);
const raced = await dispatch({...race, youtube: only(race.youtube), queue: only(race.queue), resume: []}, {live: true, fetch: noCall, paths: p, now: NOW});
assert.deepEqual([raced.sent, status('v-race'), status('v-race', 'instagram'), status('v-race', 'facebook')], [[], 'rejected', 'rejected', 'rejected']);
assert.ok(!fs.existsSync(queueFile(p.queue, {channel: 'c1-automation', date: DATE, id: 'v-race', platform: 'instagram'}, 'manifest.json')));

// taking back a video that is partly out: only the variants still waiting are rejected; what was sent is left as it is
video('v-partly');
ledger([{storyboard_id: 'v-partly', status: 'dispatched', ...ok}, {storyboard_id: 'v-partly', platform: 'instagram', status: 'approved', ...ok}]);
assert.deepEqual(reject(['v-partly'], p), {rejected: ['v-partly instagram'], kept: ['v-partly youtube is dispatched']});
assert.throws(() => reject(['v-partly'], p), /only approved videos can be rejected: v-partly youtube is dispatched, v-partly instagram is rejected/);

// YouTube makes the scheduled upload public at its publish time: the first tick after it records the variant published, once
assert.deepEqual(markPublished(p, NOW).published.filter((x) => x.endsWith('youtube')), [], 'not before 19:00 IST');
assert.deepEqual(markPublished(p, Date.parse('2026-10-01T13:31:00Z')).published.filter((x) => x.endsWith('youtube')), ['v-approved youtube'], 'a held upload (no publish time) stays private');
assert.deepEqual([status('v-approved'), status('v-hold'), markPublished(p, Date.parse('2026-10-01T14:00:00Z')).published.filter((x) => x.endsWith('youtube'))], ['published', 'dispatched', []]);

fs.rmSync(tmp, {recursive: true});
console.log('dispatch ok: each platform variant goes only to its own (channel, platform) destination; mismatched, unmanifested, misdirected, changed or already-queued variants and unknown pairs are refused; refused uploads retry, unknown ones stick for Navin; a crashed queue write resumes; torn ledger lines are safe');
