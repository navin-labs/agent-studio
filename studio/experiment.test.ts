// node studio/experiment.test.ts : a published video with an arm B rotates A/B by Pacific day (ABBAAB), the control comes back,
// the evidence is CTR when YouTube gives it and plainly "views, not CTR" when not, and B is applied for good only after Navin's
// separate "Adopt B". Nothing runs without EXPERIMENTS=on and a live channel. Temp folder only; n8n and Telegram are fakes.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {post, handle} from './approve-server.ts';
import {armOn, datesOf, daysDue, decide, eventsFile, evidence, experiments, pacificDate, step, type Day} from './experiment.ts';
import {ledgerFile, type Paths, readJsonl} from './ledger.ts';
import {file, variantDir} from './variant.ts';
import {tick} from './run.ts';
import {onUpdate, type Tg} from './telegram.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'experiment-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(tmp, 'recipes'), channels: path.join(tmp, 'channels'), queue: path.join(tmp, 'queue')};
for (const d of [p.state, p.content[0], path.join(p.channels, 'c2-reach')]) fs.mkdirSync(d, {recursive: true});
const ch = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c2-reach/channel.json'), 'utf8'));
fs.writeFileSync(path.join(p.channels, 'c2-reach', 'channel.json'), JSON.stringify({...ch, live: true}));

// the pattern: publish day skipped, then A B B A A B, then the control for good
const d0 = '2026-10-11';
assert.deepEqual(datesOf(d0).map((d) => armOn(d0, d)).join(''), 'abbaab');
assert.deepEqual([armOn(d0, '2026-10-10'), armOn(d0, '2026-10-17'), armOn(d0, '2026-11-30')], ['a', 'a', 'a']);

// evidence: CTR when every day has it (z-test, minimum impressions), views otherwise (said so), a retention guard on B
const day = (date: string, o: Partial<Day>): Day => ({storyboard_id: 'c2-x', date, views: 100, ...o});
const ctr = (a: number, b: number, n = 2000, pct?: [number, number]) => datesOf(d0).map((d) => (armOn(d0, d) === 'a' ? day(d, {impressions: n, ctr: a, avg_view_pct: pct?.[0]}) : day(d, {impressions: n, ctr: b, avg_view_pct: pct?.[1]})));
assert.equal(evidence(ctr(0.04, 0.05), d0)!.verdict, 'b');
assert.match(evidence(ctr(0.04, 0.05), d0)!.text, /^CTR A 4\.00% \(6000 impressions\) vs B 5\.00%/);
assert.equal(evidence(ctr(0.05, 0.04), d0)!.verdict, 'a');
assert.equal(evidence(ctr(0.04, 0.041), d0)!.verdict, 'inconclusive', 'a small gap is not a win');
assert.equal(evidence(ctr(0.04, 0.05, 200), d0)!.verdict, 'inconclusive', 'too few impressions');
assert.equal(evidence(ctr(0.04, 0.05, 2000, [60, 40]), d0)!.verdict, 'inconclusive', 'B gets clicks but loses viewers');
const views = datesOf(d0).map((d) => day(d, {views: armOn(d0, d) === 'a' ? 300 : 450}));
assert.equal(evidence(views, d0)!.verdict, 'b');
assert.match(evidence(views, d0)!.text, /^views, not CTR/);
assert.equal(evidence(views.slice(0, 5), d0), null, 'no result before every day is in');

// a published C2 video with an arm B
const id = 'c2-x';
const board = {format: 'storyboard', id, channel: 'c2-reach', theme: 'archive', caption: 'Who drew the first barcode in 1948?\n\nStory.\n\nSource: https://example.org/b', meta: {source: 'https://example.org/b', idea_id: 'i', recipe_id: 'r', title_b: 'The barcode began as lines in the sand', thumb_b: 'Lines in *sand*'}, scenes: []};
fs.writeFileSync(path.join(p.content[0], `${id}.json`), JSON.stringify(board));
// its YouTube variant (the experiment's arms are YouTube's thumbnails; the description is that variant's caption)
const yv = {channel: 'c2-reach', date: '2026-10-10', id, platform: 'youtube' as const};
fs.mkdirSync(variantDir(p.out, yv), {recursive: true});
for (const [k, body] of [['thumbnail.png', 'arm a'], ['thumbnail-b.png', 'arm b'], ['caption.txt', `${board.caption}\n\nSubscribe for more backstories.\n`]]) fs.writeFileSync(file(p.out, yv, k), body);
const pub = '2026-10-10T19:00:00+05:30';
fs.writeFileSync(ledgerFile(p), JSON.stringify({storyboard_id: id, channel: 'c2-reach', platform: 'youtube', status: 'published', approved_by: 'navin', approved_at: pub, sha256: '0'.repeat(64), scheduled_for: pub, post_urls: ['https://www.youtube.com/shorts/Q8sNfIm_PMU'], updated_at: pub}) + '\n');
const [x] = experiments(p);
assert.deepEqual([x.video_id, x.day0], ['Q8sNfIm_PMU', d0]);

