// node studio/approval.test.ts : page -> signed link -> apply writes exactly one ledger entry; replays, tampering, expiry,
// failed QA and wrong secrets write nothing. Runs in a temp folder; never touches state/.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {buildPage} from './approval-page.ts';
import {applyApproval, approvalQuery, currentStatus, fingerprintFile, ledgerFile, type Paths, verifyApproval} from './ledger.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'approval-test-'));
const secret = 'test-secret-0123456789';
const url = 'https://n8n.example.com/webhook/approve';
const now = Date.parse('2026-10-01T10:00:00Z');
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(ROOT, 'studio/fixtures/recipes'), channels: path.join(ROOT, 'channels')};

// one written board (caption carries markup Forge might produce by mistake), rendered and QA-passed
const board = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/content/storyboards/host-supplier-bills.json'), 'utf8'));
board.caption = 'Bills <img src=x onerror=alert(1)> enter themselves.\n\nExample data.';
fs.mkdirSync(path.join(tmp, 'content'), {recursive: true});
fs.writeFileSync(path.join(tmp, 'content', 'host-supplier-bills.json'), JSON.stringify(board));
const out = path.join(p.out, 'host-supplier-bills');
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'contact.png'), 'png');
const setQa = (pass: boolean) => fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify({storyboard_id: 'host-supplier-bills', pass, checks: [{name: 'audio', pass, ...(pass ? {} : {error: 'the video has no audio stream'})}]}));
const lines = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : []);
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'));

// failed QA: shown with its error, no approve link
setQa(false);
let page = buildPage('c1-automation', '2026-W40', {url, secret, now}, p);
assert.equal(page.rows[0].state, 'failed');
let html = fs.readFileSync(page.file, 'utf8');
assert.equal(hrefs(html).length, 0, 'a failed video gets no approve link');
assert.match(html, /audio: the video has no audio stream/);

// QA passed: one approve link, markup escaped, contact sheet copied beside the page
setQa(true);
page = buildPage('c1-automation', '2026-W40', {url, secret, now}, p);
html = fs.readFileSync(page.file, 'utf8');
assert.ok(!html.includes('<img src=x') && html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'Forge text is escaped');
assert.ok(fs.existsSync(path.join(path.dirname(page.file), 'host-supplier-bills.png')));
const [link] = hrefs(html);
assert.ok(link.startsWith(url + '?'));

// the webhook relays the link: exactly one ledger entry, schema-valid, plus the fingerprint QA will compare against
const r = applyApproval(link, secret, {now: now + 60_000, paths: p});
assert.deepEqual([r.written.length, r.skipped.length], [1, 0]);
assert.equal(lines(ledgerFile(p)).length, 1);
const entry = JSON.parse(lines(ledgerFile(p))[0]);
assert.deepEqual(validate(loadSchema('ledger'), entry), []);
assert.deepEqual([entry.status, entry.approved_by, entry.targets], ['approved', 'navin', ['instagram', 'youtube']]);
assert.equal(lines(fingerprintFile(p)).length, 1);
assert.deepEqual(validate(loadSchema('fingerprint'), JSON.parse(lines(fingerprintFile(p))[0])), []);

// replay: nothing new
assert.deepEqual(applyApproval(link, secret, {now: now + 120_000, paths: p}).skipped, ['host-supplier-bills: already approved']);
assert.equal(lines(ledgerFile(p)).length, 1);
// the page now shows it approved, with no link
page = buildPage('c1-automation', '2026-W40', {url, secret, now}, p);
assert.equal(page.rows[0].state, 'approved');
assert.equal(hrefs(fs.readFileSync(page.file, 'utf8')).length, 0);

// refused before any file is touched
const q = new URLSearchParams(link.split('?')[1]);
const tweak = (k: string, v: string) => (q.set(k, v), q.toString());
assert.throws(() => applyApproval(tweak('ids', 'host-supplier-bills,order-emails'), secret, {now, paths: p}), /signature does not match/);
assert.throws(() => applyApproval(link, 'another-secret-0123456789', {now, paths: p}), /signature does not match/);
assert.throws(() => applyApproval(link, 'short', {now, paths: p}), /shorter than 16/);
assert.throws(() => applyApproval(link, secret, {now: now + 8 * 86400_000, paths: p}), /expired/);
assert.throws(() => verifyApproval('channel=c1-automation&week=2026-W40&ids=a;rm -rf&by=navin&exp=1&sig=00', secret), /malformed/);
assert.throws(() => buildPage('c1-automation', '2026-W40', {url: 'http://plain.example', secret, now}, p), /https/);

// signed but not approvable: another channel's id, a week it is not in, a missing board
const signed = (ids: string[], week = '2026-W40') => approvalQuery({channel: 'c1-automation', week, ids, by: 'navin', exp: now / 1000 + 3600}, secret);
fs.writeFileSync(ledgerFile(p), ''); // start clean
fs.writeFileSync(fingerprintFile(p), '');
assert.deepEqual(applyApproval(signed(['host-supplier-bills'], '2026-W41'), secret, {now, paths: p}).skipped, ['host-supplier-bills: not in week 2026-W41']);
assert.deepEqual(applyApproval(signed(['nope']), secret, {now, paths: p}).skipped, ['nope: storyboard not found']);
setQa(false);
assert.deepEqual(applyApproval(signed(['host-supplier-bills']), secret, {now, paths: p}).skipped, ['host-supplier-bills: QA has not passed']);
assert.equal(lines(ledgerFile(p)).length, 0, 'nothing was written');
assert.equal(currentStatus(p).size, 0);

fs.rmSync(tmp, {recursive: true});
console.log('approval ok: a test approval writes one ledger entry; replay, tampering, expiry, failed QA and bad secrets write nothing');
