// Feed: the only way ideas reach ideas/<channel>.jsonl (read by the Weekly Writer). Each channel lists its sources in
// channel.json "feeds" ([{source, url}]). n8n (n8n/feed.json) POSTs each feed URL to the Mac receiver (/feed {url}) and the Mac
// fetches it (pullFeed); n8n only triggers: which channels a feed serves and what counts as an idea is decided here.
// Every idea keeps the item's own link as source_url (no link, no idea), is checked against idea.schema.json, and is written
// once per channel (dedupe by id = source + hash of the link). A feed that is unknown or unreadable writes nothing.
//
// node studio/feed.ts feeds                 the feed list n8n reads (GET /feeds)
// node studio/feed.ts pull <url>            fetch one listed feed on the Mac and ingest it (what POST /feed {url} does)
// node studio/feed.ts ingest <url> <file>   ingest a saved feed file by hand (same checks)
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {appendJsonl, PATHS, type Paths, readJsonl} from './ledger.ts';

export type Feed = {source: 'reddit' | 'google-trends' | 'youtube' | 'ig-question'; url: string};
export type Idea = {id: string; channel: string; title: string; summary?: string; source: Feed['source']; source_url: string; date: string};

const ROOT = path.join(import.meta.dirname, '..');
export const ideasFile = (channel: string, root = ROOT) => path.join(root, 'ideas', `${channel}.jsonl`);

// Every feed and the channels that list it.
export const feeds = (p: Paths = PATHS) => {
  const out = new Map<string, Feed & {channels: string[]}>();
  for (const c of fs.readdirSync(p.channels).filter((c) => fs.existsSync(path.join(p.channels, c, 'channel.json')))) {
    const ch = JSON.parse(fs.readFileSync(path.join(p.channels, c, 'channel.json'), 'utf8'));
    for (const f of (ch.feeds ?? []) as Feed[]) {
      const e = out.get(f.url) ?? {...f, channels: []};
      if (e.source !== f.source) throw new Error(`feed ${f.url} is listed as ${e.source} and ${f.source}`);
      e.channels.push(ch.id);
      out.set(f.url, e);
    }
  }
  return [...out.values()];
};

// ---- RSS 2.0 and Atom, the subset feeds actually use; no dependency ----
const ENT: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '};
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(parseInt(e[1].toLowerCase() === 'x' ? e.slice(2) : e.slice(1), e[1].toLowerCase() === 'x' ? 16 : 10)) : ENT[e.toLowerCase()] ?? m));
const text = (s = '') => decode(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); // source text kept as written
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))?.[1];
const day = (s: string | undefined, fallback: string) => {
  const t = s ? Date.parse(text(s)) : NaN;
  return Number.isNaN(t) ? fallback : new Date(t).toISOString().slice(0, 10);
};
const link = (block: string) => {
  const atom = block.match(/<link\b[^>]*\bhref="([^"]+)"[^>]*\/?>/i)?.[1];
  return text(tag(block, 'ht:news_item_url') ?? tag(block, 'link') ?? '') || decode(atom ?? '');
};

export type Item = {title: string; link: string; summary: string; date: string; news: boolean};
export const parse = (xml: string, today: string): Item[] => {
  if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) throw new Error('not an RSS or Atom feed');
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.map((b) => ({title: text(tag(b, 'title')), link: link(b), news: !!tag(b, 'ht:news_item_url'), summary: text(tag(b, 'description') ?? tag(b, 'summary') ?? tag(b, 'content')), date: day(tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'updated'), today)}));
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s);
// Google Trends items link to the whole feed; the item's own page is its news article, else that query's Trends page.
const sourceUrl = (f: Feed, it: Item) => {
  if (f.source !== 'google-trends' || it.news) return it.link;
  const geo = new URL(f.url).searchParams.get('geo') ?? 'IN';
  return `https://trends.google.com/trends/explore?geo=${encodeURIComponent(geo)}&q=${encodeURIComponent(it.title)}`;
};
const toIdea = (f: Feed, channel: string, it: Item): Idea => ({
  id: `${f.source}-${createHash('sha1').update(sourceUrl(f, it)).digest('hex').slice(0, 12)}`,
  channel,
  title: clip(it.title, 200),
  ...(it.summary ? {summary: clip(it.summary, 1000)} : {}),
  source: f.source,
  source_url: sourceUrl(f, it),
  date: it.date,
});

