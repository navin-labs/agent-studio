// node studio/learn.test.ts : sample metrics -> scoreboard, bench, proven list, posting times; the real Recipe command reads them.
// Planted pattern: stamp-hit videos do badly, chat-pop videos do well, YouTube at 21:00 does best. Temp folder only.
import assert from 'node:assert';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {BENCH_WEEKS, learn, type Metric, metricsFile, MIN_N, runLearn, UNBENCHABLE} from './learn.ts';
import {fingerprintFile, ledgerFile, type Paths, PATHS} from './ledger.ts';
import type {Fingerprint} from './novelty.ts';
import {FORMATS, generateWeek, type Recipe, toFingerprint} from './recipe.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-test-'));
const p: Paths = {...PATHS, state: path.join(tmp, 'state'), recipes: path.join(tmp, 'recipes')};
fs.mkdirSync(p.state, {recursive: true});
const c1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c1-automation/channel.json'), 'utf8'));
const lines = (f: string, rows: unknown[]) => fs.writeFileSync(f, rows.map((r) => JSON.stringify(r) + '\n').join(''));

// 4 weeks of published C1 videos (planned by the real generator, so they pass the novelty rules)
const topics = ['supplier bills typed by hand', 'invoice reminders chased on whatsapp', 'dispatch updates for customers', 'attendance sheet kept on paper'];
let history: Fingerprint[] = [];
for (const w of ['2026-W37', '2026-W38', '2026-W39', '2026-W40']) history = [...history, ...generateWeek(c1, w, history).map(toFingerprint)];
const fps = history.map((f, i) => ({...f, topic_text: topics[i % 4]}));
const hours = ['18', '19', '20', '21'];
const at = (i: number) => `${fps[i].date}T${hours[i % 4]}:00:00+05:30`;
lines(fingerprintFile(p), fps);
lines(ledgerFile(p), fps.map((f, i) => ({storyboard_id: f.id, channel: f.channel, status: 'published', approved_by: 'navin', approved_at: '2026-09-01T10:00:00Z', targets: ['instagram', 'youtube'], scheduled_for: at(i), updated_at: '2026-09-01T10:00:00Z'})));
const metrics: Metric[] = fps.flatMap((f, i) => {
  const base = f.primitives.includes('stamp-hit') ? 4 : f.primitives.includes('chat-pop') ? 40 : 20;
  const yt = base + (hours[i % 4] === '21' ? 30 : 0);
  return [
    {storyboard_id: f.id, channel: f.channel, platform: 'instagram', window: '24h', reach: 1000, dms: 999, profile_visits: 999}, // superseded by the 7d numbers
    {storyboard_id: f.id, channel: f.channel, platform: 'instagram', window: '7d', reach: 1000, dms: base / 2, profile_visits: base / 2},
    {storyboard_id: f.id, channel: f.channel, platform: 'youtube', window: '7d', reach: 1000, dms: yt / 2, profile_visits: yt / 2},
  ];
});
lines(metricsFile(p), metrics);

const r = runLearn('c1-automation', '2026-W41', p);
const prim = new Map(r.tables.primitive.map((x) => [x.value, x]));
assert.ok(fps.filter((f) => f.primitives.includes('stamp-hit')).length >= MIN_N, 'the sample has enough stamp-hit videos to judge');
assert.ok(r.learned.bench.some((b) => b.primitive === 'stamp-hit'), `stamp-hit benched: ${JSON.stringify(r.learned.bench)}`);
assert.ok(r.learned.bench.every((b) => b.until === '2026-W43'), `bench lasts ${BENCH_WEEKS} weeks`);
assert.ok(r.learned.bench.every((b) => !UNBENCHABLE.has(b.primitive)), 'a beat is never left empty');
assert.ok(r.learned.proven.includes('chat-pop') && !r.learned.proven.includes('stamp-hit'));
assert.ok(prim.get('chat-pop')!.kpi > prim.get('stamp-hit')!.kpi);
assert.ok(prim.get('ui-diff')!.n < MIN_N && !r.learned.proven.includes('ui-diff'), 'too few videos: shown, not judged');
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(p.state, 'learn/posting-times.json'), 'utf8'))['c1-automation'].youtube, '21:00');
const board = fs.readFileSync(path.join(p.state, 'learn/c1-automation/scoreboard.md'), 'utf8');
for (const h of ['## By primitive', '## By theme', '## By hook pattern', '## By topic word', '## By posting hour', 'Bench (until 2026-W43)']) assert.ok(board.includes(h), h);
assert.ok(!board.includes('99.90%'), 'the 24h numbers were replaced by 7d');

// the real Recipe command reads learn.json: benched primitives never appear; the 70% use proven picks, the 30% try something new
const env = {...process.env, STUDIO_STATE: p.state, STUDIO_RECIPES: p.recipes};
const outText = execFileSync(process.execPath, [path.join(ROOT, 'studio/recipe.ts'), 'c1-automation', '2026-W41'], {env, encoding: 'utf8'});
assert.match(outText, /learn: bench .*stamp-hit/);
const week: Recipe[] = JSON.parse(fs.readFileSync(path.join(p.recipes, 'c1-automation/2026-W41.json'), 'utf8'));
const benched = r.learned.bench.map((b) => b.primitive);
assert.ok(week.every((x) => x.primitives.every((q) => !benched.includes(q))), 'no benched primitive in the week');
const beatsOf = (x: Recipe) => (x.primitives[0] === 'host-hook' ? FORMATS.host : FORMATS.composed).beats;
for (const x of week) {
  const beats = beatsOf(x);
  if (x.experiment) assert.ok(x.primitives.some((q, i) => beats[i].length > 1 && !r.learned.proven.includes(q)), `${x.id} experiment tries something unproven`);
  else
    x.primitives.forEach((q, i) => {
      const provenHere = beats[i].filter((b) => r.learned.proven.includes(b) && !benched.includes(b));
      if (provenHere.length && !x.primitives.slice(0, i).some((u) => provenHere.includes(u))) assert.ok(provenHere.includes(q) || beats[i].length === 1 || provenHere.every((b) => x.primitives.includes(b)), `${x.id} beat ${i + 1} uses ${q}, proven options were ${provenHere}`);
    });
}
// benches end: planning two weeks later ignores it
const later = execFileSync(process.execPath, [path.join(ROOT, 'studio/recipe.ts'), 'c1-automation', '2026-W43'], {env, encoding: 'utf8'});
assert.ok(!/learn: bench [^;]*stamp-hit/.test(later), 'the bench expired');

// too little data: nothing judged, no bench, no posting time
const thin = learn('c1-automation', '2026-W41', {metrics: metrics.slice(0, 6), fingerprints: fps, scheduled: new Map(), kpi: c1.kpi});
assert.deepEqual([thin.learned.bench, thin.learned.proven, thin.times], [[], [], {}]);
// bad metrics are refused, not averaged in
fs.appendFileSync(metricsFile(p), JSON.stringify({storyboard_id: 'x', channel: 'c1-automation', platform: 'tiktok', window: '7d', reach: 5}) + '\n');
assert.throws(() => runLearn('c1-automation', '2026-W41', p), /metrics.jsonl line \d+: \$\.platform/);

fs.rmSync(tmp, {recursive: true});
console.log(`learn ok: ${fps.length} sample videos -> bench ${benched.join(', ')}; proven ${r.learned.proven.length}; YouTube best at 21:00; Recipe reads it`);
