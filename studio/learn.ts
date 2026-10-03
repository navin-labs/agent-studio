// Learn: closes the loop. Joins post metrics to each approved video's fingerprint and ledger line, scores the channel KPI by
// primitive, style version, theme, hook pattern, caption kind, CTA, length, topic word and posting hour, then writes what next
// week's Recipe, the Writer and Dispatch read (Tier 1, applied without a tap; docs/TECH.md "Self-improving loop"):
//   state/learn/<channel>/learn.json   findings: bench (bottom quartile, 2 weeks), proven primitives, retention holds/leaks, scores
//                                      per primitive and style version, hook preference and Writer guidance (only with evidence)
//   state/learn/changes.jsonl          every Tier 1 change Learn made, with its evidence (the weekly note reads it)
//   state/learn/<channel>/scoreboard.md
//   state/learn/posting-times.json     best hour per channel and platform (IST)
// Suggests only; never changes rules (agents/learn/RULES.md).
//
// node studio/learn.ts <channel> <YYYY-Www>   (the week being planned)
import fs from 'node:fs';
import path from 'node:path';
import {SPECS} from '../engine/src/primitives/specs.ts';
import {loadSchema, validate} from '../schemas/validate.ts';
import {appendJsonl, currentStatus, findVideo, PATHS, type Paths, readFingerprints, readJsonl} from './ledger.ts';
import {addDays, type Fingerprint, isoWeek, weekStart} from './novelty.ts';
import {FORMATS, type Guidance} from './recipe.ts';
import {relativeHolds, sceneHolds, type Span} from './retention.ts';

export const MIN_N = 3; // never judge on fewer videos than this
export const BENCH_WEEKS = 2;
const STOP = new Set('a an and are as at be by can do for from how in is it its of on or the this to with you your not no every one'.split(' '));

export type Metric = {storyboard_id: string; channel: string; platform: string; window: '24h' | '7d'; retention?: number[]; [k: string]: number | string | number[] | undefined};
export type Kpi = {numerator: string[]; denominator: string};
export type Row = {value: string; n: number; kpi: number};
export type Learned = {
  channel: string;
  week: string;
  updated?: string; // the IST date Learn last ran (it runs daily)
  videos: number;
  bench: {primitive: string; until: string}[];
  proven: string[];
  hint: string | null;
  retention: {holds: string[]; leaks: string[]};
  scores?: {primitives: {primitive: string; n: number; kpi: number; retention?: number; retention_n?: number}[]; styles: Row[]; hooks: Row[]; captions: Row[]; ctas: Row[]; lengths: Row[]; slots: Row[]};
  guidance?: {hooks: string[]; writer: Guidance | null};
};
// A winner needs MIN_N videos, a runner-up with MIN_N too, and a lead of at least 10%: anything less is noise, not a finding.
export const winner = (rows: Row[]) => {
  const [a, b] = rows.filter((r) => r.n >= MIN_N);
  return a && b && a.kpi >= b.kpi * 1.1 && a.kpi > 0 ? {...a, evidence: `${a.value} ${pct(a.kpi)} over ${a.n} videos vs ${b.value} ${pct(b.kpi)} over ${b.n}`} : null;
};
const captionKind = (opener = '') => (/\?\s*$/.test(opener) ? 'question' : /\d/.test(opener) ? 'number' : 'statement');
const lengthBand = (s?: number) => (s ? `${Math.floor(s / 5) * 5} to ${Math.floor(s / 5) * 5 + 5} s` : '');

// A primitive that is the only choice in some beat can never be benched: the format would have nothing to draw.
export const UNBENCHABLE = new Set(Object.values(FORMATS).flatMap((f) => f.beats.filter((b) => b.length === 1).flat()));

