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
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import {pipeline} from 'node:stream/promises';
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

// ---- network safety ----
// Every network read: https on 443 only, a known provider host, no public-DNS surprises (a name that resolves to a private,
// loopback or link-local address is refused), every redirect hop re-checked before it is followed, a timeout over the whole
// read, and a byte cap. The connection itself is made to the ADDRESS we validated (pinned through the request's lookup), so the
// name is resolved once per hop and a DNS answer that changes between the check and the connect (rebinding) is never used.
// Tests pass their own Policy to point at a local server.
export type Policy = {
  hosts: RegExp;
  protocols: string[];
  ports: string[];
  timeoutMs: number;
  maxRedirects: number;
  lookup: (host: string) => Promise<string[]>;
  allowPrivate?: boolean; // tests only: let the policy reach 127.0.0.1
  ca?: string | Buffer; // tests only: trust this one certificate in addition to the system store
};
export const POLICY: Policy = {
  hosts: /(^|\.)(unsplash\.com|pixabay\.com|archive\.org|iconify\.design)$/,
  protocols: ['https:'],
  ports: ['', '443'],
  timeoutMs: 30_000,
  maxRedirects: 3,
  lookup: async (h) => (await dns.lookup(h, {all: true})).map((x) => x.address),
};
export const isPrivateIp = (ip: string): boolean => {
  const v4 = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1] ?? ip;
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && v4.startsWith('192.0.0.')) || (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::' || l === '::1' || /^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff');
  }
  return true; // not an address we understand: refuse
};
export const safeUrl = (u: string, p: Policy = POLICY) => {
  const x = new URL(u);
  if (!p.protocols.includes(x.protocol) || !p.ports.includes(x.port) || x.username || x.password || !p.hosts.test(x.hostname)) throw new Error(`refused URL ${x.protocol}//${x.hostname}${x.port ? `:${x.port}` : ''}`);
  return x;
};
// resolve once; every answer must be public; the first is the one we connect to
const resolveHost = async (x: URL, p: Policy) => {
  const host = x.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [host] : await p.lookup(host);
  if (!addrs.length || (!p.allowPrivate && addrs.some(isPrivateIp))) throw new Error(`refused: ${x.hostname} resolves to a private or unknown address`);
  return addrs[0];
};
export const MAX_BYTES = 40_000_000;
export const MAX_VIDEO_BYTES = 200_000_000;
// What a read returns: just enough of a Response (a real Response also fits bodyBytes)
export type Resp = {status: number; ok: boolean; headers: {get(name: string): string | null}; body: AsyncIterable<Uint8Array>; cancel(): Promise<void>; finalUrl: string};
const request = (x: URL, addr: string, headers: Record<string, string>, p: Policy, signal: AbortSignal) =>
  new Promise<http.IncomingMessage>((resolve, reject) => {
    const family = net.isIPv6(addr) ? 6 : 4;
    const req = (x.protocol === 'https:' ? https : http).request(
      x,
      {method: 'GET', headers, agent: false, signal, ca: p.ca, lookup: ((_h: string, o: {all?: boolean}, cb: (...a: unknown[]) => void) => (o?.all ? cb(null, [{address: addr, family}]) : cb(null, addr, family))) as never} as https.RequestOptions,
      resolve,
    );
    req.on('error', reject);
    req.end();
  });
