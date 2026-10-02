// Metrics: the one way post results reach state/metrics.jsonl (read by Learn).
//   Instagram / Facebook: Forge reads insights through its Meta connector and drops JSON files in inbox/metrics/ (one row or an
//   array). ingest() checks each row and appends it; a file with any bad row goes to inbox/metrics/rejected/ with the reason.
//   YouTube: the n8n workflow asks due() (GET /metrics-due on the receiver), reads the video's statistics, and POSTs the rows
//   to /metrics, which calls record().
// A row is accepted only for a video that was actually dispatched, on its own channel and a platform it was sent to.
//
// node studio/metrics.ts ingest     move inbox files into state/metrics.jsonl
// node studio/metrics.ts due        list YouTube readings that are due (24h, 7d after the publish time)
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {metricsFile, type Metric} from './learn.ts';
import {appendJsonl, currentStatus, PATHS, type Paths, readJsonl} from './ledger.ts';

const ROOT = path.join(import.meta.dirname, '..');
export const INBOX = path.join(ROOT, 'inbox', 'metrics');
const WINDOWS = {'24h': 24 * 3600_000, '7d': 7 * 24 * 3600_000} as const;

const rows = (p: Paths): Metric[] => readJsonl<Metric>(metricsFile(p));
const key = (m: Pick<Metric, 'storyboard_id' | 'platform' | 'window'>) => `${m.storyboard_id}|${m.platform}|${m.window}`;

// Why a row cannot be recorded, or null. Untrusted input: schema first, then it must belong to a real dispatched post.
export const problem = (m: unknown, p: Paths = PATHS): string | null => {
  const bad = validate(loadSchema('metrics'), m);
  if (bad.length) return bad.join('; ');
  const r = m as Metric;
  const e = currentStatus(p).get(r.storyboard_id);
  if (!e || !['dispatched', 'published'].includes(e.status)) return `${r.storyboard_id} was never dispatched`;
  if (e.channel !== r.channel) return `${r.storyboard_id} belongs to ${e.channel}, not ${r.channel}`;
  if (!e.targets?.includes(r.platform)) return `${r.storyboard_id} was not sent to ${r.platform}`;
  return null;
};

// All-or-nothing per batch, so a half-bad file never leaves half its rows behind.
export const record = (batch: unknown[], p: Paths = PATHS) => {
  const errors = batch.map((m, i) => problem(m, p) && `row ${i + 1}: ${problem(m, p)}`).filter(Boolean) as string[];
  if (errors.length) return {recorded: 0, errors};
  appendJsonl(metricsFile(p), batch);
  return {recorded: batch.length, errors};
};

export const ingest = (p: Paths = PATHS, inbox = INBOX) => {
  if (!fs.existsSync(inbox)) return {files: 0, recorded: 0, rejected: [] as string[]};
  const files = fs.readdirSync(inbox).filter((f) => f.endsWith('.json')).sort();
  let recorded = 0;
  const rejected: string[] = [];
  for (const f of files) {
    const src = path.join(inbox, f);
    let r: {recorded: number; errors: string[]};
    try {
      const j = JSON.parse(fs.readFileSync(src, 'utf8'));
      r = record(Array.isArray(j) ? j : [j], p);
    } catch (e) {
      r = {recorded: 0, errors: [`not valid JSON: ${(e as Error).message}`]};
    }
    const to = path.join(inbox, r.errors.length ? 'rejected' : 'done');
    fs.mkdirSync(to, {recursive: true});
    fs.renameSync(src, path.join(to, f));
    if (r.errors.length) {
      fs.writeFileSync(path.join(to, f.replace(/\.json$/, '.error.txt')), r.errors.join('\n') + '\n');
      rejected.push(`${f}: ${r.errors.join('; ')}`);
    }
    recorded += r.recorded;
  }
  return {files: files.length, recorded, rejected};
};

// YouTube readings that are due: dispatched with a YouTube URL, published long enough ago, and not yet recorded for that window.
export const due = (p: Paths = PATHS, now = Date.now()) => {
  const have = new Set(rows(p).map(key));
  return [...currentStatus(p).values()].flatMap((e) => {
    const id = e.post_urls?.map((u) => u.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/)?.[1]).find(Boolean);
    const at = Date.parse(e.scheduled_for ?? e.updated_at);
    if (!['dispatched', 'published'].includes(e.status) || !id) return [];
    return (Object.keys(WINDOWS) as (keyof typeof WINDOWS)[])
      .filter((w) => now >= at + WINDOWS[w] && !have.has(key({storyboard_id: e.storyboard_id, platform: 'youtube', window: w})))
      .map((window) => ({storyboard_id: e.storyboard_id, channel: e.channel, platform: 'youtube', window, video_id: id}));
  });
};

if (import.meta.main) {
  const cmd = process.argv[2];
  if (cmd === 'ingest') {
    const r = ingest();
    console.log(`metrics: ${r.files} file(s), ${r.recorded} row(s) recorded${r.rejected.length ? `, rejected:\n  ${r.rejected.join('\n  ')}` : ''}`);
    process.exit(r.rejected.length ? 1 : 0);
  } else if (cmd === 'due') console.log(JSON.stringify(due(), null, 2));
  else {
    console.error('usage: node studio/metrics.ts ingest|due');
    process.exit(2);
  }
}
