// node studio/dispatch.test.ts : only approved ledger entries reach the n8n YouTube call or the Instagram queue; dry run sends and
// writes nothing. Temp folder only.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {handle} from './approve-server.ts';
import {dispatch, markPublished, plan, slotTime} from './dispatch.ts';
import {currentStatus, type LedgerEntry, ledgerFile, type Paths} from './ledger.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(ROOT, 'studio/fixtures/recipes'), channels: path.join(tmp, 'channels')};
// a live copy of C1 (the real one is not live until go-live)
const c1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c1-automation/channel.json'), 'utf8'));
const setChannel = (patch: object) => {
  fs.mkdirSync(path.join(p.channels, 'c1-automation'), {recursive: true});
  fs.writeFileSync(path.join(p.channels, 'c1-automation', 'channel.json'), JSON.stringify({...c1, live: true, ...patch}));
};
setChannel({});
const board = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/content/storyboards/host-supplier-bills.json'), 'utf8'));
fs.mkdirSync(p.content[0], {recursive: true});
fs.mkdirSync(p.state, {recursive: true});

const T = '2026-10-01T10:00:00.000Z';
const ok = {approved_by: 'navin', approved_at: T, targets: ['instagram', 'youtube'], updated_at: T};
const video = (id: string, {qa = true, mp4 = true} = {}) => {
  fs.writeFileSync(path.join(p.content[0], `${id}.json`), JSON.stringify({...board, id}));
  const d = path.join(p.out, id);
  fs.mkdirSync(d, {recursive: true});
  fs.writeFileSync(path.join(d, 'qa.json'), JSON.stringify({storyboard_id: id, pass: qa, checks: []}));
  if (mp4) fs.writeFileSync(path.join(d, 'reel.mp4'), `video ${id}`);
  fs.writeFileSync(path.join(d, 'render.json'), JSON.stringify({handle: '@theautomationguy.navin'}));
};
const ledger = (rows: Partial<LedgerEntry>[]) => fs.appendFileSync(ledgerFile(p), rows.map((r) => JSON.stringify({channel: 'c1-automation', ...r}) + '\n').join(''));

for (const id of ['v-approved', 'v-pending', 'v-rejected', 'v-qa-failed', 'v-rendered', 'v-revoked', 'v-hand-edit', 'v-dispatched']) video(id);
video('v-qa-now-fails', {qa: false});
video('v-no-video', {mp4: false});
ledger([
  {storyboard_id: 'v-approved', status: 'approved', ...ok},
  {storyboard_id: 'v-pending', status: 'pending-approval', updated_at: T},
  {storyboard_id: 'v-rejected', status: 'rejected', updated_at: T},
  {storyboard_id: 'v-qa-failed', status: 'qa-failed', updated_at: T},
  {storyboard_id: 'v-rendered', status: 'rendered', updated_at: T},
  {storyboard_id: 'v-revoked', status: 'approved', ...ok},
  {storyboard_id: 'v-revoked', status: 'rejected', updated_at: T}, // latest line wins
  {storyboard_id: 'v-hand-edit', status: 'approved', updated_at: T}, // typed into the file: no approver, no time
  {storyboard_id: 'v-qa-now-fails', status: 'approved', ...ok},
  {storyboard_id: 'v-no-video', status: 'approved', ...ok},
  {storyboard_id: 'v-dispatched', status: 'approved', ...ok},
  {storyboard_id: 'v-dispatched', status: 'dispatched', ...ok},
]);

const NOW = Date.parse(T); // 15:30 IST, before the 19:00 slot
const pl = plan(p, NOW);
assert.deepEqual(pl.youtube.map((j) => j.storyboard_id), ['v-approved']);
assert.deepEqual(pl.instagram.map((j) => j.storyboard_id), ['v-approved']);
assert.deepEqual(pl.blocked.map((b) => b.split(':')[0]).sort(), ['v-hand-edit', 'v-no-video', 'v-qa-now-fails']);
assert.match(pl.blocked.find((b) => b.startsWith('v-hand-edit'))!, /missing "approved_by"/);
assert.deepEqual(pl.skipped.sort(), ['v-dispatched: dispatched', 'v-pending: pending-approval', 'v-qa-failed: qa-failed', 'v-rejected: rejected', 'v-rendered: rendered', 'v-revoked: rejected']);
const job = pl.youtube[0];
assert.deepEqual([job.scheduled_for, job.tags], ['2026-10-01T19:00:00+05:30', ['automation', 'n8n', 'smallbusinessindia', 'accountspayable']]);
assert.deepEqual(pl.instagram[0].accounts, [{platform: 'instagram', handle: '@theautomationguy.navin'}]);

