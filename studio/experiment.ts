// Title/thumbnail experiments on YouTube (concept from darkzOGx/youtube-automation-agent, MIT; code ours). A published video whose
// storyboard has an arm B (meta.title_b and/or meta.thumb_b, both approved with the video on Telegram) rotates A and B by day,
// then the control (A) is restored and the evidence goes to Navin. Nothing is adopted without his separate "Adopt B" tap.
//
// Days are YouTube Analytics days (US Pacific dates); the publish day is skipped (launch spike). Six days in the order ABBAAB, so
// neither arm gets all the early, stronger days. From day 7 the control is back on.
// Evidence: thumbnail impressions CTR when YouTube reports it for every day (two-proportion z-test, at least MIN_IMPRESSIONS per
// arm); otherwise views per arm, said plainly as "views, not CTR" (Shorts often have no impressions data). Winner only at
// z >= 1.96 (95%) and when B does not lose more than 5% average view percentage. Anything else is "inconclusive".
// Changing a live video's title or thumbnail is an account change: it runs only with EXPERIMENTS=on and a live channel.
//
// node studio/experiment.ts            what would happen now (dry run)
import fs from 'node:fs';
import path from 'node:path';
import {appendJsonl, currentStatus, findVideo, PATHS, type Paths, readJsonl} from './ledger.ts';
import {captionOf, categoryOf, youtubeMeta} from './seo.ts';

export const PATTERN = 'ABBAAB';
export const MIN_IMPRESSIONS = 1000;
const Z95 = 1.96;
const DAY = 24 * 3600_000;

export type Day = {storyboard_id: string; date: string; views: number; impressions?: number; ctr?: number; avg_view_pct?: number};
export type Event = {storyboard_id: string; event: 'apply' | 'result' | 'adopt' | 'keep'; arm?: 'a' | 'b'; at: string; verdict?: string; text?: string};
// description, tags, category: YouTube's title update replaces the whole snippet, so the rest is sent unchanged with it
export type Action = {storyboard_id: string; channel: string; video_id: string; arm: 'a' | 'b'; title: string; thumb: string | null; description: string; tags: string[]; category_id: string};

export const eventsFile = (p: Paths) => path.join(p.state, 'experiments.jsonl');
export const daysFile = (p: Paths) => path.join(p.state, 'experiment-days.jsonl');
export const pacificDate = (ms: number) => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(ms);
const plusDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const between = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);
export const datesOf = (day0: string) => [...PATTERN].map((_, k) => plusDays(day0, k));
export const armOn = (day0: string, date: string): 'a' | 'b' => {
  const k = between(day0, date);
  return k >= 0 && k < PATTERN.length ? (PATTERN[k].toLowerCase() as 'a' | 'b') : 'a';
};

// Published YouTube videos with an arm B: the experiments.
export const experiments = (p: Paths = PATHS) =>
  [...currentStatus(p).values()].flatMap((e) => {
    const id = e.storyboard_id;
    const yt = e.platform === 'youtube' && e.status === 'published' && e.post_urls?.find((u) => u.includes('youtube.com/'));
    const v = yt ? findVideo(id, p) : null;
    const r = v?.variants.youtube;
    const m = v?.doc.meta ?? {};
    if (!v || !r || !(m.title_b || m.thumb_b) || !e.scheduled_for) return [];
    const video_id = (yt as string).match(/(?:shorts\/|v=|youtu\.be\/)([\w-]{11})/)?.[1];
    if (!video_id) return [];
    const title = (arm: 'a' | 'b') => (arm === 'b' && m.title_b) || String(v.doc.caption).split('\n')[0].slice(0, 100);
    const thumb = (arm: 'a' | 'b') => {
      const f = r.file(arm === 'b' && m.thumb_b ? 'thumbnail-b.png' : 'thumbnail.png');
      return fs.existsSync(f) ? f : null;
    };
    const {description, tags} = youtubeMeta(v.doc, captionOf(r.file('caption.txt')));
    return [{id, channel: e.channel, video_id, day0: plusDays(pacificDate(Date.parse(e.scheduled_for)), 1), title, thumb, description, tags, category_id: categoryOf(e.channel)}];
  });

