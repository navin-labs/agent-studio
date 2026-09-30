#!/usr/bin/env node
// Usage:
//   npm run make -- content/stories/my-story.json         render a story reel (silent unless VOICE=on in .env)
//   npm run make -- content/storyboards/my-board.json     render a storyboard through the Composer (primitives)
//   npm run make -- content/stories/*.json                several at once
// Flags:
//   --check      validate only, render nothing
//   --vo-only    generate voiceover files only
//   --force-vo   regenerate voiceover even if files exist
//   --no-vo      ignore voiceover, render text-only timing
//   --force      render even if the quality gate finds errors

import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import {lengthIssue, probeFrames, validateStoryboard} from '../src/composer/storyboard.ts';
import {checkTextBoxes} from '../src/composer/textcheck.ts';
import {THEMES} from '../src/themes.ts';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'out');
const ICONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/ui/icon-names.json'), 'utf8'));

// ---------- env ----------
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.log('Usage: npm run make -- content/stories/<file>.json [--check|--vo-only|--force-vo|--no-vo|--force]');
  process.exit(1);
}

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ---------- quality gate ----------
const words = (s = '') => s.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
const estimateSeconds = (vo = '') => words(vo) / 2.4 + (vo.match(/[,.!?;:]/g) || []).length * 0.1;

const BANNED = [
  [/[—–]/, 'em or en dash (use a comma or full stop)'],
  [/\b(i|we) (built|build) (this|it) for\b/i, 'implies a past client build'],
  [/\b(my|our) clients?\b/i, 'client claim (no clients yet)'],
  [/\bclients? like (you|yours)\b/i, 'client claim'],
  [/\bcompanies like yours\b/i, 'implies existing clients'],
  [/\b(we|i) (have )?helped\b/i, 'past-results claim'],
  [/\bguarantee(d)?\b/i, 'guarantee claim'],
  [/\b\d+x\b/i, 'multiplier claim like 3x or 10x'],
  [/\bsave[sd]? \d+ (hours|hrs|days)\b/i, 'time-saved claim'],
  [/\b100 ?%/, 'absolute claim'],
];

const STORY_TYPES = new Set(['hook', 'beat', 'cta']);
const STORY_TEMPLATES = {'pile-to-flow': 6, 'invoice-chase': 6}; // invoice-chase = old name, same template
const VOICE_ON = process.env.VOICE === 'on'; // ponytail: voiceover parked, silent by default // template -> number of scenes it animates

const allStrings = (obj, out = []) => {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => allStrings(v, out));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => allStrings(v, out));
  return out;
};

const checkIcons = (obj, warn, where) => {
  const scan = (o) => {
    if (Array.isArray(o)) return o.forEach(scan);
    if (o && typeof o === 'object') {
      if (typeof o.icon === 'string' && !ICONS[o.icon.toLowerCase()]) warn(`${where}: unknown icon "${o.icon}" (use one of: ${Object.keys(ICONS).join(', ')})`);
      Object.values(o).forEach(scan);
    }
  };
  scan(obj);
};