// not live yet, or the video shows another account: blocked, nothing sent
setChannel({live: false});
assert.match(plan(p, NOW).blocked.find((b) => b.startsWith('v-approved'))!, /not live/);
setChannel({});
fs.writeFileSync(path.join(p.out, 'v-approved', 'render.json'), JSON.stringify({handle: '@preview.only'}));
assert.match(plan(p, NOW).blocked.find((b) => b.startsWith('v-approved'))!, /shows @preview.only but the channel is @theautomationguy.navin/);
fs.writeFileSync(path.join(p.out, 'v-approved', 'render.json'), JSON.stringify({handle: '@theautomationguy.navin'}));

// posting times come from data when Learn has written them; a slot already past goes out 15 minutes from now
fs.mkdirSync(path.join(p.state, 'learn'), {recursive: true});
fs.writeFileSync(path.join(p.state, 'learn', 'posting-times.json'), JSON.stringify({'c1-automation': {youtube: '18:30', instagram: '20:15'}}));
const timed = plan(p, NOW);
assert.deepEqual([timed.youtube[0].scheduled_for, timed.instagram[0].scheduled_for], ['2026-10-01T18:30:00+05:30', '2026-10-01T20:15:00+05:30']);
fs.rmSync(path.join(p.state, 'learn'), {recursive: true});
assert.equal(slotTime('2026-10-01', '09:00', NOW), '2026-10-01T15:45:00+05:30');

// n8n's pre-upload check on the Mac receiver: yes only for what the dispatcher would send
assert.equal(handle('/dispatch-check?id=v-approved', 'x'.repeat(16), {paths: p, now: NOW}).status, 200);
for (const id of ['v-pending', 'v-hand-edit', 'v-revoked', 'v-dispatched', 'nope']) assert.equal(handle(`/dispatch-check?id=${id}`, 'x'.repeat(16), {paths: p, now: NOW}).status, 403, id);

// dry run: no call, no file, no ledger line
const before = fs.readFileSync(ledgerFile(p), 'utf8');
const noCall = () => {
  throw new Error('dry run must not call out');
};
assert.deepEqual(await dispatch(pl, {live: false, fetch: noCall, paths: p}), {sent: [], failed: []});
assert.equal(fs.readFileSync(ledgerFile(p), 'utf8'), before);
assert.ok(!fs.existsSync(path.join(p.state, 'queue')));
await assert.rejects(dispatch(pl, {live: true, fetch: noCall, paths: p}), /YOUTUBE_WEBHOOK_URL/);

// n8n answered 200 but did not upload (or answered garbage): treated as a failure, nothing queued
const odd = await dispatch(pl, {live: true, youtubeUrl: 'http://n8n.test/yt', fetch: async () => ({ok: true, status: 200, text: async () => '{"uploaded":false}'}), paths: p});
assert.match(odd.failed[0], /unexpected reply/);
assert.ok(!fs.existsSync(path.join(p.state, 'queue')));

// live with YouTube down: nothing queued, entry stays approved for a retry
const down = await dispatch(pl, {live: true, youtubeUrl: 'http://n8n.test/yt', fetch: async () => ({ok: false, status: 502, text: async () => ''}), paths: p});
assert.deepEqual(down, {sent: [], failed: ['youtube v-approved: HTTP 502']});
assert.ok(!fs.existsSync(path.join(p.state, 'queue')));
assert.equal(currentStatus(p).get('v-approved')!.status, 'approved');

// live: exactly the approved video is sent, queued and marked dispatched
const calls: string[] = [];
const up = await dispatch(pl, {live: true, youtubeUrl: 'http://n8n.test/yt', fetch: async (_u, i) => (calls.push(JSON.parse(String(i.body.get('job'))).storyboard_id), assert.equal((i.body.get('video') as File).size, 'video v-approved'.length), {ok: true, status: 200, text: async () => JSON.stringify({uploaded: true, youtube_id: 'Q8sNfIm_PMU'})}), now: Date.parse(T), paths: p});
assert.deepEqual(calls, ['v-approved']);
assert.deepEqual(up.sent, ['youtube v-approved https://www.youtube.com/shorts/Q8sNfIm_PMU', 'forge-queue v-approved (instagram)']);
const q = path.join(p.state, 'queue/instagram/2026-10-01-c1-automation-v-approved');
assert.deepEqual(fs.readdirSync(q).sort(), ['caption.txt', 'post.json', 'reel.mp4']);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(q, 'post.json'), 'utf8')), {storyboard_id: 'v-approved', channel: 'c1-automation', accounts: [{platform: 'instagram', handle: '@theautomationguy.navin'}], scheduled_for: '2026-10-01T19:00:00+05:30'});
const last = currentStatus(p).get('v-approved')!;
assert.equal(last.status, 'dispatched');
assert.deepEqual([last.post_urls, last.scheduled_for], [['https://www.youtube.com/shorts/Q8sNfIm_PMU'], '2026-10-01T19:00:00+05:30']);
assert.deepEqual(validate(loadSchema('ledger'), last), []);
assert.deepEqual(fs.readdirSync(path.join(p.state, 'queue/instagram')), ['2026-10-01-c1-automation-v-approved'], 'nothing else was queued');
assert.equal(handle('/dispatch-check?id=v-approved', 'x'.repeat(16), {paths: p, now: NOW}).status, 403, 'dispatched videos cannot be uploaded again');

