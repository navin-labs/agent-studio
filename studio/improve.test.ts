// node studio/improve.test.ts : the self-improving loop on planted data, driven by the real hourly tick. Learn finds what wins and
// logs each Tier 1 change with its evidence; the Thursday recipes carry it to the Writer with a plain-words note; Tier 2 proposals
// reach Telegram and change nothing until Navin taps; a tap changes exactly one setting; guarded things are refused; rollback is
// one setting. Planted: stamp-hit loses, question captions win, "DM AUDIT" wins, 20 to 25 s videos win. Temp folder only.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyProposal, decideProposal, grammarFile, proposals, weeklyNote} from './improve.ts';
import {changesFile, learnFile, type Metric, metricsFile, runLearn} from './learn.ts';
import {fingerprintFile, ledgerFile, type Paths, readJsonl} from './ledger.ts';
import type {Fingerprint} from './novelty.ts';
import {generateWeek, planWeek, toFingerprint} from './recipe.ts';
import {tick} from './run.ts';
import {onUpdate, type Tg} from './telegram.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(tmp, 'recipes'), channels: path.join(tmp, 'channels'), queue: path.join(tmp, 'queue')};
for (const d of [p.state, p.content[0], p.out, path.join(p.channels, 'c1-automation')]) fs.mkdirSync(d, {recursive: true});
const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c1-automation/channel.json'), 'utf8'));
const chFile = path.join(p.channels, 'c1-automation', 'channel.json');
fs.writeFileSync(chFile, JSON.stringify({...real, live: true, style: 'c1-night-v0'}, null, 2));
const before = JSON.parse(fs.readFileSync(chFile, 'utf8'));
const lines = (f: string, rows: unknown[]) => fs.writeFileSync(f, rows.map((r) => JSON.stringify(r) + '\n').join(''));

// 4 weeks of published C1 videos in style v0, each with a caption kind, a CTA and a length (independent of each other)
let history: Fingerprint[] = [];
for (const w of ['2026-W37', '2026-W38', '2026-W39', '2026-W40']) history = [...history, ...generateWeek(real, w, history).map(toFingerprint)];
const fps = history.map((f, i) => ({...f, topic_text: `task ${i}`, caption_opener: i % 2 ? 'Still typing bills?' : 'Bills get typed by hand.', cta: i % 3 === 0 ? 'DM AUDIT' : 'Follow', seconds: i % 5 < 2 ? 22 : 38, style: 'c1-night-v0'}));
lines(fingerprintFile(p), fps);
lines(ledgerFile(p), fps.map((f) => ({storyboard_id: f.id, channel: f.channel, platform: 'instagram', status: 'published', approved_by: 'navin', approved_at: '2026-09-01T10:00:00Z', sha256: '0'.repeat(64), scheduled_for: `${f.date}T19:00:00+05:30`, style: f.style, updated_at: '2026-09-01T10:00:00Z'})));
const kpi = (f: (typeof fps)[number]) => (f.primitives.includes('stamp-hit') ? 4 : 20) * (f.caption_opener.endsWith('?') ? 1.5 : 1) * (f.cta === 'DM AUDIT' ? 2 : 1) * (f.seconds < 25 ? 2 : 1);
lines(metricsFile(p), fps.map((f): Metric => ({storyboard_id: f.id, channel: f.channel, platform: 'instagram', window: '7d', reach: 1000, dms: Math.round(kpi(f) * 5), profile_visits: Math.round(kpi(f) * 5)})));
// stamp-hit was rested once before (an earlier Learn run): a second rest makes it a grammar candidate
fs.mkdirSync(path.dirname(changesFile(p)), {recursive: true});
lines(changesFile(p), [{at: '2026-09-10T03:30:00Z', channel: 'c1-automation', tier: 1, what: 'rested stamp-hit until 2026-W39', evidence: 'earlier run'}]);

// the hourly tick on a Thursday (IST): Learn runs (daily), next week is planned with the note, Tier 2 proposals are sent
const msgs: {text: string; buttons: string[]}[] = [];
const tg: Tg = async (method, body: any) => (method === 'sendMessage' && msgs.push({text: body.text, buttons: body.reply_markup?.inline_keyboard?.flat().map((b: {callback_data: string}) => b.callback_data) ?? []}), true);
const THU = Date.parse('2026-10-08T06:00:00Z');
const run = (now: number) => tick({paths: p, now, tg, chatId: '1', watcher: () => null, inbox: path.join(tmp, 'inbox'), live: false});
const r1 = await run(THU);
assert.deepEqual(r1.problems, [], r1.problems.join('\n'));

// Tier 1: machine-readable findings, each change logged once with its evidence
const L = JSON.parse(fs.readFileSync(learnFile('c1-automation', p), 'utf8'));
assert.equal(L.updated, '2026-10-08');
assert.ok(L.scores.primitives.find((x: {primitive: string}) => x.primitive === 'stamp-hit').kpi < L.scores.primitives.find((x: {primitive: string}) => x.primitive === 'flow-run').kpi);
assert.deepEqual(L.scores.styles.map((x: {value: string; n: number}) => [x.value, x.n]), [['c1-night-v0', 28]], 'per-style-version score');
assert.deepEqual([L.guidance.writer.caption, L.guidance.writer.cta, L.guidance.writer.seconds], ['question', 'DM AUDIT', [20, 25]], JSON.stringify(L.guidance));
const changes = readJsonl<{what: string; evidence: string}>(changesFile(p)).slice(1);
for (const want of [/^rested stamp-hit until /, /^Writer guidance: question captions, CTA "DM AUDIT", 20 to 25 s$/]) assert.ok(changes.some((c) => want.test(c.what)), `${want}: ${changes.map((c) => c.what).join(' | ')}`);
assert.ok(changes.every((c) => c.evidence.length > 10), 'every change has its evidence');
assert.deepEqual(runLearn('c1-automation', '2026-W42', p, THU).changes, [], 'the same data changes nothing twice');

