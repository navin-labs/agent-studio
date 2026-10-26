// Trial report: operational outcomes from files the studio already writes, nothing new collected. Reads state/ledger.jsonl (ids,
// channels, statuses, timestamps, video hashes) and the Director's run-ledger.json files (call counts, cost). No titles, captions,
// scripts, links or account names are read or printed. Counts are of what is in those files; an empty window prints "n/a", never 0%.
//   node studio/trial-report.ts [--since 2026-10-01]   (prints JSON)
import fs from 'node:fs';
import path from 'node:path';
import {type LedgerEntry, ledgerFile, PATHS, readJsonl} from './ledger.ts';

export type RunRow = {status: string; total_cost_usd: number; calls: {status: string; cost_source?: string}[]};
export type Report = {
  since: string;
  channels: Record<string, {variants: number; approved: number; dispatched: number; published: number; rejected: number; stuck: number; rerenders: number}>;
  approval_to_dispatch_minutes: {n: number; median: number | null; max: number | null};
  approval_to_publish_rate: number | null; // published-or-dispatched variants / approved variants
  rejection_rate: number | null; // rejected / ever approved
  rerender_rate: number | null; // variants approved for more than one distinct video hash / ever approved
  model: {runs: number; aborted_or_review: number; calls: number; error_calls: number; unknown_cost_calls: number; cost_usd_estimated: number; cost_per_run_usd: number | null; note: string};
  limits: string[];
};
const STUCK_MS = 30 * 60_000;
const ratio = (a: number, b: number) => (b ? Number((a / b).toFixed(3)) : null);

export const summarize = (rows: LedgerEntry[], runs: RunRow[], opts: {since?: string; now?: number} = {}): Report => {
  const since = opts.since ?? '0000-00-00';
  const now = opts.now ?? Date.now();
  const rs = rows.filter((r) => r.updated_at.slice(0, 10) >= since);
  const by = new Map<string, LedgerEntry[]>();
  for (const r of rs) by.set(`${r.storyboard_id}|${r.platform}`, [...(by.get(`${r.storyboard_id}|${r.platform}`) ?? []), r]);
  const channels: Report['channels'] = {};
  const lat: number[] = [];
  let everApproved = 0, rejected = 0, rerenders = 0, sent = 0;
  for (const hist of by.values()) {
    const last = hist.at(-1)!;
    const c = (channels[last.channel] ??= {variants: 0, approved: 0, dispatched: 0, published: 0, rejected: 0, stuck: 0, rerenders: 0});
    c.variants++;
    const approvals = hist.filter((h) => h.status === 'approved' && h.sha256);
    if (approvals.length) {
      everApproved++;
      c.approved++;
      if (new Set(approvals.map((a) => a.sha256)).size > 1) (rerenders++, c.rerenders++);
    }
    if (hist.some((h) => h.status === 'rejected')) (rejected++, c.rejected++);
    if (last.status === 'dispatched' || last.status === 'published') (sent++, c.dispatched++);
    if (last.status === 'published') c.published++;
    if (last.status === 'dispatching' && !last.post_urls?.length && now - Date.parse(last.updated_at) > STUCK_MS) c.stuck++;
    const a = approvals[0]?.approved_at ?? approvals[0]?.updated_at;
    const d = hist.find((h) => h.status === 'dispatching' || h.status === 'dispatched');
    if (a && d) lat.push((Date.parse(d.updated_at) - Date.parse(a)) / 60_000);
  }
  lat.sort((x, y) => x - y);
  const calls = runs.flatMap((r) => r.calls);
  return {
    since,
    channels,
    approval_to_dispatch_minutes: {n: lat.length, median: lat.length ? Number(lat[Math.floor(lat.length / 2)].toFixed(1)) : null, max: lat.length ? Number(lat.at(-1)!.toFixed(1)) : null},
    approval_to_publish_rate: ratio(sent, everApproved),
    rejection_rate: ratio(rejected, everApproved),
    rerender_rate: ratio(rerenders, everApproved),
    model: {
      runs: runs.length,
      aborted_or_review: runs.filter((r) => r.status === 'aborted' || r.status === 'human-review').length,
      calls: calls.length,
      error_calls: calls.filter((c) => c.status === 'error').length,
      unknown_cost_calls: calls.filter((c) => c.cost_source === 'unknown').length, // booked at their budget cap until reconciled
      cost_usd_estimated: Number(runs.reduce((a, r) => a + r.total_cost_usd, 0).toFixed(4)),
      cost_per_run_usd: runs.length ? Number((runs.reduce((a, r) => a + r.total_cost_usd, 0) / runs.length).toFixed(4)) : null,
      note: 'cost is the CLI-reported figure where present, else an over-estimate; per RUN, not per approved video (a run is not tied to an approval)',
    },
    limits: [
      'Needs about four weeks of real posts before any target is meaningful; none are set here.',
      'Views, retention and follower outcomes come from state/metrics.jsonl (Learn), not from this report.',
      'QA first-pass rate and generation success are not in the ledger (only approved videos are); they need render logs.',
    ],
  };
};

export const readRuns = (dir: string): RunRow[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {recursive: true, encoding: 'utf8'}).filter((f) => path.basename(f) === 'run-ledger.json').flatMap((f) => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return Array.isArray(j.calls) && typeof j.total_cost_usd === 'number' ? [j as RunRow] : [];
    } catch {
      return []; // a torn run ledger is skipped, not fatal
    }
  });
};

if (import.meta.main) {
  const since = process.argv.includes('--since') ? process.argv[process.argv.indexOf('--since') + 1] : undefined;
  const rep = summarize(readJsonl<LedgerEntry>(ledgerFile(PATHS)), readRuns(path.join(import.meta.dirname, '../engine/test/out/director')), {since});
  console.log(JSON.stringify(rep, null, 2));
}
