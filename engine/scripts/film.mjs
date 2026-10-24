// Post-render steps for an authored film (storyboard "film"), all on Remotion's bundled ffmpeg, no extra tools:
//   master(mp4)       loudness to -14 LUFS integrated, true peak <= -1.5 dBTP (two-pass loudnorm), video stream copied
//   motion(mp4)       temporal QA facts: first-frame contrast, change by 0.3 s, activity in the first 3 s, longest still stretch
//   filmstrip(mp4, png)  hook row (0 to 3 s, 8 frames) + body grid (every 1.5 s), for the creative review
//   beats(board)      the film's beats from the measured voice clips (Instagram variant): what a film is authored against
//   score(board)      the film's own music cue from its brief (ACE-Step 1.5, local) -> public/music/<id>.wav
//   frames(mp4, times, dir)  full-size PNGs at chosen seconds, for a close look at one moment
// CLI: node scripts/film.mjs analyse <mp4> [strip.png] | beats <board.json> | score <board.json> | frames <mp4> <t1,t2,...> <dir>
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'node_modules/@remotion/compositor-darwin-arm64');
const ff = (args, opts = {}) => {
  const r = spawnSync(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-nostdin', ...args], {env: {...process.env, DYLD_LIBRARY_PATH: BIN}, maxBuffer: 1 << 30, ...opts});
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ').slice(0, 120)}: ${String(r.stderr).split('\n').slice(-4).join(' ')}`);
  return r;
};

// ---------- loudness ----------
export const TARGET = {I: -14, TP: -1.5, LRA: 11};
export const master = (mp4) => {
  const spec = `I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
  const m = String(ff(['-i', mp4, '-vn', '-af', `loudnorm=${spec}:print_format=json`, '-f', 'null', '-']).stderr).match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) throw new Error('loudnorm measured nothing');
  const j = JSON.parse(m[0]);
  const tmp = mp4.replace(/\.mp4$/, '.master.mp4');
  ff(['-y', '-i', mp4, '-c:v', 'copy', '-af', `loudnorm=${spec}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, mp4);
  const after = JSON.parse(String(ff(['-i', mp4, '-vn', '-af', `loudnorm=${spec}:print_format=json`, '-f', 'null', '-']).stderr).match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  return {before: +j.input_i, lufs: +after.input_i, true_peak: +after.input_tp};
};

// ---------- frames ----------
const frames = (mp4, w, h, rate, fmt, extra = []) => {
  const px = fmt === 'gray' ? 1 : 3;
  const buf = ff(['-i', mp4, ...extra, '-r', String(rate), '-vf', `scale=${w}:${h}`, '-pix_fmt', fmt === 'gray' ? 'gray' : 'rgb24', '-c:v', 'rawvideo', '-f', 'image2pipe', '-']).stdout;
  const n = Math.floor(buf.length / (w * h * px));
  return Array.from({length: n}, (_, i) => buf.subarray(i * w * h * px, (i + 1) * w * h * px));
};

// Temporal QA. Rates are per 0.1 s at 54x96 grey; diff = mean absolute luma change (0..255). Thresholds live in qa.ts.
export const motion = (mp4) => {
  const RATE = 10;
  const f = frames(mp4, 54, 96, RATE, 'gray');
  const diff = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  };
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const std = (a) => {
    const m = mean(a);
    return Math.sqrt(mean([...a].map((v) => (v - m) ** 2)));
  };
  const d = f.slice(1).map((x, i) => diff(f[i], x));
  // longest run where nothing visibly changes (camera drift and grain alone stay under 0.35), ignoring the last 2.5 s (end card hold)
  const still = 0.35;
  let run = 0, longest = 0, at = 0;
  d.slice(0, Math.max(0, d.length - 25)).forEach((v, i) => {
    run = v < still ? run + 1 : 0;
    if (run > longest) (longest = run), (at = (i + 1 - run) / RATE);
  });
  return {
    seconds: f.length / RATE,
    first_frame_contrast: +std(f[0]).toFixed(1), // ~0 = a blank or flat first frame
    change_by_0_3s: +diff(f[0], f[3]).toFixed(2), // something already moving or appearing at 0.3 s
    hook_activity: +d.slice(0, 30).reduce((a, b) => a + b, 0).toFixed(1), // summed change over the first 3 s
    longest_still: +(longest / RATE).toFixed(1),
    longest_still_at: +at.toFixed(1),
    activity_per_s: +((d.reduce((a, b) => a + b, 0) / d.length) * RATE).toFixed(1),
  };
};

// ---------- filmstrip PNG (no image library: raw RGB tiles + a minimal PNG writer) ----------
const png = (w, h, rgb) => {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0), ihdr.writeUInt32BE(h, 4), (ihdr[8] = 8), (ihdr[9] = 2);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};
export const filmstrip = (mp4, out) => {
  const [W, H, COLS, GAP] = [180, 320, 8, 6];
  const hook = frames(mp4, W, H, 8 / 3, 'rgb', ['-t', '3']).slice(0, 8); // 0, .375, .75 ... 2.6 s
  const body = frames(mp4, W, H, 1 / 1.5, 'rgb');
  const tiles = [...hook, ...Array(COLS - hook.length).fill(null), ...body];
  const rows = Math.ceil(tiles.length / COLS);
  const [cw, ch] = [COLS * (W + GAP) + GAP, rows * (H + GAP) + GAP];
  const img = Buffer.alloc(cw * ch * 3, 24);
  tiles.forEach((t, i) => {
    if (!t) return;
    const [x0, y0] = [GAP + (i % COLS) * (W + GAP), GAP + Math.floor(i / COLS) * (H + GAP)];
    for (let y = 0; y < H; y++) t.copy(img, ((y0 + y) * cw + x0) * 3, y * W * 3, (y + 1) * W * 3);
  });
  fs.writeFileSync(out, png(cw, ch, img));
  return {hook: hook.length, body: body.length, every: 1.5};
};

