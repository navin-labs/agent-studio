// node studio/loop.test.ts : the whole production loop through the real contracts, end to end, twice round:
// Feed -> Recipe -> (Forge writes) -> (render + QA) -> Telegram approval -> Ledger -> Dispatch -> (Forge posts) -> Published
// -> Metrics -> Learn -> next week's Recipe. Only the outside parties are fakes: Forge, the renderer, Telegram, n8n/YouTube.
// Temp folder only; nothing is sent anywhere.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SPECS} from '../engine/src/primitives/specs.ts';
import {post} from './approve-server.ts';
import {ideasFile, ingestFeed} from './feed.ts';
import {learnFile} from './learn.ts';
import {currentStatus, type Paths, readFingerprints, readJsonl} from './ledger.ts';
import {due} from './metrics.ts';
import type {Recipe} from './recipe.ts';
import {tick} from './run.ts';
import {onUpdate, type Tg} from './telegram.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(tmp, 'recipes'), channels: path.join(tmp, 'channels')};
const TRENDS = 'https://trends.google.com/trending/rss?geo=IN';
for (const c of ['c1-automation', 'c2-reach', 'c3-studio']) {
  const ch = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels', c, 'channel.json'), 'utf8'));
  fs.mkdirSync(path.join(p.channels, c), {recursive: true});
  fs.writeFileSync(path.join(p.channels, c, 'channel.json'), JSON.stringify({...ch, live: c === 'c1-automation', feeds: [{source: 'google-trends', url: TRENDS}]}));
}
for (const d of [p.state, p.content[0], p.out]) fs.mkdirSync(d, {recursive: true});
const HANDLE = '@theautomationguynavin';
const NAVIN = '111';
const msgs: {method: string; body: any}[] = [];
const tg: Tg = async (method, body) => (msgs.push({method, body}), true);
const DAY = 24 * 3600_000;
const base = {paths: p, tg, chatId: NAVIN, inbox: path.join(tmp, 'inbox'), watcher: () => null, root: tmp};

// 1. Feed: n8n hands the Mac a fetched feed; ideas land for every channel that lists it
const items = Array.from({length: 8}, (_, i) => `<item><title>manual task ${i}</title><ht:news_item_url>https://example.in/news/${i}</ht:news_item_url><pubDate>Wed, 30 Sep 2026 10:00:00 +0530</pubDate></item>`).join('');
assert.equal((await post('/feed', JSON.stringify({url: TRENDS, body: `<rss xmlns:ht="x"><channel>${items}</channel></rss>`}), false, {paths: p, root: tmp})).status, 200);
const ideas = readJsonl<{id: string; source_url: string}>(ideasFile('c1-automation', tmp));
assert.equal(ideas.length, 8);

// 2. Recipe: Thursday's tick plans next week for the live channel and tells Navin
const THU1 = Date.parse('2026-10-01T04:00:00Z'); // Thu 09:30 IST, 2026-W40
let r = await tick({...base, now: THU1});
assert.deepEqual(r.problems, []);
const week1: Recipe[] = JSON.parse(fs.readFileSync(path.join(p.recipes, 'c1-automation', '2026-W41.json'), 'utf8'));
assert.equal(week1.length, 7);

// 3. Forge writes one board per recipe (shots, theme, hook, transitions from the recipe; one idea each, with its link);
// 4. the watcher renders and QA passes (fake renderer: video, qa.json, the handle it showed)
const forgeWrites = (week: Recipe[]) =>
  week.forEach((rc, i) => {
    const idea = ideas[i % ideas.length];
    const doc = {format: 'storyboard', id: rc.id, channel: rc.channel, theme: rc.theme, ...(rc.primitives[0] === 'host-hook' ? {host: 'chiku', captionStyle: 'karaoke'} : {}), hookPattern: rc.hook_pattern,
      scenes: rc.primitives.map((pr, j) => ({primitive: pr, ...(j ? {transition: rc.transitions[j]} : {}), params: SPECS[pr].example, vo: 'One short line.'})),
      caption: `Topic ${rc.id} done by hand.\n\nExample data.\n\nFollow for more.`, hashtags: ['#automation', '#n8n', '#smallbusinessindia'], meta: {source: idea.source_url, idea_id: idea.id, recipe_id: rc.id, hero_metaphor: `metaphor ${rc.id}`}};
    fs.writeFileSync(path.join(p.content[0], `${rc.id}.json`), JSON.stringify(doc));
    const out = path.join(p.out, rc.id);
    fs.mkdirSync(out, {recursive: true});
    fs.writeFileSync(path.join(out, 'reel.mp4'), `video ${rc.id}`);
    fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify({storyboard_id: rc.id, pass: true, checks: []}));
    fs.writeFileSync(path.join(out, 'render.json'), JSON.stringify({handle: HANDLE}));
  });
forgeWrites(week1);

// 5. the next tick shows each QA-passed video on Telegram once, then "Approve all"
r = await tick({...base, now: THU1 + 3600_000});
assert.equal(msgs.filter((m) => m.method === 'sendVideo').length, 7);
const all = msgs.find((m) => m.method === 'sendMessage' && m.body.reply_markup)!.body.reply_markup.inline_keyboard[0][0].callback_data;
assert.equal(all, 'A|c1-automation|2026-W41');