// the hourly tick drives it (fake n8n packaging webhook, fake Telegram); off by default
const calls: {url: string; job: any; thumb: boolean}[] = [];
const n8n = (async (url: string, init: {body: FormData}) => (calls.push({url, job: JSON.parse(String(init.body.get('job'))), thumb: init.body.has('thumbnail')}), {ok: true, status: 200})) as unknown as typeof fetch;
const msgs: any[] = [];
const tg: Tg = async (method, body) => (msgs.push({method, body}), true);
const at = (date: string) => Date.parse(`${date}T20:00:00Z`); // noon Pacific
const run = (date: string, on = true) => tick({paths: p, now: at(date), experiments: on, packaging: {fetch: n8n, base: 'http://n8n.test'}, tg, chatId: '1', watcher: () => null, inbox: path.join(tmp, 'inbox')});
await run('2026-10-12', false);
assert.equal(calls.length, 0, 'EXPERIMENTS off: nothing touches YouTube');
await run('2026-10-11');
assert.equal(calls.length, 0, 'day 1 is A, already live');
await run('2026-10-12');
assert.deepEqual(calls.map((c) => [c.url, c.job.title, c.thumb, c.job.category_id]), [['http://n8n.test/agent-studio-packaging-c2-reach', 'The barcode began as lines in the sand', true, '27']]);
assert.match(calls[0].job.description, /Source: https:\/\/example\.org\/b/, 'the description goes with the title, unchanged');
await run('2026-10-13');
assert.equal(calls.length, 1, 'still B, no call');
await run('2026-10-14');
assert.equal(calls.at(-1)!.job.title, 'Who drew the first barcode in 1948?', 'back to A');
await run('2026-10-16');
assert.equal(calls.at(-1)!.job.title, 'The barcode began as lines in the sand', 'the last B day');
await run('2026-10-17');
assert.equal(calls.at(-1)!.job.title, 'Who drew the first barcode in 1948?', 'control restored after the last B day');
const nCalls = calls.length;

// n8n reports the six days (through the receiver); the result goes to Navin once, with the separate decision
assert.deepEqual(JSON.parse(handle('/experiment-days-due', 'x'.repeat(16), {paths: p, now: at('2026-10-18')}).body)[0].dates, datesOf(d0));
assert.equal((await post('/experiment-days', JSON.stringify(ctr(0.04, 0.05)), false, {paths: p})).status, 200);
assert.equal((await post('/experiment-days', JSON.stringify([{storyboard_id: id}]), false, {paths: p})).status, 400);
assert.deepEqual(daysDue(p, at('2026-10-18')), []);
assert.equal(JSON.parse(handle('/experiment-days-due?channel=c1-automation', 'x'.repeat(16), {paths: p, now: at('2026-10-12')}).body).length, 0, 'each channel sees only its own');
const want = step(p, at('2026-10-15')).actions; // what the tick would apply that day (nothing until the result; checked against the receiver)
assert.equal(handle(`/packaging-check?id=${id}&channel=c2-reach&video_id=Q8sNfIm_PMU&title=${encodeURIComponent('anything')}`, 'x'.repeat(16), {paths: p, now: at('2026-10-15')}).status, 403, 'n8n refuses a title change nobody planned');
assert.equal(want.length, 0);
await run('2026-10-18');
await run('2026-10-19');
const res = msgs.filter((m) => /experiment \(control restored\)/.test(m.body?.text ?? ''));
assert.equal(res.length, 1, 'the result is reported once');
assert.deepEqual(res[0].body.reply_markup.inline_keyboard[0].map((b: {callback_data: string}) => b.callback_data), [`x|${id}|adopt`, `x|${id}|keep`]);
assert.equal(calls.length, nCalls, 'no winner is applied before Navin decides');

// only Navin's tap decides; B is then applied for good by the next tick; a second decision is refused
assert.equal(await onUpdate(tg, {update_id: 1, callback_query: {id: 'q', data: `x|${id}|adopt`, from: {id: 2}, message: {chat: {id: 2}}}}, {chatId: '1', secret: 's'.repeat(20), paths: p}), 'Not allowed.');
assert.match((await onUpdate(tg, {update_id: 2, callback_query: {id: 'q', data: `x|${id}|adopt`, from: {id: 1}, message: {chat: {id: 1}}}}, {chatId: '1', secret: 's'.repeat(20), paths: p}))!, /B adopted/);
assert.throws(() => decide(p, id, 'keep'), /already decided/);
assert.equal(handle(`/packaging-check?id=${id}&channel=c2-reach&video_id=Q8sNfIm_PMU&title=${encodeURIComponent('The barcode began as lines in the sand')}`, 'x'.repeat(16), {paths: p, now: at('2026-10-20')}).status, 200, 'the adopted B is allowed');
assert.equal(handle(`/packaging-check?id=${id}&video_id=Q8sNfIm_PMU&title=${encodeURIComponent('The barcode began as lines in the sand')}`, 'x'.repeat(16), {paths: p, now: at('2026-10-20')}).status, 403, 'asked without its channel: refused');
assert.equal(handle(`/packaging-check?id=${id}&channel=c1-automation&video_id=Q8sNfIm_PMU&title=${encodeURIComponent('The barcode began as lines in the sand')}`, 'x'.repeat(16), {paths: p, now: at('2026-10-20')}).status, 403, 'another channel\'s workflow: refused');
await run('2026-10-20');
assert.equal(calls.at(-1)!.job.title, 'The barcode began as lines in the sand', 'B applied after the adopt tap');
await run('2026-10-21');
assert.equal(step(p, at('2026-10-21')).actions.length, 0, 'B stays');
assert.deepEqual(readJsonl<{event: string}>(eventsFile(p)).map((e) => e.event).filter((e) => e !== 'apply'), ['result', 'adopt']);
assert.equal(pacificDate(Date.parse('2026-10-11T06:59:00Z')), '2026-10-10', 'Analytics days are Pacific dates');

fs.rmSync(tmp, {recursive: true});
console.log('experiment ok: ABBAAB by Pacific day, control restored, CTR evidence (views plainly labelled otherwise), result once, B adopted only on Navin\'s tap; off unless EXPERIMENTS=on');
