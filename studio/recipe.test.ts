// node studio/recipe.test.ts : 8 weeks of recipes never break the 7 novelty rules; each rule fires on a crafted violation.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';
import {addDays, checkNovelty, type Fingerprint, isoWeek, structureDistance, topicSimilarity, weekStart} from './novelty.ts';
import {generateWeek, type Recipe, recipeDate, toFingerprint} from './recipe.ts';

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
    assert.equal(rs.length, 7);
    assert.equal(rs.filter((r) => r.experiment).length, 2, '30% of 7 slots are experiments');
    for (const r of rs) {
      assert.deepEqual(validate(schema, r), [], `${r.id} breaks recipe.schema.json`);
      assert.equal(r.transitions.length, r.primitives.length);
      assert.equal(r.transitions[0], 'cut');
    }
    history = [...history, ...rs.map(toFingerprint)];
    all.push(...rs);
  }
// independent re-check: every recipe against the full history of what came before it
for (const r of all) assert.deepEqual(checkNovelty(toFingerprint(r), history.filter((h) => h.id !== r.id)), [], `${r.id} breaks a rule`);
assert.ok(all.some((r) => r.primitives[0] === 'host-hook') && all.some((r) => r.theme !== 'night'), 'C1 mixes host and composed videos');

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
assert.deepEqual(rules(base, [h(1, {hook_pattern: 'pile'}), h(2, {hook_pattern: 'pile'})]), ['hook-pattern']);
assert.deepEqual(rules({...base, caption_opener: 'Nobody should type this.'}, [h(2, {caption_opener: 'nobody should type this'})]), ['hook-pattern']);
assert.deepEqual(rules({...base, hash: 'abc'}, [h(1, {channel: 'c3-studio', hash: 'abc'})]), ['cross-channel']);
assert.deepEqual(rules({...base, hash: 'abc'}, [h(7, {channel: 'c3-studio', hash: 'abc'})]), [], 'last week is fine');
assert.deepEqual(rules({...base, hash: 'abc'}, [{...h(0, {channel: 'c3-studio', hash: 'abc'}), date: addDays(base.date, 1)}]), ['cross-channel'], 'later in the same week counts too');
assert.deepEqual(rules(base, [h(1, {channel: 'c3-studio', opening: 'pile-drop', theme: 'paper'})]), [], 'other channels do not count for channel rules');
assert.equal(recipeDate({week: '2026-W40', slot: 7}), '2026-10-04');

const hostShare = all.filter((r) => r.channel === 'c1-automation' && r.opening === 'host-hook').length / 56;
console.log(`recipe ok: ${all.length} recipes over ${weeks.length} weeks, 0 rule breaks; C1 host share ${(hostShare * 100).toFixed(0)}%`);
