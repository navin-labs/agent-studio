// node studio/telegram.test.ts : the week goes to Telegram with Approve buttons; only taps from Navin's chat approve, through the
// same signed-approval checks as the web links. Fake Telegram, temp folder; never touches state/ or the network.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {currentStatus, type Paths} from './ledger.ts';
import {onUpdate, send, type Tg} from './telegram.ts';

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

fs.rmSync(tmp, {recursive: true});
console.log('telegram ok: only QA-passed videos are sent; only Navin\'s own taps approve, once');
