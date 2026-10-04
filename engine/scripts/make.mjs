#!/usr/bin/env node
// Usage:
//   npm run make -- content/storyboards/<id>.json         render a Writer board: one video per platform (silent unless VOICE=on in .env)
//   npm run make -- test/style-c1.json                    render a test board (goes to test/out, never to production out/)
//   npm run make -- test/stories/<file>.json              render a legacy story reel (test only)
// Flags:
//   --check      validate only, render nothing
//   --vo-only    generate voiceover files only
//   --force-vo   regenerate voiceover even if files exist
//   --no-vo      ignore voiceover, render text-only timing
//   --force      render even if the quality gate finds errors
//   --out=<dir>  renders root (default: engine/out for the Writer's boards in content/storyboards, engine/test/out for anything else)
//
// Where renders go: a board from content/storyboards (the Writer's folder, what the watcher renders) is production: one render per
// platform in engine/out/<channel>/<date>/<id>/<platform>/ (studio/variant.ts). Everything else (test boards, stress fixtures,
// legacy stories) renders to engine/test/out/, which nothing ever dispatches from.

import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import {HOOK_PATTERNS, lengthIssue, probeFrames, validateStoryboard} from '../src/composer/storyboard.ts';
import {probeVideo} from './probe.ts';
import {ctaKind, file as variantFile, PLATFORMS, ROUTE, variantDir} from '../../studio/variant.ts';
import {recipeDate} from '../../studio/recipe.ts';
import {checkTextBoxes} from '../src/composer/textcheck.ts';
import {THEMES} from '../src/themes.ts';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_FLAG = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
const PRODUCTION = path.join(ROOT, 'content', 'storyboards');
const outFor = (f) => (OUT_FLAG ? path.resolve(OUT_FLAG) : path.dirname(path.resolve(f)) === PRODUCTION ? path.join(ROOT, 'out') : path.join(ROOT, 'test', 'out'));
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
  console.log('Usage: npm run make -- <board or story>.json [--check|--vo-only|--force-vo|--no-vo|--force|--out=<dir>]');
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
const VOICE_ON = process.env.VOICE === 'on'; // silent unless VOICE=on in engine/.env (production renders with it on)

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
  const {errors, warnings} = validateStoryboard(doc, VOICE_ON ? 'later' : undefined); // voiced: each line is judged by its measured clip, per platform below
  if (!/^[a-z0-9-]+$/.test(doc.id || '')) errors.push('id must be lowercase-with-dashes');
  for (const s of allStrings(doc)) for (const [re, why] of BANNED) if (re.test(s)) errors.push(`banned: ${why} -> "${s.slice(0, 80)}"`);
  if (doc.hookPattern !== undefined && !HOOK_PATTERNS.includes(doc.hookPattern)) errors.push(`"hookPattern" must be one of: ${HOOK_PATTERNS.join(', ')}`);
  if (!doc.caption) warnings.push('no caption');
  else if (doc.caption.split('\n')[0].length > 125) warnings.push('caption first line over 125 chars, it gets cut before "more"');
  if (doc.caption && !VOICE_ON && /voiceover|voice-over/i.test(doc.caption)) errors.push('caption discloses a voiceover but the video is silent (VOICE is off)');
  if (doc.hashtags && (doc.hashtags.length < 3 || doc.hashtags.length > 5)) errors.push('use 3 to 5 hashtags (Instagram caps at 5)');
  // the closer shows the channel's own account: read it from channels/<id>/channel.json (no channel = test board, default handle)
  if (doc.channel) {
    const cf = path.join(ROOT, '..', 'channels', doc.channel, 'channel.json');
    const ch = fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : null;
    doc.publishers = ch?.publishers ?? [];
    const ig = doc.publishers.find((x) => x.platform === 'instagram')?.handle;
    const real = /^@[A-Za-z0-9._]{1,30}$/.test(ig ?? '');
    // PREVIEW_HANDLE: only while the channel has no handle yet (sample weeks); dispatch refuses a video whose handle is not the channel's
    if (real) doc.handle = ig;
    else if (process.env.PREVIEW_HANDLE) (doc.handle = process.env.PREVIEW_HANDLE), warnings.push(`preview handle ${doc.handle}: channel ${doc.channel} has no Instagram handle yet; this render can never be dispatched`);
    else errors.push(`channel ${doc.channel} has no Instagram handle yet (channels/${doc.channel}/channel.json): the end card would show the wrong account`);
    // the channel's own end-card logo, else the studio mark (C1); a board without a channel (demo, test) shows no logo and no account
    doc.mark = fs.existsSync(path.join(ROOT, 'public', 'brand', doc.channel, 'mark.svg')) ? `brand/${doc.channel}/mark.svg` : 'brand/mark.png';
    // the style preset (styles/<id>.json, docs/MOTION.md): the board's own, else the channel's setting
    const styleId = doc.style ?? ch?.style;
    const sf = styleId && path.join(ROOT, '..', 'styles', `${styleId}.json`);
    if (!styleId) errors.push(`channel ${doc.channel} has no style preset (channels/${doc.channel}/channel.json "style"), so it has no platform variants to render`);
    else if (!fs.existsSync(sf)) errors.push(`style ${styleId} not found (styles/${styleId}.json)`);
    else if (styleId) {
      const preset = JSON.parse(fs.readFileSync(sf, 'utf8'));
      if (preset.channel !== doc.channel) errors.push(`style ${styleId} belongs to ${preset.channel}, not ${doc.channel}`);
      if ((doc.theme ?? 'paper') !== preset.theme) errors.push(`style ${styleId} uses theme ${preset.theme}; the board says ${doc.theme ?? 'paper'}`);
      const bad = doc.scenes.map((s) => s.transition).filter((x) => x && !preset.transitions.includes(x));
      if (bad.length) errors.push(`style ${styleId} allows transitions ${preset.transitions.join(', ')}; the board uses ${[...new Set(bad)].join(', ')}`);
      if (preset.opener === 'year-flap' && !/^[0-9]{3,4}$/.test(doc.meta?.year ?? '')) errors.push(`style ${styleId} opens on the story's year: set meta.year (e.g. "1948")`);
      doc.preset = preset;
    }
    // the video's date (its folder): the recipe's slot date, else today in IST (a board made outside the weekly plan)
    const rf = (fs.existsSync(path.join(ROOT, '..', 'recipes')) ? fs.readdirSync(path.join(ROOT, '..', 'recipes'), {recursive: true, encoding: 'utf8'}) : []).filter((x) => x.endsWith('.json'));
    const recipe = rf.flatMap((x) => JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'recipes', x), 'utf8'))).find((r) => r.id === doc.meta?.recipe_id);
    doc.date = recipe ? recipeDate(recipe) : new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  }
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
const checkPattern = (doc, err) => {
  if (!HOOK_PATTERNS.includes(doc.hookPattern)) return err(`"hookPattern" must be one of: ${HOOK_PATTERNS.join(', ')}`);
  const dir = path.join(ROOT, 'content/stories');
  // ponytail: "previous post" = newest other file by name (files are YYYY-MM-DD-slug), fine while names stay dated
  const prev = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => /^\d{4}-\d{2}-\d{2}-.*\.json$/.test(f) && f < `${doc.id}.json`).sort().slice(-2);
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