const validate = (doc) => {
  if (doc.format === 'storyboard') return validateBoard(doc);
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);
  if (!/^[a-z0-9-]+$/.test(doc.id || '')) err('id must be lowercase-with-dashes');
  for (const s of allStrings(doc)) {
    for (const [re, why] of BANNED) if (re.test(s)) err(`banned: ${why} -> "${s.slice(0, 80)}"`);
  }
  if (doc.format !== 'story') err('format must be "story" or "storyboard" (reel and carousel formats were removed)');
  if (doc.theme !== undefined && !THEMES[doc.theme]) err(`unknown theme "${doc.theme}" (use one of: ${Object.keys(THEMES).join(', ')})`);
  const sc = doc.scenes || [];
  const need = STORY_TEMPLATES[doc.template];
  if (!need) err(`unknown template "${doc.template}" (use one of: ${Object.keys(STORY_TEMPLATES).join(', ')})`);
  else if (sc.length !== need) err(`template "${doc.template}" needs exactly ${need} scenes, got ${sc.length}`);
  checkWorld(doc, err);
  checkPattern(doc, err);
  if (sc[0]?.type !== 'hook') err('first scene must be type "hook"');
  if (sc.at(-1)?.type !== 'cta') err('last scene must be type "cta"');
  let total = 0;
  sc.forEach((s, i) => {
    const w = `scene ${i + 1} (${s.type})`;
    if (!STORY_TYPES.has(s.type)) return err(`${w}: unknown type`);
    if (!s.vo) err(`${w}: missing "vo"`);
    if (words(s.vo) > 28) err(`${w}: vo is ${words(s.vo)} words, max 28`);
    else if (words(s.vo) > 22) warn(`${w}: vo is ${words(s.vo)} words, aim for 22 or less`);
    if (s.type === 'hook' && words(s.text) > 10) err(`${w}: text max 10 words`);
    total += Math.max(estimateSeconds(s.vo) + 0.6, 1.5);
  });
  if (sc[0]?.vo && words(sc[0].vo) > 7) err('story hook vo max 7 words: silent hook must be read in 2 seconds');
  if (total > 42) warn(`estimated length ${total.toFixed(0)}s, aim for 20 to 40s`);
  if (total < 16) warn(`estimated length ${total.toFixed(0)}s, too short to teach anything`);
  checkIcons(sc, warn, 'story');
  if (!doc.caption) warn('no caption');
  else if (!/DM AUDIT|[Ff]ollow/.test(doc.caption)) warn('caption should end with a CTA: follow line or DM AUDIT');
  if (doc.caption && !VOICE_ON && /voiceover|voice-over/i.test(doc.caption)) err('caption discloses a voiceover but the video is silent (VOICE is off)');
  if (doc.caption && doc.caption.split('\n')[0].length > 125) warn('caption first line over 125 chars, it gets cut before "more"');
  if (doc.hashtags && (doc.hashtags.length < 3 || doc.hashtags.length > 5)) err('use 3 to 5 hashtags (Instagram caps at 5)');
  return {errors, warnings};
};

// storyboard: engine checks from src/composer/storyboard.ts, plus the shared honesty and caption checks
const validateBoard = (doc) => {
  const {errors, warnings} = validateStoryboard(doc);
  if (!/^[a-z0-9-]+$/.test(doc.id || '')) errors.push('id must be lowercase-with-dashes');
  for (const s of allStrings(doc)) for (const [re, why] of BANNED) if (re.test(s)) errors.push(`banned: ${why} -> "${s.slice(0, 80)}"`);
  if (doc.hookPattern !== undefined && !HOOK_PATTERNS.includes(doc.hookPattern)) errors.push(`"hookPattern" must be one of: ${HOOK_PATTERNS.join(', ')}`);
  if (!doc.caption) warnings.push('no caption');
  else if (doc.caption.split('\n')[0].length > 125) warnings.push('caption first line over 125 chars, it gets cut before "more"');
  if (doc.caption && !VOICE_ON && /voiceover|voice-over/i.test(doc.caption)) errors.push('caption discloses a voiceover but the video is silent (VOICE is off)');
  if (doc.hashtags && (doc.hashtags.length < 3 || doc.hashtags.length > 5)) errors.push('use 3 to 5 hashtags (Instagram caps at 5)');
  return {errors, warnings};
};

// pile-to-flow: label lengths that fit the cards, and the accent words that cue the animation
const accentSpans = (vo = '') => (vo.match(/\*[^*]+\*/g) || []).length;
const checkWorld = (doc, err) => {
  const w = doc.world;
  const sc = doc.scenes || [];
  if (!w) return err('story needs a "world" block (see FORGE_CONTENT_SKILL.md)');
  const max = (v, n, what) => {
    if (typeof v !== 'string' || !v.trim()) err(`world.${what} missing`);
    else if (v.length > n) err(`world.${what} max ${n} characters, got ${v.length}: "${v}"`);
  };
  max(w.item?.title, 9, 'item.title');
  max(w.item?.id, 5, 'item.id');
  max(w.item?.pill, 6, 'item.pill');
  max(w.counter?.label, 10, 'counter.label');
  max(w.counter?.icon, 20, 'counter.icon');
  max(w.message?.app, 12, 'message.app');
  max(w.message?.text, 90, 'message.text');
  max(w.done, 8, 'done');
  if (!Array.isArray(w.nodes) || w.nodes.length !== 4) err('world.nodes must be exactly 4 steps');
  else w.nodes.forEach((n, i) => {
    max(n.label, 16, `nodes[${i}].label`);
    max(n.sub, 22, `nodes[${i}].sub`);
    max(n.icon, 20, `nodes[${i}].icon`);
  });
  checkIcons(w, err, 'world');
  if (sc.length === 6) {
    if (accentSpans(sc[2].vo) < 1) err('scene 3 vo needs 1 *accent* word (the whip pan lands on it)');
    if (accentSpans(sc[3].vo) !== 3) err(`scene 4 vo needs exactly 3 *accent* words, one per step 1 to 3, in order (got ${accentSpans(sc[3].vo)})`);
    if (accentSpans(sc[4].vo) < 1) err('scene 5 vo needs 1 *accent* word (step 4 lights up on it)');
  }
};

