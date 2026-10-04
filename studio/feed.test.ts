// node studio/feed.test.ts : a fetched RSS/Atom feed becomes schema-valid ideas for every channel that lists it, each with the
// item's own link; repeats are dropped; unknown feeds, junk and items without links write nothing. Temp folder only.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {handle, post} from './approve-server.ts';
import {feeds, ideasFile, ingestFeed, parse} from './feed.ts';
import {type Paths, readJsonl} from './ledger.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'feed-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [], out: tmp, recipes: tmp, channels: path.join(tmp, 'channels'), queue: path.join(tmp, 'queue')};
const TRENDS = 'https://trends.google.com/trending/rss?geo=IN';
const REDDIT = 'https://www.reddit.com/r/smallbusiness/.rss';
const setChannel = (id: string, f: object[]) => {
  const ch = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels', id, 'channel.json'), 'utf8'));
  fs.mkdirSync(path.join(p.channels, id), {recursive: true});
  fs.writeFileSync(path.join(p.channels, id, 'channel.json'), JSON.stringify({...ch, feeds: f}));
};
setChannel('c1-automation', [{source: 'google-trends', url: TRENDS}, {source: 'reddit', url: REDDIT}]);
setChannel('c2-reach', [{source: 'google-trends', url: TRENDS}]);
const o = {paths: p, root: tmp, today: '2026-10-02'};

