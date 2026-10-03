// node studio/approval.test.ts : page -> signed link -> apply writes one ledger line per approvable platform variant, each with the
// hash of the exact video approved; a variant that failed QA is held alone; replays (also after a rejection), tampering, expiry,
// a changed video and wrong secrets write nothing. Runs in a temp folder; never touches state/.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {buildPage} from './approval-page.ts';
import {handle} from './approve-server.ts';
import {renderVariants} from './fixtures/variants.ts';
import {applyApproval, approvalQuery, currentStatus, fingerprintFile, ledgerFile, lkey, type Paths, readFingerprints, reject, repairFingerprints, sha256, verifyApproval} from './ledger.ts';
import {file, type Platform, PLATFORMS} from './variant.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'approval-test-'));
const secret = 'test-secret-0123456789';
const url = 'https://n8n.example.com/webhook/approve';
const now = Date.parse('2026-10-01T10:00:00Z');
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(ROOT, 'studio/fixtures/recipes'), channels: path.join(ROOT, 'channels'), queue: path.join(tmp, 'queue')};
const ID = 'host-supplier-bills';
const DATE = '2026-10-01';

// one written board (caption carries markup Forge might produce by mistake), rendered as its three platform variants. The real
// C1 channel file: its Facebook username is pending, so QA holds the Facebook variant (destination) and it is never a target.
const board = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/test/boards/host-supplier-bills.json'), 'utf8'));
board.caption = 'Bills <img src=x onerror=alert(1)> enter themselves.\n\nExample data.';
fs.mkdirSync(path.join(tmp, 'content'), {recursive: true});
fs.writeFileSync(path.join(tmp, 'content', `${ID}.json`), JSON.stringify(board));
renderVariants(p, board, {date: DATE, qa: {facebook: false}});
const vf = (pf: Platform, kind: string) => file(p.out, {channel: 'c1-automation', date: DATE, id: ID, platform: pf}, kind);
const setQa = (pass: Partial<Record<Platform, boolean>>) =>
  PLATFORMS.forEach((pf) => {
    const ok = pf === 'facebook' ? false : (pass[pf] ?? true);
    const checked = JSON.parse(fs.readFileSync(vf(pf, 'manifest.json'), 'utf8')).video_sha256; // QA records the file it checked
    fs.writeFileSync(vf(pf, 'qa.json'), JSON.stringify({storyboard_id: ID, platform: pf, pass: ok, checks: [{name: pf === 'facebook' ? 'destination' : 'audio', pass: ok, ...(ok ? {} : {error: pf === 'facebook' ? 'facebook username is still pending' : 'the video has no audio stream'})}], video_sha256: checked}));
  });
const lines = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean) : []);
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'));
const st = (pf: Platform) => currentStatus(p).get(lkey(ID, pf))?.status;

// every variant failed QA: shown with its errors, no approve link
setQa({youtube: false, instagram: false});
let page = buildPage('c1-automation', '2026-W40', {url, secret, now}, p);
assert.equal(page.rows[0].state, 'failed');
let html = fs.readFileSync(page.file, 'utf8');
assert.equal(hrefs(html).length, 0, 'a failed video gets no approve link');
assert.match(html, /youtube: audio: the video has no audio stream/);

// QA passed: one approve link, markup escaped, contact sheet copied beside the page, the held variant named
setQa({});
page = buildPage('c1-automation', '2026-W40', {url, secret, now}, p);
html = fs.readFileSync(page.file, 'utf8');
assert.ok(!html.includes('<img src=x') && html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'Forge text is escaped');
assert.ok(fs.existsSync(path.join(path.dirname(page.file), `${ID}.png`)));
assert.match(html, /held: facebook: destination: facebook username is still pending/);
const [link] = hrefs(html);
assert.ok(link.startsWith(url + '?'));

