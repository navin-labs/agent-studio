// Render fault injection, deterministic, temp folders only, no Chromium and no network: the post-render ffmpeg steps (engine/scripts/
// film.mjs: master, motion, filmstrip) run against FAKE ffmpeg programs that are missing, fail, hang, lie or leave partial files, and
// against real ffmpeg on unreadable input; the assets the bundle references are checked to exist; and a broken render must never
// reach approval. What this cannot do is listed in docs/SECURITY.md ("Render fault injection: not simulated").
// Run: node studio/render-faults.test.ts
import assert from 'node:assert';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderVariants} from './fixtures/variants.ts';
import {applyApproval, approvalQuery, currentStatus, ledgerFile, lkey, type Paths} from './ledger.ts';
import {file, PLATFORMS} from './variant.ts';

// film.mjs is plain JavaScript without type declarations
const FILM = '../engine/scripts/film.mjs';
const {ff, filmstrip, master, motion, tool} = (await import(FILM)) as Record<string, any>;
const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-faults-'));
const real = {...tool};
// long enough for a fake program to start and write its pid even on a loaded machine or with a preload (node start-up is the cost)
const TIMEOUT = 2500;
const useFake = (name: string, body: string, timeoutMs = 20_000) => {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, `#!${process.execPath}\nconst fs = require('node:fs');\nconst a = process.argv.slice(2);\n${body}\n`);
  fs.chmodSync(f, 0o755);
  Object.assign(tool, {bin: f, env: {}, timeoutMs});
  return f;
};
const restore = () => Object.assign(tool, real);
const LOUD = `process.stderr.write('{ "input_i" : "-20.0", "input_tp" : "-3.0", "input_lra" : "5.0", "input_thresh" : "-30.0", "target_offset" : "0.1" }');`;
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const bytes = (f: string) => fs.readFileSync(f).toString('hex');
const tmpFiles = (dir: string) => fs.readdirSync(dir).filter((f) => /\.(tmp|master\.mp4)$/.test(f));

// ---- the ffmpeg runner: every way a subprocess can go wrong becomes a clear error ----
tool.bin = path.join(tmp, 'no-such-ffmpeg');
assert.throws(() => ff(['-version']), /could not run \(ENOENT\)/, 'executable missing');
useFake('notexec', '');
fs.chmodSync(tool.bin, 0o644);
assert.throws(() => ff(['-version']), /could not run \((EACCES|ENOENT)\)/, 'file present but not runnable');
useFake('fail3', `process.stderr.write('Error: No space left on device\\n'); process.exit(3);`);
assert.throws(() => ff(['-i', 'x.mp4']), (e: Error) => /exited 3/.test(e.message) && /No space left on device/.test(e.message) && !e.message.includes(process.env.HOME ?? '\0'), 'non-zero exit names the code and the tool\'s own last words, not the environment');
useFake('signalled', `process.kill(process.pid, 'SIGKILL');`);
assert.throws(() => ff(['-i', 'x.mp4']), /on signal SIGKILL/, 'a process killed from outside');
useFake('hang', `fs.writeFileSync(${JSON.stringify(path.join(tmp, 'hang.pid'))}, String(process.pid)); setInterval(() => {}, 1000);`, TIMEOUT);
const t0 = Date.now();
assert.throws(() => ff(['-i', 'x.mp4']), new RegExp(`timed out after ${TIMEOUT} ms and was killed`), 'stalled process');
assert.ok(Date.now() - t0 < 10_000);
await sleep(100);
assert.ok(!alive(Number(fs.readFileSync(path.join(tmp, 'hang.pid'), 'utf8'))), 'the stalled child is gone, not orphaned');
useFake('ignores-term', `process.on('SIGTERM', () => {}); fs.writeFileSync(${JSON.stringify(path.join(tmp, 'term.pid'))}, String(process.pid)); setInterval(() => {}, 1000);`, TIMEOUT);
assert.throws(() => ff([]), /timed out/);
await sleep(100);
assert.ok(!alive(Number(fs.readFileSync(path.join(tmp, 'term.pid'), 'utf8'))), 'a process that ignores SIGTERM is still killed (SIGKILL)');
restore();
assert.throws(() => ff(['-definitely-not-a-flag']), /ffmpeg exited/, 'invalid arguments (real ffmpeg)');
assert.throws(() => ff(['-i', path.join(tmp, 'absent.mp4'), '-f', 'null', '-']), /exited/, 'input file missing (real ffmpeg)');