// the Thursday recipes: style recorded, Learn's guidance for the Writer, the rested primitive absent, and the plain-words note
const week = JSON.parse(fs.readFileSync(path.join(p.recipes, 'c1-automation', '2026-W42.json'), 'utf8'));
assert.ok(week.every((r: {style: string; guidance: {cta: string}; primitives: string[]}) => r.style === 'c1-night-v0' && r.guidance.cta === 'DM AUDIT' && !r.primitives.includes('stamp-hit')));
const note = msgs.find((m) => m.text.includes('what the system learned'))!.text;
for (const s of ['Changed by itself this week:', '- rested stamp-hit until', 'Why: videos with stamp-hit scored', 'Waiting for your tap:\n- Switch c1-automation to c1-night-signal-v1', 'Testing next:']) assert.ok(note.includes(s), `note: ${s}\n${note}`);

// Tier 2: proposed with before/after evidence and buttons; nothing applied until the tap
const sent = msgs.filter((m) => m.buttons.some((b) => b.startsWith('p|')));
assert.deepEqual(sent.map((m) => m.buttons[0]), ['p|style:c1-automation:c1-night-signal-v1|yes', 'p|grammar:c1-automation:stamp-hit|yes']);
assert.match(sent[0].text, /Now: c1-night-v0: .* over 28 videos\.\nAfter: Night Signal with the folded arrow.*\nLearn expects: Recognised in the first 2 seconds/s);
assert.deepEqual(JSON.parse(fs.readFileSync(chFile, 'utf8')), before, 'nothing applies itself');
await run(THU + 3600_000);
assert.equal(msgs.filter((m) => m.buttons.some((b) => b.startsWith('p|'))).length, 2, 'each proposal is sent once');

// only Navin's tap applies, exactly one setting; "Not now" changes nothing; a decided proposal cannot be decided again
const tap = (data: string, from = 1) => onUpdate(tg, {update_id: 1, callback_query: {id: 'q', data, from: {id: from}, message: {chat: {id: from}}}}, {chatId: '1', secret: 's'.repeat(20), paths: p});
assert.equal(await tap('p|style:c1-automation:c1-night-signal-v1|yes', 2), 'Not allowed.');
assert.equal(JSON.parse(fs.readFileSync(chFile, 'utf8')).style, 'c1-night-v0');
assert.match((await tap('p|style:c1-automation:c1-night-signal-v1|yes'))!, /^Applied: Switch c1-automation to c1-night-signal-v1/);
const after = JSON.parse(fs.readFileSync(chFile, 'utf8'));
assert.deepEqual({...after, style: before.style}, before, 'only "style" changed: voice, live, CTAs, publishers untouched');
assert.equal(after.style, 'c1-night-signal-v1');
assert.match((await tap('p|grammar:c1-automation:stamp-hit|no'))!, /^Not now/);
assert.ok(!fs.existsSync(grammarFile(p, 'c1-automation')));
assert.match((await tap('p|grammar:c1-automation:stamp-hit|yes'))!, /Refused: .*already declined/);
assert.deepEqual(proposals(p).map((x) => x.status), ['approved', 'declined']);

// the next week is planned in the new style; rolling back is the same one setting
const v1 = planWeek('c1-automation', '2026-W43', {recipes: p.recipes, state: p.state, channels: p.channels}).recipes;
assert.ok(v1.every((r) => r.theme === 'night-signal' && r.style === 'c1-night-signal-v1'));
applyProposal(p, {kind: 'style', channel: 'c1-automation', style: 'c1-night-v0'});
assert.ok(planWeek('c1-automation', '2026-W44', {recipes: p.recipes, state: p.state, channels: p.channels}).recipes.every((r) => r.theme === 'night'));

// guarded: nothing but a style or a grammar removal can be applied, and grammar never empties a beat
for (const kind of ['voice', 'live', 'themes', 'disclosure', 'sourcing']) assert.throws(() => applyProposal(p, {kind: kind as never, channel: 'c1-automation'}), /never changes/);
assert.throws(() => applyProposal(p, {kind: 'grammar', channel: 'c1-automation', primitive: 'end-card'}), /last option/);
assert.throws(() => decideProposal(p, 'style:c1-automation:nope', true), /no proposal/);
assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(chFile, 'utf8')).voice), JSON.stringify(real.voice), 'the voice is never touched');
assert.match(weeklyNote(p, 'c1-automation', '2026-W43', v1, THU), /Waiting for your tap: nothing\./);

fs.rmSync(tmp, {recursive: true});
console.log('improve ok: Learn scores primitives, style versions, captions, CTAs and lengths; Tier 1 changes logged once with evidence and carried to the Writer; Tier 2 proposals sent once and applied only by Navin\'s tap, one setting; guarded things refused; rollback is one setting');
