// node studio/run.test.ts : the hourly tick touches only live channels, plans next week once on Thursday, files metrics,
// shows each QA-passed video on Telegram once, and reports problems without stopping. Fake Telegram, temp folder.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ledgerFile, type Paths} from './ledger.ts';
import {tick} from './run.ts';
import type {Tg} from './telegram.ts';

const ROOT = path.join(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'run-test-'));
const p: Paths = {state: path.join(tmp, 'state'), content: [path.join(tmp, 'content')], out: path.join(tmp, 'out'), recipes: path.join(tmp, 'recipes'), channels: path.join(tmp, 'channels')};
for (const c of ['c1-automation', 'c2-reach', 'c3-studio']) {
  const ch = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels', c, 'channel.json'), 'utf8'));
  fs.mkdirSync(path.join(p.channels, c), {recursive: true});
  fs.writeFileSync(path.join(p.channels, c, 'channel.json'), JSON.stringify({...ch, live: c === 'c1-automation'}));
}
// this week's (W40) video: written, rendered, QA passed
fs.mkdirSync(path.join(p.recipes, 'c1-automation'), {recursive: true});
fs.copyFileSync(path.join(ROOT, 'studio/fixtures/recipes/host-supplier-bills.json'), path.join(p.recipes, 'c1-automation', '2026-W40.json'));
fs.mkdirSync(p.content[0], {recursive: true});
fs.copyFileSync(path.join(ROOT, 'engine/content/storyboards/host-supplier-bills.json'), path.join(p.content[0], 'host-supplier-bills.json'));
const out = path.join(p.out, 'host-supplier-bills');
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'reel.mp4'), 'video');
fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify({storyboard_id: 'host-supplier-bills', pass: true, checks: []}));
fs.mkdirSync(p.state, {recursive: true});

const calls: {method: string; body: any}[] = [];
const tg: Tg = async (method, body) => (calls.push({method, body}), true);
const texts = () => calls.filter((c) => c.method === 'sendMessage').map((c) => c.body.text as string);
const THU = Date.parse('2026-10-01T04:00:00Z'); // Thursday 09:30 IST, week 2026-W40
const o = {paths: p, tg, chatId: '111', inbox: path.join(tmp, 'inbox')};

// Thursday: next week planned for the live channel only, Navin told; this week's video shown once
let r = await tick({...o, now: THU});
assert.deepEqual(r.problems, []);
assert.ok(fs.existsSync(path.join(p.recipes, 'c1-automation', '2026-W41.json')), 'C1 W41 planned');
assert.ok(!fs.existsSync(path.join(p.recipes, 'c2-reach')) && !fs.existsSync(path.join(p.recipes, 'c3-studio')), 'channels that are not live are not touched');
assert.ok(fs.existsSync(path.join(p.state, 'learn', 'c1-automation', 'learn.json')), 'Learn ran before planning');
assert.match(texts()[0], /c1-automation 2026-W41: 7 recipes are ready/);
assert.equal(calls.filter((c) => c.method === 'sendVideo').length, 1);

// the next hour: nothing repeats (no replan, no resend)
const before = fs.readFileSync(path.join(p.recipes, 'c1-automation', '2026-W41.json'), 'utf8');
calls.length = 0;
r = await tick({...o, now: THU + 3600_000});
assert.deepEqual([calls.length, r.problems], [0, []]);
assert.equal(fs.readFileSync(path.join(p.recipes, 'c1-automation', '2026-W41.json'), 'utf8'), before, 'recipes never overwritten');

// not Thursday: no planning
fs.rmSync(path.join(p.recipes, 'c1-automation', '2026-W41.json'));
await tick({...o, now: THU - 24 * 3600_000});
assert.ok(!fs.existsSync(path.join(p.recipes, 'c1-automation', '2026-W41.json')));

// problems are reported, and one bad step does not stop the rest: a bad metrics file plus an approved video showing a preview handle
fs.mkdirSync(o.inbox, {recursive: true});
fs.writeFileSync(path.join(o.inbox, 'bad.json'), '{');
fs.writeFileSync(path.join(out, 'render.json'), JSON.stringify({handle: '@preview.only'}));
fs.appendFileSync(ledgerFile(p), JSON.stringify({storyboard_id: 'host-supplier-bills', channel: 'c1-automation', status: 'approved', approved_by: 'navin', approved_at: '2026-10-01T04:00:00Z', targets: ['instagram', 'youtube'], updated_at: '2026-10-01T04:00:00Z'}) + '\n');
calls.length = 0;
r = await tick({...o, now: THU + 7200_000});
assert.equal(r.problems.length, 2, r.problems.join(' | '));
assert.match(r.problems.join('\n'), /metrics rejected: bad.json/);
assert.match(r.problems.join('\n'), /blocked host-supplier-bills: the video shows @preview.only/);
assert.match(texts().at(-1)!, /^agent-studio needs you:/);

// nothing live: the tick does nothing at all
for (const c of ['c1-automation']) {
  const f = path.join(p.channels, c, 'channel.json');
  fs.writeFileSync(f, JSON.stringify({...JSON.parse(fs.readFileSync(f, 'utf8')), live: false}));
}
calls.length = 0;
r = await tick({...o, now: THU});
assert.deepEqual([r.channels, calls.length, r.problems], [[], 0, []]);

fs.rmSync(tmp, {recursive: true});
console.log('run ok: only live channels; Thursday plans next week once; each video shown once; problems reported without stopping');