// ---- master(): the original is replaced only by a finished file ----
const mp4 = path.join(tmp, 'film.mp4');
const original = Buffer.from('ORIGINAL MP4 BYTES');
const fresh = () => fs.writeFileSync(mp4, original);
fresh();
useFake('nojson', `process.exit(0);`);
assert.throws(() => master(mp4), /loudnorm measured nothing before mastering/, 'exit 0 with no measurement is not success');
useFake('badjson', `process.stderr.write('{ "input_i" : nope }');`);
assert.throws(() => master(mp4), /not valid JSON/);
useFake('partial', `if (a.some((x) => x.includes('print_format=json'))) { ${LOUD} } else { fs.writeFileSync(a.at(-1), 'HALF A FILE'); process.exit(1); }`);
assert.throws(() => master(mp4), /ffmpeg exited 1/);
assert.equal(bytes(mp4), original.toString('hex'), 'the prior valid output is untouched');
assert.deepEqual(tmpFiles(tmp), [], 'the partial .master.mp4 is removed');
useFake('empty-out', `if (a.some((x) => x.includes('print_format=json'))) { ${LOUD} } else { process.exit(0); }`);
assert.throws(() => master(mp4), /mastering produced no file/, 'exit 0 with no output file is a failure');
assert.equal(bytes(mp4), original.toString('hex'));
useFake('zero-out', `if (a.some((x) => x.includes('print_format=json'))) { ${LOUD} } else { fs.writeFileSync(a.at(-1), ''); }`);
assert.throws(() => master(mp4), /mastering produced no file/, 'a zero-byte output is a failure');
assert.deepEqual(tmpFiles(tmp), []);
useFake('master-hang', `if (a.some((x) => x.includes('print_format=json'))) { ${LOUD} } else { fs.writeFileSync(a.at(-1), 'partial'); fs.writeFileSync(${JSON.stringify(path.join(tmp, 'm.pid'))}, String(process.pid)); setInterval(() => {}, 1000); }`, TIMEOUT);
assert.throws(() => master(mp4), /timed out/);
await sleep(100);
assert.ok(!alive(Number(fs.readFileSync(path.join(tmp, 'm.pid'), 'utf8'))), 'no orphan after an interrupted mastering pass');
assert.equal(bytes(mp4), original.toString('hex'));
assert.deepEqual(tmpFiles(tmp), [], 'interrupted pass leaves no partial file');
useFake('ok', `if (a.some((x) => x.includes('print_format=json'))) { ${LOUD} } else { fs.writeFileSync(a.at(-1), 'MASTERED'); }`);
assert.deepEqual(master(mp4), {before: -20, lufs: -20, true_peak: -3}, 'the happy path still works');
assert.equal(fs.readFileSync(mp4, 'utf8'), 'MASTERED');
assert.deepEqual(tmpFiles(tmp), []);
restore();

// ---- motion() and filmstrip() on output that exists but does not decode ----
const junk = path.join(tmp, 'junk.mp4');
for (const [name, data] of [['text', 'not a video'], ['zero', ''], ['html', '<html>404</html>']] as const) {
  fs.writeFileSync(junk, data);
  assert.throws(() => motion(junk), /exited|only \d+ frame/, `motion on ${name}`);
  const out = path.join(tmp, `strip-${name}.png`);
  fs.writeFileSync(out, 'OLD CONTACT SHEET');
  assert.throws(() => filmstrip(junk, out), /exited|decoded/, `filmstrip on ${name}`);
  assert.equal(fs.readFileSync(out, 'utf8'), 'OLD CONTACT SHEET', 'a failed contact sheet keeps the previous valid one');
  assert.deepEqual(tmpFiles(tmp).filter((f) => f.startsWith('strip')), []);
}
assert.throws(() => motion(path.join(tmp, 'absent.mp4')), /exited/, 'missing file');
// frames decoded: fewer than the minimum is an explicit error, not a TypeError from an empty list
useFake('one-frame', `process.stdout.write(Buffer.alloc(54 * 96));`);
assert.throws(() => motion(junk), /only 1 frame\(s\) decoded/);
restore();

