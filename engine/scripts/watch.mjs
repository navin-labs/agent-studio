#!/usr/bin/env node
// Auto-render: any new or changed .json in content/stories or content/storyboards gets rendered.
// The result is written next to the script as <name>.status.txt (Forge reads it).
// Finished files are copied to Google Drive/Reel Engine/<id>/ (or iCloud, or RENDER_COPY_DIR in .env) so they reach your phone.
//   npm run watch            run in this Terminal window
//   npm run watch:install    run in the background, starts at login, keeps the Mac awake on power
import {spawn, spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const DIRS = ['content/stories', 'content/storyboards'].map((d) => path.join(ROOT, d));
const STATE = path.join(ROOT, 'out', '.watch-state.json');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
// Google Drive for desktop mounts at ~/Library/CloudStorage/GoogleDrive-<email>/My Drive
const CLOUD = path.join(os.homedir(), 'Library/CloudStorage');
const GDRIVE = fs.existsSync(CLOUD)
  ? fs
      .readdirSync(CLOUD)
      .filter((n) => n.startsWith('GoogleDrive-'))
      .map((n) => path.join(CLOUD, n, 'My Drive'))
      .find((d) => fs.existsSync(d))
  : null;
const ICLOUD = path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs');
const COPY_TO =
  process.env.RENDER_COPY_DIR ||
  (GDRIVE ? path.join(GDRIVE, 'Reel Engine') : fs.existsSync(ICLOUD) ? path.join(ICLOUD, 'Reel Engine') : null);

if (process.argv.includes('--install')) {
  install();
  process.exit(0);
}

const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const log = (m) => console.log(`[${new Date().toLocaleString('en-IN')}] ${m}`);
const jsonFiles = () =>
  DIRS.flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d) : []).filter((n) => n.endsWith('.json')).map((n) => path.join(d, n)));

fs.mkdirSync(path.dirname(STATE), {recursive: true});
const firstRun = !fs.existsSync(STATE);
const state = firstRun ? {} : JSON.parse(fs.readFileSync(STATE, 'utf8'));
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
if (firstRun) {
  // scripts that already exist (the examples) are treated as done
  for (const f of jsonFiles()) state[f] = hash(f);
  save();
}

const queue = [];
let busy = false;
const enqueue = (f) => {
  if (!queue.includes(f)) queue.push(f);
  next();
};

function next() {
  if (busy || !queue.length) return;
  const f = queue.shift();
  if (!fs.existsSync(f)) return next();
  const h = hash(f);
  if (state[f] === h) return next();
  busy = true;
  const statusFile = f.replace(/\.json$/, '.status.txt');
  fs.writeFileSync(statusFile, `rendering since ${new Date().toISOString()}\n`);
  log(`rendering ${path.relative(ROOT, f)}`);
  const out = [];
  const p = spawn(process.execPath, [path.join(ROOT, 'scripts/make.mjs'), f], {cwd: ROOT});
  p.stdout.on('data', (d) => out.push(String(d)));
  p.stderr.on('data', (d) => out.push(String(d)));
  p.on('close', (code) => {
    const text = out.join('').replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '\n');
    // ponytail: a failed file is not retried until it changes; rewrite it to retry after a network error
    state[f] = h;
    save();
    if (code === 0) {
      let copied = '';
      try {
        const {id} = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (COPY_TO) {
          fs.cpSync(path.join(ROOT, 'out', id), path.join(COPY_TO, id), {recursive: true});
          copied = `\ncopied to ${path.join(COPY_TO, id)}`;
        }
      } catch (e) {
        copied = `\ncopy failed: ${e.message}`;
      }
      fs.writeFileSync(statusFile, `ok ${new Date().toISOString()}${copied}\n\n${text.slice(-1500)}`);
      log(`done ${path.relative(ROOT, f)}${copied}`);
    } else {
      fs.writeFileSync(statusFile, `failed ${new Date().toISOString()}\n\n${text.slice(-3000)}`);
      log(`failed ${path.relative(ROOT, f)} (see ${path.basename(statusFile)})`);
    }
    busy = false;
    next();
  });
}

// Forge may write a file in chunks: wait 3s after the last change before rendering.
const timers = new Map();
for (const d of DIRS) {
  fs.mkdirSync(d, {recursive: true});
  fs.watch(d, (_, name) => {
    if (!name?.endsWith('.json')) return;
    const f = path.join(d, name);
    clearTimeout(timers.get(f));
    timers.set(f, setTimeout(() => enqueue(f), 3000));
  });
}
jsonFiles().forEach(enqueue); // anything saved while the watcher was off
log(`watching content/stories and content/storyboards${COPY_TO ? `; results copied to ${COPY_TO}` : ''}`);

function install() {
  const label = 'com.theautomationguy.reelwatch';
  const plist = path.join(os.homedir(), 'Library/LaunchAgents', `${label}.plist`);
  const logFile = path.join(ROOT, 'out', 'watch.log');
  fs.mkdirSync(path.dirname(plist), {recursive: true});
  fs.mkdirSync(path.dirname(logFile), {recursive: true});
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  fs.writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/caffeinate</string><string>-s</string>
    <string>${esc(process.execPath)}</string><string>${esc(path.join(ROOT, 'scripts/watch.mjs'))}</string>
  </array>
  <key>WorkingDirectory</key><string>${esc(ROOT)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${esc(logFile)}</string>
  <key>StandardErrorPath</key><string>${esc(logFile)}</string>
</dict></plist>
`,
  );
  spawnSync('launchctl', ['unload', plist]);
  const r = spawnSync('launchctl', ['load', '-w', plist], {encoding: 'utf8'});
  if (r.status !== 0) {
    console.log(`launchctl failed: ${r.stderr}`);
    return;
  }
  console.log(`Auto-render is running in the background and will start at every login.
Log: ${logFile}
Stop it: launchctl unload ${plist}`);
}
