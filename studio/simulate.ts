// node studio/simulate.ts : a full production cycle on REAL renders, in a temp sandbox; nothing is sent anywhere (n8n and Telegram
// are fakes, the queue is a temp folder). C1 and C2 masters, each with its YouTube, Instagram and Facebook variant, go through the
// real QA results, the Telegram message, one approval tap, the ledger, dispatch routing, queue placement and the refusals.
// First render the test boards (engine/test/out, never production out/) and QA them:
//   cd engine && VOICE=on npm run make -- test/style-c1.json test/style-c2.json
//   node studio/qa.ts engine/test/style-c1.json --out engine/test/out --recipes engine/test/recipes --date <render date>   (and style-c2)
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {handle} from './approve-server.ts';
import {dispatch, markPublished, plan} from './dispatch.ts';
import {renderVariants} from './fixtures/variants.ts';
import {currentStatus, ledgerFile, lkey, type Paths} from './ledger.ts';
import {onUpdate, send, type Tg} from './telegram.ts';
import {file, findVariants, PLATFORMS, queueFile} from './variant.ts';

const ROOT = path.join(import.meta.dirname, '..');
const RENDERS = path.join(ROOT, 'engine/test/out');
const MASTERS = [{id: 'style-c1', channel: 'c1-automation'}, {id: 'style-c2', channel: 'c2-reach'}];
for (const m of MASTERS) assert.equal(findVariants(RENDERS, m.id).length, 3, `${m.id}: render the test boards first (see the header)`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'simulate-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(tmp, 'recipes'), channels: path.join(tmp, 'channels'), queue: path.join(tmp, 'queue')};
fs.cpSync(RENDERS, p.out, {recursive: true}); // a copy: the refusals below tamper with it
fs.cpSync(path.join(ROOT, 'engine/test/recipes'), p.recipes, {recursive: true});
fs.mkdirSync(p.content[0], {recursive: true});
for (const m of MASTERS) fs.copyFileSync(path.join(ROOT, 'engine/test', `${m.id}.json`), path.join(p.content[0], `${m.id}.json`));
const chFile = (c: string) => path.join(p.channels, c, 'channel.json');
const real = (c: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'channels', c, 'channel.json'), 'utf8'));
const setChannel = (c: string, patch: object = {}) => (fs.mkdirSync(path.dirname(chFile(c)), {recursive: true}), fs.writeFileSync(chFile(c), JSON.stringify({...real(c), live: true, ...patch})));
for (const m of MASTERS) setChannel(m.channel); // the real channel files, switched live in the sandbox only
const report: [string, string][] = [];
const ok = (what: string, detail = '') => report.push([what, detail]);
const NOW = Date.parse('2026-10-03T08:00:00Z'); // 13:30 IST, before the 19:00 slot

// 1. renders: three distinct videos per master, canonical folders and names, manifests that describe them
for (const m of MASTERS)
  for (const v of findVariants(p.out, m.id)) {
    const man = JSON.parse(fs.readFileSync(file(p.out, v, 'manifest.json'), 'utf8'));
    assert.deepEqual(validate(loadSchema('manifest'), man), [], `${m.id} ${v.platform} manifest`);
    assert.deepEqual([man.channel, man.platform, man.video_id], [m.channel, v.platform, m.id]);
    assert.ok(fs.readdirSync(path.dirname(file(p.out, v, 'mp4'))).every((f) => f.startsWith(`${m.channel}-${v.platform}-${v.date}-${m.id}.`)), 'every file name carries channel, platform, date, id');
    ok(`${m.id} ${v.platform}`, `${path.relative(p.out, path.dirname(file(p.out, v, 'mp4')))}/ CTA "${man.cta_text}" ("${man.cta_say}"), end card ${man.end_card_handle ?? 'no account'}, QA ${man.qa_status}`);
  }
const shas = MASTERS.flatMap((m) => findVariants(p.out, m.id).map((v) => JSON.parse(fs.readFileSync(file(p.out, v, 'manifest.json'), 'utf8')).video_sha256));
assert.equal(new Set(shas).size, 6, 'six different videos: no variant is a copy of another');