// ---- output directory problems ----
const gone = path.join(tmp, 'no', 'such', 'dir', 'strip.png');
useFake('strip-frames', `process.stdout.write(Buffer.alloc(180 * 320 * 3 * 4, 9));`);
assert.throws(() => filmstrip(junk, gone), /ENOENT/, 'missing output directory');
const ro = path.join(tmp, 'readonly');
fs.mkdirSync(ro);
fs.chmodSync(ro, 0o555);
if (process.getuid?.() !== 0) {
  assert.throws(() => filmstrip(junk, path.join(ro, 'strip.png')), /EACCES|EPERM/, 'permission denied');
  assert.deepEqual(fs.readdirSync(ro), [], 'nothing written into a directory we may not write');
}
fs.chmodSync(ro, 0o755);
const okStrip = path.join(tmp, 'ok-strip.png');
const r = filmstrip(junk, okStrip);
assert.ok(r.hook > 0 && fs.statSync(okStrip).size > 100 && !fs.existsSync(`${okStrip}.tmp`), 'the happy path writes the PNG via a temp name');
// the PNG is written under a temp name and renamed: if that temp name cannot be written, the existing contact sheet is not touched
const guarded = path.join(tmp, 'guarded.png');
fs.writeFileSync(guarded, 'OLD CONTACT SHEET');
fs.mkdirSync(`${guarded}.tmp`);
assert.throws(() => filmstrip(junk, guarded), /EISDIR|EEXIST|EPERM|ENOTEMPTY|EACCES/);
assert.equal(fs.readFileSync(guarded, 'utf8'), 'OLD CONTACT SHEET', 'a failed write never replaces the previous sheet');
fs.rmSync(`${guarded}.tmp`, {recursive: true});
restore();