// Hook patterns rotate: the algorithm tests every post cold, so a repeated opener repeats the same result.
const HOOK_PATTERNS = ['pile', 'should-not', 'question', 'number', 'confession', 'myth', 'before-after'];
const checkPattern = (doc, err) => {
  if (!HOOK_PATTERNS.includes(doc.hookPattern)) return err(`"hookPattern" must be one of: ${HOOK_PATTERNS.join(', ')}`);
  const dir = path.join(ROOT, 'content/stories');
  // ponytail: "previous post" = newest other file by name (files are YYYY-MM-DD-slug), fine while names stay dated
  const prev = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}-.*\.json$/.test(f) && f < `${doc.id}.json`).sort().slice(-2);
  const used = prev.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).hookPattern);
  if (used.length === 2 && used.every((u) => u === doc.hookPattern)) err(`hookPattern "${doc.hookPattern}" used in the last 2 posts, pick another`);
  const first = (doc.caption || '').split('\n')[0].toLowerCase();
  for (const f of prev) {
    const other = (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).caption || '').split('\n')[0].toLowerCase();
    const shared = first.split(/\s+/).filter((w) => w.length > 3 && other.includes(w));
    if (/should not|shouldn't/.test(first) && /should not|shouldn't/.test(other)) err(`caption opener repeats the "should not" frame from ${f}`);
    else if (shared.length >= 4) err(`caption opener too close to ${f}`);
  }
};

// ---------- voiceover ----------
const PRONOUNCE = [
  [/₹\s?([\d,]+)/g, '$1 rupees'],
  [/\bINV-(\d+)\b/g, 'invoice $1'],
  [/\bMIS\b/g, 'M.I.S.'],
  [/\bn8n\b/gi, 'n-eight-n'],
  [/\bAUDIT\b/g, 'audit'],
  [/\bCRM\b/g, 'C.R.M.'],
  [/\bERP\b/g, 'E.R.P.'],
  [/\bGST\b/g, 'G.S.T.'],
  [/\bPOs\b/g, 'P.O.s'],
  [/\bPO\b/g, 'P.O.'],
  [/\bSMEs\b/g, 'S.M.E.s'],
  [/\bAI\b/g, 'A.I.'],
];
const ttsText = (s, extra = {}) => {
  let t = s.replace(/\*/g, '');
  for (const [re, rep] of PRONOUNCE) t = t.replace(re, rep);
  for (const [k, v] of Object.entries(extra)) t = t.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
  return t;
};

// Cloned voice (Chatterbox, local): set CLONE_VOICE=voice/navin.wav in .env. Wins over the API voices when present.
const CLONE_VOICE = process.env.CLONE_VOICE && path.resolve(ROOT, process.env.CLONE_VOICE);
const CLONE_PY = process.env.CLONE_PYTHON || path.join(ROOT, '.venv-voice/bin/python');
const PROVIDER = (
  process.env.TTS_PROVIDER ||
  (CLONE_VOICE && fs.existsSync(CLONE_VOICE) ? 'chatterbox' : '') ||
  (process.env.SARVAM_API_KEY ? 'sarvam' : process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : process.env.OPENAI_API_KEY ? 'openai' : 'none')
).toLowerCase();
const SARVAM_SPEAKER = process.env.SARVAM_SPEAKER || 'shubh';
const SARVAM_MODEL = process.env.SARVAM_MODEL || 'bulbul:v3';
const SARVAM_PACE = Number(process.env.SARVAM_PACE || 1.1);
const OPENAI_VOICE = process.env.OPENAI_TTS_VOICE || 'ash';
const OPENAI_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const INSTRUCTIONS =
  process.env.OPENAI_TTS_INSTRUCTIONS ||
  'Voice: a friendly, confident Indian English business consultant talking to a busy business owner. Pace: natural and slightly brisk, about 155 words per minute. Tone: practical and warm, never salesy or dramatic. Keep the same energy and pitch in every clip so the clips join seamlessly.';

