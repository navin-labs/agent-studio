// make.mjs against a TEMPORARY engine tree (FORGE_TEST_ROOT): the assets and settings a render requires cannot be skipped, with or
// without --force, and a configured voice cannot be skipped or left half-done. The TTS engine is a fake program that writes silent
// clips (or fails, or skips a line, or writes garbage); nothing renders (every case stops at the gate or at --vo-only), nothing
// touches the real engine/public or engine/out, no network. Run: node studio/make-required.test.ts
import assert from 'node:assert';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'make-required-'));
const ENG = path.join(T, 'engine');
const link = (target: string, at: string) => (fs.mkdirSync(path.dirname(at), {recursive: true}), fs.symlinkSync(target, at));
fs.mkdirSync(path.join(ENG, 'public'), {recursive: true});
fs.mkdirSync(path.join(ENG, 'content/storyboards'), {recursive: true});
link(path.join(REPO, 'engine/scripts'), path.join(ENG, 'scripts'));
link(path.join(REPO, 'engine/src'), path.join(ENG, 'src'));
link(path.join(REPO, 'engine/styles'), path.join(ENG, 'styles'));
link(path.join(REPO, 'styles'), path.join(T, 'styles'));
fs.mkdirSync(path.join(T, 'recipes'));
fs.cpSync(path.join(REPO, 'channels'), path.join(T, 'channels'), {recursive: true});

const pub = (...p: string[]) => path.join(ENG, 'public', ...p);
const put = (f: string, data: string | Buffer = 'x') => (fs.mkdirSync(path.dirname(f), {recursive: true}), fs.writeFileSync(f, data));
const rm = (f: string) => fs.rmSync(f, {force: true, recursive: true});
const CH = 'c1-automation';
const chFile = path.join(T, 'channels', CH, 'channel.json');
const channel = JSON.parse(fs.readFileSync(chFile, 'utf8'));
const setChannel = (patch: object) => fs.writeFileSync(chFile, JSON.stringify({...channel, ...patch}));
const board = JSON.parse(fs.readFileSync(path.join(REPO, 'engine/test/boards/host-supplier-bills.json'), 'utf8'));
const prodBoard = path.join(ENG, 'content/storyboards/req.json');
const writeBoard = (extra: object = {}) => put(prodBoard, JSON.stringify({...board, id: 'req', ...extra}));
const brandAll = () => {
  put(pub('brand', 'mark.png'));
  put(pub('brand', 'audio', `${CH}-bed.wav`));
  put(pub('brand', 'audio', `${CH}-bumper.wav`));
};