// the webhook relays the link: one schema-valid line per approvable variant, with its video hash and the link it came from,
// plus the one fingerprint QA will compare against
const r = applyApproval(link, secret, {now: now + 60_000, paths: p});
assert.deepEqual(r.written.map((e) => e.platform), ['instagram', 'youtube'], 'one tap covers the video and its variants; Facebook (pending) is not a target');
assert.deepEqual(r.skipped, []);
for (const e of r.written) {
  assert.deepEqual(validate(loadSchema('ledger'), e), []);
  assert.deepEqual([e.status, e.approved_by, e.sha256, e.approval], ['approved', 'navin', sha256(vf(e.platform, 'mp4')), new URLSearchParams(link.split('?')[1]).get('sig')!.slice(0, 16)]);
}
assert.equal(lines(ledgerFile(p)).length, 2);
assert.equal(lines(fingerprintFile(p)).length, 1);
assert.deepEqual(validate(loadSchema('fingerprint'), JSON.parse(lines(fingerprintFile(p))[0])), []);

// replay of the same link: refused, nothing written
assert.throws(() => applyApproval(link, secret, {now: now + 120_000, paths: p}), /already used/);
assert.equal(lines(ledgerFile(p)).length, 2);
// the page now shows it approved, with no link
page = buildPage('c1-automation', '2026-W40', {url, secret, now}, p);
assert.equal(page.rows[0].state, 'approved');
assert.equal(hrefs(fs.readFileSync(page.file, 'utf8')).length, 0);

// refused before any file is touched
const q = new URLSearchParams(link.split('?')[1]);
const tweak = (k: string, v: string) => (q.set(k, v), q.toString());
assert.throws(() => applyApproval(tweak('ids', `${ID},order-emails`), secret, {now, paths: p}), /signature does not match/);
assert.throws(() => applyApproval(link, 'another-secret-0123456789', {now, paths: p}), /signature does not match/);
assert.throws(() => applyApproval(link, 'short', {now, paths: p}), /shorter than 16/);
assert.throws(() => applyApproval(link, secret, {now: now + 8 * 86400_000, paths: p}), /expired/);
assert.throws(() => verifyApproval('channel=c1-automation&week=2026-W40&ids=a;rm -rf&by=navin&exp=1&sig=00', secret), /malformed/);
assert.throws(() => buildPage('c1-automation', '2026-W40', {url: 'http://plain.example', secret, now}, p), /https/);
assert.throws(() => buildPage('c1-automation', '2026-W40', {url: 'http://localhost.evil.example/x', secret, now}, p), /https/);

// taking an approval back, then replaying the old link: still refused (a link approves once)
assert.deepEqual(reject([ID], p), {rejected: [`${ID} instagram`, `${ID} youtube`], kept: []});
assert.deepEqual([st('youtube'), st('instagram')], ['rejected', 'rejected']);
assert.throws(() => applyApproval(link, secret, {now: now + 180_000, paths: p}), /already used/);
assert.throws(() => reject([ID], p), /only approved videos can be rejected: host-supplier-bills instagram is rejected, host-supplier-bills youtube is rejected/);

// signed but not approvable: another channel's id, a week it is not in, a missing board, failed QA, a video changed after QA
let exp = now / 1000 + 3600;
const signed = (ids: string[], week = '2026-W40') => approvalQuery({channel: 'c1-automation', week, ids, by: 'navin', exp: exp++}, secret);
fs.writeFileSync(ledgerFile(p), ''); // start clean
fs.writeFileSync(fingerprintFile(p), '');
assert.deepEqual(applyApproval(signed([ID], '2026-W41'), secret, {now, paths: p}).skipped, [`${ID}: not in week 2026-W41`]);
assert.deepEqual(applyApproval(signed(['nope']), secret, {now, paths: p}).skipped, ['nope: storyboard not found']);
setQa({youtube: false, instagram: false});
assert.deepEqual(applyApproval(signed([ID]), secret, {now, paths: p}).skipped, [`${ID} instagram: held, QA has not passed`, `${ID} youtube: held, QA has not passed`]);
setQa({});
const real = fs.readFileSync(vf('youtube', 'mp4'));
fs.writeFileSync(vf('youtube', 'mp4'), 'rendered again after QA');
setQa({instagram: false});
assert.deepEqual(applyApproval(signed([ID]), secret, {now, paths: p}).skipped, [`${ID} instagram: held, QA has not passed`, `${ID} youtube: held, the video is not the one QA checked (render and QA again)`]);
fs.writeFileSync(vf('youtube', 'mp4'), real);
assert.equal(lines(ledgerFile(p)).length, 0, 'nothing was written');
assert.equal(currentStatus(p).size, 0);