// 2. Telegram: one message per master listing its variants; one tap approves the ready ones, the held one stays held
const msgs: {method: string; body: any}[] = [];
const tg: Tg = async (method, body) => (msgs.push({method, body}), true);
const NAVIN = '111';
const SECRET = 'simulate-secret-0123456789';
for (const m of MASTERS) assert.deepEqual(await send(tg, NAVIN, m.channel, '2026-W41', p), [m.id]);
for (const msg of msgs.filter((x) => x.method === 'sendVideo')) {
  const text = String(msg.body.get('caption'));
  assert.match(text, /youtube: ready, CTA "Subscribe"/);
  assert.match(text, /instagram: ready, CTA "Follow"/);
  assert.match(text, /facebook: HELD/);
  ok('telegram message', text.split('\n').filter((l) => /^(youtube|instagram|facebook):/.test(l)).join(' | ').slice(0, 160));
}
for (const m of MASTERS) {
  const reply = await onUpdate(tg, {update_id: 1, callback_query: {id: 'q', data: `a|${m.id}`, from: {id: 111}, message: {chat: {id: 111}}}}, {chatId: NAVIN, secret: SECRET, paths: p, now: NOW});
  assert.equal(reply, `Approved: ${m.id} (instagram, youtube)`);
  assert.equal(currentStatus(p).get(lkey(m.id, 'facebook')), undefined, 'the held Facebook variant is not approved');
  ok(`approve ${m.id}`, reply!);
}

// 3. dispatch plan: each variant to its own (channel, platform) destination, at its slot
const pl = plan(p, NOW);
assert.deepEqual(pl.youtube.map((j) => [j.storyboard_id, j.webhook, j.scheduled_for]), [
  ['style-c1', 'http://localhost:5678/webhook/agent-studio-youtube-c1-automation', '2026-10-03T19:00:00+05:30'],
  ['style-c2', 'http://localhost:5678/webhook/agent-studio-youtube-c2-reach', '2026-10-03T19:00:00+05:30'],
]);
assert.deepEqual(pl.queue.map((q) => [q.storyboard_id, path.relative(p.queue, q.folder), q.handle]), [['style-c1', 'c1-automation/instagram', '@theautomationguynavin'], ['style-c2', 'c2-reach/instagram', '@backstory.minute']]);
assert.deepEqual([pl.blocked, pl.stuck], [[], []]);
ok('plan', `${pl.youtube.length} YouTube jobs (each to its own channel's webhook), ${pl.queue.length} queue items, 0 blocked`);