// One fetched feed -> new ideas for every channel that lists it. Unknown feed or unreadable text: throws, nothing written.
export const ingestFeed = (url: string, body: string, o: {paths?: Paths; root?: string; today?: string} = {}) => {
  const f = feeds(o.paths).find((x) => x.url === url);
  if (!f) throw new Error(`${url} is not a feed of any channel (channels/*/channel.json "feeds")`);
  const items = parse(body, o.today ?? new Date().toISOString().slice(0, 10));
  if (!items.length) throw new Error('the feed has no items');
  const schema = loadSchema('idea');
  const added: string[] = [];
  const skipped: string[] = [];
  for (const channel of f.channels) {
    const file = ideasFile(channel, o.root);
    const have = new Set(readJsonl<Idea>(file).flatMap((x) => [x.id, x.source_url]));
    const rows: Idea[] = [];
    for (const it of items) {
      if (!/^https?:\/\//.test(it.link)) {
        skipped.push(`"${it.title.slice(0, 60)}": no link`);
        continue;
      }
      const idea = toIdea(f, channel, it);
      const bad = validate(schema, idea);
      if (bad.length) skipped.push(`"${it.title.slice(0, 60)}": ${bad.join('; ')}`);
      else if (!have.has(idea.id) && !have.has(idea.source_url)) {
        rows.push(idea);
        have.add(idea.id);
        have.add(idea.source_url);
      }
    }
    appendJsonl(file, rows);
    added.push(...rows.map((r) => `${channel}:${r.id}`));
  }
  return {added, skipped, items: items.length};
};

// The Mac fetches the feed itself (Reddit refuses the n8n container: 403/429). Only feeds listed in a channel.json are fetched,
// so the endpoint cannot be used to fetch anything else. A non-200 answer writes nothing and says why.
export type Get = (url: string, init: {headers: Record<string, string>; signal: AbortSignal}) => Promise<{status: number; text: () => Promise<string>}>;
export const pullFeed = async (url: string, o: {paths?: Paths; root?: string; today?: string; fetch?: Get} = {}) => {
  if (!feeds(o.paths).some((x) => x.url === url)) throw new Error(`${url} is not a feed of any channel (channels/*/channel.json "feeds")`);
  const get = o.fetch ?? (globalThis.fetch as unknown as Get);
  const r = await get(url, {headers: {'User-Agent': 'Mozilla/5.0 (Macintosh) agent-studio-feed/1.0', Accept: 'application/rss+xml, application/atom+xml, text/xml'}, signal: AbortSignal.timeout(20_000)}).catch((e: Error) => {
    throw new Error(`could not fetch ${url}: ${e.message}`);
  });
  if (r.status !== 200) throw new Error(`${new URL(url).hostname} answered HTTP ${r.status}${r.status === 429 ? ' (rate limited, try later)' : r.status === 403 ? ' (blocked)' : ''}; nothing written`);
  return ingestFeed(url, await r.text(), o);
};

if (import.meta.main) {
  const [cmd, url, file] = process.argv.slice(2);
  if (cmd === 'feeds') console.log(JSON.stringify(feeds(), null, 2));
  else if (cmd === 'pull' && url) {
    const r = await pullFeed(url);
    console.log(`feed: ${r.items} item(s), ${r.added.length} new idea(s)${r.skipped.length ? `, skipped:\n  ${r.skipped.join('\n  ')}` : ''}`);
  } else if (cmd === 'ingest' && url && file) {
    const r = ingestFeed(url, fs.readFileSync(file, 'utf8'));
    console.log(`feed: ${r.items} item(s), ${r.added.length} new idea(s)${r.skipped.length ? `, skipped:\n  ${r.skipped.join('\n  ')}` : ''}`);
  } else {
    console.error('usage: node studio/feed.ts feeds | pull <url> | ingest <url> <file>');
    process.exit(2);
  }
}