// ---- assets the bundle references must exist (a missing font or image fails here, not mid-render) ----
{
  const missing: string[] = [];
  const walk = (d: string): string[] => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
  let seen = 0;
  // engine/src/fx/demos are gallery demos that read engine/public/hook-test/, which is git-ignored (a local scratch folder); production films do not
  for (const f of walk(path.join(ROOT, 'engine/src')).filter((x) => !x.includes(`${path.sep}fx${path.sep}demos${path.sep}`)))
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/staticFile\(\s*[`'"]([^`'"$]+)[`'"]\s*\)/g)) {
      seen++;
      if (!fs.existsSync(path.join(ROOT, 'engine/public', m[1]))) missing.push(`${path.relative(ROOT, f)}: ${m[1]}`);
    }
  assert.ok(seen > 15, `scanned ${seen} literal staticFile() references`);
  assert.deepEqual(missing, [], 'every literal staticFile() asset exists under engine/public');
  // the same scan catches a planted break
  const planted = 'staticFile("fonts/does-not-exist.woff2")'.match(/staticFile\(\s*[`'"]([^`'"$]+)[`'"]\s*\)/)![1];
  assert.ok(!fs.existsSync(path.join(ROOT, 'engine/public', planted)));
}

// ---- required assets: a board that names music the repo does not have is an error, not a silent render without it ----
{
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/test/c1-literal.json'), 'utf8'));
  const run = (music?: string) => {
    const f = path.join(tmp, `music-${music ?? 'none'}.json`);
    fs.writeFileSync(f, JSON.stringify({...doc, ...(music ? {music} : {})}));
    const r = spawnSync(process.execPath, ['scripts/make.mjs', f, '--check'], {cwd: path.join(ROOT, 'engine'), encoding: 'utf8', timeout: 120_000});
    return (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, '');
  };
  assert.match(run('definitely-not-there.wav'), /error \(required, --force cannot skip it\): music file public\/music\/definitely-not-there\.wav is named by the board and does not exist/);
  assert.doesNotMatch(run(), /music file/, 'a board that names no music is not asked for one');
}

// ---- a broken render never reaches approval or dispatch ----
const secret = 'test-secret-0123456789';
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(ROOT, 'studio/fixtures/recipes'), channels: path.join(tmp, 'channels'), queue: path.join(tmp, 'queue')};
fs.cpSync(path.join(ROOT, 'channels'), p.channels, {recursive: true});
const c1File = path.join(p.channels, 'c1-automation', 'channel.json');
const c1 = JSON.parse(fs.readFileSync(c1File, 'utf8'));
fs.writeFileSync(c1File, JSON.stringify({...c1, publishers: c1.publishers.map((q: {platform: string}) => (q.platform === 'facebook' ? {...q, page_id: undefined} : q))}));
const board = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine/test/boards/host-supplier-bills.json'), 'utf8'));
fs.mkdirSync(p.content[0], {recursive: true});
const link = (id: string) => '/approve?' + approvalQuery({channel: 'c1-automation', week: '2026-W40', ids: [id], by: 'navin', exp: Math.floor(Date.now() / 1000) + 3600}, secret);
const ledgerLines = () => (fs.existsSync(ledgerFile(p)) ? fs.readFileSync(ledgerFile(p), 'utf8').split('\n').filter(Boolean).length : 0);
const vf = (id: string, pf: (typeof PLATFORMS)[number], kind: string) => file(p.out, {channel: 'c1-automation', date: '2026-10-01', id, platform: pf}, kind);
const cases: [string, (id: string) => void, RegExp][] = [
  ['qa failed', (id) => renderVariants(p, {...board, id}, {date: '2026-10-01', qa: {youtube: false, instagram: false, facebook: false}}), /QA has not passed/],
  ['no qa.json', (id) => PLATFORMS.forEach((pf) => fs.rmSync(vf(id, pf, 'qa.json'))), /QA has not passed/],
  ['video emptied after QA', (id) => PLATFORMS.forEach((pf) => fs.writeFileSync(vf(id, pf, 'mp4'), '')), /not the one QA checked/],
  ['video truncated after QA', (id) => PLATFORMS.forEach((pf) => fs.writeFileSync(vf(id, pf, 'mp4'), 'video')), /not the one QA checked/],
  ['video deleted after QA', (id) => PLATFORMS.forEach((pf) => fs.rmSync(vf(id, pf, 'mp4'))), /not the one QA checked/],
  ['no manifest', (id) => PLATFORMS.forEach((pf) => fs.rmSync(vf(id, pf, 'manifest.json'))), /not the one QA checked|held/],
];
for (const [name, break_, why] of cases) {
  const id = `fault-${name.replace(/[^a-z]+/g, '-')}`;
  fs.writeFileSync(path.join(p.content[0], `${id}.json`), JSON.stringify({...board, id}));
  renderVariants(p, {...board, id}, {date: '2026-10-01', qa: {facebook: false}});
  if (name !== 'qa failed') break_(id);
  else break_(id);
  const before = ledgerLines();
  const res = applyApproval(link(id), secret, {paths: p});
  assert.deepEqual(res.written, [], `${name}: nothing approved`);
  assert.ok(res.skipped.some((s) => why.test(s)), `${name}: refused with a reason (${res.skipped.join(' | ')})`);
  assert.equal(ledgerLines(), before, `${name}: the ledger is unchanged`);
  for (const pf of PLATFORMS) assert.equal(currentStatus(p).get(lkey(id, pf)), undefined, `${name}: ${pf} has no ledger status`);
}

restore();
fs.chmodSync(ro, 0o755);
fs.rmSync(tmp, {recursive: true, force: true});
console.log('render-faults ok: missing/unrunnable/failing/signalled/hung/SIGTERM-ignoring ffmpeg and bad arguments become clear errors with no orphan; mastering never replaces a good file with a partial one; undecodable output and unwritable folders fail loudly and keep the previous contact sheet; every staticFile() asset exists; 6 kinds of broken render are refused at approval');
