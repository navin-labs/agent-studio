// node studio/telegram.test.ts : the week goes to Telegram with Approve buttons; only taps from Navin's chat approve, through the
// same signed-approval checks as the web links. Fake Telegram, temp folder; never touches state/ or the network.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {currentStatus, type Paths} from './ledger.ts';
import {applyResolve, dispatch, plan, resolveQuery} from './dispatch.ts';
import {askResolve, onUpdate, send, type Tg, youtubeId} from './telegram.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'telegram-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(ROOT, 'studio/fixtures/recipes'), channels: path.join(ROOT, 'channels')};
const board = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/content/storyboards/host-supplier-bills.json'), 'utf8'));
fs.mkdirSync(p.content[0], {recursive: true});
fs.mkdirSync(p.state, {recursive: true});
fs.writeFileSync(path.join(p.content[0], 'host-supplier-bills.json'), JSON.stringify(board));
const out = path.join(p.out, 'host-supplier-bills');
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'reel.mp4'), 'video');
const qa = (pass: boolean) => fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify({storyboard_id: 'host-supplier-bills', pass, checks: []}));

const calls: {method: string; body: any}[] = [];
const tg: Tg = async (method, body) => (calls.push({method, body}), method === 'sendVideo' ? {message_id: 1} : true);
const NAVIN = '111';
const o = {chatId: NAVIN, secret: 'test-secret-0123456789', paths: p, now: Date.parse('2026-10-01T10:00:00Z')};
const tap = (data: string, from = NAVIN, chat = NAVIN) => ({update_id: 1, callback_query: {id: 'q', data, from: {id: Number(from)}, message: {chat: {id: Number(chat)}}}});

// failed QA: nothing is sent
qa(false);
assert.deepEqual(await send(tg, NAVIN, 'c1-automation', '2026-W40', p), []);
assert.equal(calls.length, 0);

// QA passed: the video goes out with one Approve button
qa(true);
assert.deepEqual(await send(tg, NAVIN, 'c1-automation', '2026-W40', p), ['host-supplier-bills']);
const v = calls.find((c) => c.method === 'sendVideo')!.body as FormData;
assert.equal(v.get('chat_id'), NAVIN);
assert.deepEqual(JSON.parse(String(v.get('reply_markup'))).inline_keyboard[0][0], {text: 'Approve', callback_data: 'a|host-supplier-bills'});

// shown once: a second run sends nothing new (unless --again)
assert.deepEqual(await send(tg, NAVIN, 'c1-automation', '2026-W40', p), []);
assert.deepEqual(await send(tg, NAVIN, 'c1-automation', '2026-W40', p, {again: true}), ['host-supplier-bills']);

// a tap from anyone else (another user, or a group the bot is in) approves nothing
assert.equal(await onUpdate(tg, tap('a|host-supplier-bills', '999', '999'), o), 'Not allowed.');
assert.equal(await onUpdate(tg, tap('a|host-supplier-bills', NAVIN, '-100200'), o), 'Not allowed.');
assert.equal(currentStatus(p).size, 0);
assert.equal(await onUpdate(tg, {update_id: 2, message: {text: 'hi'}}, o), null, 'plain messages are ignored');

// Navin's tap: one approved ledger entry; a second tap changes nothing
assert.match((await onUpdate(tg, tap('a|host-supplier-bills'), o))!, /^Approved: host-supplier-bills/);
const e = currentStatus(p).get('host-supplier-bills')!;
assert.deepEqual([e.status, e.approved_by], ['approved', 'navin']);
assert.match((await onUpdate(tg, tap('a|host-supplier-bills'), o))!, /already approved/);
assert.match((await onUpdate(tg, tap('A|c1-automation|2026-W40'), o))!, /Nothing new approved/);
assert.equal(fs.readFileSync(path.join(p.state, 'ledger.jsonl'), 'utf8').trim().split('\n').length, 1);
assert.match((await onUpdate(tg, tap('a|no-such-video'), o))!, /not found/);

// already approved: not sent again
calls.length = 0;
assert.deepEqual(await send(tg, NAVIN, 'c1-automation', '2026-W40', p), []);

// ---- an upload whose YouTube result is unknown: two buttons, never an automatic retry ----
const live = path.join(tmp, 'channels');
const c1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c1-automation/channel.json'), 'utf8'));
fs.mkdirSync(path.join(live, 'c1-automation'), {recursive: true});
fs.writeFileSync(path.join(live, 'c1-automation', 'channel.json'), JSON.stringify({...c1, live: true}));
p.channels = live;
fs.writeFileSync(path.join(out, 'render.json'), JSON.stringify({handle: '@theautomationguynavin'}));
const NOW = o.now;
const stuck = (at = NOW) => fs.appendFileSync(path.join(p.state, 'ledger.jsonl'), JSON.stringify({...currentStatus(p).get('host-supplier-bills'), status: 'dispatching', post_urls: undefined, updated_at: new Date(at).toISOString()}) + '\n');
const noCall = async () => { throw new Error('must not upload'); };
stuck();
assert.deepEqual([plan(p, NOW).youtube.length, plan(p, NOW).stuck.length], [0, 1], 'stuck: not planned for upload');
assert.deepEqual(await dispatch(plan(p, NOW), {live: true, youtubeUrl: 'http://n8n.test/yt', fetch: noCall, paths: p, now: NOW}), {sent: [], failed: []}, 'never retried by itself');