// The evidence for one experiment from its six days of data; null until every day is in.
export const evidence = (days: Day[], day0: string) => {
  const want = datesOf(day0);
  const by = new Map(days.map((d) => [d.date, d]));
  if (!want.every((d) => by.has(d))) return null;
  const sum = (arm: 'a' | 'b', f: (d: Day) => number) => want.filter((d) => armOn(day0, d) === arm).reduce((s, d) => s + f(by.get(d)!), 0);
  const ctrKnown = want.every((d) => by.get(d)!.impressions !== undefined && by.get(d)!.ctr !== undefined);
  const watch = (arm: 'a' | 'b') => sum(arm, (d) => (d.avg_view_pct ?? 0) * d.views) / Math.max(1, sum(arm, (d) => (d.avg_view_pct === undefined ? 0 : d.views)));
  const guard = watch('b') >= watch('a') * 0.95 || !want.some((d) => by.get(d)!.avg_view_pct !== undefined);
  let z: number, basis: string, enough: boolean;
  if (ctrKnown) {
    const [ia, ib] = [sum('a', (d) => d.impressions!), sum('b', (d) => d.impressions!)];
    const [ca, cb] = [sum('a', (d) => d.impressions! * d.ctr!), sum('b', (d) => d.impressions! * d.ctr!)];
    const pool = (ca + cb) / Math.max(1, ia + ib);
    z = ia && ib ? (cb / ib - ca / ia) / Math.sqrt(pool * (1 - pool) * (1 / ia + 1 / ib) || 1) : 0;
    enough = ia >= MIN_IMPRESSIONS && ib >= MIN_IMPRESSIONS;
    basis = `CTR A ${((ca / Math.max(1, ia)) * 100).toFixed(2)}% (${ia} impressions) vs B ${((cb / Math.max(1, ib)) * 100).toFixed(2)}% (${ib})`;
  } else {
    const [va, vb] = [sum('a', (d) => d.views), sum('b', (d) => d.views)];
    z = va + vb ? (vb - va) / Math.sqrt(va + vb) : 0; // equal days per arm: a Poisson rate comparison
    enough = va + vb >= 100;
    basis = `views, not CTR (YouTube gave no impressions data): A ${va} vs B ${vb} over 3 days each`;
  }
  const verdict = !enough ? 'inconclusive' : z >= Z95 && guard ? 'b' : z <= -Z95 ? 'a' : 'inconclusive';
  const why = !enough ? 'not enough data' : verdict === 'b' ? 'B wins at 95%' : verdict === 'a' ? 'A (the control) wins at 95%' : z >= Z95 ? 'B gets more clicks but keeps viewers worse' : 'no difference at 95%';
  return {verdict, z: +z.toFixed(2), text: `${basis}; z ${z.toFixed(2)}: ${why}`};
};

// What the hourly tick should do now: arm switches (and the control restored), and finished results to report once.
export const step = (p: Paths = PATHS, now = Date.now()) => {
  const ev = readJsonl<Event>(eventsFile(p));
  const days = readJsonl<Day>(daysFile(p));
  const today = pacificDate(now);
  const actions: Action[] = [];
  const results: {storyboard_id: string; verdict: string; text: string}[] = [];
  for (const x of experiments(p)) {
    const mine = ev.filter((e) => e.storyboard_id === x.id);
    if (mine.some((e) => e.event === 'keep')) continue; // decided: the control stays
    const adopted = mine.some((e) => e.event === 'adopt'); // decided: B for good (the tick applies it)
    const live = mine.filter((e) => e.event === 'apply').at(-1)?.arm ?? 'a';
    const want = adopted ? 'b' : armOn(x.day0, today);
    if (want !== live) actions.push({storyboard_id: x.id, channel: x.channel, video_id: x.video_id, arm: want, title: x.title(want), thumb: x.thumb(want), description: x.description, tags: x.tags, category_id: x.category_id});
    const done = !adopted && between(x.day0, today) >= PATTERN.length && want === 'a' && live === 'a';
    const r = done && !mine.some((e) => e.event === 'result') ? evidence(days.filter((d) => d.storyboard_id === x.id), x.day0) : null;
    if (r) results.push({storyboard_id: x.id, verdict: r.verdict, text: `${x.id} experiment (control restored): ${r.text}.${r.verdict === 'b' ? ` B: "${x.title('b')}". Adopt B?` : ' Keeping A.'}`});
  }
  return {actions, results};
};