// Voice: local, open-source engines with built-in voices (no cloning, no paid voice API). Each channel sets its voice in
// channels/<id>/channel.json "voice": {"engine": "kokoro" | "parler" | "chatterbox", "voice", "speed"}; the engine runs from
// engine/.venv-voice/<engine>/ via scripts/tts_local.py (setup: README "Voice"). OpenAI / ElevenLabs only via TTS_PROVIDER.
const API_PROVIDER = (process.env.TTS_PROVIDER || (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : process.env.OPENAI_API_KEY ? 'openai' : 'none')).toLowerCase();
const channelVoice = (script) => {
  const f = script.channel && path.join(ROOT, '..', 'channels', script.channel, 'channel.json');
  if (!script.channel) return script.voice ?? null; // a demo or test board may name its own voice; a channel board never does
  return f && fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).voice ?? null) : null;
};
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
  if (flags.has('--no-vo') || !VOICE_ON) return {audio: Array(n).fill(null), durations: Array(n).fill(null), fresh: false};
  const dir = path.join(PUBLIC, 'vo', script.id, script.variant?.platform ?? ''); // one cache per platform variant (the CTA line differs)
  fs.mkdirSync(dir, {recursive: true});
  const manifestFile = path.join(dir, 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {scenes: []};
  const audio = [];
  const durations = [];
  let fresh = false; // a clip was written: the render bundle (a copy of public/) must be rebuilt to include it
  const lv = channelVoice(script);
  // pronunciation: the channel's overrides (voice.pronounce, engine markup e.g. Kokoro "[Tally](/tˈæli/)"), then the board's own
  // a scene without a line (the end card) stays silent
  const inputs = script.scenes.map((s) => ((s.say ?? s.vo) ? ttsText(s.say ?? s.vo, {...lv?.pronounce, ...script.pronounce}) : null));
  const PROVIDER = lv ? 'local' : API_PROVIDER;
  if (lv) localBatch(lv, dir, manifest, inputs);
  for (let i = 0; i < n; i++) {
    const base = `s${String(i + 1).padStart(2, '0')}`;
    const existing = ['.mp3', '.wav', '.m4a'].map((e) => path.join(dir, base + e)).find((f) => fs.existsSync(f));
    if (inputs[i] === null && !existing) {
      audio.push(null);
      durations.push(null);
      continue;
    }
    const entry = manifest.scenes[i];
    const voiceKey = {
      openai: `${OPENAI_MODEL}/${OPENAI_VOICE}/${INSTRUCTIONS}`,
      elevenlabs: `${process.env.ELEVENLABS_VOICE_ID}`,
      local: lv ? localKey(lv) : '',
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
        PROVIDER === 'local'
          ? fs.readFileSync(path.join(dir, `${base}.local.wav`))
          : PROVIDER === 'elevenlabs' ? await ttsEleven(inputs[i], inputs[i - 1], inputs[i + 1]) : await ttsOpenAI(inputs[i]);
      file = path.join(dir, PROVIDER === 'local' ? `${base}.wav` : `${base}.mp3`);
      if (existing && existing !== file) fs.renameSync(existing, `${existing}.old`);
      fs.writeFileSync(file, buf);
      if (PROVIDER === 'local') fs.rmSync(path.join(dir, `${base}.local.wav`), {force: true});
      manifest.scenes[i] = {file: path.basename(file), source: PROVIDER, hash};
      fresh = true;
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
  const missing = audio.filter((a, i) => !a && inputs[i] !== null).length;
  if (missing && missing === inputs.filter((x) => x !== null).length) console.log(c.yellow(`  No voiceover: set "voice" in channels/${script.channel ?? '<id>'}/channel.json (README "Voice"), or drop your recordings into ` + path.relative(ROOT, dir) + '/s01.mp3, s02.mp3 ...'));
  else if (missing) console.log(c.yellow(`  ${missing} scene(s) have no voiceover`));
  return {audio, durations, voice: audio.some(Boolean) ? (lv ? localKey(lv) : PROVIDER) : null, fresh};
};

// Voices every scene that needs a new clip with the channel's local engine (the model loads once per video).
const localKey = (v) => `${v.engine}/${v.voice ?? 'default'}/${v.speed ?? 1}`;
function localBatch(v, dir, manifest, inputs) {
  const jobs = [];
  inputs.forEach((text, i) => {
    if (text === null) return;
    const base = `s${String(i + 1).padStart(2, '0')}`;
    const hash = crypto.createHash('sha1').update(`local|${localKey(v)}|${text}`).digest('hex').slice(0, 12);
    const entry = manifest.scenes[i];
    const existing = ['.mp3', '.wav', '.m4a'].some((e) => fs.existsSync(path.join(dir, base + e)));
    if (entry?.source === 'manual' && !flags.has('--force-vo')) return;
    if (existing && entry?.hash === hash && !flags.has('--force-vo')) return;
    jobs.push({text, out: path.join(dir, `${base}.local.wav`)});
  });
  if (!jobs.length) return;
  const py = path.join(ROOT, '.venv-voice', v.engine, 'bin', 'python');
  if (!fs.existsSync(py)) throw new Error(`Voice engine ${v.engine} not installed: ${py} missing. See README "Voice".`);
  const list = path.join(dir, 'voice-jobs.json');
  fs.writeFileSync(list, JSON.stringify(jobs));
  console.log(c.dim(`  voicing ${jobs.length} line(s) with ${localKey(v)} (local)...`));
  const r = spawnSync(py, [path.join(ROOT, 'scripts/tts_local.py'), '--engine', v.engine, '--voice', v.voice ?? '', '--speed', String(v.speed ?? 1), '--jobs', list], {stdio: ['ignore', 'ignore', 'inherit']});
  fs.rmSync(list, {force: true});
  if (r.status !== 0) throw new Error(`Local voice (${v.engine}) failed (see output above)`);
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

// The caption (or YouTube description): the platform's template from the style preset, filled in; blank parts drop out
// (a test render without a channel keeps the board's caption and hashtags).
// {voice} is the AI-voiceover disclosure whenever the video is voiced (Learn never changes it).
const AI_VOICE = 'Voiceover: AI-generated voice.';
const captionText = (doc, voice) =>
  doc.variant
    ? doc.variant.caption.replace('{body}', doc.caption ?? '').replace('{cta}', doc.variant.line).replace('{voice}', voice ? AI_VOICE : '').replace('{hashtags}', (doc.hashtags || []).join(' ')).replace(/\n{3,}/g, '\n\n').trim() + '\n'
    : `${doc.caption}\n\n${(doc.hashtags || []).join(' ')}\n`;

const renderReel = async (script, place) => {
  const {renderMedia, renderStill, selectComposition} = await import('@remotion/renderer');
  const {audio, durations, voice, fresh} = await prepareVoice(script);
  if (flags.has('--vo-only')) return;
  if (fresh) serveUrl = null; // the bundle copies public/ when it is built; new voice clips need a new one
  const music = script.music && fs.existsSync(path.join(PUBLIC, 'music', script.music)) ? `music/${script.music}` : null;
  if (script.music && !music) console.log(c.yellow(`  music file public/music/${script.music} not found, rendering without music`));
  const inputProps = {script, timing: {audio, durations, music}};
  const browserExecutable = findBrowser();
  const url = await getBundle();
  const composition = await selectComposition({serveUrl: url, id: script.format === 'storyboard' ? 'Composer' : 'Story', inputProps, browserExecutable});
  const outDir = place.dir;
  const name = place.name;
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
    outputLocation: name('mp4'),
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
  await renderStill({composition, serveUrl: url, output: name('cover.png'), frame: coverFrame, inputProps, browserExecutable});
  if (script.format === 'storyboard') {
    // YouTube thumbnails in the channel theme: arm A = the hook (control), arm B = meta.thumb_b (the experiment's variant)
    // only the platforms whose preset asks for one (YouTube); a board without a channel style keeps the legacy pair
    const want = script.variant ? script.variant.thumbnail : true;
    const arms = want ? [[name('thumbnail.png'), String(script.scenes[0]?.params?.text ?? script.caption?.split('\n')[0] ?? '')], ...(script.meta?.thumb_b ? [[name('thumbnail-b.png'), script.meta.thumb_b]] : [])] : [];
    for (const [file, text] of arms) {
      const props = {text, theme: script.theme, handle: script.handle};
      const still = await selectComposition({serveUrl: url, id: 'Thumbnail', inputProps: props, browserExecutable});
      await renderStill({composition: still, serveUrl: url, output: file, frame: 0, inputProps: props, browserExecutable});
    }
    const sheet = await selectComposition({serveUrl: url, id: 'BoardSheet', inputProps, browserExecutable});
    await renderStill({composition: sheet, serveUrl: url, output: name('contact.png'), frame: 0, inputProps, browserExecutable});
  }
  if (script.caption) fs.writeFileSync(name('caption.txt'), captionText(script, voice));
  // render.json: the account shown on the closer (Dispatch checks it), the style preset, the AI voice used (null = silent; the YouTube description
// discloses it) and each scene's time span (Learn maps YouTube retention onto it)
  const at = (composition.props.frames ?? []).reduce((a, f) => [...a, a.at(-1) + f], [0]).map((f) => +(f / composition.fps).toFixed(2));
  if (script.format === 'storyboard') fs.writeFileSync(name('render.json'), JSON.stringify({handle: script.handle || null, voice: voice ?? null, style: script.preset?.id ?? null, platform: script.variant?.platform ?? null, vo: durations, scenes: script.scenes.map((s, i) => ({primitive: s.primitive, start: at[i], end: at[i + 1]}))}) + '\n');
  console.log(c.green(`  -> ${path.relative(ROOT, outDir)}/ (${fs.readdirSync(outDir).filter((x) => !x.startsWith('.')).length} files)`));
  if (script.format !== 'storyboard') return true;
  // text boxes: measured in the browser at render time, then checked (safe area, card overflow, caption overlap)
  const frames = [...measured].sort((a, b) => a[0] - b[0]).map(([frame, boxes]) => ({frame, boxes}));
  const issues = checkTextBoxes(frames);
  fs.writeFileSync(name('text-boxes.json'), JSON.stringify({id: script.id, measured: frames.length, issues, frames}, null, 1));
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
  const long = lengthIssue(script, (await probeVideo(name('mp4'))).seconds); // measured on the file, exactly as QA measures it
  const voiced = script.scenes.every((s, i) => !s.vo || durations[i] != null);
  if (long) console.log((voiced ? c.red : c.yellow)(`  ${voiced ? 'error' : 'warn'}: ${long}${voiced ? '' : ' (estimated, no voice)'}`));
  // the variant's manifest, written last: what it is, for whom, and where its files are (QA fills in its status)
  if (script.variant) {
    const v = script.variant;
    const files = {video: path.basename(name('mp4')), caption: path.basename(name('caption.txt')), ...(v.thumbnail ? {thumbnail: path.basename(name('thumbnail.png'))} : {})};
    const sha = crypto.createHash('sha256').update(fs.readFileSync(name('mp4'))).digest('hex');
    const {platform: _p, ...destination} = v.publisher;
    fs.writeFileSync(name('manifest.json'), JSON.stringify({channel: script.channel, platform: v.platform, video_id: script.id, date: script.date, style_version: script.preset.id, voice: voice ?? null, cta_kind: v.kind, cta_text: v.text.replace(/\*/g, ''), cta_say: script.scenes.at(-1).vo, end_card_handle: script.handle || null, destination: {via: destination.via, handle: destination.handle, ...(destination.page_id ? {page_id: destination.page_id} : {})}, size: v.size, video_sha256: sha, qa_status: 'pending', files}, null, 2) + '\n');
  }
  return errs === 0 && !(long && voiced);
};

// A platform variant of a channel board: the closing card's CTA, its spoken line and the caption's CTA line come from the style
// preset for that platform (styles/<id>.json "platforms"). The CTA kind is read from the board's own closer.
// The end card names the account the preset says (end_card.handle: this platform's own, from channel.json); a handle still pending
// (pending_...) is never shown, so the card names none; QA holds that variant until the username is claimed, except Facebook with a
// page_id, which posts to the page by its ID (studio/variant.ts sendable).
const variantOf = (doc, platform) => {
  const spec = doc.preset.platforms[platform];
  const publisher = doc.publishers.find((x) => x.platform === platform);
  if (!publisher) throw new Error(`channel ${doc.channel} has no ${platform} publisher (channels/${doc.channel}/channel.json)`);
  if (publisher.via !== ROUTE[platform] || spec.destination !== ROUTE[platform]) throw new Error(`${platform} goes via ${ROUTE[platform]}; channel.json says ${publisher.via}, style ${doc.preset.id} says ${spec.destination}`);
  const closer = doc.scenes.at(-1);
  const kind = ctaKind(closer?.params?.text);
  const cta = spec.cta[kind];
  if (!cta) throw new Error(`the closer's CTA "${closer?.params?.text}" is not one of this style's CTA kinds (${Object.keys(spec.cta).join(', ')})`);
  const ig = (s) => s.replaceAll('{ig}', doc.handle ?? '');
  const own = spec.end_card.handle === platform && /^@[A-Za-z0-9._]{1,30}$/.test(publisher.handle) ? publisher.handle : '';
  const scenes = [...doc.scenes.slice(0, -1), {...closer, params: {...closer.params, text: cta.text, ...(cta.sub !== undefined ? {sub: ig(cta.sub)} : {})}, vo: ig(cta.say)}];
  return {...doc, handle: own, scenes, variant: {platform, kind, text: cta.text, line: ig(cta.line), caption: spec.caption, thumbnail: spec.thumbnail, size: spec.size, publisher}};
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
  const OUT = outFor(f);
  if (doc.format === 'storyboard' && doc.channel) {
    // a channel board: one render per platform, each in out/<channel>/<date>/<id>/<platform>/ (studio/variant.ts)
    console.log(c.dim(`  renders -> ${path.relative(ROOT, OUT) || '.'}/${doc.channel}/${doc.date}/${doc.id}/<platform>/`));
    // a new render replaces the old one whole: a platform that fails this time must not leave its last render (and its QA pass) behind
    if (!flags.has('--vo-only')) for (const platform of PLATFORMS) fs.rmSync(variantDir(OUT, {channel: doc.channel, date: doc.date, id: doc.id, platform}), {recursive: true, force: true});
    for (const platform of PLATFORMS) {
      console.log(c.bold(`  ${platform}`));
      let vs;
      try {
        vs = variantOf(doc, platform);
      } catch (e) {
        console.log(c.red(`  error: ${e.message}`));
        failed++;
        continue;
      }
      // voiced: generate (or reuse) this platform's clips first, so every line is judged by its real length
      const heard = VOICE_ON && !flags.has('--no-vo') ? await prepareVoice(vs) : null;
      if (heard?.fresh) serveUrl = null; // clips written here are not "fresh" again in renderReel: rebuild the bundle now
      const verr = validateStoryboard(vs, heard?.durations).errors;
      if (verr.length) {
        verr.forEach((e) => console.log(c.red(`  error: ${platform}: ${e}`)));
        failed++;
        continue;
      }
      const v = {channel: doc.channel, date: doc.date, id: doc.id, platform};
      try {
        if (!(await renderReel(vs, {dir: variantDir(OUT, v), name: (k) => variantFile(OUT, v, k)})) && !flags.has('--vo-only')) failed++;
      } catch (e) {
        // one platform's render failing never stops the others; QA reports this one as not rendered (or failing)
        console.log(c.red(`  error: ${platform}: ${e.message.split('\n')[0]}`));
        failed++;
      }
    }
  } else if (OUT === path.join(ROOT, 'out')) {
    console.log(c.red('  error: only a channel board renders into engine/out (production); render this one with --out=test/out'));
    failed++;
  } else if (!(await renderReel(doc, {dir: path.join(OUT, doc.id), name: (k) => path.join(OUT, doc.id, k === 'mp4' ? 'reel.mp4' : k)})) && !flags.has('--vo-only')) failed++;
}
process.exit(failed ? 1 : 0);
