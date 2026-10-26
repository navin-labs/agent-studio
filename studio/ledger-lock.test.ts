// One lock for every ledger writer, in every process. Static: no code appends to state/ledger.jsonl except through ledger.ts, and
// only ledger.ts knows the lock database. Dynamic, with real child processes: mutual exclusion under many waiters (no two critical
// sections overlap), the same lock whatever the state path is spelled as, a throw inside the lock releases it, a holder killed
// mid-append leaves a torn line that the next writer repairs, and an approval that races a dispatch claim waits and then respects it.
// Constraints (docs/SECURITY.md): one machine, local disk, POSIX advisory. Run: node studio/ledger-lock.test.ts
import assert from 'node:assert';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderVariants} from './fixtures/variants.ts';
import {appendLedger, applyApproval, approvalQuery, currentStatus, ledgerFile, lkey, type Paths, readJsonl, sha256, withLedgerLock} from './ledger.ts';
import {file, PLATFORMS} from './variant.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-lock-'));

// ---- static: one implementation, one database, one append path ----
{
  const walk = (d: string): string[] => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => (e.name === 'node_modules' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const code = [...walk(path.join(ROOT, 'studio')), ...walk(path.join(ROOT, 'engine/scripts')), ...walk(path.join(ROOT, 'engine/src'))].filter((f) => /\.(ts|tsx|mjs)$/.test(f) && !/\.test\.ts$/.test(f) && !f.endsWith('studio/simulate.ts'));
  const where = (re: RegExp) => code.filter((f) => re.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f)).sort();
  assert.deepEqual(where(/ledger\.lock\.db/), ['studio/ledger.ts'], 'only ledger.ts knows the lock database');
  assert.deepEqual(where(/node:sqlite/), ['studio/ledger.ts'], 'only ledger.ts opens SQLite');
  assert.deepEqual(where(/(appendJsonl|appendFileSync|writeFileSync|appendFile|writeFile)\(\s*ledgerFile\(/), [], 'nothing writes the ledger file directly');
  assert.deepEqual(where(/['"`]ledger\.jsonl['"`]/), ['studio/ledger.ts'], 'no other code builds the ledger path (comments aside)');
  assert.deepEqual(where(/appendLedger\(/), ['studio/dispatch.ts', 'studio/ledger.ts'], 'ledger lines are appended through appendLedger by the approval/rejection code and the dispatcher');
  const sim = fs.readFileSync(path.join(ROOT, 'studio/simulate.ts'), 'utf8');
  assert.match(sim, /mkdtempSync\(path\.join\(os\.tmpdir\(\), 'simulate-'\)\)/, 'the one direct ledger write (simulate.ts) forges rows inside its own temporary sandbox, never the real state');
}

const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(ROOT, 'studio/fixtures/recipes'), channels: path.join(tmp, 'channels'), queue: path.join(tmp, 'queue')};
fs.mkdirSync(p.state, {recursive: true});
const child = (code: string, statePath = p.state) => {
  const f = path.join(tmp, `c-${Math.random().toString(36).slice(2)}.ts`);
  fs.writeFileSync(f, `import {appendLedger, applyApproval, withLedgerLock, ledgerFile} from ${JSON.stringify(path.join(ROOT, 'studio/ledger.ts'))};\nconst fs = process.getBuiltinModule('fs');\nconst p = {...${JSON.stringify(p)}, state: ${JSON.stringify(statePath)}};\nconst nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);\n${code}`);
  const c = spawn(process.execPath, [f], {stdio: ['ignore', 'pipe', 'pipe']});
  let out = '', err = '';
  c.stdout.on('data', (d) => (out += d));
  c.stderr.on('data', (d) => (err += d));
  const done = new Promise<{code: number | null; out: string; err: string}>((r) => c.on('close', (code) => r({code, out, err})));
  const said = (s: string) => new Promise<void>((r) => { const t = setInterval(() => out.includes(s) && (clearInterval(t), r()), 10); });
  return {c, done, said};
};

// ---- many waiting processes never overlap ----
{
  const log = path.join(tmp, 'sections.log');
  const runs = Array.from({length: 6}, (_, i) => child(`for (let k = 0; k < 4; k++) withLedgerLock(p, () => { fs.appendFileSync(${JSON.stringify(log)}, 'in ' + ${i} + ' ' + Date.now() + '\\n'); nap(15); fs.appendFileSync(${JSON.stringify(log)}, 'out ' + ${i} + ' ' + Date.now() + '\\n'); }, 60000);`));
  const res = await Promise.all(runs.map((r) => r.done));
  assert.deepEqual(res.map((r) => r.code), [0, 0, 0, 0, 0, 0], res.map((r) => r.err).join());
  const ev = fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => l.split(' '));
  assert.equal(ev.length, 6 * 4 * 2);
  let inside: string | null = null;
  for (const [what, who] of ev) {
    if (what === 'in') { assert.equal(inside, null, `process ${who} entered while ${inside} was inside`); inside = who; }
    else { assert.equal(inside, who, 'the one that left is the one that entered'); inside = null; }
  }
}

// ---- the same lock whatever the state path is spelled as ----
{
  const alias = path.join(tmp, 'state-alias');
  fs.symlinkSync(p.state, alias);
  const h = child(`withLedgerLock(p, () => { console.log('held'); nap(1500); });`, alias);
  await h.said('held');
  assert.throws(() => withLedgerLock(p, () => 'must not run', 300), /ledger is locked by another process/, 'a symlinked spelling of the same state folder is the same lock');
  await h.done;
  assert.equal(withLedgerLock(p, () => 'free', 2000), 'free');
}

// ---- a throw inside the lock releases it (the transaction is rolled back) ----
{
  assert.throws(() => withLedgerLock(p, () => { throw new Error('boom'); }), /boom/);
  assert.equal(withLedgerLock(p, () => 'again', 500), 'again', 'released after a throw, and the in-process re-entry guard is reset');
  const t = child(`try { withLedgerLock(p, () => { throw new Error('child boom'); }); } catch { console.log('caught'); }`);
  assert.equal((await t.done).code, 0);
  assert.equal(withLedgerLock(p, () => 'after child throw', 500), 'after child throw');
  // appendLedger takes the lock itself when called bare, and inside the lock it does not deadlock
  appendLedger(p, [{storyboard_id: 'x', platform: 'youtube', channel: 'c', status: 'approved', updated_at: 't'}]);
  withLedgerLock(p, () => appendLedger(p, [{storyboard_id: 'y', platform: 'youtube', channel: 'c', status: 'approved', updated_at: 't'}]));
  assert.deepEqual(readJsonl<{storyboard_id: string}>(ledgerFile(p)).map((r) => r.storyboard_id), ['x', 'y']);
  // a bare appendLedger waits for a holder in another process instead of writing around it
  const h = child(`withLedgerLock(p, () => { console.log('held'); nap(1200); });`);
  await h.said('held');
  const t0 = Date.now();
  appendLedger(p, [{storyboard_id: 'waited', platform: 'youtube', channel: 'c', status: 'approved', updated_at: 't'}]);
  assert.ok(Date.now() - t0 > 700, 'the append waited for the other process');
  await h.done;
  assert.equal(readJsonl<{storyboard_id: string}>(ledgerFile(p)).at(-1)!.storyboard_id, 'waited');
}

// ---- a holder killed in the middle of an append leaves a torn line; the next writer repairs it and no earlier row is lost ----
{
  const before = readJsonl(ledgerFile(p)).length;
  const k = child(`withLedgerLock(p, () => { fs.appendFileSync(ledgerFile(p), '{"storyboard_id":"torn","platform":"you'); process.kill(process.pid, 'SIGKILL'); });`);
  assert.equal((await k.done).code, null);
  assert.equal(readJsonl(ledgerFile(p)).length, before, 'a torn last line is ignored by readers');
  const t0 = Date.now();
  appendLedger(p, [{storyboard_id: 'after-crash', platform: 'youtube', channel: 'c', status: 'approved', updated_at: 't'}]);
  assert.ok(Date.now() - t0 < 1000, 'the dead holder released the lock at once');
  const rows = readJsonl<{storyboard_id: string}>(ledgerFile(p));
  assert.equal(rows.length, before + 1);
  assert.equal(rows.at(-1)!.storyboard_id, 'after-crash', 'the new row is on its own line, not glued to the torn one');
}

// ---- conflicting approval and dispatch: an approval that arrives while a claim is being written waits, then respects it ----
{
  fs.cpSync(path.join(ROOT, 'channels'), p.channels, {recursive: true});
  const cf = path.join(p.channels, 'c1-automation', 'channel.json');
  const c1 = JSON.parse(fs.readFileSync(cf, 'utf8'));
  fs.writeFileSync(cf, JSON.stringify({...c1, publishers: c1.publishers.map((q: {platform: string}) => (q.platform === 'facebook' ? {...q, page_id: undefined} : q))}));
  const board = {...JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/test/boards/host-supplier-bills.json'), 'utf8')), id: 'race'};
  fs.mkdirSync(p.content[0], {recursive: true});
  fs.writeFileSync(path.join(p.content[0], 'race.json'), JSON.stringify(board));
  renderVariants(p, board, {date: '2026-10-01', qa: {facebook: false}});
  const secret = 'test-secret-0123456789';
  const link = (exp: number) => '/approve?' + approvalQuery({channel: 'c1-automation', week: '2026-W40', ids: ['race'], by: 'navin', exp}, secret);
  const now = Math.floor(Date.now() / 1000);
  assert.equal(applyApproval(link(now + 3600), secret, {paths: p}).written.length, 2, 'approved once (youtube + instagram)');
  const approved = currentStatus(p).get(lkey('race', 'youtube'))!;
  // a re-render lands (new bytes, new hash, QA of the new file), and a NEW approval link is tapped ...
  for (const pf of PLATFORMS) {
    const v = {channel: 'c1-automation', date: '2026-10-01', id: 'race', platform: pf};
    if (!fs.existsSync(file(p.out, v, 'manifest.json')) || pf === 'facebook') continue;
    fs.writeFileSync(file(p.out, v, 'mp4'), `a different render of ${pf}`);
    const sha = sha256(file(p.out, v, 'mp4'));
    for (const k of ['manifest.json', 'qa.json']) {
      const j = JSON.parse(fs.readFileSync(file(p.out, v, k), 'utf8'));
      fs.writeFileSync(file(p.out, v, k), JSON.stringify({...j, video_sha256: sha}));
    }
  }
  // ... at the moment another process is claiming the ORIGINAL approval for dispatch
  const claimer = child(`withLedgerLock(p, () => { console.log('claiming'); nap(1500); appendLedger(p, [${JSON.stringify({...approved, status: 'dispatching'})}]); });`);
  await claimer.said('claiming');
  const t0 = Date.now();
  const res = applyApproval(link(now + 7200), secret, {paths: p});
  assert.ok(Date.now() - t0 > 1000, 'the approval waited for the claim');
  assert.deepEqual(res.written.map((w) => w.platform), ['instagram'], 'only the variant nobody had claimed was re-approved; nothing was written over the claimed one');
  assert.ok(res.skipped.some((x) => /race youtube: already dispatching/.test(x)), res.skipped.join(' | '));
  assert.equal(currentStatus(p).get(lkey('race', 'youtube'))!.status, 'dispatching', 'the claim stands: the second render is not approved over an upload under way');
  await claimer.done;
}

fs.rmSync(tmp, {recursive: true, force: true});
console.log('ledger-lock ok: one lock implementation and database for every ledger writer (no direct append anywhere else); 6 processes x 4 sections never overlap; a symlinked spelling of the state folder is the same lock; a throw releases it; a bare append waits for another process; a holder killed mid-append leaves a torn line that the next writer repairs; an approval racing a dispatch claim waits and then leaves the claim standing');