// n8n's stats workflow: which experiment days still need YouTube Analytics numbers (complete Pacific days only).
export const daysDue = (p: Paths = PATHS, now = Date.now()) => {
  const have = new Set(readJsonl<Day>(daysFile(p)).map((d) => `${d.storyboard_id}|${d.date}`));
  const yesterday = plusDays(pacificDate(now), -1);
  return experiments(p).flatMap((x) => {
    const dates = datesOf(x.day0).filter((d) => d <= yesterday && !have.has(`${x.id}|${d}`));
    return dates.length ? [{storyboard_id: x.id, channel: x.channel, video_id: x.video_id, dates}] : [];
  });
};

export const recordDays = (rows: Day[], p: Paths = PATHS) => {
  const errors = rows.flatMap((r, i) => (typeof r?.storyboard_id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r?.date) && Number.isFinite(r?.views) ? [] : [`row ${i + 1}: needs storyboard_id, date (YYYY-MM-DD), views`]));
  if (!errors.length) appendJsonl(daysFile(p), rows);
  return {recorded: errors.length ? 0 : rows.length, errors};
};

export const note = (p: Paths, e: Omit<Event, 'at'>, now = Date.now()) => appendJsonl(eventsFile(p), [{...e, at: new Date(now).toISOString()}]);

// Navin's separate decision after a result: adopt B (the next tick applies it for good) or keep A.
export const decide = (p: Paths, id: string, choice: 'adopt' | 'keep', now = Date.now()) => {
  const ev = readJsonl<Event>(eventsFile(p)).filter((e) => e.storyboard_id === id);
  if (!ev.some((e) => e.event === 'result')) throw new Error(`${id} has no experiment result yet`);
  if (ev.some((e) => e.event === 'adopt' || e.event === 'keep')) throw new Error(`${id} was already decided`);
  note(p, {storyboard_id: id, event: choice}, now);
};

// Apply one arm through the channel's n8n packaging workflow (title + thumbnail). Records the arm only when n8n confirms.
export const apply = async (a: Action, o: {paths?: Paths; fetch?: typeof fetch; base?: string; now?: number} = {}) => {
  const form = new FormData();
  form.set('job', JSON.stringify({storyboard_id: a.storyboard_id, video_id: a.video_id, title: a.title, description: a.description, tags: a.tags, category_id: a.category_id}));
  if (a.thumb) form.set('thumbnail', new Blob([fs.readFileSync(a.thumb)], {type: 'image/png'}), `${a.storyboard_id}-${a.arm}.png`);
  const url = `${o.base ?? process.env.N8N_WEBHOOK_BASE ?? 'http://localhost:5678/webhook'}/agent-studio-packaging-${a.channel}`;
  const r = await (o.fetch ?? fetch)(url, {method: 'POST', body: form});
  if (!r.ok) throw new Error(`${a.storyboard_id}: n8n packaging answered HTTP ${r.status}; arm ${a.arm} not applied`);
  note(o.paths ?? PATHS, {storyboard_id: a.storyboard_id, event: 'apply', arm: a.arm}, o.now);
};

if (import.meta.main) {
  const s = step();
  console.log(`experiments: ${experiments().length}; EXPERIMENTS=${process.env.EXPERIMENTS ?? 'off'} (dry run, nothing applied)`);
  for (const a of s.actions) console.log(`  would apply ${a.storyboard_id} arm ${a.arm}: "${a.title}"`);
  for (const r of s.results) console.log(`  result ${r.text}`);
}