const ttsOpenAI = async (text) => {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: OPENAI_MODEL, voice: OPENAI_VOICE, input: text, instructions: INSTRUCTIONS, response_format: 'mp3'}),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
};

// Sarvam Bulbul: Indian English voices. Returns base64 audio in JSON.
const ttsSarvam = async (text) => {
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {'api-subscription-key': process.env.SARVAM_API_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({text, language_code: 'en-IN', speaker: SARVAM_SPEAKER, model: SARVAM_MODEL, pace: SARVAM_PACE, output_audio_codec: 'mp3'}),
  });
  if (!res.ok) throw new Error(`Sarvam TTS ${res.status}: ${await res.text()}`);
  const {audios} = await res.json();
  if (!audios?.[0]) throw new Error('Sarvam TTS returned no audio');
  return Buffer.from(audios[0], 'base64');
};

const ttsEleven = async (text, prev, next) => {
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!voice) throw new Error('Set ELEVENLABS_VOICE_ID in .env');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      previous_text: prev || undefined,
      next_text: next || undefined,
      voice_settings: {stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true},
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
};

const measure = async (file) => {
  const {parseMedia} = await import('@remotion/media-parser');
  const {nodeReader} = await import('@remotion/media-parser/node');
  const r = await parseMedia({src: file, reader: nodeReader, fields: {slowDurationInSeconds: true}});
  return r.slowDurationInSeconds;
};

