// Media hub: finds photographic plates and archive clips for a scene, downloads them once, normalizes them and caches them.
// Node only (scripts and the Director call it; the Remotion bundle never imports it). Sources, in order:
//   Unsplash (UNSPLASH_ACCESS_KEY, the app's Access Key / Client ID): photos; attribution required, the download is reported
//     to Unsplash as its API guidelines ask.
//   Pixabay (PIXABAY_API_KEY): photos and videos under the Pixabay Content License.
//   Internet Archive (no key): movies and images from curated collections only (Prelinger films; NASA and Flickr Commons
//     stills), and only items whose licenseurl is public domain or Creative Commons: an uploader's own licence claim on a
//     random upload is not trusted.
// Keys are read by name from engine/.env (never printed). Without a key that source is skipped.
// Cache: <repo>/.cache/media/<id>.(png|webm) + index.json; a cached query never calls the network again. A plate is used in a
// render by copying it to engine/public/media/ (materialize), which is git-ignored like the cache.
//   node src/lib/mediaHub.ts find "<query>" [--video] [--source archive|pixabay|unsplash] [--n 3]
//   node src/lib/mediaHub.ts get "<query>" [--video] [--source ...] [--pick 0] [--start 30] [--seconds 8]
// Self-test (no network): node src/lib/mediaHub.ts test
import assert from 'node:assert';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ENGINE = path.resolve(import.meta.dirname, '../..');
const CACHE = path.resolve(ENGINE, '..', '.cache', 'media');
const PUBLIC = path.join(ENGINE, 'public', 'media');
const W = 1080, H = 1920;

export type Source = 'unsplash' | 'pixabay' | 'archive';
export type Kind = 'image' | 'video';
export type Candidate = {source: Source; kind: Kind; url: string; page: string; credit: string; license: string; seconds?: number; ping?: string};
export type Plate = Candidate & {id: string; file: string; query: string; start?: number; duration?: number};

// engine/.env into process.env by name only, the same way make.mjs does it
const envFile = path.join(ENGINE, '.env');
if (fs.existsSync(envFile))
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }

const OPEN = /creativecommons\.org\/(publicdomain|licenses)\//; // public domain marks and CC licences
export const openLicense = (url?: string) => !!url && OPEN.test(url) && !/-nd\b|\/nd\//.test(url); // no-derivatives is out: we crop and grade

const json = async (url: string, headers: Record<string, string> = {}) => {
  const r = await fetch(url, {headers: {'User-Agent': 'forge-content-studio/1.0 (media hub)', ...headers}});
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.json();
};

const unsplash = async (q: string, kind: Kind, n: number): Promise<Candidate[]> => {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || kind !== 'image') return [];
  const d = await json(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=portrait&per_page=${n}&content_filter=high`, {Authorization: `Client-ID ${key}`});
  return d.results.map((r: any) => ({source: 'unsplash', kind, url: `${r.urls.raw}&w=${W}&h=${H}&fit=crop&fm=png`, page: r.links.html, credit: `Photo by ${r.user.name} on Unsplash`, license: 'https://unsplash.com/license', ping: r.links.download_location}));
};

const pixabay = async (q: string, kind: Kind, n: number): Promise<Candidate[]> => {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const base = kind === 'video' ? 'https://pixabay.com/api/videos/' : 'https://pixabay.com/api/';
  const d = await json(`${base}?key=${key}&q=${encodeURIComponent(q)}&safesearch=true&per_page=${Math.max(3, n)}${kind === 'image' ? '&image_type=photo&orientation=vertical' : ''}`);
  return d.hits.map((h: any) => ({source: 'pixabay', kind, url: kind === 'video' ? (h.videos.large?.url || h.videos.medium.url) : h.largeImageURL, page: h.pageURL, credit: `${h.user} on Pixabay`, license: 'https://pixabay.com/service/license-summary/', seconds: h.duration}));
};

export const ARCHIVE_COLLECTIONS = {video: ['prelinger'], image: ['nasa', 'flickrcommons']};
const archive = async (q: string, kind: Kind, n: number): Promise<Candidate[]> => {
  const mt = kind === 'video' ? 'movies' : 'image';
  const cols = ARCHIVE_COLLECTIONS[kind].map((c) => `collection:${c}`).join(' OR ');
  const s = await json(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(`(${q}) AND mediatype:${mt} AND (${cols}) AND licenseurl:*creativecommons*`)}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=creator&rows=${n * 4}&output=json`);
  const out: Candidate[] = [];
  for (const doc of s.response.docs) {
    if (out.length >= n) break;
    if (!openLicense(doc.licenseurl)) continue;
    const m = await json(`https://archive.org/metadata/${doc.identifier}`);
    const want = kind === 'video' ? /(h\.264|mpeg4)/i : /(jpeg|png)/i;
    const f = (m.files ?? []).filter((x: any) => want.test(x.format ?? '') && !/thumb/i.test(x.name)).sort((a: any, b: any) => Number(b.size ?? 0) - Number(a.size ?? 0))[kind === 'video' ? 1 : 0] ?? (m.files ?? []).find((x: any) => want.test(x.format ?? ''));
    if (!f) continue;
    out.push({source: 'archive', kind, url: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(f.name)}`, page: `https://archive.org/details/${doc.identifier}`, credit: `${doc.title}${doc.creator ? `, ${[doc.creator].flat()[0]}` : ''} (Internet Archive)`, license: doc.licenseurl, seconds: Number(f.length) || undefined});
  }
  return out;
};

