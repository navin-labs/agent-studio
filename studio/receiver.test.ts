// The approve receiver on a real local socket (127.0.0.1, port 0), plus the cross-process ledger lock. No production state, no
// credentials, no outbound network. Run: node studio/receiver.test.ts
import assert from 'node:assert';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {makeServer} from './approve-server.ts';
import {renderVariants} from './fixtures/variants.ts';
import {approvalQuery, currentStatus, ledgerFile, lkey, type Paths, readJsonl, withLedgerLock} from './ledger.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'receiver-test-'));
const secret = 'test-secret-0123456789';
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(ROOT, 'studio/fixtures/recipes'), channels: path.join(tmp, 'channels'), queue: path.join(tmp, 'queue')};
fs.cpSync(path.join(ROOT, 'channels'), p.channels, {recursive: true});
const c1File = path.join(p.channels, 'c1-automation', 'channel.json');
const c1 = JSON.parse(fs.readFileSync(c1File, 'utf8'));
fs.writeFileSync(c1File, JSON.stringify({...c1, publishers: c1.publishers.map((q: {platform: string}) => (q.platform === 'facebook' ? {...q, page_id: undefined} : q))}));
const board = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/test/boards/host-supplier-bills.json'), 'utf8'));
fs.mkdirSync(p.content[0], {recursive: true});
for (const id of ['host-supplier-bills', 'host-second']) {
  const doc = {...board, id};
  fs.writeFileSync(path.join(p.content[0], `${id}.json`), JSON.stringify(doc));
  renderVariants(p, doc, {date: '2026-10-01', qa: {facebook: false}});
}
const link = (id: string, o: {exp?: number; by?: string; sec?: string} = {}) =>
  '/approve?' + approvalQuery({channel: 'c1-automation', week: '2026-W40', ids: [id], by: o.by ?? 'navin', exp: o.exp ?? Math.floor(Date.now() / 1000) + 3600}, o.sec ?? secret);
const rows = () => readJsonl<{storyboard_id: string; platform: string; status: string}>(ledgerFile(p));

const log = console.log;
console.log = () => undefined; // the server logs every request
const quiet = new Set<string>();
const listen = async (o: Parameters<typeof makeServer>[1]) => {
  const s = makeServer(secret, {paths: p, ...o});
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return {s, port: (s.address() as net.AddressInfo).port};
};
// one raw HTTP exchange: the exact bytes we choose, whatever the client library would have refused to send
const raw = (port: number, head: string[], send?: (s: net.Socket) => void) =>
  new Promise<{status: number; text: string; closed: boolean}>((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    let buf = '';
    s.on('connect', () => (s.write(head.join('\r\n') + '\r\n\r\n'), send?.(s)));
    s.on('data', (d) => (buf += d));
    s.on('error', () => undefined);
    const done = () => resolve({status: Number(buf.match(/^HTTP\/1\.1 (\d+)/)?.[1] ?? 0), text: buf.split('\r\n\r\n').slice(1).join(''), closed: s.destroyed});
    s.on('close', done);
    setTimeout(() => (s.destroy(), done()), 4000);
  });
const H = (port: number, extra: string[] = []) => [`Host: 127.0.0.1:${port}`, ...extra];
const post = (port: number, route: string, body: string, ct = 'application/json') => raw(port, [`POST ${route} HTTP/1.1`, ...H(port, [`Content-Type: ${ct}`, `Content-Length: ${Buffer.byteLength(body)}`, 'Connection: close'])], (s) => s.end(body));
const get = (port: number, url: string, extra: string[] = []) => raw(port, [`GET ${url} HTTP/1.1`, ...H(port, ['Connection: close', ...extra])]);

