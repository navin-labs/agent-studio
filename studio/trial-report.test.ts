// node studio/trial-report.test.ts : the trial report's arithmetic on a hand-made ledger, and that it reads no content fields.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {type LedgerEntry} from './ledger.ts';
import {readRuns, summarize} from './trial-report.ts';

const e = (id: string, platform: 'youtube' | 'instagram', status: string, at: string, x: Partial<LedgerEntry> = {}): LedgerEntry => ({storyboard_id: id, platform, channel: 'c1-automation', status, updated_at: at, ...x});
const ap = (id: string, platform: 'youtube' | 'instagram', sha: string, at: string) => e(id, platform, 'approved', at, {approved_by: 'navin', approved_at: at, sha256: sha});
const rows = [
  ap('a', 'youtube', 's1', '2026-10-01T10:00:00Z'), e('a', 'youtube', 'dispatching', '2026-10-01T10:30:00Z'), e('a', 'youtube', 'published', '2026-10-01T12:00:00Z'),
  ap('b', 'youtube', 's2', '2026-10-01T10:00:00Z'), e('b', 'youtube', 'rejected', '2026-10-01T11:00:00Z'),
  ap('c', 'youtube', 's3', '2026-10-01T10:00:00Z'), ap('c', 'youtube', 's3b', '2026-10-01T10:20:00Z'), e('c', 'youtube', 'dispatching', '2026-10-01T10:50:00Z'),
  ap('d', 'instagram', 's4', '2026-10-01T10:00:00Z'), e('d', 'instagram', 'dispatched', '2026-10-01T10:10:00Z'),
];
const r = summarize(rows, [], {now: Date.parse('2026-10-02T00:00:00Z')});
assert.deepEqual(r.channels['c1-automation'], {variants: 4, approved: 4, dispatched: 2, published: 1, rejected: 1, stuck: 1, rerenders: 1});
assert.deepEqual([r.approval_to_publish_rate, r.rejection_rate, r.rerender_rate], [0.5, 0.25, 0.25]);
assert.deepEqual(r.approval_to_dispatch_minutes, {n: 3, median: 30, max: 50});
assert.equal(summarize([], []).approval_to_publish_rate, null, 'no data is n/a, never 0%');
assert.equal(summarize(rows, [], {since: '2026-11-01'}).approval_to_publish_rate, null, 'the window filters');
assert.ok(!JSON.stringify(r).match(/navin|s1|http/), 'no approver, hash or link in the output');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trial-test-'));
fs.mkdirSync(path.join(dir, 'x/1'), {recursive: true});
fs.mkdirSync(path.join(dir, 'x/2'), {recursive: true});
fs.writeFileSync(path.join(dir, 'x/1/run-ledger.json'), JSON.stringify({status: 'done', total_cost_usd: 0.1, calls: [{status: 'ok'}, {status: 'error', cost_source: 'unknown'}]}));
fs.writeFileSync(path.join(dir, 'x/2/run-ledger.json'), '{"status": "abor'); // torn
const runs = readRuns(dir);
assert.equal(runs.length, 1, 'a torn run ledger is skipped');
assert.deepEqual([summarize([], runs).model.calls, summarize([], runs).model.error_calls, summarize([], runs).model.cost_per_run_usd], [2, 1, 0.1]);
assert.equal(summarize([], runs).model.unknown_cost_calls, 1, 'unreconciled calls are counted');
fs.rmSync(dir, {recursive: true});
console.log('trial-report ok: per-channel counts, approval-to-dispatch latency, publish/rejection/re-render rates, stuck uploads, model runs and cost; empty windows are n/a; no content fields');
