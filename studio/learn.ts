// Learn: closes the loop. Joins post metrics to each approved video's fingerprint and ledger line, scores the channel KPI by
// primitive, theme, hook pattern, topic word and posting hour, then writes what next week's Recipe and Dispatch read:
//   state/learn/<channel>/learn.json   bench (bottom quartile, 2 weeks), proven primitives, missing-kind hint
//   state/learn/<channel>/scoreboard.md
//   state/learn/posting-times.json     best hour per channel and platform (IST)
// Suggests only; never changes rules (agents/learn/RULES.md).
//
// node studio/learn.ts <channel> <YYYY-Www>   (the week being planned)
import fs from 'node:fs';
import path from 'node:path';
import {SPECS} from '../engine/src/primitives/specs.ts';
import {loadSchema, validate} from '../schemas/validate.ts';
import {currentStatus, PATHS, type Paths, readFingerprints} from './ledger.ts';
import {addDays, type Fingerprint, isoWeek, weekStart} from './novelty.ts';
import {FORMATS} from './recipe.ts';

export const MIN_N = 3; // never judge on fewer videos than this
export const BENCH_WEEKS = 2;
const STOP = new Set('a an and are as at be by can do for from how in is it its of on or the this to with you your not no every one'.split(' '));

export type Metric = {storyboard_id: string; channel: string; platform: string; window: '24h' | '7d'; [k: string]: number | string};
export type Kpi = {numerator: string[]; denominator: string};
export type Row = {value: string; n: number; kpi: number};
export type Learned = {channel: string; week: string; videos: number; bench: {primitive: string; until: string}[]; proven: string[]; hint: string | null};

// A primitive that is the only choice in some beat can never be benched: the format would have nothing to draw.
export const UNBENCHABLE = new Set(Object.values(FORMATS).flatMap((f) => f.beats.filter((b) => b.length === 1).flat()));

// Per video and platform: the 7d window when present, else 24h. Totals pool across platforms.
const latest = (ms: Metric[]) => {
  const best = new Map<string, Metric>();
  for (const m of ms) {
    const k = `${m.storyboard_id}|${m.platform}`;
    if (!best.has(k) || (m.window === '7d' && best.get(k)!.window === '24h')) best.set(k, m);
  }
  return [...best.values()];
};

// Pooled KPI over a group of videos: sum of numerators / sum of denominators (big posts weigh more, as they should).
const score = (ms: Metric[], k: Kpi) => {
  const den = ms.reduce((a, m) => a + Number(m[k.denominator] ?? 0), 0);
  return den ? ms.reduce((a, m) => a + k.numerator.reduce((b, f) => b + Number(m[f] ?? 0), 0), 0) / den : 0;
};

export const table = (groups: Map<string, Metric[]>, k: Kpi, videosOf: (ms: Metric[]) => number): Row[] =>
  [...groups].map(([value, ms]) => ({value, n: videosOf(ms), kpi: score(ms, k)})).sort((a, b) => b.kpi - a.kpi || a.value.localeCompare(b.value));

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};

