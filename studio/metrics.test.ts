// node studio/metrics.test.ts : Forge's inbox files and n8n's YouTube rows reach state/metrics.jsonl only for real dispatched
// posts; bad files are set aside with the reason; YouTube readings come due at 24h and 7d; rows that cannot measure the KPI
// never dilute it. Temp folder only.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {handle} from './approve-server.ts';
import {learn, type Metric, metricsFile} from './learn.ts';
import {ledgerFile, type Paths} from './ledger.ts';
import {due, ingest, record} from './metrics.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [], out: path.join(tmp, 'out'), recipes: path.join(tmp, 'recipes'), channels: path.join(ROOT, 'channels'), queue: path.join(tmp, 'queue')};
const inbox = path.join(tmp, 'inbox');
fs.mkdirSync(p.state, {recursive: true});
fs.mkdirSync(inbox, {recursive: true});

const T = '2026-10-05T19:00:00+05:30';
const t = Date.parse(T);
const H = 3600_000;
const base = {channel: 'c1-automation', approved_by: 'navin', approved_at: T, sha256: '0'.repeat(64), updated_at: T};
fs.writeFileSync(ledgerFile(p), [
  {storyboard_id: 'v1', platform: 'youtube', status: 'dispatched', scheduled_for: T, post_urls: ['https://www.youtube.com/shorts/Q8sNfIm_PMU'], ...base},
  {storyboard_id: 'v1', platform: 'instagram', status: 'dispatched', scheduled_for: T, ...base}, // each platform variant has its own line
  {storyboard_id: 'v2', platform: 'youtube', status: 'approved', ...base},
  {storyboard_id: 'v2', platform: 'instagram', status: 'approved', ...base},
].map((e) => JSON.stringify(e) + '\n').join(''));

const ig = (o: object = {}) => ({storyboard_id: 'v1', channel: 'c1-automation', platform: 'instagram', window: '24h', reach: 1000, sends: 4, dms: 2, profile_visits: 30, ...o});
const drop = (name: string, body: string) => fs.writeFileSync(path.join(inbox, name), body);
const lines = () => (fs.existsSync(metricsFile(p)) ? fs.readFileSync(metricsFile(p), 'utf8').trim().split('\n').filter(Boolean) : []);

// Forge's inbox: good file in, bad files out with the reason, nothing half-written
drop('a-good.json', JSON.stringify(ig()));
drop('b-never-sent.json', JSON.stringify(ig({storyboard_id: 'v2'})));
drop('c-mixed.json', JSON.stringify([ig({window: '7d'}), ig({platform: 'tiktok'})]));
drop('d-broken.json', '{"storyboard_id": ');
drop('e-wrong-channel.json', JSON.stringify(ig({channel: 'c2-reach'})));
drop('f-not-sent-there.json', JSON.stringify(ig({platform: 'facebook'})));
const r = ingest(p, inbox);
assert.deepEqual([r.files, r.recorded, r.rejected.length], [6, 1, 5]);
assert.equal(lines().length, 1, 'only the good row, none of the mixed batch');
assert.deepEqual(fs.readdirSync(path.join(inbox, 'done')), ['a-good.json']);
const why = (f: string) => fs.readFileSync(path.join(inbox, 'rejected', f), 'utf8');
assert.match(why('b-never-sent.error.txt'), /v2 was never dispatched/);
assert.match(why('c-mixed.error.txt'), /row 2: .*platform/);
assert.match(why('d-broken.error.txt'), /not valid JSON/);
assert.match(why('e-wrong-channel.error.txt'), /belongs to c1-automation, not c2-reach/);
assert.match(why('f-not-sent-there.error.txt'), /v1 was never dispatched to facebook/, 'the Facebook variant never went out');
assert.deepEqual(fs.readdirSync(inbox).filter((f) => f.endsWith('.json')), [], 'the inbox is emptied');

// YouTube readings come due at 24h and 7d after publishing, once each
assert.deepEqual(due(p, t + H), []);
assert.deepEqual(due(p, t + 25 * H), [{storyboard_id: 'v1', channel: 'c1-automation', platform: 'youtube', window: '24h', video_id: 'Q8sNfIm_PMU'}]);
assert.equal(JSON.parse(handle('/metrics-due', 'x'.repeat(16), {paths: p, now: t + 25 * H}).body).length, 1, 'the receiver answers n8n');
assert.deepEqual(record([{storyboard_id: 'v1', channel: 'c1-automation', platform: 'youtube', window: '24h', reach: 900, views: 900}], p).errors, []);
assert.deepEqual(due(p, t + 25 * H), [], 'recorded: no longer due');
assert.deepEqual(due(p, t + 8 * 24 * H).map((d) => d.window), ['7d']);

// Learn: the YouTube row (views only) cannot measure DMs + profile visits, so it is not pooled into the KPI
const fp = {id: 'v1', channel: 'c1-automation', date: '2026-10-05', primitives: ['split-flap', 'end-card'], opening: 'split-flap', theme: 'paper', hook_pattern: 'number', hash: 'x'};
const metrics = lines().map((l) => JSON.parse(l) as Metric);
const kpi = {numerator: ['dms', 'profile_visits'], denominator: 'reach'};
const k = learn('c1-automation', '2026-W42', {metrics, fingerprints: [fp], scheduled: new Map(), kpi}).tables.primitive[0].kpi;
assert.equal(k, 32 / 1000, `KPI from Instagram only, got ${k}`);

fs.rmSync(tmp, {recursive: true});
console.log('metrics ok: inbox rows land only for dispatched posts, bad files are set aside with the reason; YouTube due at 24h and 7d; views-only rows never dilute the KPI');
