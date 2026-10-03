// node studio/recipe.test.ts : 8 weeks of recipes never break the 7 novelty rules; each rule fires on a crafted violation.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {addDays, checkNovelty, type Fingerprint, isoWeek, structureDistance, topicSimilarity, weekStart} from './novelty.ts';
import {channelThemes, generateWeek, reachable, type Recipe, recipeDate, slotDay, toFingerprint} from './recipe.ts';

const ROOT = path.join(import.meta.dirname, '..');
const c1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c1-automation/channel.json'), 'utf8'));
const c2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c2-reach/channel.json'), 'utf8'));
const c3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'channels/c3-studio/channel.json'), 'utf8'));
const schema = loadSchema('recipe');

// dates
assert.equal(weekStart('2026-W40'), '2026-09-28');
assert.equal(isoWeek('2026-10-04'), '2026-W40');
assert.equal(isoWeek('2026-10-05'), '2026-W41');
assert.equal(weekStart('2027-W01'), '2027-01-04');
assert.equal(isoWeek('2021-01-03'), '2020-W53');

// 8 weeks, all three channels, each week planned against everything before it
const weeks = Array.from({length: 8}, (_, i) => isoWeek(addDays('2026-10-05', i * 7)));
let history: Fingerprint[] = [];
const all: Recipe[] = [];
for (const w of weeks)
  for (const ch of [c1, c2, c3]) {
    const rs = generateWeek(ch, w, history);
    assert.equal(rs.length, ch.cadence.posts_per_week, 'one recipe per posting day (C1, C2: 4 a week; C3: 7)');
    assert.equal(rs.filter((r) => r.experiment).length, Math.round(ch.cadence.posts_per_week * 0.3), '30% of the slots are experiments');
    for (const r of rs) {
      assert.deepEqual(validate(schema, r), [], `${r.id} breaks recipe.schema.json`);
      assert.equal(r.transitions.length, r.primitives.length);
      assert.equal(r.transitions[0], 'cut');
    }
    history = [...history, ...rs.map(toFingerprint)];
    all.push(...rs);
  }
// independent re-check: every recipe against the full history of what came before it
for (const r of all) assert.deepEqual(checkNovelty(toFingerprint(r), history.filter((h) => h.id !== r.id), {themes: channelThemes([c1, c2, c3].find((c) => c.id === r.channel)).length}), [], `${r.id} breaks a rule`);
const c1all = all.filter((r) => r.channel === 'c1-automation');
assert.ok(c1all.some((r) => r.primitives[0] === 'host-hook') && c1all.some((r) => r.primitives[0] !== 'host-hook'), 'C1 mixes host and composed videos');
assert.ok(c1all.every((r) => r.theme === channelThemes(c1)[0]), 'C1 renders in its style preset theme only');
assert.ok(all.filter((r) => r.channel === 'c2-reach').every((r) => r.theme === channelThemes(c2)[0]), 'C2 renders in its style preset theme only');

// seeded: same inputs, same week; another seed, another week
assert.deepEqual(generateWeek(c1, '2026-W41', []), generateWeek(c1, '2026-W41', []));
assert.notDeepEqual(generateWeek(c1, '2026-W41', []), generateWeek(c1, '2026-W41', [], {seed: 'other'}));

// bench: a benched primitive never appears
assert.ok(generateWeek(c1, '2026-W41', [], {bench: ['flow-run', 'chat-pop']}).every((r) => !r.primitives.includes('flow-run') && !r.primitives.includes('chat-pop')));
// impossible constraints throw instead of returning a rule-breaking week
assert.throws(() => generateWeek({id: 'c1-automation', themes: ['paper']}, '2026-W41', [], {bench: ['end-card']}), /no recipe passes|no video format/);