export const learn = (channel: string, week: string, input: {metrics: Metric[]; fingerprints: Fingerprint[]; scheduled: Map<string, string>; kpi: Kpi}) => {
  const fp = new Map(input.fingerprints.filter((f) => f.channel === channel).map((f) => [f.id, f]));
  const ms = latest(input.metrics.filter((m) => m.channel === channel && fp.has(m.storyboard_id)));
  const videosOf = (xs: Metric[]) => new Set(xs.map((m) => m.storyboard_id)).size;
  const by = (key: (f: Fingerprint, m: Metric) => string[]) => {
    const g = new Map<string, Metric[]>();
    for (const m of ms) for (const v of new Set(key(fp.get(m.storyboard_id)!, m))) g.set(v, [...(g.get(v) ?? []), m]);
    return table(g, input.kpi, videosOf);
  };
  const words = (t = '') => t.toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !STOP.has(w)) ?? [];
  const hourOf = (m: Metric) => {
    const s = input.scheduled.get(m.storyboard_id);
    return s ? [`${m.platform} ${s.slice(11, 13)}:00`] : [];
  };
  const tables = {
    primitive: by((f) => f.primitives),
    theme: by((f) => [f.theme]),
    'hook pattern': by((f) => [f.hook_pattern]),
    'topic word': by((f) => words(f.topic_text)).filter((r) => r.n >= 2),
    'posting hour': by((f, m) => hourOf(m)),
  };

  const judged = tables.primitive.filter((r) => r.n >= MIN_N);
  const cut = judged.length >= 4 ? quantile(judged.map((r) => r.kpi), 0.25) : -Infinity;
  const mid = judged.length ? quantile(judged.map((r) => r.kpi), 0.5) : Infinity;
  const until = isoWeek(addDays(weekStart(week), 7 * BENCH_WEEKS));
  const bench = judged.filter((r) => r.kpi < cut && !UNBENCHABLE.has(r.value)).map((r) => ({primitive: r.value, until}));
  const proven = judged.filter((r) => r.kpi >= mid).map((r) => r.value);

  // Missing kind: the family that scores best per video but has the fewest primitives to draw from.
  const fam = new Map<string, Metric[]>();
  for (const m of ms) for (const p of new Set(fp.get(m.storyboard_id)!.primitives)) fam.set(SPECS[p].family, [...(fam.get(SPECS[p].family) ?? []), m]);
  const count = (f: string) => Object.values(SPECS).filter((s) => s.family === f && s.channels.includes(channel as never)).length;
  const fams = table(fam, input.kpi, videosOf).filter((r) => r.n >= MIN_N);
  const top = fams[0];
  const hint = top && fams.length > 1 && count(top.value) <= Math.min(...fams.map((r) => count(r.value))) ? `${top.value} scores best (${pct(top.kpi)}) and has only ${count(top.value)} primitive(s) for this channel: build another ${top.value} primitive` : null;

  const times: Record<string, string> = {};
  for (const plat of ['youtube', 'instagram']) {
    const best = tables['posting hour'].filter((r) => r.value.startsWith(plat) && r.n >= MIN_N)[0];
    if (best) times[plat] = best.value.split(' ')[1];
  }
  const out: Learned = {channel, week, videos: videosOf(ms), bench, proven, hint};
  return {learned: out, tables, times};
};

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
export const scoreboard = (r: ReturnType<typeof learn>) =>
  [
    `# ${r.learned.channel} scoreboard, planning ${r.learned.week}`,
    `${r.learned.videos} videos with metrics. KPI is pooled over each group; rows with fewer than ${MIN_N} videos are shown but not judged.`,
    '',
    ...Object.entries(r.tables).flatMap(([name, rows]) => [`## By ${name}`, '| value | videos | KPI |', '|---|---|---|', ...rows.map((x) => `| ${x.value} | ${x.n} | ${pct(x.kpi)} |`), '']),
    '## Decisions for the week',
    `- Bench (until ${r.learned.bench[0]?.until ?? '-'}): ${r.learned.bench.map((b) => b.primitive).join(', ') || 'none'}`,
    `- Proven (the 70%): ${r.learned.proven.join(', ') || 'not enough data yet'}`,
    `- Posting times: ${Object.entries(r.times).map(([k, v]) => `${k} ${v}`).join(', ') || 'default until enough data'}`,
    `- Missing kind: ${r.learned.hint ?? 'none flagged'}`,
    '',
  ].join('\n');

const readLines = <T,>(f: string): T[] => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
export const metricsFile = (p: Paths) => path.join(p.state, 'metrics.jsonl');
export const learnFile = (channel: string, p: Paths) => path.join(p.state, 'learn', channel, 'learn.json');

// Only the scheduled time of dispatched/published videos counts toward posting hours.
export const scheduledTimes = (p: Paths) => new Map([...currentStatus(p)].filter(([, e]) => e.scheduled_for).map(([id, e]) => [id, e.scheduled_for!]));

export const runLearn = (channel: string, week: string, p: Paths = PATHS) => {
  const ch = JSON.parse(fs.readFileSync(path.join(p.channels, channel, 'channel.json'), 'utf8'));
  const schema = loadSchema('metrics');
  const metrics = readLines<Metric>(metricsFile(p));
  metrics.forEach((m, i) => {
    const bad = validate(schema, m);
    if (bad.length) throw new Error(`state/metrics.jsonl line ${i + 1}: ${bad.join('; ')}`);
  });
  const r = learn(channel, week, {metrics, fingerprints: readFingerprints(p), scheduled: scheduledTimes(p), kpi: ch.kpi});
  const dir = path.dirname(learnFile(channel, p));
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(learnFile(channel, p), JSON.stringify(r.learned, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'scoreboard.md'), scoreboard(r));
  const tf = path.join(p.state, 'learn', 'posting-times.json');
  const all = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, 'utf8')) : {};
  if (Object.keys(r.times).length) all[channel] = r.times;
  else delete all[channel];
  fs.writeFileSync(tf, JSON.stringify(all, null, 2) + '\n');
  return r;
};

if (import.meta.main) {
  const [channel, week] = process.argv.slice(2);
  if (!channel || !/^\d{4}-W\d{2}$/.test(week ?? '')) {
    console.error('usage: node studio/learn.ts <channel> <YYYY-Www>');
    process.exit(2);
  }
  const r = runLearn(channel, week);
  console.log(scoreboard(r).split('## Decisions for the week')[1].trim());
  console.log(`-> state/learn/${channel}/scoreboard.md, learn.json; state/learn/posting-times.json`);
}