// 4. refusals: every one fails closed, with its reason (each change undone after)
const why = (key: string) => plan(p, NOW).blocked.find((b) => b.startsWith(key)) ?? '';
const v1 = (pf: (typeof PLATFORMS)[number], kind: string) => file(p.out, findVariants(p.out, 'style-c1').find((v) => v.platform === pf)!, kind);
const refuse = (what: string, key: string, change: () => () => void, want: RegExp) => {
  const undo = change();
  const r = why(key);
  undo();
  assert.match(r, want, what);
  ok(`refused: ${what}`, r.slice(key.length + 2, key.length + 140));
};
const edit = (f: string, change: (j: any) => void) => () => {
  const before = fs.readFileSync(f, 'utf8');
  const j = JSON.parse(before);
  change(j);
  fs.writeFileSync(f, JSON.stringify(j));
  return () => fs.writeFileSync(f, before);
};
const line = (row: object) => () => {
  const before = fs.readFileSync(ledgerFile(p), 'utf8');
  fs.appendFileSync(ledgerFile(p), JSON.stringify(row) + '\n');
  return () => fs.writeFileSync(ledgerFile(p), before);
};
const approved = currentStatus(p).get(lkey('style-c1', 'youtube'))!;
refuse('incorrect routing (C1 pointed at C2\'s workflow)', 'style-c1 youtube', edit(chFile('c1-automation'), (c) => (c.publishers.find((x: {platform: string}) => x.platform === 'youtube').webhook = 'http://localhost:5678/webhook/agent-studio-youtube-c2-reach')), /no YouTube upload webhook of its own/);
refuse('missing manifest', 'style-c1 instagram', () => (fs.renameSync(v1('instagram', 'manifest.json'), `${v1('instagram', 'manifest.json')}.x`), () => fs.renameSync(`${v1('instagram', 'manifest.json')}.x`, v1('instagram', 'manifest.json'))), /no manifest for the instagram variant/);
refuse('unknown platform', 'style-c1 tiktok', line({...approved, platform: 'tiktok'}), /ledger entry invalid/);
refuse('wrong channel/platform pair', 'style-c1 instagram', edit(v1('instagram', 'manifest.json'), (m) => (m.platform = 'facebook')), /the manifest says c1-automation facebook style-c1, the ledger says c1-automation instagram style-c1: refused/);
refuse('wrong channel on the ledger line', 'style-c1 youtube', line({...approved, channel: 'c2-reach'}), /belongs to c1-automation, the ledger says c2-reach: refused/);
refuse('wrong destination handle', 'style-c1 instagram', edit(v1('instagram', 'manifest.json'), (m) => (m.destination.handle = '@someone.else')), /rendered for forge-queue @someone.else/);
refuse('stale approval (video changed after approval)', 'style-c1 youtube', () => {
  const f = v1('youtube', 'mp4');
  const before = fs.readFileSync(f);
  fs.appendFileSync(f, 'x');
  return () => fs.writeFileSync(f, before);
}, /the video changed after it was approved/);
{
  const undo = line({...approved, status: 'rejected'})(); // taken back: skipped, never sent
  const x = plan(p, NOW);
  undo();
  assert.ok(x.skipped.includes('style-c1 youtube: rejected') && !x.youtube.some((j) => j.storyboard_id === 'style-c1'));
  ok('refused: approval taken back', 'style-c1 youtube: rejected (skipped, not sent)');
}
assert.ok(plan(p, NOW).youtube.some((j) => j.storyboard_id === 'style-c1'), 'every change was undone');
const check = (q: string) => handle(`/dispatch-check?${q}`, 'x'.repeat(16), {paths: p, now: NOW}).status;
assert.deepEqual([check('id=style-c1&channel=c1-automation&platform=youtube'), check('id=style-c1&channel=c2-reach&platform=youtube'), check('id=style-c1&channel=c1-automation&platform=instagram'), check('id=style-c1')], [200, 403, 403, 403]);
ok('n8n dispatch-check', 'C1 workflow 200; C2 workflow asking for C1\'s video 403; wrong platform 403; no channel 403');

// 5. live dispatch with a fake n8n: two uploads, each to its own channel's workflow; Instagram items in their own queue folders
const calls: {url: string; job: any}[] = [];
let n = 0;
const n8n = async (url: string, init: {body: FormData}) => (calls.push({url, job: JSON.parse(String(init.body.get('job')))}), {ok: true, status: 200, text: async () => JSON.stringify({uploaded: true, youtube_id: `simvideo00${++n}`})});
const r = await dispatch(pl, {live: true, fetch: n8n, paths: p, now: NOW});
assert.deepEqual(r.failed, []);
assert.deepEqual(calls.map((c) => [c.url.split('/').pop(), c.job.channel, c.job.platform]), [['agent-studio-youtube-c1-automation', 'c1-automation', 'youtube'], ['agent-studio-youtube-c2-reach', 'c2-reach', 'youtube']]);
for (const m of MASTERS) {
  const v = findVariants(p.out, m.id).find((x) => x.platform === 'instagram')!;
  const qm = JSON.parse(fs.readFileSync(queueFile(p.queue, v, 'manifest.json'), 'utf8'));
  assert.deepEqual(validate(loadSchema('queue'), qm), []);
  assert.deepEqual([qm.channel, qm.platform, qm.video_id, qm.scheduled_for], [m.channel, 'instagram', m.id, '2026-10-03T19:00:00+05:30']);
  assert.ok(fs.existsSync(queueFile(p.queue, v, 'mp4')) && fs.existsSync(queueFile(p.queue, v, 'caption.txt')));
  ok(`queue ${m.id}`, `queue/${m.channel}/instagram/: ${fs.readdirSync(path.dirname(queueFile(p.queue, v, 'mp4'))).join(', ')}; handle ${qm.handle}`);
}
assert.ok(!fs.existsSync(path.join(p.queue, 'c1-automation', 'facebook')) && !fs.existsSync(path.join(p.queue, 'c2-reach', 'facebook')), 'held Facebook variants never reach the queue');
assert.equal([...currentStatus(p).values()].filter((e) => e.status === 'dispatched').length, 4);
ok('dispatch', r.sent.join('; '));