// the alert: once per claim, with "Not uploaded" and "Uploaded"
calls.length = 0;
assert.deepEqual(await askResolve(tg, NAVIN, p), ['host-supplier-bills']);
assert.deepEqual(calls[0].body.reply_markup.inline_keyboard[0].map((b: {text: string; callback_data: string}) => [b.text, b.callback_data]), [['Not uploaded', 'n|host-supplier-bills'], ['Uploaded', 'u|host-supplier-bills']]);
assert.deepEqual(await askResolve(tg, NAVIN, p), [], 'asked once');

// someone else's tap or reply changes nothing
assert.equal(await onUpdate(tg, tap('n|host-supplier-bills', '999', '999'), o), 'Not allowed.');
const question = {text: 'Reply to this message with the YouTube video ID (or its link) for host-supplier-bills.', from: {is_bot: true}};
const reply = (text: string, from = NAVIN, to: object = question) => ({update_id: 9, message: {text, from: {id: Number(from)}, chat: {id: Number(from)}, reply_to_message: to}});
assert.equal(await onUpdate(tg, reply('Q8sNfIm_PMU', '999'), o), null);
assert.equal(await onUpdate(tg, reply('Q8sNfIm_PMU', NAVIN, {text: 'something else', from: {is_bot: true}}), o), null, 'not an answer to the question');
assert.equal(currentStatus(p).get('host-supplier-bills')!.status, 'dispatching');

// "Not uploaded": the claim is cleared, the next run uploads it again
assert.match((await onUpdate(tg, tap('n|host-supplier-bills'), o))!, /marked not uploaded/);
assert.equal(currentStatus(p).get('host-supplier-bills')!.status, 'approved');
assert.deepEqual(plan(p, NOW).youtube.map((j) => j.storyboard_id), ['host-supplier-bills']);
assert.match((await onUpdate(tg, tap('n|host-supplier-bills'), o))!, /Refused: .*not stuck/, 'a second tap changes nothing');

// "Uploaded": asks for the ID (force reply), records the reply, and the next run finishes without uploading
stuck(NOW + 3600_000); // the retry got stuck again: a new claim
assert.deepEqual(await askResolve(tg, NAVIN, p), ['host-supplier-bills'], 'a new claim is asked again');
calls.length = 0;
assert.match((await onUpdate(tg, tap('u|host-supplier-bills'), o))!, /Waiting for the video ID/);
assert.deepEqual([calls[0].body.text, calls[0].body.reply_markup.force_reply], [question.text, true]);
assert.match((await onUpdate(tg, reply('not an id'), o))!, /not a YouTube video ID/);
assert.equal(currentStatus(p).get('host-supplier-bills')!.status, 'dispatching');
assert.match((await onUpdate(tg, reply('https://youtube.com/shorts/Q8sNfIm_PMU?feature=share'), o))!, /recorded https:\/\/www.youtube.com\/shorts\/Q8sNfIm_PMU/);
const next = plan(p, NOW);
assert.deepEqual([next.resume, next.youtube.length], [['host-supplier-bills'], 0]);
const fin = await dispatch(next, {live: true, youtubeUrl: 'http://n8n.test/yt', fetch: noCall, paths: p, now: NOW});
assert.deepEqual([fin.failed, currentStatus(p).get('host-supplier-bills')!.status, currentStatus(p).get('host-supplier-bills')!.post_urls], [[], 'dispatched', ['https://www.youtube.com/shorts/Q8sNfIm_PMU']]);

// the signature is checked like an approval's: wrong secret, tampering or expiry write nothing
assert.throws(() => applyResolve(resolveQuery('host-supplier-bills', 'none', 'another-secret-012345', 9e9), o.secret, p, NOW), /signature/);
assert.throws(() => applyResolve(resolveQuery('host-supplier-bills', 'none', o.secret, 9e9).replace('none', 'abcdefghijk'), o.secret, p, NOW), /signature/);
assert.throws(() => applyResolve(resolveQuery('host-supplier-bills', 'none', o.secret, 1), o.secret, p, NOW), /expired/);
assert.deepEqual(['Q8sNfIm_PMU', 'https://www.youtube.com/watch?v=Q8sNfIm_PMU', 'https://youtu.be/Q8sNfIm_PMU', 'Q8sNfIm_PMUx'].map(youtubeId), ['Q8sNfIm_PMU', 'Q8sNfIm_PMU', 'Q8sNfIm_PMU', null]);

fs.rmSync(tmp, {recursive: true});
console.log('telegram ok: only QA-passed videos are sent; only Navin\'s own taps approve, once; unknown uploads get Not uploaded / Uploaded buttons and never retry by themselves');
