// node studio/qa.test.ts : QA passes a good render and fails each broken fact with its exact error. No video needed (evaluate is pure).
// End to end on real renders: node studio/qa.ts engine/content/storyboards/host-supplier-bills.json --recipes studio/fixtures/recipes (pass)
//                             node studio/qa.ts studio/fixtures/qa-broken.json --recipes studio/fixtures/recipes (fails audio, duration, fingerprint, naming)
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {evaluate, type QaInputs} from './qa.ts';
import {toFingerprint} from './recipe.ts';

const ROOT = path.join(import.meta.dirname, '..');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const doc = read('engine/content/storyboards/host-supplier-bills.json');
const recipe = read('studio/fixtures/recipes/host-supplier-bills.json')[0];

const good = (): QaInputs => ({
  doc: structuredClone(doc),
  file: 'host-supplier-bills.json',
  outDir: '/x/out/host-supplier-bills',
  probe: {container: 'mp4', width: 1080, height: 1920, fps: 30.000000000000004, seconds: 43.86, audio: true},
  textBoxes: {measured: 254, issues: [{level: 'warning', scene: 1, primitive: 'ui-inbox', text: 'x', problem: 'caption overlaps "y"'}]},
  sheet: true,
  recipe: structuredClone(recipe),
  date: '2026-10-01',
  history: [],
});
const failing = (change: (x: QaInputs) => void) => {
  const x = good();
  change(x);
  return evaluate(x).checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.error}`);
};

const ok = evaluate(good());
assert.ok(ok.pass, JSON.stringify(ok.checks.filter((c) => !c.pass)));
assert.deepEqual(ok.checks.map((c) => c.name), ['schema', 'text-limits', 'audio', 'format', 'duration', 'safe-zones', 'fingerprint', 'naming'], 'every check runs, in order');

assert.deepEqual(failing((x) => delete (x.doc.meta as Record<string, unknown>).source), ['schema: $.meta: missing "source"']);
const tooLong = failing((x) => ((x.doc.scenes[0].params as {text: string}).text = 'x'.repeat(41)));
assert.equal(tooLong.length, 1);
assert.match(tooLong[0], /^text-limits: scene 1 \(host-hook\): host-hook.text: max 40 characters, got 41/);
assert.deepEqual(failing((x) => (x.probe!.audio = false)), ['audio: the video has no audio stream']);
assert.deepEqual(failing((x) => Object.assign(x.probe!, {width: 720, height: 1280, fps: 25})), ['format: frame is 720x1280, needs 1080x1920; 25.00 fps, needs 30']);
assert.deepEqual(failing((x) => (x.probe!.seconds = 38.2)), ['duration: host video is 38.2s, needs 40 to 60s']);
assert.deepEqual(failing((x) => (x.probe = null)), ['audio: no video file', 'format: no video file', 'duration: no video file']);
assert.deepEqual(failing((x) => (x.textBoxes = null)), ['safe-zones: no text-boxes.json: the render did not measure text']);
assert.deepEqual(failing((x) => x.textBoxes!.issues.push({level: 'error', scene: 1, primitive: 'ui-inbox', text: 'BY HAND', problem: 'outside the youtube safe area (x 895..979, y 311..337)'})), [
  'safe-zones: scene 2 (ui-inbox) "BY HAND": outside the youtube safe area (x 895..979, y 311..337)',
]);
assert.deepEqual(failing((x) => (x.recipe = null)), ['fingerprint: recipe test-host-supplier-bills not found in recipes/']);
assert.deepEqual(failing((x) => (x.doc.theme = 'paper')), ['fingerprint: theme paper differs from recipe test-host-supplier-bills (night)']);
assert.deepEqual(failing((x) => (x.doc.scenes[1].transition = 'cut')), [
  'fingerprint: transitions differ from recipe test-host-supplier-bills: cut > cut > whip-pan > pixel-wipe > whip-pan > whip-pan > pixel-wipe > cut vs cut > whip-pan > whip-pan > pixel-wipe > whip-pan > whip-pan > pixel-wipe > cut',
]);
// novelty on the written words: a video approved yesterday with the same caption opener and hero metaphor
const prev = {...toFingerprint({...recipe, id: 'c1-old', week: '2026-W40', slot: 3, primitives: ['pile-drop', 'flow-run', 'end-card'], opening: 'pile-drop', hook_pattern: 'pile'}), caption_opener: 'Supplier bills do not need a person typing every line.', hero_metaphor: 'bills entering themselves'};
assert.deepEqual(failing((x) => ((x.history = [prev]), ((x.doc.meta as Record<string, unknown>).hero_metaphor = 'Bills entering themselves'))), [
  'fingerprint: hero-metaphor: hero metaphor "Bills entering themselves" used by c1-old (2026-09-30), within 14 days; hook-pattern: caption opener repeats c1-old: "Supplier bills do not need a person typing every line."',
]);
assert.deepEqual(failing((x) => (x.file = 'bills.json')), ['naming: file is bills.json, must be host-supplier-bills.json']);
assert.deepEqual(failing((x) => ((x.outDir = '/x/out/other'), (x.sheet = false))), ['naming: render folder is other, must be host-supplier-bills; no contact.png next to the video']);

console.log('qa ok: good passes, 14 broken cases fail with their exact error');