const SOURCES = {unsplash, pixabay, archive};
export const find = async (q: string, kind: Kind = 'image', n = 3, only?: Source): Promise<Candidate[]> => {
  const order: Source[] = only ? [only] : kind === 'video' ? ['pixabay', 'archive'] : ['unsplash', 'pixabay', 'archive'];
  const all: Candidate[] = [];
  for (const s of order) {
    try {
      all.push(...(await SOURCES[s](q, kind, n)));
    } catch (e) {
      console.error(`  ${s}: ${(e as Error).message}`); // one source failing never stops the others
    }
    if (all.length >= n) break;
  }
  return all.slice(0, n);
};

// ---- download, normalize, cache ----
export const plateId = (c: Pick<Candidate, 'url'>, start = 0, duration = 0) => crypto.createHash('sha1').update(`${c.url}|${start}|${duration}`).digest('hex').slice(0, 16);
// ffmpeg filters: fill the 9:16 frame (scale to cover, centre crop). Remotion's ffmpeg has only a few filters (scale, crop...).
export const coverFilter = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
const ffmpeg = (args: string[]) => {
  const r = spawnSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', ...args], {cwd: ENGINE, encoding: 'utf8'});
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').slice(0, 300)}`);
};
const INDEX = path.join(CACHE, 'index.json');
const readIndex = (): Record<string, Plate> => (fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : {});

export const fetchPlate = async (c: Candidate, query: string, opt: {start?: number; seconds?: number} = {}): Promise<Plate> => {
  fs.mkdirSync(CACHE, {recursive: true});
  const start = c.kind === 'video' ? opt.start ?? Math.round((c.seconds ?? 60) * 0.3) : undefined;
  const duration = c.kind === 'video' ? opt.seconds ?? 8 : undefined;
  const id = plateId(c, start, duration);
  const index = readIndex();
  if (index[id] && fs.existsSync(path.join(CACHE, index[id].file))) return index[id];
  const file = `${id}.${c.kind === 'video' ? 'webm' : 'png'}`;
  const out = path.join(CACHE, file);
  if (c.ping) await fetch(c.ping, {headers: {Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`}}).catch(() => null); // Unsplash: report the download
  if (c.kind === 'video') {
    // seek on the remote file (HTTP range), so only the needed seconds are downloaded; no audio, VP9 at 1080x1920
    ffmpeg(['-ss', String(start), '-t', String(duration), '-i', c.url, '-an', '-vf', coverFilter, '-r', '30', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', out]);
  } else {
    const r = await fetch(c.url, {headers: {'User-Agent': 'forge-content-studio/1.0 (media hub)'}});
    if (!r.ok) throw new Error(`download ${r.status}`);
    const ext = (r.headers.get('content-type') ?? '').match(/image\/(png|jpeg|webp|gif)/)?.[1] ?? 'jpeg'; // ffmpeg reads the format from the name
    const tmp = path.join(CACHE, `${id}.src.${ext}`);
    fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
    ffmpeg(['-i', tmp, '-vf', coverFilter, '-frames:v', '1', out]);
    fs.rmSync(tmp);
  }
  const plate: Plate = {...c, id, file, query, start, duration};
  delete plate.ping;
  fs.writeFileSync(INDEX, JSON.stringify({...readIndex(), [id]: plate}, null, 1));
  return plate;
};

// copy a cached plate into engine/public/media so a render can load it with staticFile(`media/${file}`)
export const materialize = (p: Plate) => {
  fs.mkdirSync(PUBLIC, {recursive: true});
  const dst = path.join(PUBLIC, p.file);
  if (!fs.existsSync(dst)) fs.copyFileSync(path.join(CACHE, p.file), dst);
  return `media/${p.file}`;
};

// a board's composite scenes: each gets the first plate for its query (a cached query never calls the network again);
// returns one entry per scene (null for the other primitives), the shape the Composer's StoryCtx takes
export const resolvePlates = async (doc: {scenes: {primitive: string; params?: Record<string, unknown>}[]}) => {
  const out: ({src: string; kind: Kind; credit: string} | null)[] = [];
  for (const sc of doc.scenes) {
    if (sc.primitive !== 'composite') {
      out.push(null);
      continue;
    }
    const q = String(sc.params?.query ?? '');
    const kind: Kind = sc.params?.video ? 'video' : 'image';
    let plate = Object.values(readIndex()).find((p) => p.query === q && p.kind === kind && fs.existsSync(path.join(CACHE, p.file)));
    // a source that is rate-limited or down (Unsplash's demo tier allows 50 requests an hour) falls through to the next
    for (const src of (kind === 'video' ? ['pixabay', 'archive'] : ['unsplash', 'pixabay', 'archive']) as Source[]) {
      if (plate) break;
      for (const c of await find(q, kind, 2, src)) {
        try {
          plate = await fetchPlate(c, q);
          break;
        } catch (e) {
          console.error(`  ${src}: ${(e as Error).message}`);
        }
      }
    }
    if (!plate) throw new Error(`media hub: no ${kind} plate for "${q}" from any source`);
    out.push({src: materialize(plate), kind: plate.kind, credit: plate.credit});
  }
  return out;
};

// the literal prop of a scene: a colour SVG of its noun from Iconify's emoji sets (no key), cached like a plate;
// null when no set has one, and the scene is then just its plate
export const resolveObject = async (noun: string) => {
  const slug = noun.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cached = path.join(CACHE, 'objects', `${slug}.svg`);
  if (!fs.existsSync(cached)) {
    const hit = (await (await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(noun)}&limit=1&prefixes=noto,fluent-emoji-flat,twemoji`)).json()).icons?.[0] as string | undefined;
    if (!hit) return null;
    const [prefix, name] = hit.split(':');
    const res = await fetch(`https://api.iconify.design/${prefix}/${name}.svg?height=512`);
    if (!res.ok) return null;
    fs.mkdirSync(path.dirname(cached), {recursive: true});
    fs.writeFileSync(cached, await res.text());
  }
  const dst = path.join(PUBLIC, 'objects', `${slug}.svg`);
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  fs.copyFileSync(cached, dst);
  return `media/objects/${slug}.svg`;
};
export const resolveObjects = async (doc: {scenes: {params?: Record<string, unknown>}[]}) =>
  Promise.all(doc.scenes.map(async (sc) => (sc.params?.objectNoun ? await resolveObject(String(sc.params.objectNoun)).catch(() => null) : null)));