// ponytail: ffmpeg never touches the network (videos are downloaded here, then trimmed from the file), so this is the only fetch path.
export const get = async (url: string, headers: Record<string, string> = {}, p: Policy = POLICY): Promise<Resp> => {
  const signal = AbortSignal.timeout(p.timeoutMs);
  let cur = url;
  for (let hop = 0; ; hop++) {
    const x = safeUrl(cur, p);
    const res = await request(x, await resolveHost(x, p), {'User-Agent': 'forge-content-studio/1.0 (media hub)', ...headers}, p, signal);
    const status = res.statusCode ?? 0;
    const next = res.headers.location;
    if (status >= 300 && status < 400 && next) {
      res.destroy();
      if (hop >= p.maxRedirects) throw new Error('too many redirects');
      cur = new URL(next, x).href;
      continue;
    }
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: {get: (n) => ([res.headers[n.toLowerCase()]].flat()[0] as string | undefined) ?? null},
      body: res,
      cancel: async () => void res.destroy(),
      finalUrl: x.href,
    };
  }
};
const drop = async (r: {body?: unknown; cancel?: () => Promise<void>}) => (r.cancel ? r.cancel() : (r.body as {cancel?: () => Promise<void>} | null)?.cancel?.().catch(() => null));
// the body, never more than max bytes in memory; the read ends at the get() timeout too
export const bodyBytes = async (r: {headers: {get(n: string): string | null}; body?: AsyncIterable<Uint8Array> | null; cancel?: () => Promise<void>}, max = MAX_BYTES) => {
  if (Number(r.headers.get('content-length') ?? 0) > max) {
    await drop(r);
    throw new Error(`download over ${max} bytes`);
  }
  const chunks: Uint8Array[] = [];
  let n = 0;
  for await (const c of r.body ?? []) {
    n += (c as Uint8Array).length;
    if (n > max) {
      await drop(r);
      throw new Error(`download over ${max} bytes`);
    }
    chunks.push(c as Uint8Array);
  }
  return Buffer.concat(chunks);
};
// A big file straight to disk (never in memory), capped; a failure leaves no file.
export const downloadFile = async (url: string, dest: string, max: number, p: Policy = POLICY) => {
  const r = await get(url, {}, p);
  let out: fs.WriteStream | undefined;
  try {
    if (!r.ok) throw new Error(`download ${r.status}`);
    if (Number(r.headers.get('content-length') ?? 0) > max) throw new Error(`download over ${max} bytes`);
    let n = 0;
    out = fs.createWriteStream(dest);
    await pipeline(
      r.body as unknown as NodeJS.ReadableStream,
      async function* (src: AsyncIterable<Buffer>) {
        for await (const c of src) {
          n += c.length;
          if (n > max) throw new Error(`download over ${max} bytes`);
          yield c;
        }
      },
      out,
    );
  } catch (e) {
    await r.cancel();
    // the write stream opens its file asynchronously: wait until it is closed, or the file can reappear after we delete it
    if (out && !out.closed) {
      out.destroy();
      await new Promise((res) => out!.once('close', res));
    }
    fs.rmSync(dest, {force: true});
    throw e;
  }
};
// A video file by its first bytes: mp4/mov or webm/mkv. Anything else (a playlist, a concat list, text) is refused, and the format is
// then forced on ffmpeg so it never probes into a demuxer that follows file names written inside the file.
export const videoFormat = (file: string): string | null => {
  const fd = fs.openSync(file, 'r');
  try {
    const b = Buffer.alloc(12);
    fs.readSync(fd, b, 0, 12, 0);
    if (b.subarray(4, 8).toString('latin1') === 'ftyp') return 'mov,mp4,m4a,3gp,3g2,mj2';
    if (b.readUInt32BE(0) === 0x1a45dfa3) return 'matroska,webm';
    return null;
  } finally {
    fs.closeSync(fd);
  }
};
const PNG_SIG = '89504e470d0a1a0a';
export const MAX_PIXELS = 50_000_000;
// real image bytes, not whatever the server called them; a PNG announcing a huge canvas is refused before ffmpeg decodes it
export const imageExt = (b: Buffer) => {
  if (b.subarray(0, 8).equals(Buffer.from(PNG_SIG, 'hex'))) return b.length >= 24 && b.readUInt32BE(16) * b.readUInt32BE(20) > MAX_PIXELS ? null : 'png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  if (b.subarray(0, 3).toString() === 'GIF') return 'gif';
  return null;
};
// Iconify props: a plain picture or nothing. No script, handlers, foreign content, external references, DTD/entities, CSS imports.
export const cleanSvg = (svg: string): string | null => {
  if (!/^\s*(<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(svg) || svg.length > 2_000_000) return null;
  if (/<!(doctype|entity)|<script|<foreignObject|<iframe|<embed|<object|<audio|<video|<animate|<set\b|\son\w+\s*=|javascript:|@import|url\(\s*['"]?\s*(https?:|file:|\/\/|data:text)/i.test(svg)) return null;
  for (const m of svg.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) if (!m[1].startsWith('#')) return null;
  return svg;
};

const json = async (url: string, headers: Record<string, string> = {}, p: Policy = POLICY) => {
  const r = await get(url, headers, p);
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return JSON.parse((await bodyBytes(r, 5_000_000)).toString('utf8'));
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
    const m = await json(`https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`);
    const want = kind === 'video' ? /(h\.264|mpeg4)/i : /(jpeg|png)/i;
    const f = (m.files ?? []).filter((x: any) => want.test(x.format ?? '') && !/thumb/i.test(x.name)).sort((a: any, b: any) => Number(b.size ?? 0) - Number(a.size ?? 0))[kind === 'video' ? 1 : 0] ?? (m.files ?? []).find((x: any) => want.test(x.format ?? ''));
    if (!f) continue;
    out.push({source: 'archive', kind, url: `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${encodeURIComponent(f.name)}`, page: `https://archive.org/details/${doc.identifier}`, credit: `${doc.title}${doc.creator ? `, ${[doc.creator].flat()[0]}` : ''} (Internet Archive)`, license: doc.licenseurl, seconds: Number(f.length) || undefined});
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
  const r = spawnSync('npx', ['remotion', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', ...args], {cwd: ENGINE, encoding: 'utf8', timeout: 300_000, killSignal: 'SIGKILL'});
  if (r.error) throw new Error(`ffmpeg failed: ${(r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT' ? 'timed out after 300 s and was killed' : `could not run (${(r.error as NodeJS.ErrnoException).code ?? r.error.message})`}`);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').slice(0, 300)}`);
};
const INDEX = path.join(CACHE, 'index.json');
const readIndex = (f = INDEX): Record<string, Plate> => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {});
// write-then-rename: a crash or a failed write leaves the previous index untouched, and no .tmp behind
export const writeIndex = (index: Record<string, Plate>, f = INDEX) => {
  const tmp = `${f}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(index, null, 1));
    fs.renameSync(tmp, f);
  } finally {
    fs.rmSync(tmp, {force: true});
  }
};
// ffmpeg reads a LOCAL file only: protocol whitelist `file`, so no network, concat:, subfile:, data: or other protocol, and the input
// format is forced to the one the file's own bytes showed (videoFormat), so no playlist demuxer is ever tried.
export const VIDEO_PROTOCOLS = 'file';
export const videoArgs = (input: string, format: string, start: number, duration: number, out: string) =>
  // no audio, VP9 at 1080x1920
  ['-protocol_whitelist', VIDEO_PROTOCOLS, '-f', format, '-ss', String(start), '-t', String(duration), '-i', input, '-an', '-vf', coverFilter, '-r', '30', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', out];
// download one clip (capped), check what it is, cut the seconds that are needed; every failure leaves nothing behind in dir
export const videoPlate = async (url: string, dir: string, id: string, start: number, duration: number, p: Policy = POLICY, max = MAX_VIDEO_BYTES, run: (a: string[]) => void = ffmpeg) => {
  const out = path.join(dir, `${id}.webm`);
  const src = path.join(dir, `${id}.src.video`);
  try {
    await downloadFile(url, src, max, p);
    const format = videoFormat(src);
    if (!format) throw new Error('download is not an mp4, mov, webm or mkv video');
    run(videoArgs(src, format, start, duration, out));
    if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error('ffmpeg produced no video');
    return out;
  } catch (e) {
    fs.rmSync(out, {force: true});
    throw e;
  } finally {
    fs.rmSync(src, {force: true});
  }
};
// download one image to <dir>/<id>.png, normalized to 9:16; every failure leaves nothing behind in dir
export const imagePlate = async (url: string, dir: string, id: string, p: Policy = POLICY, run: (a: string[]) => void = ffmpeg) => {
  const out = path.join(dir, `${id}.png`);
  let tmp = '';
  try {
    const r = await get(url, {}, p);
    if (!r.ok) throw new Error(`download ${r.status}`);
    const bytes = await bodyBytes(r);
    const ext = imageExt(bytes);
    if (!ext) throw new Error('download is not a png, jpeg, webp or gif image (or its canvas is too large)');
    tmp = path.join(dir, `${id}.src.${ext}`); // ffmpeg reads the format from the name
    fs.writeFileSync(tmp, bytes);
    run(['-i', tmp, '-vf', coverFilter, '-frames:v', '1', out]);
    if (!fs.existsSync(out) || !fs.statSync(out).size) throw new Error('ffmpeg produced no image');
    return out;
  } catch (e) {
    fs.rmSync(out, {force: true});
    throw e;
  } finally {
    if (tmp) fs.rmSync(tmp, {force: true});
  }
};

export const fetchPlate = async (c: Candidate, query: string, opt: {start?: number; seconds?: number} = {}): Promise<Plate> => {
  fs.mkdirSync(CACHE, {recursive: true});
  const start = c.kind === 'video' ? opt.start ?? Math.round((c.seconds ?? 60) * 0.3) : undefined;
  const duration = c.kind === 'video' ? opt.seconds ?? 8 : undefined;
  const id = plateId(c, start, duration);
  const index = readIndex();
  if (index[id] && fs.existsSync(path.join(CACHE, index[id].file))) return index[id];
  const file = `${id}.${c.kind === 'video' ? 'webm' : 'png'}`;
  const out = path.join(CACHE, file);
  safeUrl(c.url);
  if (c.ping) await get(c.ping, {Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`}).then((r) => r.cancel(), () => null); // Unsplash: report the download
  if (c.kind === 'video') await videoPlate(c.url, CACHE, id, start!, duration!);
  else await imagePlate(c.url, CACHE, id);
  const plate: Plate = {...c, id, file, query, start, duration};
  delete plate.ping;
  writeIndex({...readIndex(), [id]: plate});
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
    const hit = (await json(`https://api.iconify.design/search?query=${encodeURIComponent(noun)}&limit=1&prefixes=noto,fluent-emoji-flat,twemoji`)).icons?.[0] as string | undefined;
    if (!hit || !/^[a-z0-9-]+:[a-z0-9-]+$/.test(hit)) return null;
    const [prefix, name] = hit.split(':');
    const res = await get(`https://api.iconify.design/${prefix}/${name}.svg?height=512`);
    if (!res.ok) return null;
    const svg = cleanSvg((await bodyBytes(res, 2_000_000)).toString('utf8'));
    if (!svg) return null; // a plain picture, nothing that runs or loads
    fs.mkdirSync(path.dirname(cached), {recursive: true});
    fs.writeFileSync(cached, svg);
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
    for (const bad of ['http://images.unsplash.com/a.png', 'https://evil.example/a.png', 'https://unsplash.com.evil.example/a', 'file:///etc/passwd', 'https://127.0.0.1/a']) assert.throws(() => safeUrl(bad), /refused URL|Invalid URL/, bad);
    for (const ok of ['https://images.unsplash.com/a', 'https://cdn.pixabay.com/a', 'https://ia800.us.archive.org/a', 'https://api.iconify.design/a']) safeUrl(ok);
    assert.strictEqual(imageExt(Buffer.from('89504e470d0a1a0a00', 'hex')), 'png');
    assert.strictEqual(imageExt(Buffer.from('ffd8ff00', 'hex')), 'jpeg');
    assert.strictEqual(imageExt(Buffer.from('<html>not an image')), null, 'content-type is not trusted, bytes are');
    await assert.rejects(bodyBytes(new Response('x'.repeat(100)), 10), /over 10 bytes/);
    assert.strictEqual((await bodyBytes(new Response('abc'), 10)).toString(), 'abc');
    console.log(`mediaHub ok: licence filter, plate ids, 9:16 cover crop; keys present: ${['UNSPLASH_ACCESS_KEY', 'PIXABAY_API_KEY'].filter((k) => process.env[k]).join(', ') || 'none (archive only)'}`);
  } else if (cmd === 'find' && q) console.log(JSON.stringify(await find(q, kind, Number(arg('--n') ?? 3), only), null, 1));
  else if (cmd === 'get' && q) {
    const c = (await find(q, kind, Number(arg('--pick') ?? 0) + 1, only)).at(-1);
    if (!c) throw new Error(`no ${kind} for "${q}"`);
    const p = await fetchPlate(c, q, {start: arg('--start') ? Number(arg('--start')) : undefined, seconds: arg('--seconds') ? Number(arg('--seconds')) : undefined});
    console.log(JSON.stringify({...p, public: materialize(p)}, null, 1));
  } else console.log('usage: mediaHub.ts find|get "<query>" [--video] [--source archive|pixabay|unsplash] | test');
}