// the real channel files are valid feed configs
for (const f of feeds()) assert.ok(f.channels.length && /^https:\/\//.test(f.url), f.url);

// Google Trends (RSS 2.0): each item's news link is its source; without one, that query's own Trends page
const trends = `<?xml version="1.0"?><rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel><title>Daily Search Trends</title><link>${TRENDS}</link>
<item><title>gst invoice due date</title><link>${TRENDS}</link><pubDate>Thu, 1 Oct 2026 20:00:00 +0530</pubDate>
  <ht:news_item><ht:news_item_title>GST returns: what changes</ht:news_item_title><ht:news_item_url>https://example.in/news/gst-returns</ht:news_item_url></ht:news_item></item>
<item><title>tally &amp; excel</title><link>${TRENDS}</link><pubDate>Thu, 1 Oct 2026 21:00:00 +0530</pubDate></item>
</channel></rss>`;
let r = ingestFeed(TRENDS, trends, o);
assert.equal(r.added.length, 4, 'two items, each for both channels that list the feed');
const c1 = readJsonl<any>(ideasFile('c1-automation', tmp));
const c2 = readJsonl<any>(ideasFile('c2-reach', tmp));
assert.deepEqual(c1.map((x) => [x.title, x.source_url, x.date, x.source]), [
  ['gst invoice due date', 'https://example.in/news/gst-returns', '2026-10-01', 'google-trends'],
  ['tally & excel', 'https://trends.google.com/trends/explore?geo=IN&q=tally%20%26%20excel', '2026-10-01', 'google-trends'],
]);
assert.deepEqual(c2.map((x) => x.channel), ['c2-reach', 'c2-reach']);
for (const x of [...c1, ...c2]) assert.deepEqual(validate(loadSchema('idea'), x), [], x.id);

// the same feed again: nothing new
assert.deepEqual(ingestFeed(TRENDS, trends, o).added, []);
assert.equal(readJsonl(ideasFile('c1-automation', tmp)).length, 2);

// Reddit (Atom): CDATA and entities decoded, own link kept, only the channel that lists it gets it; an item without a link is skipped
const reddit = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>r/smallbusiness</title>
<entry><title>Typing 200 invoices into Tally every month &#8211; any shortcut?</title><link href="https://www.reddit.com/r/smallbusiness/comments/abc/typing_200_invoices/"/><updated>2026-09-30T10:00:00+00:00</updated>
  <content type="html"><![CDATA[<p>We run a <b>small</b> trading firm &amp; type every bill.</p>]]></content></entry>
<entry><title>No link here</title><updated>2026-09-30T11:00:00+00:00</updated></entry>
<entry><title></title><link href="https://www.reddit.com/r/smallbusiness/comments/def/empty/"/></entry>
</feed>`;
r = ingestFeed(REDDIT, reddit, o);
assert.equal(r.added.length, 1);
assert.deepEqual(r.skipped.length, 2, r.skipped.join(' | '));
const post1 = readJsonl<any>(ideasFile('c1-automation', tmp)).at(-1);
assert.deepEqual([post1.title, post1.summary, post1.source_url, post1.date], ['Typing 200 invoices into Tally every month – any shortcut?', 'We run a small trading firm & type every bill.', 'https://www.reddit.com/r/smallbusiness/comments/abc/typing_200_invoices/', '2026-09-30']);
assert.equal(readJsonl(ideasFile('c2-reach', tmp)).length, 2, 'C2 does not list that subreddit');

// safe failures: unknown feed, not a feed, an empty feed: nothing written
const before = fs.readFileSync(ideasFile('c1-automation', tmp), 'utf8');
assert.throws(() => ingestFeed('https://evil.example/rss', trends, o), /not a feed of any channel/);
assert.throws(() => ingestFeed(TRENDS, '<html>blocked</html>', o), /not an RSS or Atom feed/);
assert.throws(() => ingestFeed(TRENDS, '<rss><channel></channel></rss>', o), /no items/);
assert.equal(fs.readFileSync(ideasFile('c1-automation', tmp), 'utf8'), before);

// a long title is clipped to the schema limit, never rejected for length
const long = parse(`<rss><channel><item><title>${'word '.repeat(80)}</title><link>https://example.in/a</link></item></channel></rss>`, '2026-10-02');
assert.ok(long[0].title.length > 200);
r = ingestFeed(TRENDS, `<rss xmlns:ht="x"><channel><item><title>${'word '.repeat(80)}</title><ht:news_item_url>https://example.in/long</ht:news_item_url></item></channel></rss>`, o);
assert.ok(readJsonl<any>(ideasFile('c1-automation', tmp)).at(-1).title.length <= 200);

// the receiver endpoints n8n uses
assert.deepEqual(JSON.parse(handle('/feeds', 'x'.repeat(16), {paths: p}).body).map((f: {url: string}) => f.url), [TRENDS, REDDIT]);
assert.equal((await post('/feed', JSON.stringify({url: REDDIT, body: reddit}), false, {paths: p, root: tmp})).status, 200);
assert.equal((await post('/feed', '{nope', false, {paths: p, root: tmp})).status, 400);
// {url} only: the Mac fetches the listed feed itself (Reddit refuses the n8n container); fake fetch, no network in tests
const answer = (status: number, body = reddit) => async () => ({status, text: async () => body});
const reddit2 = reddit.replace('abc/typing_200_invoices', 'xyz/second_post');
const pulled = await post('/feed', JSON.stringify({url: REDDIT}), false, {paths: p, root: tmp, fetch: answer(200, reddit2)});
assert.deepEqual([pulled.status, (pulled.body as {added: string[]}).added.length], [200, 1]);
const kept = fs.readFileSync(ideasFile('c1-automation', tmp), 'utf8');
for (const [fetch, why] of [[answer(403), /answered HTTP 403 \(blocked\); nothing written/], [answer(429), /HTTP 429 \(rate limited, try later\)/], [answer(200, '<html>login</html>'), /not an RSS or Atom feed/], [async () => { throw new Error('getaddrinfo ENOTFOUND'); }, /could not fetch .*ENOTFOUND/]] as const) {
  const r = await post('/feed', JSON.stringify({url: REDDIT}), false, {paths: p, root: tmp, fetch});
  assert.equal(r.status, 400);
  assert.match((r.body as {errors: string[]}).errors[0], why);
}
assert.equal(fs.readFileSync(ideasFile('c1-automation', tmp), 'utf8'), kept, 'a blocked feed writes nothing');
let fetched = false;
assert.equal((await post('/feed', JSON.stringify({url: 'https://evil.example/rss'}), false, {paths: p, root: tmp, fetch: async () => ((fetched = true), {status: 200, text: async () => reddit})})).status, 400);
assert.ok(!fetched, 'an unlisted URL is never fetched');
assert.equal((await post('/feed', JSON.stringify({url: 'https://evil.example/rss', body: reddit}), false, {paths: p, root: tmp})).status, 400);
assert.equal((await post('/feed', 'x', true)).status, 413);
// every POST the server receives goes through post(): an unknown route is 404, never the feed handler
assert.equal((await post('/nope', JSON.stringify({url: REDDIT, body: reddit}), false, {paths: p, root: tmp})).status, 404);

fs.rmSync(tmp, {recursive: true});
console.log('feed ok: RSS and Atom items become schema-valid ideas with their own links, per channel, once; the Mac fetches listed feeds only; blocked, unknown and junk feeds write nothing');
