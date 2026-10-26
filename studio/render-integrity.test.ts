// A render that stopped half-way, a zero-byte file and a text file renamed .mp4 must fail QA's file checks, not crash it or pass on
// the header alone. Uses the real Remotion ffmpeg to make a 1-second clip in a temp folder. Run: node studio/render-integrity.test.ts
import assert from 'node:assert';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {mp4Complete, probeOrBroken, probeVideo} from '../engine/scripts/probe.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-test-'));
const good = path.join(tmp, 'good.mp4');
const png = path.join(tmp, 'frame.png');
fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'));
const wav = path.join(tmp, 'a.wav'); // 1 s of 8 kHz mono silence (Remotion's ffmpeg has no signal generators)
const pcm = Buffer.alloc(16000);
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(8000, 24); head.writeUInt32LE(16000, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(wav, Buffer.concat([head, pcm]));
const r = spawnSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '30', '-t', '1', '-i', png, '-i', wav, '-vf', 'scale=320:568,format=yuv420p', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', good], {cwd: path.join(import.meta.dirname, '../engine'), encoding: 'utf8', timeout: 120_000});
assert.equal(r.status, 0, r.stderr);
const bytes = fs.readFileSync(good);
const make = (name: string, data: Buffer | string) => (fs.writeFileSync(path.join(tmp, name), data), path.join(tmp, name));

assert.equal(mp4Complete(good), true);
const p = await probeVideo(good);
assert.deepEqual([p.container, p.width, p.height, p.audio, p.complete], ['mp4', 320, 568, true, true]);

for (const [name, data] of [
  ['truncated-60.mp4', bytes.subarray(0, Math.floor(bytes.length * 0.6))],
  ['truncated-1-byte.mp4', bytes.subarray(0, bytes.length - 1)],
  ['trailing-junk.mp4', Buffer.concat([bytes, Buffer.from('junk')])],
  ['header-only.mp4', bytes.subarray(0, 40)],
] as const) {
  const f = make(name, data);
  assert.equal(mp4Complete(f), false, `${name} is incomplete`);
  const q = await probeOrBroken(f);
  assert.ok(q.complete === false || q.container === 'unreadable', `${name}: QA sees it as broken`);
}
for (const [name, data] of [['zero.mp4', ''], ['text.mp4', 'this is not a video at all'], ['html.mp4', '<html><body>404</body></html>']] as const) {
  const f = make(name, data);
  assert.equal(mp4Complete(f), false, name);
  const q = await probeOrBroken(f);
  assert.deepEqual([q.container, q.complete, q.width], ['unreadable', false, 0], `${name} fails the probe without crashing`);
}
const gone = await probeOrBroken(path.join(tmp, 'missing.mp4'));
assert.equal(gone.container, 'unreadable', 'a missing file is a failed check');

fs.rmSync(tmp, {recursive: true, force: true});
console.log('render-integrity ok: a complete mp4 probes clean; truncated, trailing-junk, header-only, zero-byte, text and missing files are all reported broken, none crash the probe');