// Per video and platform: the 7d window when present, else 24h; a later reading of the same window replaces an earlier one.
const latest = (ms: Metric[]) => {
  const best = new Map<string, Metric>();
  for (const m of ms) {
    const k = `${m.storyboard_id}|${m.platform}`;
    if (!best.has(k) || !(best.get(k)!.window === '7d' && m.window === '24h')) best.set(k, m);
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

export const learn = (channel: string, week: string, input: {metrics: Metric[]; fingerprints: Fingerprint[]; scheduled: Map<string, string>; kpi: Kpi; spans?: (id: string) => Span[] | null}) => {
  const fp = new Map(input.fingerprints.filter((f) => f.channel === channel).map((f) => [f.id, f]));
  // a row counts only if it measures the KPI at all (YouTube's basic stats have no DMs or follows: they must not dilute it)
  const ms = latest(input.metrics.filter((m) => m.channel === channel && fp.has(m.storyboard_id) && input.kpi.numerator.some((f) => m[f] !== undefined)));
  const videosOf = (xs: Metric[]) => new Set(xs.map((m) => m.storyboard_id)).size;
  const by = (key: (f: Fingerprint, m: Metric) => string[]) => {
    const g = new Map<string, Metric[]>();
    for (const m of ms) for (const v of new Set(key(fp.get(m.storyboard_id)!, m))) g.set(v, [...(g.get(v) ?? []), m]);
    return table(g, input.kpi, videosOf);
  };
  const words = (t = '') => t.toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !STOP.has(w)) ?? [];
  const hourOf = (m: Metric) => {
    const s = input.scheduled.get(`${m.storyboard_id}|${m.platform}`);
    return s ? [`${m.platform} ${s.slice(11, 13)}:00`] : [];
  };
  const tables = {
    primitive: by((f) => f.primitives),
    theme: by((f) => [f.theme]),
    'hook pattern': by((f) => [f.hook_pattern]),
    'topic word': by((f) => words(f.topic_text)).filter((r) => r.n >= 2),
    'posting hour': by((f, m) => hourOf(m)),
    'style version': by((f) => (f.style ? [f.style] : [])),
    'caption kind': by((f) => [captionKind(f.caption_opener)]),
    cta: by((f) => (f.cta ? [f.cta] : [])),
    length: by((f) => (f.seconds ? [lengthBand(f.seconds)] : [])),
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
  // Scene retention (YouTube): which primitives hold viewers and which lose them, against the average at the same scene position.
  // Holds are preferred and leaks kept out of the opening shot by next week's Recipe; judged only from MIN_N videos.
  const curves = latest(input.metrics.filter((m) => m.channel === channel && fp.has(m.storyboard_id) && Array.isArray(m.retention)));
  const holdsByVideo = curves.map((m) => sceneHolds(m.retention!, input.spans?.(m.storyboard_id) ?? [])).filter((h) => h.length);
  const rel = relativeHolds(holdsByVideo);
  const judgedRel = rel.filter((r) => r.n >= MIN_N);
  const lo = judgedRel.length >= 4 ? quantile(judgedRel.map((r) => r.rel), 0.25) : -Infinity;
  const hi = judgedRel.length >= 4 ? quantile(judgedRel.map((r) => r.rel), 0.75) : Infinity;
  const retention = {holds: judgedRel.filter((r) => r.rel >= hi && r.rel > 1).map((r) => r.primitive), leaks: judgedRel.filter((r) => r.rel <= lo && r.rel < 1).map((r) => r.primitive)};

  // Writer guidance (Tier 1, within the approved style): only what has a winner
  const ev: string[] = [];
  const cap = winner(tables['caption kind']);
  const cta = winner(tables.cta);
  const len = winner(tables.length);
  if (cap) ev.push(`caption: ${cap.evidence}`);
  if (cta) ev.push(`cta: ${cta.evidence}`);
  if (len) ev.push(`length: ${len.evidence}`);
  const writer: Guidance | null = ev.length ? {...(cap ? {caption: cap.value} : {}), ...(cta ? {cta: cta.value} : {}), ...(len ? {seconds: len.value.split(' to ').map((x) => parseInt(x)) as [number, number]} : {}), evidence: ev} : null;
  const hooksJudged = tables['hook pattern'].filter((r) => r.n >= MIN_N);
  const hooks = hooksJudged.length >= 2 ? hooksJudged.filter((r) => r.kpi >= quantile(hooksJudged.map((x) => x.kpi), 0.5)).map((r) => r.value) : [];
  const retBy = new Map(rel.map((r) => [r.primitive, r]));
  const scores = {
    primitives: tables.primitive.map((r) => ({primitive: r.value, n: r.n, kpi: r.kpi, ...(retBy.has(r.value) ? {retention: +retBy.get(r.value)!.rel.toFixed(3), retention_n: retBy.get(r.value)!.n} : {})})),
    styles: tables['style version'], hooks: tables['hook pattern'], captions: tables['caption kind'], ctas: tables.cta, lengths: tables.length, slots: tables['posting hour'],
  };
  const out: Learned = {channel, week, videos: videosOf(ms), bench, proven, hint, retention, scores, guidance: {hooks, writer}};
  return {learned: out, tables, times, rel, cut, kpiName: `${input.kpi.numerator.join(' + ')} per ${input.kpi.denominator}`};
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
    `- Retention holds (preferred): ${r.learned.retention.holds.join(', ') || 'not enough data yet'}`,
    `- Retention leaks (not as the opener): ${r.learned.retention.leaks.join(', ') || 'none'}`,
    '',
    '## Scene retention (YouTube; 1.00 = the channel average at that scene position)',
    '| primitive | videos | relative hold |',
    '|---|---|---|',
    ...r.rel.map((x) => `| ${x.primitive} | ${x.n} | ${x.rel.toFixed(2)} |`),
    '',
  ].join('\n');

export const metricsFile = (p: Paths) => path.join(p.state, 'metrics.jsonl');
export const guidanceWords = (w: Guidance) => [w.caption && `${w.caption} captions`, w.cta && `CTA "${w.cta}"`, w.seconds && `${w.seconds[0]} to ${w.seconds[1]} s`].filter(Boolean).join(', ');
export const changesFile = (p: Paths) => path.join(p.state, 'learn', 'changes.jsonl');
export type Change = {at: string; channel: string; tier: 1; what: string; evidence: string};

// Tier 1: what Learn changed since its last run, in plain words with the evidence (appended to changes.jsonl; the weekly note
// reads it). Comparing findings, not re-deciding: running Learn twice on the same data logs nothing the second time.
export const changesBetween = (prev: Partial<Learned> | null, r: ReturnType<typeof learn>, prevTimes: Record<string, string>, at: string): Change[] => {
  const ch = r.learned.channel;
  const out: Change[] = [];
  const add = (what: string, evidence: string) => out.push({at, channel: ch, tier: 1, what, evidence});
  const row = (p: string) => r.tables.primitive.find((x) => x.value === p);
  const rel = (p: string) => r.rel.find((x) => x.primitive === p);
  const was = new Set((prev?.bench ?? []).map((b) => b.primitive));
  for (const b of r.learned.bench) if (!was.has(b.primitive)) add(`rested ${b.primitive} until ${b.until}`, `videos with ${b.primitive} scored ${pct(row(b.primitive)!.kpi)} (${r.kpiName}) over ${row(b.primitive)!.n} videos, in the channel's weakest quarter (below ${pct(r.cut)})`);
  for (const p of was) if (!r.learned.bench.some((b) => b.primitive === p)) add(`${p} back in rotation`, 'its two-week rest ended');
  for (const [key, verb] of [['holds', 'prefers'], ['leaks', 'keeps out of the opening shot']] as const) {
    const before = new Set(prev?.retention?.[key] ?? []);
    for (const p of r.learned.retention[key]) if (!before.has(p)) add(`${verb} ${p}`, `${p} keeps ${rel(p)!.rel.toFixed(2)} of the viewers the channel keeps at the same scene, over ${rel(p)!.n} videos`);
    for (const p of before) if (!r.learned.retention[key].includes(p)) add(`no longer ${verb} ${p}`, 'its retention moved back toward the channel average');
  }
  const hooks = r.learned.guidance?.hooks ?? [];
  if (hooks.join() !== (prev?.guidance?.hooks ?? []).join() && hooks.length) add(`prefers hook patterns ${hooks.join(', ')}`, r.tables['hook pattern'].filter((x) => x.n >= MIN_N).map((x) => `${x.value} ${pct(x.kpi)} (${x.n})`).join(', '));
  const w = r.learned.guidance?.writer;
  if (JSON.stringify(w ?? null) !== JSON.stringify(prev?.guidance?.writer ?? null) && w) add(`Writer guidance: ${guidanceWords(w)}`, w.evidence.join('; '));
  for (const [plat, time] of Object.entries(r.times)) if (prevTimes[plat] !== time) add(`posts ${plat} at ${time} IST${prevTimes[plat] ? ` (was ${prevTimes[plat]})` : ''}`, r.tables['posting hour'].filter((x) => x.value.startsWith(plat) && x.n >= MIN_N).slice(0, 2).map((x) => `${x.value} ${pct(x.kpi)} (${x.n})`).join(' vs '));
  return out;
};
export const learnFile = (channel: string, p: Paths) => path.join(p.state, 'learn', channel, 'learn.json');

// Only the scheduled time of dispatched/published videos counts toward posting hours.
// keyed lkey(id, platform): each platform variant has its own slot
export const scheduledTimes = (p: Paths) => new Map([...currentStatus(p)].filter(([, e]) => e.scheduled_for).map(([k, e]) => [k, e.scheduled_for!]));

export const runLearn = (channel: string, week: string, p: Paths = PATHS, now = Date.now()) => {
  const ch = JSON.parse(fs.readFileSync(path.join(p.channels, channel, 'channel.json'), 'utf8'));
  const schema = loadSchema('metrics');
  const metrics = readJsonl<Metric>(metricsFile(p));
  metrics.forEach((m, i) => {
    const bad = validate(schema, m);
    if (bad.length) throw new Error(`state/metrics.jsonl line ${i + 1}: ${bad.join('; ')}`);
  });
  // each render's scene spans (the YouTube variant's render.json), for mapping YouTube retention onto scenes
  const spans = (id: string) => {
    const f = findVideo(id, p)?.variants.youtube?.file('render.json'); // YouTube's retention maps onto the YouTube variant's scenes
    return f && fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).scenes ?? null) : null;
  };
  const r = learn(channel, week, {metrics, fingerprints: readFingerprints(p), scheduled: scheduledTimes(p), kpi: ch.kpi, spans});
  const dir = path.dirname(learnFile(channel, p));
  fs.mkdirSync(dir, {recursive: true});
  const prev: Learned | null = fs.existsSync(learnFile(channel, p)) ? JSON.parse(fs.readFileSync(learnFile(channel, p), 'utf8')) : null;
  const tf = path.join(p.state, 'learn', 'posting-times.json');
  const all = fs.existsSync(tf) ? JSON.parse(fs.readFileSync(tf, 'utf8')) : {};
  const changes = changesBetween(prev, r, all[channel] ?? {}, new Date(now).toISOString());
  r.learned.updated = new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
  fs.writeFileSync(learnFile(channel, p), JSON.stringify(r.learned, null, 2) + '\n');
  appendJsonl(changesFile(p), changes);
  fs.writeFileSync(path.join(dir, 'scoreboard.md'), scoreboard(r));
  // only platforms with evidence change; a time set by hand (no data yet) stays until Learn has better
  if (Object.keys(r.times).length) all[channel] = {...all[channel], ...r.times};
  fs.writeFileSync(tf, JSON.stringify(all, null, 2) + '\n');
  return {...r, changes};
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