const { s: server, port } = await listen({limits: {body: 50_000, bodyMs: 500}});
try {
  // ---- request guards ----
  assert.deepEqual([(await get(port, '/health')).status, (await get(port, '/health')).text], [200, 'ok']);
  assert.equal((await raw(port, ['GET /health HTTP/1.1', 'Host: evil.example', 'Connection: close'])).status, 421, 'DNS rebinding: a foreign Host');
  assert.equal((await raw(port, ['GET /health HTTP/1.1', `Host: 127.0.0.1.evil.example:${port}`, 'Connection: close'])).status, 421);
  assert.equal((await get(port, '/health', ['Origin: https://evil.example'])).status, 403, 'a browser page calling in');
  assert.equal((await post(port, '/metrics', '[]', 'text/plain')).status, 415, 'a no-preflight cross-site POST');
  assert.equal((await post(port, '/metrics', '[]', 'application/x-www-form-urlencoded')).status, 415);
  for (const m of ['PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']) assert.equal((await raw(port, [`${m} /health HTTP/1.1`, ...H(port, ['Connection: close'])])).status, 405, m);
  assert.equal((await post(port, '/approve', '{}')).status, 404, 'approvals are GET links only');
  assert.equal((await post(port, '/dispatch-check', '{}')).status, 404);
  assert.equal((await get(port, '/nope')).status, 404);

  // ---- bodies: bad, huge, slow, cut short ----
  assert.equal((await post(port, '/metrics', '{not json')).status, 400);
  assert.equal((await post(port, '/metrics', '\xff\xfe\x00')).status, 400, 'bytes that are not UTF-8 text');
  assert.equal((await post(port, '/metrics', '[]')).status, 200, 'an empty batch is valid');
  assert.equal((await post(port, '/metrics', JSON.stringify([{nonsense: 1}]))).status, 400, 'rows are validated');
  assert.equal((await post(port, '/feed', JSON.stringify({url: 'https://not-listed.example/rss'}))).status, 400, 'an unlisted feed is not fetched');
  const big = await raw(port, ['POST /metrics HTTP/1.1', ...H(port, ['Content-Type: application/json', 'Content-Length: 10000000'])]);
  assert.equal(big.status, 413, 'declared length over the cap: refused before any body is read');
  assert.ok(big.closed);
  const chunked = await raw(port, ['POST /metrics HTTP/1.1', ...H(port, ['Content-Type: application/json', 'Transfer-Encoding: chunked'])], (s) => {
    let n = 0;
    const t = setInterval(() => {
      if (s.destroyed || n++ > 40) return clearInterval(t);
      s.write(`4e20\r\n${'a'.repeat(20000)}\r\n`); // 20 kB chunks, no declared length
    }, 5);
  });
  assert.equal(chunked.status, 413, 'streamed past the cap with no declared length');
  assert.ok(chunked.closed, 'the server hung up instead of reading on');
  const t0 = Date.now();
  const slow = await raw(port, ['POST /metrics HTTP/1.1', ...H(port, ['Content-Type: application/json', 'Content-Length: 100'])], (s) => s.write('[1,'));
  assert.equal(slow.status, 408, 'a body that stalls is cut off');
  assert.ok(Date.now() - t0 < 2500);
  const trickle = await raw(port, ['POST /metrics HTTP/1.1', ...H(port, ['Content-Type: application/json', 'Content-Length: 100'])], (s) => {
    const t = setInterval(() => (s.destroyed ? clearInterval(t) : s.write(' ')), 100); // never idle, never finishing: the total deadline decides
  });
  assert.equal(trickle.status, 408, 'a trickling body hits the total deadline too');
  const cut = net.connect(port, '127.0.0.1');
  await new Promise<void>((r) => cut.on('connect', () => (cut.write(`POST /metrics HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n[1,`), cut.end(), r())));
  await new Promise((r) => setTimeout(r, 200));
  cut.destroy();
  assert.equal((await get(port, '/health')).status, 200, 'the server survives a body cut short');

  // ---- approvals over the socket: signed, once, to this ledger only ----
  const ID = 'host-supplier-bills';
  const before = rows().length;
  for (const bad of [
    link(ID).replace(/sig=[0-9a-f]/, (m) => m.slice(0, -1) + (m.endsWith('0') ? '1' : '0')), // one bit of the signature
    link(ID).replace('by=navin', 'by=mallory'), // a different approver than the one signed
    link(ID, {exp: Math.floor(Date.now() / 1000) - 5}), // expired
    link(ID, {sec: 'another-secret-0123456789'}), // signed with another secret
    '/approve?channel=c1-automation',
    '/approve',
  ]) {
    const r = await get(port, bad);
    assert.equal(r.status, 403, bad.slice(0, 60));
    assert.match(r.text, /Refused/);
  }
  assert.equal(rows().length, before, 'refused approvals write nothing');
  const first = link(ID);
  const ok = await get(port, first);
  assert.equal(ok.status, 200);
  assert.match(ok.text, /Approved 2/);
  assert.deepEqual(rows().filter((r) => r.storyboard_id === ID).map((r) => `${r.platform}:${r.status}`).sort(), ['instagram:approved', 'youtube:approved']);
  const replay = await get(port, first);
  assert.equal(replay.status, 403);
  assert.match(replay.text, /already used/);
  // the signed link is the only authority: a stolen dispatch-check cannot approve, and asks need the right channel and platform
  assert.equal((await get(port, `/dispatch-check?id=${ID}`)).status, 403);
  assert.equal((await get(port, `/dispatch-check?id=${ID}&channel=c2-reach&platform=youtube`)).status, 403, 'another channel\'s workflow');
  assert.equal((await get(port, `/dispatch-check?id=${ID}&channel=c1-automation&platform=instagram`)).status, 403, 'only YouTube asks');

  // ---- many concurrent taps on one link: exactly one approval ----
  const L2 = link('host-second');
  const many = await Promise.all(Array.from({length: 12}, () => get(port, L2)));
  assert.deepEqual([many.filter((r) => r.status === 200).length, many.filter((r) => r.status === 403).length], [1, 11]);
  assert.equal(rows().filter((r) => r.storyboard_id === 'host-second').length, 2, 'two variants, once each');
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
assert.equal(server.listening, false);
await new Promise((r) => setTimeout(r, 50));
assert.deepEqual(process.getActiveResourcesInfo().filter((x) => /TCP|Socket/i.test(x)), [], 'no open sockets or servers left');

// ---- opt-in token for the helper endpoints (n8n sends it as x-forge-token) ----
{
  const TOKEN = 'helper-token-0123456789';
  const {s, port: tp} = await listen({token: TOKEN});
  try {
    assert.equal((await get(tp, '/feeds')).status, 401);
    assert.equal((await get(tp, '/metrics-due')).status, 401);
    assert.equal((await get(tp, '/feeds', ['x-forge-token: wrong-token-0123456789'])).status, 401);
    assert.equal((await get(tp, '/feeds', ['x-forge-token: short'])).status, 401);
    assert.equal((await post(tp, '/metrics', '[]')).status, 401, 'POST without the token');
    assert.equal((await raw(tp, ['POST /metrics HTTP/1.1', ...H(tp, ['Content-Type: application/json', `x-forge-token: ${TOKEN}`, 'Content-Length: 2', 'Connection: close'])], (c) => c.end('[]'))).status, 200);
    assert.equal((await get(tp, '/feeds', [`x-forge-token: ${TOKEN}`])).status, 200);
    assert.equal((await get(tp, '/health')).status, 200, 'health needs no token');
    assert.equal((await get(tp, '/approve?x=1')).status, 403, '/approve is reached (and refused on its own signature), not blocked by the token');
  } finally {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
}

// ---- the cross-process ledger lock ----
const child = (code: string) => {
  const f = path.join(tmp, `child-${Math.random().toString(36).slice(2)}.ts`);
  fs.writeFileSync(f, `import {applyApproval, appendJsonl, ledgerFile, withLedgerLock} from ${JSON.stringify(path.join(ROOT, 'studio/ledger.ts'))};\nconst p = ${JSON.stringify(p)};\n${code}`);
  return new Promise<{code: number | null; out: string; err: string}>((resolve) => {
    const c = spawn(process.execPath, [f], {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    c.stdout.on('data', (d) => (out += d));
    c.stderr.on('data', (d) => (err += d));
    c.on('close', (code) => resolve({code, out, err}));
  });
};
{
  // read-modify-write a counter from 4 processes at once: no lost updates
  const counter = path.join(tmp, 'counter.txt');
  fs.writeFileSync(counter, '0');
  const runs = await Promise.all(Array.from({length: 4}, () => child(`for (let i = 0; i < 40; i++) withLedgerLock(p, () => { const n = Number(require('node:fs').readFileSync(${JSON.stringify(counter)}, 'utf8')); require('node:fs').writeFileSync(${JSON.stringify(counter)}, String(n + 1)); });`.replace(/require\('node:fs'\)/g, 'process.getBuiltinModule("fs")'))));
  assert.deepEqual(runs.map((r) => r.code), [0, 0, 0, 0], runs.map((r) => r.err).join());
  assert.equal(fs.readFileSync(counter, 'utf8'), '160', 'no lost update across 4 processes');
  assert.ok(!fs.existsSync(path.join(p.state, 'ledger.lock.db-journal')), 'no journal left by the lock');

  // 4 processes tap the same fresh link at once: the ledger gets each variant exactly once
  const id = 'host-second';
  fs.rmSync(ledgerFile(p));
  fs.rmSync(path.join(p.state, 'fingerprints.jsonl'), {force: true});
  const L = link(id);
  const taps = await Promise.all(Array.from({length: 4}, () => child(`try { console.log(JSON.stringify(applyApproval(${JSON.stringify(L)}, ${JSON.stringify(secret)}, {paths: p}).written.length)); } catch (e) { console.log('refused'); }`)));
  assert.deepEqual(taps.map((t) => t.out.trim()).sort(), ['0'.replace('0', 'refused'), 'refused', 'refused', '2'].sort(), taps.map((t) => t.err).join());
  assert.equal(rows().length, 2, 'one line per variant, however many processes raced');

  // a live holder is respected, then the waiter gives up with an error (it never steals)
  const flag = path.join(tmp, 'holder.flag');
  const holder = child(`withLedgerLock(p, () => { process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(flag)}, 'held'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500); });`);
  while (!fs.existsSync(flag)) await new Promise((r) => setTimeout(r, 10)); // wait until the child really holds the lock (no fixed sleep)
  assert.throws(() => withLedgerLock(p, () => 'no', 300), /ledger is locked by another process/);
  assert.equal(withLedgerLock(p, () => 'after release', 5000), 'after release', 'the waiter gets it as soon as the holder is done');
  assert.equal((await holder).code, 0);
  // a holder killed (SIGKILL) inside the lock frees it at once: no stale file to judge, no two-minute wait
  const crashed = await child(`withLedgerLock(p, () => { process.getBuiltinModule('fs').writeFileSync(${JSON.stringify(path.join(tmp, 'crash.txt'))}, 'half'); process.kill(process.pid, 'SIGKILL'); });`);
  assert.equal(crashed.code, null, 'the holder was killed');
  const t1 = Date.now();
  assert.equal(withLedgerLock(p, () => 'recovered', 2000), 'recovered');
  assert.ok(Date.now() - t1 < 1000, 'recovery is immediate');
  // a STALLED holder (stopped, not dead) keeps the lock: nobody takes it from under it, so two writers are never inside at once
  const stalled = spawn(process.execPath, ['--input-type=module', '-e', `import {withLedgerLock} from ${JSON.stringify(path.join(ROOT, 'studio/ledger.ts'))}; withLedgerLock(${JSON.stringify(p)}, () => { console.log('held'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000); });`], {stdio: ['ignore', 'pipe', 'inherit']});
  await new Promise<void>((r) => stalled.stdout.once('data', () => r()));
  process.kill(stalled.pid!, 'SIGSTOP');
  assert.throws(() => withLedgerLock(p, () => 'must not run', 400), /ledger is locked by another process/, 'a stopped holder is not overtaken');
  process.kill(stalled.pid!, 'SIGKILL');
  await new Promise((r) => stalled.once('close', r));
  assert.equal(withLedgerLock(p, () => 'free again', 2000), 'free again');
  // an old-style lock file left behind by the previous implementation is ignored
  fs.writeFileSync(path.join(p.state, 'ledger.lock'), '1 1 old');
  assert.equal(withLedgerLock(p, () => 'ignored', 1000), 'ignored');
  assert.throws(() => withLedgerLock(p, () => withLedgerLock(p, () => 1)), /not re-entrant/);
  assert.equal(withLedgerLock(p, () => 'usable after a throw', 1000), 'usable after a throw');
}
void currentStatus; void lkey; void quiet;
fs.rmSync(tmp, {recursive: true, force: true});
console.log = log;
console.log('receiver ok: Host/Origin/method/content-type guards; bad, huge (declared and streamed), stalled, trickling and cut-short bodies; tampered, expired, replayed and foreign-secret links write nothing; 12 concurrent taps approve once; opt-in helper token; clean shutdown; ledger lock (exclusive SQLite transaction) holds across 4 processes (160/160 updates, 1 approval of 2 variants), is freed at once by a killed holder, and is never taken from a stopped one');