export const grab = (mp4, times, dir) => {
  fs.mkdirSync(dir, {recursive: true});
  return times.map((t) => {
    const out = path.join(dir, `t${t.toFixed(2)}.png`);
    ff(['-y', '-ss', String(t), '-i', mp4, '-frames:v', '1', '-vf', 'scale=-2:960', out]); // keeps the source's aspect (references may be 16:9)
    return out;
  });
};

// ---------- beats and score ----------
const wavSeconds = (f) => {
  const b = fs.readFileSync(f);
  const rate = b.readUInt32LE(28); // byte rate
  let i = 12;
  while (i < b.length - 8 && b.toString('ascii', i, i + 4) !== 'data') i += 8 + b.readUInt32LE(i + 4);
  return b.readUInt32LE(i + 4) / rate;
};
export const beats = async (boardFile) => {
  const {sceneFrames} = await import('../src/composer/storyboard.ts');
  const {FPS, LEAD} = await import('../src/lib/timing.ts');
  const doc = JSON.parse(fs.readFileSync(boardFile, 'utf8'));
  const dir = path.join(ROOT, 'public', 'vo', doc.id, 'instagram');
  const durations = doc.scenes.map((_, i) => {
    const f = path.join(dir, `s${String(i + 1).padStart(2, '0')}.wav`);
    return fs.existsSync(f) ? +wavSeconds(f).toFixed(2) : null;
  });
  if (durations.some((d, i) => d == null && (doc.scenes[i].vo || i === doc.scenes.length - 1))) throw new Error(`no measured voice in ${path.relative(ROOT, dir)}: run npm run vo -- ${path.relative(ROOT, boardFile)} first`);
  const last = doc.scenes.length - 1; // the closer speaks the platform's CTA line at render time
  const frames = sceneFrames({...doc, scenes: doc.scenes.map((sc, i) => (i === last && !sc.vo ? {...sc, vo: 'cta'} : sc))}, {durations});
  let at = 0;
  const out = doc.scenes.map((sc, i) => {
    const start = at / FPS;
    at += frames[i];
    return {beat: i, start: +start.toFixed(2), end: +(at / FPS).toFixed(2), vo: durations[i] != null ? [+(start + LEAD / FPS).toFixed(2), +(start + LEAD / FPS + durations[i]).toFixed(2)] : null, text: sc.vo ?? '(closer: the platform CTA line)'};
  });
  return {id: doc.id, total: +(at / FPS).toFixed(2), beats: out};
};
export const score = async (boardFile) => {
  const doc = JSON.parse(fs.readFileSync(boardFile, 'utf8'));
  const m = doc.brief?.music;
  if (!m?.caption) throw new Error('the board has no brief.music.caption');
  const {total} = await beats(boardFile);
  const ace = process.env.ACESTEP_DIR ?? path.join(process.env.HOME, 'Dev/tools/ace-step');
  const name = `film-${doc.id}`;
  const jobs = path.join(ace, 'out', `${name}.jobs.json`);
  fs.mkdirSync(path.dirname(jobs), {recursive: true});
  fs.writeFileSync(jobs, JSON.stringify([{name, caption: m.caption, bpm: m.bpm, key: m.key ?? '', duration: Math.ceil(total + 2), seed: m.seed ?? 7}]));
  const r = spawnSync(path.join(ace, '.venv/bin/python'), ['gen.py', jobs], {cwd: ace, stdio: ['ignore', 'inherit', 'inherit']});
  if (r.status !== 0) throw new Error('ACE-Step generation failed (see output above)');
  const dst = path.join(ROOT, 'public', 'music', `${doc.id}.wav`);
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  fs.copyFileSync(path.join(ace, 'out', `${name}.wav`), dst);
  return {file: path.relative(ROOT, dst), seconds: Math.ceil(total + 2)};
};

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'analyse' && a) {
    console.log(JSON.stringify(motion(a)));
    if (b) console.log(JSON.stringify(filmstrip(a, b)));
  } else if (cmd === 'beats' && a) console.log(JSON.stringify(await beats(a), null, 1));
  else if (cmd === 'score' && a) console.log(JSON.stringify(await score(a)));
  else if (cmd === 'frames' && a && b) console.log(grab(a, b.split(',').map(Number), process.argv[5] ?? path.join(path.dirname(a), 'frames')).join('\n'));
  else (console.log('usage: node scripts/film.mjs analyse <mp4> [strip.png] | beats <board.json> | score <board.json> | frames <mp4> <t1,t2,...> [dir]'), process.exit(1));
}