// ---- CLI ----
const arg = (k: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : undefined);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const [cmd, q] = process.argv.slice(2);
  const kind: Kind = process.argv.includes('--video') ? 'video' : 'image';
  const only = arg('--source') as Source | undefined;
  if (cmd === 'test') {
    assert.ok(openLicense('http://creativecommons.org/licenses/publicdomain/'));
    assert.ok(openLicense('https://creativecommons.org/publicdomain/zero/1.0/'));
    assert.ok(openLicense('https://creativecommons.org/licenses/by/4.0/'));
    assert.ok(!openLicense('https://creativecommons.org/licenses/by-nd/4.0/'), 'no-derivatives is refused (we crop and grade)');
    assert.ok(!openLicense(undefined) && !openLicense('http://example.com/all-rights-reserved'));
    assert.strictEqual(plateId({url: 'a'}, 1, 2), plateId({url: 'a'}, 1, 2));
    assert.notStrictEqual(plateId({url: 'a'}, 1, 2), plateId({url: 'a'}, 2, 2), 'another segment of a clip is another plate');
    assert.match(coverFilter, /force_original_aspect_ratio=increase,crop=1080:1920/);
    console.log(`mediaHub ok: licence filter, plate ids, 9:16 cover crop; keys present: ${['UNSPLASH_ACCESS_KEY', 'PIXABAY_API_KEY'].filter((k) => process.env[k]).join(', ') || 'none (archive only)'}`);
  } else if (cmd === 'find' && q) console.log(JSON.stringify(await find(q, kind, Number(arg('--n') ?? 3), only), null, 1));
  else if (cmd === 'get' && q) {
    const c = (await find(q, kind, Number(arg('--pick') ?? 0) + 1, only)).at(-1);
    if (!c) throw new Error(`no ${kind} for "${q}"`);
    const p = await fetchPlate(c, q, {start: arg('--start') ? Number(arg('--start')) : undefined, seconds: arg('--seconds') ? Number(arg('--seconds')) : undefined});
    console.log(JSON.stringify({...p, public: materialize(p)}, null, 1));
  } else console.log('usage: mediaHub.ts find|get "<query>" [--video] [--source archive|pixabay|unsplash] | test');
}