// a variant that failed QA is held alone: the others are approved with the same tap
const one = applyApproval(signed([ID]), secret, {now, paths: p});
assert.deepEqual([one.written.map((e) => e.platform), one.skipped], [['youtube'], [`${ID} instagram: held, QA has not passed`]]);
fs.writeFileSync(ledgerFile(p), '');
fs.writeFileSync(fingerprintFile(p), '');

// the Mac receiver n8n forwards to: same checks, plain HTTP answers
setQa({});
const at = {now, paths: p};
assert.deepEqual(handle('/health', secret, at), {status: 200, body: 'ok'});
assert.equal(handle('/other', secret, at).status, 404);
assert.equal(handle(`/approve?${tweak('ids', 'x')}`, secret, at).status, 403);
const once = signed([ID]);
const ok = handle(`/approve?${once}`, secret, at);
assert.equal(ok.status, 200);
assert.match(ok.body, /Approved 2/);
assert.equal(lines(ledgerFile(p)).length, 2);
assert.deepEqual([handle(`/approve?${once}`, secret, at).status, lines(ledgerFile(p)).length], [403, 2], 'a replayed link is refused');
assert.match(handle(`/approve?${signed([ID])}`, secret, at).body, /already approved/);
assert.equal(lines(ledgerFile(p)).length, 2);

// crash between the ledger write and the fingerprint write: the next approval (or tick) heals it, once
assert.equal(lines(fingerprintFile(p)).length, 1);
fs.writeFileSync(fingerprintFile(p), ''); // the fingerprint never made it to disk
assert.deepEqual(repairFingerprints(p), [ID]);
assert.deepEqual(repairFingerprints(p), [], 'idempotent');
fs.writeFileSync(fingerprintFile(p), '');
handle(`/approve?${signed([ID])}`, secret, at); // a new tap on an approved video also repairs, and writes no new approval
assert.deepEqual([lines(fingerprintFile(p)).length, lines(ledgerFile(p)).length], [1, 2]);
fs.appendFileSync(fingerprintFile(p), lines(fingerprintFile(p))[0] + '\n'); // a duplicate (e.g. replayed write) counts once
assert.equal(readFingerprints(p).length, 1);

// a re-render after the approval (Forge fixed the board): the old approval does not cover it, and a new tap approves the new render
fs.writeFileSync(vf('youtube', 'mp4'), 'the video after the fix');
const m = JSON.parse(fs.readFileSync(vf('youtube', 'manifest.json'), 'utf8'));
fs.writeFileSync(vf('youtube', 'manifest.json'), JSON.stringify({...m, video_sha256: sha256(vf('youtube', 'mp4'))}));
assert.deepEqual(applyApproval(signed([ID]), secret, {now, paths: p}).skipped, [`${ID} instagram: already approved`, `${ID} youtube: held, the video is not the one QA checked (render and QA again)`], 'QA has not seen the new file yet');
setQa({}); // QA runs on the new render
page = buildPage('c1-automation', '2026-W40', {url, secret, now}, p);
assert.equal(page.rows[0].state, 'approve', 'the new render needs a new approval');
const again = applyApproval(signed([ID]), secret, {now, paths: p});
assert.deepEqual([again.written.map((e) => [e.platform, e.sha256]), again.skipped], [[['youtube', sha256(vf('youtube', 'mp4'))]], [`${ID} instagram: already approved`]]);

fs.rmSync(tmp, {recursive: true});
console.log('approval ok: one tap approves every QA-passed variant (one line each, with its video hash); a failed variant is held alone; replays (also after a rejection), tampering, expiry, a changed video and bad secrets write nothing; a lost fingerprint is repaired once; a re-render needs (and gets) a new approval');
