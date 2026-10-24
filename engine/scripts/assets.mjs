// Asset pipeline (docs/FILM_PIPELINE_PLAN.md, E1): every script noun becomes a real, cut-out object.
// For each noun: search Pixabay, then Pexels, then Wikimedia Commons and Openverse (CC0 and public domain only), download a few candidates, cut each
// out with BiRefNet (scripts/cutout.py, its own venv), and keep the best one in the prop library with its source and licence.
//   node scripts/assets.mjs "burdock burr" "magnifying glass" ...      (from engine/)
//   node scripts/assets.mjs "white sneaker=public/hook-test/stitch-shoe.jpg"   a local image (Stitch photo, scan) instead of a search
//   node scripts/assets.mjs "photo:aurora borealis"   a whole photo (a window or plate in formats E and F), not a cut-out:
//   the candidate CLIP matches best is kept as public/props/<slug>/<slug>.jpg
//   node scripts/assets.mjs "footage:train window view"   real moving footage (format F plates): Wikimedia Commons, CC0 and
//   public domain only, the candidate whose still CLIP matches best, cropped to 1080 x 1920, at most 40 s, no sound -> <slug>.mp4
//   out: public/props/<slug>/<slug>.png + manifest.json (all candidates, scores, sources). Props are not committed: the
//   manifest says where each came from, so the library can be rebuilt; stock licences forbid redistributing the files as-is.
// Keys come from engine/.env (PIXABAY_API_KEY, PEXELS_API_KEY); a provider without a key is skipped. Openverse needs none.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const PY = process.env.CUTOUT_PYTHON ?? path.join(os.homedir(), 'Dev/tools/cutout/bin/python');
const PER = 4; // candidates per provider per query

const get = async (u, headers = {}) => {
  const r = await fetch(u, {headers});
  if (!r.ok) throw new Error(`${r.status} ${u.replace(/key=[^&]+/, 'key=…')}`);
  return r;
};

// Each provider returns [{url, page, author, license, provider}] for a query.
const PROVIDERS = {
  pixabay: async (q) => {
    const key = process.env.PIXABAY_API_KEY;
    if (!key) return [];
    const j = await (await get(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true&per_page=${PER + 6}`)).json();
    return j.hits.slice(0, PER).map((h) => ({url: h.largeImageURL, page: h.pageURL, author: h.user, license: 'Pixabay Content License', provider: 'pixabay'}));
  },
  pexels: async (q) => {
    const key = process.env.PEXELS_API_KEY;
    if (!key) return [];
    const j = await (await get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${PER}`, {Authorization: key})).json();
    return j.photos.map((p) => ({url: p.src.large2x, page: p.url, author: p.photographer, license: 'Pexels License', provider: 'pexels'}));
  },
  // Wikimedia Commons: archival photos, patent drawings, portraits (CC0 and public domain only, licence read per file)
  wikimedia: async (q) => {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&iiextmetadatafilter=LicenseShortName|Artist`;
    const pages = Object.values((await (await get(u, {'User-Agent': 'agent-studio/1.0 (asset pipeline)'})).json()).query?.pages ?? {}).sort((a, b) => a.index - b.index);
    return pages
      .map((p) => p.imageinfo[0])
      .filter((i) => /^(cc0|public domain|pd|pdm)/i.test(i.extmetadata?.LicenseShortName?.value ?? ''))
      .slice(0, PER)
      .map((i) => ({url: i.thumburl ?? i.url, page: i.descriptionurl, author: (i.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, ''), license: i.extmetadata.LicenseShortName.value, provider: 'wikimedia'}));
  },
  openverse: async (q) => {
    const j = await (await get(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=${PER}`)).json();
    return j.results.map((r) => ({url: r.url, page: r.foreign_landing_url, author: r.creator ?? '', license: r.license === 'pdm' ? 'Public Domain Mark' : 'CC0', provider: 'openverse'}));
  },
};