// VOICE is 'off', not empty: mediaHub.ts fills any empty variable from the real engine/.env (by name) when it is imported
// a fake TTS python: reads --jobs, writes a silent 8 kHz WAV per job, unless FAKE_TTS says otherwise
const wav = (seconds: number) => {
  const pcm = Buffer.alloc(16000 * seconds);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(8000, 24); h.writeUInt32LE(16000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
const fakePy = path.join(ENG, '.venv-voice', 'kokoro', 'bin', 'python');
put(path.join(T, 'good.wav'), wav(1));
put(fakePy, `#!${process.execPath}
const fs = require('node:fs');
const a = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(a[a.indexOf('--jobs') + 1], 'utf8'));
const mode = process.env.FAKE_TTS || 'ok';
fs.writeFileSync(${JSON.stringify(path.join(T, 'tts-calls.log'))}, String(jobs.length) + '\\n', {flag: 'a'});
if (mode === 'fail') { process.stderr.write('fake tts: out of memory\\n'); process.exit(2); }
jobs.forEach((j, i) => {
  if (mode === 'skip-last' && i === jobs.length - 1) return;
  if (mode === 'empty') return fs.writeFileSync(j.out, '');
  if (mode === 'garbage') return fs.writeFileSync(j.out, 'not audio at all');
  fs.copyFileSync(${JSON.stringify(path.join(T, 'good.wav'))}, j.out);
});
`);
fs.chmodSync(fakePy, 0o755);

const make = (args: string[], env: Record<string, string> = {}) => {
  const r = spawnSync(process.execPath, [path.join(REPO, 'engine/scripts/make.mjs'), ...args], {cwd: path.join(REPO, 'engine'), encoding: 'utf8', timeout: 180_000, env: {PATH: process.env.PATH ?? '', HOME: os.homedir(), FORGE_TEST_ROOT: ENG, VOICE: 'off', ...env}});
  return {code: r.status, out: (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, '')};
};
const REQUIRED = /error \(required, --force cannot skip it\): /;

// ---- baseline: everything present, live channel: no required-asset complaint, and --force --check goes through ----
setChannel({live: true});
brandAll();
writeBoard();
let r = make([prodBoard, '--check', '--force']);
assert.equal(r.code, 0, r.out);
assert.doesNotMatch(r.out, REQUIRED);
assert.match(r.out, /error: /, 'the board does have ordinary quality-gate errors (art gate), which --force does skip');

// ---- required music ----
writeBoard({music: 'calm-bed.wav'});
for (const flags of [['--check'], ['--check', '--force'], ['--force']]) {
  r = make([prodBoard, ...flags]);
  assert.equal(r.code, 1, `music missing, ${flags.join(' ')}: ${r.out}`);
  assert.match(r.out, new RegExp(REQUIRED.source + 'music file public/music/calm-bed.wav is named by the board'));
}
put(pub('music', 'calm-bed.wav'));
r = make([prodBoard, '--check', '--force']);
assert.equal(r.code, 0, `music present: ${r.out}`);

// ---- required end-card mark ----
writeBoard();
rm(pub('brand', 'mark.png'));
for (const flags of [['--check'], ['--check', '--force']]) {
  r = make([prodBoard, ...flags]);
  assert.equal(r.code, 1, `mark missing, ${flags.join(' ')}`);
  assert.match(r.out, /no end-card mark/);
}
put(pub('brand', 'mark.png'));
put(pub('brand', CH, 'mark.svg'));
rm(pub('brand', 'mark.png'));
assert.equal(make([prodBoard, '--check', '--force']).code, 0, 'the channel\'s own mark is enough');
rm(pub('brand', CH));
put(pub('brand', 'mark.png'));

// ---- live channel audio: both files, never half ----
for (const [what, drop] of [['bed missing', 'bed'], ['bumper missing', 'bumper']] as const) {
  rm(pub('brand', 'audio', `${CH}-${drop}.wav`));
  r = make([prodBoard, '--check', '--force']);
  assert.equal(r.code, 1, what);
  assert.match(r.out, /only one of its brand audio files/);
  put(pub('brand', 'audio', `${CH}-${drop}.wav`));
}
rm(pub('brand', 'audio'));
r = make([prodBoard, '--check', '--force']);
assert.equal(r.code, 1, 'a live channel with no brand audio');
assert.match(r.out, /is live and has no brand audio/);
setChannel({live: false});
r = make([prodBoard, '--check', '--force']);
assert.equal(r.code, 0, `a channel that is not live may go without, with a warning: ${r.out}`);
assert.match(r.out, /warn: channel c1-automation is not live and has no brand audio/);
setChannel({live: true});
brandAll();

// ---- a configured voice: production cannot be silent ----
r = make([prodBoard, '--force'], {VOICE: 'off'});
assert.equal(r.code, 1, r.out);
assert.match(r.out, new RegExp(REQUIRED.source + 'channel c1-automation has a voice configured'), 'VOICE off in production');
r = make([prodBoard, '--force', '--no-vo'], {VOICE: 'on'});
assert.equal(r.code, 1);
assert.match(r.out, /has a voice configured/, '--no-vo in production');
const preview = path.join(T, 'preview');
r = make([prodBoard, '--force', '--no-vo', '--vo-only', `--out=${preview}`, '--only=instagram'], {VOICE: 'on'});
assert.doesNotMatch(r.out, /has a voice configured/, 'a preview (--out) may go without a voice');

// ---- the voice itself: fake TTS ----
const vo = (mode: string) => {
  rm(pub('vo'));
  rm(path.join(T, 'tts-calls.log'));
  return make([prodBoard, '--force', '--vo-only', `--out=${preview}`, '--only=instagram'], {VOICE: 'on', FAKE_TTS: mode});
};
r = vo('ok');
assert.equal(r.code, 0, `complete clips: ${r.out}`);
const clips = fs.readdirSync(pub('vo', 'req', 'instagram')).filter((f) => /^s\d\d\.wav$/.test(f));
assert.ok(clips.length >= 6, `every voiced line has a clip (${clips.length})`);
for (const mode of ['skip-last', 'fail', 'empty', 'garbage']) {
  r = vo(mode);
  assert.equal(r.code, 1, `${mode}: a half-voiced or failed voice is a failure, never a silent render. ${r.out}`);
  assert.match(r.out, /error: instagram: /, mode);
  assert.ok(fs.existsSync(path.join(T, 'tts-calls.log')), `${mode}: the fake TTS really ran`);
}
assert.match(vo('skip-last').out, /s08: the voice engine wrote no clip for this line/);
assert.doesNotMatch(vo('skip-last').out, new RegExp(os.tmpdir().replace(/\//g, '\\/')), 'the message carries no absolute path');
assert.match(vo('fail').out, /Local voice \(kokoro\) failed/);
assert.doesNotMatch(r.out, /fake tts: out of memory|ANTHROPIC|sk-/, 'no environment leaks into the message');

rm(T);
console.log('make-required ok: required music, end-card mark, live-channel brand audio and a configured voice cannot be skipped with --force, --no-vo or VOICE off in production; a fake TTS that fails, skips a line, writes nothing or writes garbage fails the render instead of shipping silent lines; only a not-live channel may go without brand audio, with a warning');