// each rule fires on a crafted violation
const base: Fingerprint = {id: 'x', channel: 'c1-automation', date: '2026-10-10', primitives: ['pile-drop', 'flow-run', 'end-card'], opening: 'pile-drop', theme: 'paper', hook_pattern: 'pile'};
const h = (d: number, over: Partial<Fingerprint>): Fingerprint => ({...base, id: `h${d}`, date: addDays(base.date, -d), primitives: ['counter-drop', 'conveyor', 'stamp-hit', 'host-cta'], opening: 'counter-drop', theme: 'studio', hook_pattern: 'number', ...over});
const rules = (fp: Fingerprint, hist: Fingerprint[]) => checkNovelty(fp, hist).map((v) => v.rule);
assert.deepEqual(rules(base, [h(1, {}), h(2, {})]), [], 'a clean history passes');
assert.deepEqual(rules({...base, topic_text: 'Chasing unpaid invoices on WhatsApp'}, [h(30, {topic_text: 'chasing unpaid invoices on whatsapp!'})]), ['topic']);
assert.ok(topicSimilarity('supplier bills typed by hand', 'dispatch updates sent by courier') < 0.3);
assert.deepEqual(rules(base, [h(9, {primitives: base.primitives})]), ['structure']);
assert.equal(structureDistance(['a', 'b', 'c'], ['c', 'b', 'a']), 1 - 3 / 7, 'order counts');
assert.deepEqual(rules(base, [h(1, {opening: 'pile-drop'})]), ['opening']);
assert.deepEqual(rules(base, [h(3, {opening: 'pile-drop'}), h(5, {opening: 'pile-drop'})]), ['opening'], 'at most 2 in 7 days');
assert.deepEqual(rules(base, [h(3, {opening: 'pile-drop'}), h(7, {opening: 'pile-drop'})]), [], 'the 7-day window moves');
assert.deepEqual(rules({...base, hero_metaphor: 'Bills entering themselves'}, [h(13, {hero_metaphor: 'bills entering themselves'})]), ['hero-metaphor']);
assert.deepEqual(rules({...base, hero_metaphor: 'bills entering themselves'}, [h(14, {hero_metaphor: 'bills entering themselves'})]), []);
assert.deepEqual(rules(base, [h(1, {theme: 'paper'}), h(2, {theme: 'paper'})]), ['theme']);
assert.deepEqual(rules(base, [h(1, {theme: 'paper'}), h(3, {theme: 'paper'})]), [], 'a gap day breaks the run');
assert.deepEqual(checkNovelty(base, [h(1, {theme: 'paper'}), h(2, {theme: 'paper'})], {themes: 1}), [], 'a one-theme channel has no theme-run rule');
assert.deepEqual(rules(base, [h(1, {hook_pattern: 'pile'}), h(2, {hook_pattern: 'pile'})]), ['hook-pattern']);
assert.deepEqual(rules({...base, caption_opener: 'Nobody should type this.'}, [h(2, {caption_opener: 'nobody should type this'})]), ['hook-pattern']);
assert.deepEqual(rules({...base, hash: 'abc'}, [h(1, {channel: 'c3-studio', hash: 'abc'})]), ['cross-channel']);
assert.deepEqual(rules({...base, hash: 'abc'}, [h(7, {channel: 'c3-studio', hash: 'abc'})]), [], 'last week is fine');
assert.deepEqual(rules({...base, hash: 'abc'}, [{...h(0, {channel: 'c3-studio', hash: 'abc'}), date: addDays(base.date, 1)}]), ['cross-channel'], 'later in the same week counts too');
assert.deepEqual(rules(base, [h(1, {channel: 'c3-studio', opening: 'pile-drop', theme: 'paper'})]), [], 'other channels do not count for channel rules');
assert.equal(recipeDate({week: '2026-W40', slot: 7}), '2026-10-04');
// posting days spread over the week (alternate days at 4 a week); a channel's first-ever recipe is its launch video, and only that one
assert.deepEqual([1, 2, 3, 4].map((s) => slotDay(s, 4)), [0, 2, 4, 6]);
assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((s) => slotDay(s, 7)), [0, 1, 2, 3, 4, 5, 6]);
{
  const c1 = {...JSON.parse(fs.readFileSync(path.join(ROOT, 'channels', 'c1-automation', 'channel.json'), 'utf8')), cadence: {posts_per_week: 4}};
  const first = generateWeek(c1, '2026-W41', []);
  assert.deepEqual(first.map((x) => [recipeDate(x), x.launch ?? false]), [['2026-10-05', true], ['2026-10-07', false], ['2026-10-09', false], ['2026-10-11', false]]);
  assert.ok(generateWeek(c1, '2026-W42', first.map(toFingerprint)).every((x) => !x.launch), 'only the first week has a launch video');
}

// style presets: one setting switches the look (theme, transitions) and is recorded on every recipe; setting it back rolls back
const v1 = generateWeek({...c1, style: 'c1-night-signal-v1'}, '2026-W45', []);
assert.ok(v1.every((r) => r.theme === 'night-signal' && r.style === 'c1-night-signal-v1' && r.transitions.every((x) => ['cut', 'fold'].includes(x))), 'v1: its theme and transitions');
assert.ok(v1.some((r) => r.transitions.includes('fold')), 'v1 uses its signature sweep');
const v0 = generateWeek({...c1, style: 'c1-night-v0'}, '2026-W45', []);
assert.ok(v0.every((r) => r.theme === 'night' && r.style === 'c1-night-v0' && !r.transitions.includes('fold')), 'rolled back to v0');
assert.ok(all.filter((r) => r.channel === 'c3-studio').every((r) => !r.transitions.includes('fold') && !r.style), 'an unstyled channel never gets a signature');
assert.ok(generateWeek({...c2, style: 'c2-archive-gold-v1'}, '2026-W45', []).every((r) => r.theme === 'archive-gold' && r.transitions.every((x) => ['cut', 'ink-wipe'].includes(x))));

const hostShare = all.filter((r) => r.channel === 'c1-automation' && r.opening === 'host-hook').length / 56;
// every shot list can reach its channel's length floor (C1 40 s) with lines no longer than their shots
assert.deepEqual(all.filter((r) => !reachable(r.channel, r.primitives)).map((r) => r.id), [], 'a recipe too short to reach the length floor');
console.log(`recipe ok: ${all.length} recipes over ${weeks.length} weeks, 0 rule breaks, every shot list can reach its length floor; C1 host share ${(hostShare * 100).toFixed(0)}%`);