// 6. Navin taps "Approve all": 7 ledger approvals, 7 fingerprints
const SECRET = 'loop-test-secret-0123456789';
assert.match((await onUpdate(tg, {update_id: 1, callback_query: {id: 'q', data: all, from: {id: 111}, message: {chat: {id: 111}}}}, {chatId: NAVIN, secret: SECRET, paths: p, now: THU1 + 7200_000}))!, /^Approved: /);
assert.equal([...currentStatus(p).values()].filter((e) => e.status === 'approved').length, 7);
assert.equal(readFingerprints(p).length, 7);

// 7. Dispatch (live, fake n8n): every video to YouTube once and into Forge's queue
let uploads = 0;
const n8n = async () => ({ok: true, status: 200, text: async () => JSON.stringify({uploaded: true, youtube_id: `yt${String(++uploads).padStart(9, '0')}`})});
r = await tick({...base, now: THU1 + 3 * 3600_000, live: true, youtubeUrl: 'http://n8n.test/yt', fetch: n8n});
assert.deepEqual([r.problems, uploads], [[], 7]);
assert.equal([...currentStatus(p).values()].filter((e) => e.status === 'dispatched').length, 7);
r = await tick({...base, now: THU1 + 4 * 3600_000, live: true, youtubeUrl: 'http://n8n.test/yt', fetch: n8n});
assert.equal(uploads, 7, 'the next tick uploads nothing again');

// 8. Forge posts each queue folder at its time and writes posted.json; the tick marks them published
const queue = path.join(p.state, 'queue', 'instagram');
const folders = fs.readdirSync(queue);
assert.equal(folders.length, 7);
for (const f of folders) {
  const job = JSON.parse(fs.readFileSync(path.join(queue, f, 'post.json'), 'utf8'));
  assert.deepEqual(job.accounts, [{platform: 'instagram', handle: HANDLE}]);
  fs.writeFileSync(path.join(queue, f, 'posted.json'), JSON.stringify({posted_at: job.scheduled_for, urls: {instagram: `https://www.instagram.com/reel/${job.storyboard_id}/`}}));
}
const AFTER = Date.parse('2026-10-12T12:00:00Z'); // the week has been posted
r = await tick({...base, now: AFTER, live: true, youtubeUrl: 'http://n8n.test/yt', fetch: n8n});
const published = [...currentStatus(p).values()].filter((e) => e.status === 'published');
assert.equal(published.length, 7);
assert.ok(published.every((e) => e.post_urls!.length === 2), 'YouTube and Instagram URLs');

// 9. Metrics: Forge reports Instagram (with a pattern: slot 1 and 2 do far better); n8n reports YouTube views when due
fs.mkdirSync(base.inbox, {recursive: true});
for (const [i, rc] of week1.entries()) {
  const good = i < 2;
  fs.writeFileSync(path.join(base.inbox, `${rc.id}-instagram-7d.json`), JSON.stringify({storyboard_id: rc.id, channel: 'c1-automation', platform: 'instagram', window: '7d', reach: 1000, dms: good ? 40 : 2, profile_visits: good ? 60 : 5, sends: 3}));
}
const yt = due(p, AFTER + 2 * DAY);
assert.deepEqual(new Set(yt.filter((d) => d.window === '24h').map((d) => d.storyboard_id)).size, 7, 'every YouTube upload is due its 24h reading (the oldest also their 7d)');
assert.equal((await post('/metrics', JSON.stringify(yt.map((d) => ({storyboard_id: d.storyboard_id, channel: d.channel, platform: 'youtube', window: d.window, reach: 500, views: 500}))), false, {paths: p})).status, 200);
r = await tick({...base, now: AFTER + 2 * DAY});
assert.deepEqual(r.problems, []);
assert.equal(readJsonl(path.join(p.state, 'metrics.jsonl')).length, 7 + yt.length);
assert.deepEqual(due(p, AFTER + 2 * DAY), [], 'nothing due twice');

// 10. Learn -> next Recipe: the next Thursday's tick learns from those numbers and plans the week after with them
const THU3 = Date.parse('2026-10-15T04:00:00Z'); // Thu, 2026-W42 -> plans 2026-W43
r = await tick({...base, now: THU3});
assert.deepEqual(r.problems, []);
const learned = JSON.parse(fs.readFileSync(learnFile('c1-automation', p), 'utf8'));
assert.equal(learned.week, '2026-W43');
assert.equal(learned.videos, 7, 'every published video was scored');
const times = JSON.parse(fs.readFileSync(path.join(p.state, 'learn', 'posting-times.json'), 'utf8'));
assert.ok(times['c1-automation']?.instagram, 'posting times learned from the real schedule');
assert.ok(learned.proven.length > 0, 'proven primitives found');
const week3: Recipe[] = JSON.parse(fs.readFileSync(path.join(p.recipes, 'c1-automation', '2026-W43.json'), 'utf8'));
assert.equal(week3.length, 7);
const benched = learned.bench.map((b: {primitive: string}) => b.primitive);
assert.ok(week3.every((x) => x.primitives.every((q) => !benched.includes(q))), 'the next week avoids what Learn benched');
assert.ok(week3.some((x) => !x.experiment && x.primitives.some((q) => learned.proven.includes(q))), 'the next week uses what Learn proved');
assert.match(msgs.map((m) => m.body.text ?? '').join('\n'), /c1-automation 2026-W43: 7 recipes are ready/);

fs.rmSync(tmp, {recursive: true});
console.log(`loop ok: feed -> recipe -> forge -> QA -> Telegram approval -> ledger -> dispatch -> published -> metrics -> learn (bench ${benched.join(', ') || 'none'}, proven ${learned.proven.length}) -> next week's recipe`);