const prepareVoice = async (script) => {
  const n = script.scenes.length;
  if (flags.has('--no-vo') || !VOICE_ON) return {audio: Array(n).fill(null), durations: Array(n).fill(null)};
  const dir = path.join(PUBLIC, 'vo', script.id);
  fs.mkdirSync(dir, {recursive: true});
  const manifestFile = path.join(dir, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {scenes: []};
  const audio = [];
  const durations = [];
  const inputs = script.scenes.map((s) => ttsText(s.say ?? s.vo, script.pronounce));
  if (PROVIDER === 'chatterbox') cloneBatch(script, dir, manifest, inputs);
  for (let i = 0; i < n; i++) {
    const base = `s${String(i + 1).padStart(2, '0')}`;
    const existing = ['.mp3', '.wav', '.m4a'].map((e) => path.join(dir, base + e)).find((f) => fs.existsSync(f));
    const entry = manifest.scenes[i];
    const voiceKey = {
      openai: `${OPENAI_MODEL}/${OPENAI_VOICE}/${INSTRUCTIONS}`,
      elevenlabs: `${process.env.ELEVENLABS_VOICE_ID}`,
      sarvam: `${SARVAM_MODEL}/${SARVAM_SPEAKER}/${SARVAM_PACE}`,
      chatterbox: CLONE_VOICE ? `${CLONE_VOICE}/${fs.statSync(CLONE_VOICE).mtimeMs}` : '',
    }[PROVIDER] ?? '';
    const hash = crypto.createHash('sha1').update(`${PROVIDER}|${voiceKey}|${inputs[i]}`).digest('hex').slice(0, 12);
    const manual = existing && (!entry || entry.source === 'manual');
    let file = existing;
    if (manual && !flags.has('--force-vo')) {
      manifest.scenes[i] = {file: path.basename(existing), source: 'manual'};
      console.log(c.dim(`  ${base}: using your recording ${path.basename(existing)}`));
    } else if (PROVIDER !== 'none' && (!existing || flags.has('--force-vo') || entry?.hash !== hash)) {
      process.stdout.write(c.dim(`  ${base}: generating voice (${PROVIDER})... `));
      const buf =
        PROVIDER === 'chatterbox'
          ? fs.readFileSync(path.join(dir, `${base}.clone.wav`))
          : PROVIDER === 'sarvam' ? await ttsSarvam(inputs[i]) : PROVIDER === 'elevenlabs' ? await ttsEleven(inputs[i], inputs[i - 1], inputs[i + 1]) : await ttsOpenAI(inputs[i]);
      file = path.join(dir, PROVIDER === 'chatterbox' ? `${base}.wav` : `${base}.mp3`);
      if (existing && existing !== file) fs.renameSync(existing, `${existing}.old`);
      fs.writeFileSync(file, buf);
      if (PROVIDER === 'chatterbox') fs.rmSync(path.join(dir, `${base}.clone.wav`), {force: true});
      manifest.scenes[i] = {file: path.basename(file), source: PROVIDER, hash};
      console.log('done');
    }
    if (file && fs.existsSync(file)) {
      audio.push(path.relative(PUBLIC, file).split(path.sep).join('/'));
      durations.push(await measure(file));
    } else {
      audio.push(null);
      durations.push(null);
    }
  }
  manifest.scenes = manifest.scenes.slice(0, n);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  const missing = audio.filter((a) => !a).length;
  if (missing === n) console.log(c.yellow('  No voiceover: set SARVAM_API_KEY (or OPENAI_API_KEY / ELEVENLABS_API_KEY) in .env, or drop your recordings into ' + path.relative(ROOT, dir) + '/s01.mp3, s02.mp3 ...'));
  else if (missing) console.log(c.yellow(`  ${missing} scene(s) have no voiceover`));
  return {audio, durations};
};

// Runs the local clone once for every scene that needs a new clip (model loads once).
function cloneBatch(script, dir, manifest, inputs) {
  const voiceKey = `${CLONE_VOICE}/${fs.statSync(CLONE_VOICE).mtimeMs}`;
  const jobs = [];
  inputs.forEach((text, i) => {
    const base = `s${String(i + 1).padStart(2, '0')}`;
    const hash = crypto.createHash('sha1').update(`chatterbox|${voiceKey}|${text}`).digest('hex').slice(0, 12);
    const entry = manifest.scenes[i];
    const existing = ['.mp3', '.wav', '.m4a'].some((e) => fs.existsSync(path.join(dir, base + e)));
    if (entry?.source === 'manual' && !flags.has('--force-vo')) return;
    if (existing && entry?.hash === hash && !flags.has('--force-vo')) return;
    jobs.push({text, out: path.join(dir, `${base}.clone.wav`)});
  });
  if (!jobs.length) return;
  if (!fs.existsSync(CLONE_PY)) throw new Error(`Voice clone not installed: ${CLONE_PY} missing. See README "Your cloned voice".`);
  const list = path.join(dir, 'clone-jobs.json');
  fs.writeFileSync(list, JSON.stringify(jobs));
  console.log(c.dim(`  cloning ${jobs.length} line(s) in your voice (first run downloads the model)...`));
  const r = spawnSync(CLONE_PY, [path.join(ROOT, 'scripts/clone_tts.py'), list, CLONE_VOICE], {stdio: 'inherit'});
  fs.rmSync(list, {force: true});
  if (r.status !== 0) throw new Error('Voice clone failed (see output above)');
}

// ---------- render ----------
const findBrowser = () => {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE;
  const pw = '/opt/pw-browsers';
  if (fs.existsSync(pw)) {
    const d = fs.readdirSync(pw).find((x) => x.startsWith('chromium_headless_shell'));
    if (d) {
      const exe = path.join(pw, d, 'chrome-linux', 'headless_shell');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return undefined; // Remotion downloads its own headless browser on first run
};

let serveUrl = null;
const getBundle = async () => {
  if (serveUrl) return serveUrl;
  const {bundle} = await import('@remotion/bundler');
  process.stdout.write(c.dim('Bundling... '));
  serveUrl = await bundle({entryPoint: path.join(ROOT, 'src/index.ts'), publicDir: PUBLIC});
  console.log('done');
  return serveUrl;
};

const writeCaption = (doc, outDir) => {
  if (!doc.caption) return;
  const text = `${doc.caption}\n\n${(doc.hashtags || []).join(' ')}\n`;
  fs.writeFileSync(path.join(outDir, 'caption.txt'), text);
};

const renderReel = async (script) => {
  const {renderMedia, renderStill, selectComposition} = await import('@remotion/renderer');
  const {audio, durations} = await prepareVoice(script);
  if (flags.has('--vo-only')) return;
  const music = script.music && fs.existsSync(path.join(PUBLIC, 'music', script.music)) ? `music/${script.music}` : null;
  if (script.music && !music) console.log(c.yellow(`  music file public/music/${script.music} not found, rendering without music`));
  const inputProps = {script, timing: {audio, durations, music}};
  const browserExecutable = findBrowser();
  const url = await getBundle();
  const composition = await selectComposition({serveUrl: url, id: script.format === 'storyboard' ? 'Composer' : 'Story', inputProps, browserExecutable});
  const outDir = path.join(OUT, script.id);
  fs.mkdirSync(outDir, {recursive: true});
  const secs = (composition.durationInFrames / composition.fps).toFixed(1);
  let last = -1;
  const measured = new Map(); // frame -> boxes, reported by the Composer's TextProbe
  await renderMedia({
    composition,
    serveUrl: url,
    codec: 'h264',
    crf: 18,
    audioBitrate: '192k',
    outputLocation: path.join(outDir, 'reel.mp4'),
    inputProps,
    browserExecutable,
    onArtifact: ({filename, content}) => {
      if (!filename.startsWith('text-boxes-')) return;
      const m = JSON.parse(typeof content === 'string' ? content : new TextDecoder().decode(content));
      measured.set(m.frame, m.boxes);
    },
    onProgress: ({progress}) => {
      const p = Math.floor(progress * 10);
      if (p !== last) {
        last = p;
        process.stdout.write(c.dim(`\r  rendering ${secs}s reel: ${p * 10}%`));
      }
    },
  });
  console.log('');
  const coverFrame = Math.max(0, (composition.props.frames?.[0] ?? 30) - 6);
  await renderStill({composition, serveUrl: url, output: path.join(outDir, 'cover.png'), frame: coverFrame, inputProps, browserExecutable});
  writeCaption(script, outDir);
  console.log(c.green(`  -> ${path.relative(ROOT, outDir)}/reel.mp4, cover.png, caption.txt`));
  if (script.format !== 'storyboard') return true;
  // text boxes: measured in the browser at render time, then checked (safe area, card overflow, caption overlap)
  const frames = [...measured].sort((a, b) => a[0] - b[0]).map(([frame, boxes]) => ({frame, boxes}));
  const issues = checkTextBoxes(frames);
  fs.writeFileSync(path.join(outDir, 'text-boxes.json'), JSON.stringify({id: script.id, measured: frames.length, issues, frames}, null, 1));
  const fr = composition.props.frames;
  const expected = probeFrames(script, fr, fr.map((_, i) => fr.slice(0, i).reduce((a, b) => a + b, 0))).size;
  if (frames.length !== expected) {
    console.log(c.red(`  error: text boxes measured on ${frames.length} of ${expected} frames (TextProbe missed some); not trusting this render`));
    return false;
  }
  issues.forEach((i) => console.log((i.level === 'error' ? c.red : c.yellow)(`  ${i.level}: scene ${i.scene + 1} (${i.primitive}) "${i.text}": ${i.problem}`)));
  const errs = issues.filter((i) => i.level === 'error').length;
  console.log((errs ? c.red : c.green)(`  text boxes: ${frames.length} frames measured, ${errs} error(s) -> text-boxes.json`));
  // length: an error only when every vo line was measured; an estimate is never final
  const long = lengthIssue(script, composition.durationInFrames / composition.fps);
  const voiced = script.scenes.every((s, i) => !s.vo || durations[i] != null);
  if (long) console.log((voiced ? c.red : c.yellow)(`  ${voiced ? 'error' : 'warn'}: ${long}${voiced ? '' : ' (estimated, no voice)'}`));
  return errs === 0 && !(long && voiced);
};

// ---------- main ----------
// Theme gate first: contrast + no raw colours in src/. A broken theme must never render.
const gate = spawnSync(process.execPath, [path.join(ROOT, 'scripts/theme-gate.ts')], {encoding: 'utf8'});
if (gate.status !== 0) {
  console.log(c.red(gate.stdout.split('\n').filter((l) => l.startsWith('FAIL')).join('\n')));
  console.log(c.red('Theme gate failed: fix src/themes.ts or remove raw colours (npm run gate:themes).'));
  process.exit(1);
}
let failed = 0;
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
  console.log(c.bold(`\n${doc.id} (${doc.format})`));
  const {errors, warnings} = validate(doc);
  warnings.forEach((w) => console.log(c.yellow(`  warn: ${w}`)));
  errors.forEach((e) => console.log(c.red(`  error: ${e}`)));
  if (errors.length && !flags.has('--force')) {
    console.log(c.red(`  Quality gate failed (${errors.length}). Fix the script or rerun with --force.`));
    failed++;
    continue;
  }
  if (!errors.length) console.log(c.green('  quality gate passed'));
  if (flags.has('--check')) continue;
  if (!(await renderReel(doc)) && !flags.has('--vo-only')) failed++;
}
process.exit(failed ? 1 : 0);