export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const fetchProp = async (noun, local, localLicense = 'Stitch (Google Labs) generated', photo = false) => {
  const id = slug(noun);
  const dir = path.join(ROOT, 'public/props', id);
  const raw = path.join(ROOT, 'test/out/assets', id);
  fs.mkdirSync(dir, {recursive: true});
  fs.mkdirSync(raw, {recursive: true});
  // an isolated product shot cuts out cleanly; the plain query is the fallback
  const cands = [];
  // a local image (a Stitch photo, a scan) is one more candidate: "noun=path/to/file.jpg"
  if (local) cands.push({url: url.pathToFileURL(path.resolve(local)).href, page: '', author: '', license: localLicense, provider: 'local', query: noun});
  for (const q of local ? [] : photo ? [noun] : [`${noun} isolated`, noun])
    for (const [name, search] of Object.entries(PROVIDERS)) {
      try {
        for (const c of await search(q)) if (!cands.some((x) => x.url === c.url)) cands.push({...c, query: q});
      } catch (e) {
        console.error(`  ${name}: ${e.message}`);
      }
    }
  const jobs = [];
  for (const [i, c] of cands.entries()) {
    try {
      const buf = c.provider === 'local' ? fs.readFileSync(url.fileURLToPath(c.url)) : Buffer.from(await (await get(c.url)).arrayBuffer());
      c.file = path.join(raw, `${i}.src`);
      fs.writeFileSync(c.file, buf);
      jobs.push({src: c.file, out: path.join(raw, `${i}.png`), noun, photo});
      c.cut = jobs.at(-1).out;
    } catch (e) {
      c.error = e.message;
    }
  }
  const jobFile = path.join(raw, 'jobs.json');
  fs.writeFileSync(jobFile, JSON.stringify(jobs));
  const r = spawnSync(PY, [path.join(ROOT, 'scripts/cutout.py'), jobFile], {encoding: 'utf8', maxBuffer: 1 << 26, env: {...process.env, HF_HUB_OFFLINE: '1'}}); // models are cached; an online check can stall
  if (r.status !== 0) throw new Error(`cutout.py failed: ${r.stderr.split('\n').slice(-4).join(' ')}`);
  const scores = new Map(r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((s) => [s.out, s]));
  for (const c of cands) Object.assign(c, scores.get(c.cut) ?? {score: 0});
  // best score wins; ties go to the earlier provider and query (the list order)
  if (photo) {
    const best = cands.reduce((a, c) => ((c.match ?? 0) > (a?.match ?? -1) ? c : a), null);
    if (!best || (best.match ?? 0) < 0.5) throw new Error(`${noun}: no photo matches (best ${best?.match ?? 0}); try another wording`);
    fs.copyFileSync(best.file, path.join(dir, `${id}.jpg`));
    const manifest = {noun, id, file: `props/${id}/${id}.jpg`, chosen: pick(best), candidates: cands.map(pick), at: new Date().toISOString()};
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
    return manifest;
  }
  const best = cands.reduce((a, c) => ((c.score ?? 0) > (a?.score ?? -1) ? c : a), null);
  if (!best || best.score < 0.5) throw new Error(`${noun}: no usable cut-out (best ${best?.score ?? 0}); try another wording`);
  fs.copyFileSync(best.cut, path.join(dir, `${id}.png`));
  const manifest = {noun, id, file: `props/${id}/${id}.png`, chosen: pick(best), candidates: cands.map(pick), at: new Date().toISOString()};
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return manifest;
};
// Footage: Commons video search, licence-checked; candidates are judged on their still thumbnails, only the winner downloads.
const FREE = /^(cc0|public domain|pd|pdm)/i;
export const fetchFootage = async (noun) => {
  const id = slug(noun);
  const dir = path.join(ROOT, 'public/props', id);
  const raw = path.join(ROOT, 'test/out/assets', id);
  fs.mkdirSync(dir, {recursive: true});
  fs.mkdirSync(raw, {recursive: true});
  const ua = {'User-Agent': 'agent-studio/1.0 (asset pipeline)'};
  const q = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(`${noun} filetype:video`)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|Artist`;
  const pages = Object.values((await (await get(q, ua)).json()).query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const cands = pages
    .map((p) => ({p, i: p.imageinfo[0]}))
    .filter(({i}) => FREE.test(i.extmetadata?.LicenseShortName?.value ?? '') && (i.duration ?? 0) >= 12 && i.size < 400e6 && i.thumburl)
    .slice(0, PER)
    .map(({p, i}) => ({url: i.url, page: i.descriptionurl, author: (i.extmetadata?.Artist?.value ?? '').replace(/<[^>]+>/g, ''), license: i.extmetadata.LicenseShortName.value, provider: 'wikimedia', query: noun, title: p.title, seconds: Math.round(i.duration), thumb: i.thumburl}));
  if (!cands.length) throw new Error(`${noun}: no CC0 or public-domain footage on Wikimedia Commons; try another wording`);
  const jobs = [];
  for (const [n, c] of cands.entries()) {
    c.file = path.join(raw, `${n}.thumb`);
    fs.writeFileSync(c.file, Buffer.from(await (await get(c.thumb, ua)).arrayBuffer()));
    jobs.push({src: c.file, out: path.join(raw, `${n}.png`), noun, photo: true});
  }
  const jobFile = path.join(raw, 'jobs.json');
  fs.writeFileSync(jobFile, JSON.stringify(jobs));
  const r = spawnSync(PY, [path.join(ROOT, 'scripts/cutout.py'), jobFile], {encoding: 'utf8', maxBuffer: 1 << 26, env: {...process.env, HF_HUB_OFFLINE: '1'}});
  if (r.status !== 0) throw new Error(`cutout.py failed: ${r.stderr.split('\n').slice(-4).join(' ')}`);
  const scores = r.stdout.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  cands.forEach((c, n) => Object.assign(c, {score: scores[n]?.score ?? 0, match: scores[n]?.match ?? 0}));
  const best = cands.reduce((a, c) => (c.match > a.match ? c : a));
  if (best.match < 0.5) throw new Error(`${noun}: no footage matches (best ${best.match}); try another wording`);
  const src = path.join(raw, 'best.src');
  fs.writeFileSync(src, Buffer.from(await (await get(best.url, ua)).arrayBuffer()));
  const BIN = path.join(ROOT, 'node_modules/@remotion/compositor-darwin-arm64');
  const ff = spawnSync(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-nostdin', '-y', '-i', src, '-t', '40', '-an', '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', path.join(dir, `${id}.mp4`)], {env: {...process.env, DYLD_LIBRARY_PATH: BIN}, encoding: 'utf8'});
  if (ff.status !== 0) throw new Error(`ffmpeg: ${ff.stderr.split('\n').slice(-3).join(' ')}`);
  const manifest = {noun, id, file: `props/${id}/${id}.mp4`, chosen: {...pick(best), title: best.title, seconds: best.seconds}, candidates: cands.map(pick), at: new Date().toISOString()};
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  return manifest;
};

const pick = (c) => ({provider: c.provider, query: c.query, url: c.url, page: c.page, author: c.author, license: c.license, score: c.score, match: c.match, why: c.why, w: c.w, h: c.h, error: c.error});

if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
  for (const [p, k] of [['pixabay', 'PIXABAY_API_KEY'], ['pexels', 'PEXELS_API_KEY']]) if (!process.env[k]) console.log(`${p}: no ${k} in engine/.env, skipped`);
  const nouns = process.argv.slice(2);
  if (!nouns.length) throw new Error('usage: node scripts/assets.mjs "noun" ["noun" ...]');
  for (const arg of nouns) {
    const [n, local] = arg.replace(/^(photo|footage):/, '').split('=');
    const m = await (arg.startsWith('footage:') ? fetchFootage(n) : fetchProp(n, local, undefined, arg.startsWith('photo:'))).catch((e) => (console.log(`${n}: ${e.message}`), null));
    if (m) console.log(`${n} -> public/${m.file}  (${m.chosen.provider}, ${m.chosen.license}, score ${m.chosen.score}, ${m.candidates.length} candidates)`);
  }
}