// 6. duplicates: the next run sends nothing; n8n is told no; a hand-made second approval is not queued twice
const again = plan(p, NOW);
assert.deepEqual([again.youtube.length, again.queue.length, (await dispatch(again, {live: true, fetch: n8n, paths: p, now: NOW})).sent.length, n], [0, 0, 0, 2]);
assert.equal(check('id=style-c1&channel=c1-automation&platform=youtube'), 403);
refuse('duplicate queue item', 'style-c1 instagram', line({...currentStatus(p).get(lkey('style-c1', 'instagram'))!, status: 'approved'}), /not queued twice/);
ok('duplicates', 'second run: 0 uploads, 0 queue writes; dispatch-check 403 after dispatch');

// 7. Facebook claimed (sandbox only, fixture render): the same tap queues it in queue/<channel>/facebook/ with its page ID
setChannel('c1-automation', {publishers: real('c1-automation').publishers.map((x: {platform: string}) => (x.platform === 'facebook' ? {...x, handle: '@simulated.page'} : x))});
const fb = {...JSON.parse(fs.readFileSync(path.join(p.content[0], 'style-c1.json'), 'utf8')), id: 'sim-fb'};
fs.writeFileSync(path.join(p.content[0], 'sim-fb.json'), JSON.stringify(fb));
renderVariants(p, fb, {date: '2026-10-03'});
await onUpdate(tg, {update_id: 2, callback_query: {id: 'q', data: 'a|sim-fb', from: {id: 111}, message: {chat: {id: 111}}}}, {chatId: NAVIN, secret: SECRET, paths: p, now: NOW + 1000});
assert.equal(currentStatus(p).get(lkey('sim-fb', 'facebook'))?.status, 'approved');
const fbPlan = plan(p, NOW);
await dispatch({...fbPlan, youtube: []}, {live: true, fetch: n8n, paths: p, now: NOW});
const fbm = JSON.parse(fs.readFileSync(queueFile(p.queue, {channel: 'c1-automation', date: '2026-10-03', id: 'sim-fb', platform: 'facebook'}, 'manifest.json'), 'utf8'));
assert.deepEqual([fbm.platform, fbm.handle, fbm.page_id], ['facebook', '@simulated.page', real('c1-automation').publishers.find((x: {platform: string}) => x.platform === 'facebook').page_id]);
ok('facebook (claimed, sandbox)', `queue/c1-automation/facebook/ to page ${fbm.page_id}`);

// 8. published: Forge's posted file marks one variant; YouTube once its publish time has passed
fs.writeFileSync(queueFile(p.queue, findVariants(p.out, 'style-c1').find((v) => v.platform === 'instagram')!, 'posted.json'), JSON.stringify({posted_at: '2026-10-03T19:00:05+05:30', url: 'https://www.instagram.com/reel/SIM/'}));
const pub = markPublished(p, Date.parse('2026-10-03T14:00:00Z'));
assert.deepEqual(pub.problems, []);
ok('published', pub.published.join(', '));

fs.rmSync(tmp, {recursive: true});
const w = Math.max(...report.map(([a]) => a.length));
console.log(report.map(([a, b]) => `${a.padEnd(w)}  ${b}`).join('\n'));
console.log('\nsimulate ok: 2 masters x 3 platform variants; YouTube and Instagram approved and routed to their own channel; Facebook held (username pending); every refusal failed closed; nothing sent anywhere');