// next run: nothing left to send
const again = plan(p, NOW);
assert.deepEqual([again.youtube.length, again.instagram.length], [0, 0]);

// hold: YouTube gets no publish time and the ledger claims no schedule
video('v-hold');
ledger([{storyboard_id: 'v-hold', status: 'approved', ...ok}]);
const sentJobs: {scheduled_for: string}[] = [];
await dispatch(plan(p, NOW), {live: true, hold: true, youtubeUrl: 'http://n8n.test/yt', fetch: async (_u, i) => (sentJobs.push(JSON.parse(String(i.body.get('job')))), {ok: true, status: 200, text: async () => JSON.stringify({uploaded: true, youtube_id: 'abcdefghijk'})}), now: NOW, paths: p});
assert.equal(sentJobs[0].scheduled_for, '');
const held = currentStatus(p).get('v-hold')!;
assert.deepEqual([held.status, held.scheduled_for, held.post_urls], ['dispatched', undefined, ['https://www.youtube.com/shorts/abcdefghijk']]);

// Forge posted it: posted.json in the queue folder marks it published once, keeping the YouTube URL
fs.writeFileSync(path.join(q, 'posted.json'), JSON.stringify({posted_at: '2026-10-01T13:30:00Z', urls: {instagram: 'https://www.instagram.com/reel/ABC123/'}}));
assert.deepEqual(markPublished(p, NOW), {published: ['v-approved'], problems: []});
assert.deepEqual(currentStatus(p).get('v-approved')!.post_urls, ['https://www.youtube.com/shorts/Q8sNfIm_PMU', 'https://www.instagram.com/reel/ABC123/']);
assert.deepEqual(markPublished(p, NOW).published, [], 'only once');
assert.deepEqual(validate(loadSchema('ledger'), currentStatus(p).get('v-approved')), []);
fs.writeFileSync(path.join(q, 'posted.json'), JSON.stringify({urls: {instagram: 'https://evil.example/x'}}));
assert.match(markPublished(p, NOW).problems[0], /no instagram.com or facebook.com URL/);
fs.rmSync(path.join(q, 'posted.json'));

// a channel with its own YouTube workflow: the job goes to that webhook
setChannel({publishers: c1.publishers.map((x: {platform: string}) => (x.platform === 'youtube' ? {...x, webhook: 'http://localhost:5678/webhook/agent-studio-youtube-c1'} : x))});
video('v-own-yt');
ledger([{storyboard_id: 'v-own-yt', status: 'approved', ...ok}]);
const urls: string[] = [];
await dispatch({...plan(p, NOW), instagram: []}, {live: true, fetch: async (u) => (urls.push(u), {ok: true, status: 200, text: async () => JSON.stringify({uploaded: true, youtube_id: 'abcdefghij2'})}), now: NOW, paths: p});
assert.deepEqual(urls, ['http://localhost:5678/webhook/agent-studio-youtube-c1'], 'no global URL needed');

// Facebook rides in the same Forge queue folder when the channel has a Facebook account and the approval targets it
setChannel({publishers: [...c1.publishers, {platform: 'facebook', handle: '@theautomationguy.fb', via: 'forge-queue'}]});
video('v-fb');
ledger([{storyboard_id: 'v-fb', status: 'approved', ...ok, targets: ['instagram', 'facebook', 'youtube']}]);
assert.deepEqual(plan(p, NOW).instagram.find((q) => q.storyboard_id === 'v-fb')!.accounts, [{platform: 'instagram', handle: '@theautomationguy.navin'}, {platform: 'facebook', handle: '@theautomationguy.fb'}]);

fs.rmSync(tmp, {recursive: true});
console.log('dispatch ok: only approved entries reach YouTube or the Instagram queue; dry run sends and writes nothing');
