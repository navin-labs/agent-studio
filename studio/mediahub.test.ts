// Media hub network and file safety, against a real local HTTP server (127.0.0.1, random port). No live service is contacted:
// tests use their own Policy (http, localhost, a fake public DNS answer) or the production POLICY with inputs it must refuse.
// Run: node studio/mediahub.test.ts
import assert from 'node:assert';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import {bodyBytes, cleanSvg, downloadFile, get, imageExt, imagePlate, isPrivateIp, MAX_PIXELS, type Plate, POLICY, type Policy, safeUrl, videoArgs, videoFormat, videoPlate, VIDEO_PROTOCOLS, writeIndex} from '../engine/src/lib/mediaHub.ts';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'); // a real 1x1 PNG
const ihdr = (w: number, h: number) => {
  const b = Buffer.from(PNG);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};
let clip: Buffer = Buffer.alloc(0);
const skipped: string[] = [];
let stalledClosed = false;
let streamClosed = false;
const server = http.createServer((req, res) => {
  const u = req.url!;
  if (u === '/clip.mp4') return void res.writeHead(200, {'content-type': 'video/mp4'}).end(clip);
  if (u === '/playlist.m3u8') return void res.writeHead(200, {'content-type': 'video/mp4'}).end('#EXTM3U\n#EXTINF:1,\nfile:///etc/hosts\n');
  if (u === '/concat.txt') return void res.writeHead(200, {'content-type': 'video/mp4'}).end("ffconcat version 1.0\nfile '/etc/hosts'\n");
  if (u === '/ok.png') return void res.writeHead(200, {'content-type': 'image/png'}).end(PNG);
  if (u === '/redir-ok') return void res.writeHead(302, {location: '/ok.png'}).end();
  if (u === '/redir-loop') return void res.writeHead(302, {location: '/redir-loop'}).end();
  if (u === '/redir-host') return void res.writeHead(302, {location: 'http://127.0.0.1:1/ok.png'}).end();
  if (u === '/redir-proto') return void res.writeHead(302, {location: 'https://localhost/ok.png'}).end();
  if (u === '/redir-file') return void res.writeHead(302, {location: 'file:///etc/hosts'}).end();
  if (u === '/redir-port') return void res.writeHead(302, {location: 'http://localhost:1/ok.png'}).end();
  if (u === '/html') return void res.writeHead(200, {'content-type': 'image/png'}).end('<html><script>alert(1)</script></html>');
  if (u === '/svg') return void res.writeHead(200, {'content-type': 'image/png'}).end('<svg xmlns="http://www.w3.org/2000/svg"/>');
  if (u === '/garbage-png') return void res.writeHead(200, {'content-type': 'image/png'}).end(Buffer.concat([PNG.subarray(0, 33), Buffer.alloc(200, 7)]));
  if (u === '/bomb') return void res.writeHead(200, {'content-type': 'image/png'}).end(ihdr(100000, 100000));
  if (u === '/big-length') {
    res.writeHead(200, {'content-length': '999999999'});
    res.write('x');
    return;
  }
  if (u === '/big-stream') {
    // no content-length: chunks until the client hangs up
    res.writeHead(200);
    const t = setInterval(() => res.write(Buffer.alloc(64 * 1024, 1)), 1);
    res.on('close', () => {
      streamClosed = true;
      clearInterval(t);
    });
    return;
  }
  if (u === '/stall-body') {
    res.writeHead(200);
    res.write('partial');
    res.on('close', () => (stalledClosed = true));
    return;
  }
  if (u === '/stall-headers') return; // never answers
  res.writeHead(404).end();
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as {port: number}).port;
const base = `http://localhost:${port}`;
const local: Policy = {hosts: /^localhost$/, protocols: ['http:'], ports: [String(port)], timeoutMs: 400, maxRedirects: 3, lookup: async () => ['127.0.0.1'], allowPrivate: true};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mediahub-test-'));

try {
  // ---- URL forms against the production policy ----
  for (const bad of [
    'http://images.unsplash.com/a.png', // wrong protocol
    'https://images.unsplash.com:8443/a.png', // wrong port
    'https://user:pw@images.unsplash.com/a.png', // credentials
    'https://evil.example/a.png',
    'https://unsplash.com.evil.example/a',
    'https://evilunsplash.com/a', // suffix without a dot boundary
    'file:///etc/passwd',
    'ftp://images.unsplash.com/a',
    'https://127.0.0.1/a',
    'https://[::1]/a',
    'https://2130706433/a', // decimal form of 127.0.0.1 (the URL parser normalises it to 127.0.0.1)
    'https://0x7f.1/a',
    'https://images.unsplash.com.@evil.example/a', // userinfo trick
  ])
    assert.throws(() => safeUrl(bad), /refused URL|Invalid URL/, bad);
  for (const ok of ['https://images.unsplash.com/a', 'https://cdn.pixabay.com/a', 'https://ia800.us.archive.org/a', 'https://api.iconify.design/a', 'https://archive.org:443/a']) safeUrl(ok);

  // ---- private / internal addresses ----
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '198.18.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'garbage'])
    assert.ok(isPrivateIp(ip), `${ip} is internal`);
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700::1111']) assert.ok(!isPrivateIp(ip), `${ip} is public`);
  // a name that resolves inside is refused; an IP literal is checked without DNS
  const realDns: Policy = {...local, lookup: POLICY.lookup, allowPrivate: false};
  await assert.rejects(get(`${base}/ok.png`, {}, realDns), /resolves to a private/);
  await assert.rejects(get(`${base}/ok.png`, {}, {...local, allowPrivate: false, lookup: async () => ['93.184.216.34', '10.0.0.5']}), /resolves to a private/, 'one private answer among public ones refuses');
  await assert.rejects(get(`${base}/ok.png`, {}, {...local, allowPrivate: false, lookup: async () => []}), /resolves to a private or unknown/);

  // ---- redirects: each hop re-checked ----
  assert.strictEqual((await get(`${base}/redir-ok`, {}, local)).finalUrl, `${base}/ok.png`);
  await assert.rejects(get(`${base}/redir-host`, {}, local), /refused URL/, 'redirect to a disallowed host');
  await assert.rejects(get(`${base}/redir-proto`, {}, local), /refused URL/, 'redirect across protocols');
  await assert.rejects(get(`${base}/redir-file`, {}, local), /refused URL/, 'redirect to file:');
  await assert.rejects(get(`${base}/redir-port`, {}, local), /refused URL/, 'redirect to another port');
  await assert.rejects(get(`${base}/redir-loop`, {}, local), /too many redirects/);

  // ---- timeouts ----
  await assert.rejects(get(`${base}/stall-headers`, {}, local), /abort|timeout|timed out/i, 'server never answers');
  const stalled = await get(`${base}/stall-body`, {}, local);
  await assert.rejects(bodyBytes(stalled), /abort|timeout|timed out|terminated/i, 'body stalls after the headers');
  for (let i = 0; i < 300 && !stalledClosed; i++) await new Promise((r) => setTimeout(r, 10)); // wait for the event, up to 3 s
  assert.ok(stalledClosed, 'the stalled connection was closed');

  // ---- size ----
  await assert.rejects(async () => bodyBytes(await get(`${base}/big-length`, {}, {...local, timeoutMs: 2000})), /over \d+ bytes/, 'declared length too big');
  await assert.rejects(async () => bodyBytes(await get(`${base}/big-stream`, {}, {...local, timeoutMs: 1000}), 200_000), /over 200000 bytes/, 'streamed past the cap with no length');
  for (let i = 0; i < 300 && !streamClosed; i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(streamClosed, 'the oversized stream was cancelled, not read to the end');

  // ---- file types: bytes decide ----
  assert.strictEqual(imageExt(PNG), 'png');
  assert.strictEqual(imageExt(Buffer.from('ffd8ffe0', 'hex')), 'jpeg');
  assert.strictEqual(imageExt(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')), 'webp');
  assert.strictEqual(imageExt(Buffer.from('GIF89a')), 'gif');
  for (const bad of ['<html>', '<svg xmlns="http://www.w3.org/2000/svg"/>', '', 'MZ\x90\x00', '#!/bin/sh\n']) assert.strictEqual(imageExt(Buffer.from(bad)), null, bad);
  assert.ok(100000 * 100000 > MAX_PIXELS);
  assert.strictEqual(imageExt(ihdr(100000, 100000)), null, 'a PNG announcing a huge canvas');

  // ---- imagePlate: success and cleanup after every failure ----
  const dir = (n: string) => fs.mkdtempSync(path.join(tmp, n));
  const empty = (d: string) => assert.deepStrictEqual(fs.readdirSync(d), [], `${d} holds nothing after the failure`);
  const d1 = dir('ok');
  const out = await imagePlate(`${base}/ok.png`, d1, 'a', local);
  assert.deepStrictEqual(fs.readdirSync(d1), ['a.png'], 'success leaves only the plate');
  assert.ok(fs.statSync(out).size > 0);
  for (const [route, why] of [['html', /not a png/], ['svg', /not a png/], ['bomb', /not a png/], ['garbage-png', /ffmpeg failed/], ['redir-host', /refused URL/], ['big-length', /over \d+ bytes/], ['nope', /download 404/]] as const) {
    const d = dir(route);
    await assert.rejects(imagePlate(`${base}/${route}`, d, 'a', {...local, timeoutMs: 3000}), why, route);
    empty(d);
  }
  const d2 = dir('ffmpeg-no-output'); // ffmpeg "succeeds" but writes nothing
  await assert.rejects(imagePlate(`${base}/ok.png`, d2, 'a', local, () => undefined), /produced no image/);
  empty(d2);

  // ---- the plate index ----
  const idx = path.join(tmp, 'index.json');
  const plate = (id: string) => ({id, file: `${id}.png`} as unknown as Plate);
  writeIndex({a: plate('a')}, idx);
  const before = fs.readFileSync(idx, 'utf8');
  assert.throws(() => writeIndex({b: {big: 1n} as unknown as Plate}, idx), /BigInt/);
  assert.strictEqual(fs.readFileSync(idx, 'utf8'), before, 'a failed update keeps the previous valid index');
  assert.deepStrictEqual(fs.readdirSync(tmp).filter((f) => f.includes('.tmp')), [], 'no temp index left');
  writeIndex({a: plate('a'), c: plate('c')}, idx);
  assert.deepStrictEqual(Object.keys(JSON.parse(fs.readFileSync(idx, 'utf8'))), ['a', 'c']);

  // ---- svg ----
  const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${inner}</svg>`;
  assert.ok(cleanSvg(wrap('<defs><linearGradient id="g"/></defs><use xlink:href="#g"/><circle r="3" fill="url(#g)"/>')), 'a plain picture with internal references passes');
  assert.ok(cleanSvg('<?xml version="1.0"?>' + wrap('<path d="M0 0"/>')));
  for (const [name, bad] of Object.entries({
    script: wrap('<script>alert(1)</script>'),
    handler: wrap('<circle onload="x()"/>'),
    handlerQuoted: wrap('<g onclick = "x()"/>'),
    foreign: wrap('<foreignObject><div/></foreignObject>'),
    jsHref: wrap('<a xlink:href="javascript:alert(1)"><circle/></a>'),
    externalHref: wrap('<image href="https://evil.example/x.png"/>'),
    fileHref: wrap('<image xlink:href="file:///etc/passwd"/>'),
    dtd: '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + wrap('<text>&x;</text>'),
    cssImport: wrap('<style>@import url(https://evil.example/a.css);</style>'),
    cssUrl: wrap('<rect style="fill:url(https://evil.example/a)"/>'),
    animate: wrap('<animate attributeName="href" to="javascript:x"/>'),
    iframe: wrap('<iframe src="x"/>'),
    notSvg: '<html></html>',
    huge: wrap('a'.repeat(2_100_000)),
  }))
    assert.strictEqual(cleanSvg(bad), null, name);

  // ---- videos: downloaded here (capped), identified by bytes, trimmed from a LOCAL file; ffmpeg never touches the network ----
  const ffbin = (args: string[]) => spawnSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', ...args], {cwd: path.resolve(import.meta.dirname, '../engine'), encoding: 'utf8', timeout: 120_000});
  assert.strictEqual(VIDEO_PROTOCOLS, 'file');
  const va = videoArgs('in.mp4', 'mov,mp4,m4a,3gp,3g2,mj2', 3, 8, 'o.webm');
  assert.deepStrictEqual(va.slice(0, 4), ['-protocol_whitelist', 'file', '-f', 'mov,mp4,m4a,3gp,3g2,mj2'], 'whitelist and forced format precede the input');
  assert.ok(va.indexOf('-f') < va.indexOf('-i') && va.indexOf('-protocol_whitelist') < va.indexOf('-i'));
  for (const [what, data, want] of [['mp4', Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex'), 'mov,mp4,m4a,3gp,3g2,mj2'], ['webm', Buffer.from('1a45dfa3a3428681', 'hex'), 'matroska,webm'], ['hls playlist', Buffer.from('#EXTM3U\n#EXTINF:1,\nfile:///etc/hosts\n'), null], ['concat list', Buffer.from("ffconcat version 1.0\nfile '/etc/hosts'\n"), null], ['html', Buffer.from('<html>'), null], ['empty', Buffer.alloc(0), null], ['short', Buffer.from('abc'), null]] as const) {
    const f = path.join(tmp, `sniff-${what.replace(/ /g, '-')}`);
    fs.writeFileSync(f, data);
    assert.strictEqual(videoFormat(f), want, what);
  }
  // a real clip made with the real ffmpeg, then served by the local server
  const pngFile = path.join(tmp, 'f.png');
  fs.writeFileSync(pngFile, PNG);
  const wavFile = path.join(tmp, 'a.wav');
  const pcm = Buffer.alloc(16000);
  const wh = Buffer.alloc(44);
  wh.write('RIFF', 0); wh.writeUInt32LE(36 + pcm.length, 4); wh.write('WAVEfmt ', 8); wh.writeUInt32LE(16, 16); wh.writeUInt16LE(1, 20); wh.writeUInt16LE(1, 22); wh.writeUInt32LE(8000, 24); wh.writeUInt32LE(16000, 28); wh.writeUInt16LE(2, 32); wh.writeUInt16LE(16, 34); wh.write('data', 36); wh.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(wavFile, Buffer.concat([wh, pcm]));
  const made = ffbin(['-loop', '1', '-framerate', '30', '-t', '2', '-i', pngFile, '-i', wavFile, '-vf', 'scale=320:568,format=yuv420p', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', path.join(tmp, 'clip.mp4')]);
  assert.strictEqual(made.status, 0, made.stderr);
  clip = fs.readFileSync(path.join(tmp, 'clip.mp4'));
  const vdir = (n: string) => fs.mkdtempSync(path.join(tmp, n));
  const v1 = vdir('video-ok');
  const webm = await videoPlate(`${base}/clip.mp4`, v1, 'p', 0, 1, local);
  assert.deepStrictEqual(fs.readdirSync(v1), ['p.webm'], 'success leaves only the plate (the downloaded source is removed)');
  assert.ok(fs.statSync(webm).size > 0);
  assert.strictEqual(videoFormat(webm), 'matroska,webm', 'the output is a real webm');
  for (const [route, why, max] of [['playlist.m3u8', /not an mp4, mov, webm or mkv/, undefined], ['concat.txt', /not an mp4, mov, webm or mkv/, undefined], ['redir-host', /refused URL/, undefined], ['big-length', /over \d+ bytes/, undefined], ['clip.mp4', /over 300 bytes/, 300], ['big-stream', /over 300000 bytes/, 300000], ['nope', /download 404/, undefined]] as const) {
    const d = vdir(route.replace(/\W/g, ''));
    let ran = false;
    await assert.rejects(videoPlate(`${base}/${route}`, d, 'p', 0, 1, {...local, timeoutMs: 4000}, max, () => { ran = true; }), why, route);
    assert.deepStrictEqual(fs.readdirSync(d), [], `${route}: nothing left behind`);
    assert.ok(!ran, `${route}: ffmpeg was never started on something that is not a video`);
  }
  const vd = vdir('video-stall');
  await assert.rejects(videoPlate(`${base}/stall-body`, vd, 'p', 0, 1, local), /abort|timeout|timed out|terminated|not an mp4/i, 'a stalled download');
  assert.deepStrictEqual(fs.readdirSync(vd), []);
  const vz = vdir('video-fails');
  await assert.rejects(videoPlate(`${base}/clip.mp4`, vz, 'p', 0, 1, local, undefined, () => { throw new Error('ffmpeg failed: boom'); }), /boom/);
  assert.deepStrictEqual(fs.readdirSync(vz), [], 'a failed cut leaves neither the source nor a partial output');
  const vn = vdir('video-noout');
  await assert.rejects(videoPlate(`${base}/clip.mp4`, vn, 'p', 0, 1, local, undefined, () => undefined), /produced no video/);
  assert.deepStrictEqual(fs.readdirSync(vn), []);
  // downloadFile on its own: capped on disk, partial removed
  const dl = path.join(tmp, 'dl.bin');
  await assert.rejects(downloadFile(`${base}/big-stream`, dl, 200_000, {...local, timeoutMs: 4000}), /over 200000 bytes/);
  assert.ok(!fs.existsSync(dl), 'no partial file after a capped download');
  await downloadFile(`${base}/clip.mp4`, dl, 10_000_000, local);
  assert.strictEqual(fs.statSync(dl).size, clip.length);

  // ---- ffmpeg itself, under the production whitelist: only a plain local file is readable ----
  const localMp4 = path.join(tmp, 'clip.mp4');
  const cut = (input: string, extra: string[] = []) => ffbin(['-protocol_whitelist', VIDEO_PROTOCOLS, ...extra, '-t', '1', '-i', input, '-an', '-frames:v', '1', path.join(tmp, 'ff.png')]);
  assert.strictEqual(cut(localMp4).status, 0, 'a plain local mp4 is readable');
  fs.rmSync(path.join(tmp, 'ff.png'), {force: true});
  fs.writeFileSync(path.join(tmp, 'p.m3u8'), '#EXTM3U\n#EXTINF:1,\nfile:///etc/hosts\n#EXT-X-ENDLIST\n');
  for (const [input, what] of [[`concat:${localMp4}|${localMp4}`, 'concat'], [`${base}/clip.mp4`, 'http'], ['https://example.com/x.mp4', 'https'], ['subfile,,start,0,end,0,,:/etc/hosts', 'subfile'], ['data:text/plain;base64,AAAA', 'data'], ['tcp://127.0.0.1:1', 'tcp']] as const) {
    const r = cut(input);
    assert.notStrictEqual(r.status, 0, `ffmpeg refuses ${what}`);
    assert.match(r.stderr, new RegExp(`Protocol '${what}' not on whitelist`), what);
  }
  assert.ok(!fs.existsSync(path.join(tmp, 'ff.png')), 'no output from a refused input');
  // with the format forced to mp4, a playlist saved under any name is not parsed as a playlist at all
  const forced = cut(path.join(tmp, 'p.m3u8'), ['-f', 'mov,mp4,m4a,3gp,3g2,mj2']);
  assert.notStrictEqual(forced.status, 0, 'a playlist is not read as mp4');
  assert.doesNotMatch(forced.stderr, /hosts/, 'the file named inside the playlist was never opened');

  // ---- no rebinding: the name is resolved once and the connection goes to the address that was checked ----
  {
    let lookups = 0;
    const rebind: Policy = {...local, hosts: /^rebind\.test$/, lookup: async () => (lookups++ === 0 ? ['127.0.0.1'] : ['10.255.255.1'])};
    const r = await get(`http://rebind.test:${port}/ok.png`, {}, rebind);
    assert.strictEqual(r.status, 200, '.test names cannot resolve in the system DNS: only the pinned answer can have connected');
    assert.deepStrictEqual((await bodyBytes(r)).subarray(0, 4), PNG.subarray(0, 4));
    assert.strictEqual(lookups, 1, 'one resolution per hop, none at connect time');
    await assert.rejects(get(`http://rebind.test:${port}/ok.png`, {}, {...rebind, allowPrivate: false, lookup: async () => ['10.255.255.1']}), /resolves to a private/, 'the private answer is refused before any connection');
  }

  // ---- https: certificates are verified; protocol downgrades are refused ----
  const sh = (args: string[]) => spawnSync('openssl', args, {encoding: 'utf8'});
  const cert = (cn: string) => {
    const [k, c] = [path.join(tmp, `${cn}.key`), path.join(tmp, `${cn}.crt`)];
    const r = sh(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '2', '-subj', `/CN=${cn}`, '-addext', `subjectAltName=DNS:${cn}`]);
    return r.status === 0 ? {key: fs.readFileSync(k), cert: fs.readFileSync(c)} : null;
  };
  const good = cert('localhost');
  const other = cert('other.example');
  if (!good || !other) {
    skipped.push('https: openssl could not make a test certificate');
  } else {
    const tls = https.createServer(good, (req, res) => {
      if (req.url === '/ok.png') return void res.writeHead(200, {'content-type': 'image/png'}).end(PNG);
      if (req.url === '/to-http') return void res.writeHead(302, {location: `http://localhost:${port}/ok.png`}).end();
      res.writeHead(404).end();
    });
    const wrongName = https.createServer(other, (_q, res) => res.writeHead(200).end('x'));
    await Promise.all([new Promise<void>((r) => tls.listen(0, '127.0.0.1', r)), new Promise<void>((r) => wrongName.listen(0, '127.0.0.1', r))]);
    const tp = (tls.address() as {port: number}).port;
    const sp = (s: https.Server) => (s.address() as {port: number}).port;
    const tlsPolicy: Policy = {...local, protocols: ['https:'], ports: [String(tp)], ca: good.cert};
    try {
      const r = await get(`https://localhost:${tp}/ok.png`, {}, tlsPolicy);
      assert.strictEqual(r.status, 200);
      assert.strictEqual(imageExt(await bodyBytes(r)), 'png', 'https works end to end with its certificate trusted');
      await assert.rejects(get(`https://localhost:${tp}/ok.png`, {}, {...tlsPolicy, ca: undefined}), /self.signed|unable to verify|certificate/i, 'an untrusted certificate is refused (verification is on)');
      await assert.rejects(get(`https://localhost:${sp(wrongName)}/x`, {}, {...tlsPolicy, ports: [String(sp(wrongName))], ca: other.cert}), /altnames|hostname|does not match|certificate/i, 'a certificate for another name is refused');
      await assert.rejects(get(`https://localhost:${tp}/to-http`, {}, {...tlsPolicy, ports: [String(tp), String(port)]}), /refused URL http:/, 'https to http redirect is a downgrade and is refused');
      await assert.rejects(get(`http://localhost:${tp}/ok.png`, {}, tlsPolicy), /refused URL http:/, 'plain http is refused by an https-only policy');
    } finally {
      tls.closeAllConnections();
      wrongName.closeAllConnections();
      await Promise.all([new Promise((r) => tls.close(r)), new Promise((r) => wrongName.close(r))]);
    }
  }
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  fs.rmSync(tmp, {recursive: true, force: true});
}
if (skipped.length) {
  console.log(`mediahub SKIPPED: ${skipped.join('; ')}`);
  if (process.env.CI) throw new Error('a skipped HTTPS test is a failure in CI (the runner needs openssl)');
}
console.log('mediahub ok: URL forms, ports, credentials, private/internal addresses, redirect hops (host, protocol, port, file:, loop), timeouts, declared and streamed size caps, file types by bytes, cleanup after 8 failure paths, index kept on a failed update, 14 unsafe SVGs refused, ffmpeg refuses file/concat/http/subfile/data inputs');
