// Self-test for studio/script.ts: a crafted script passes, a flat one fails with its exact reasons.
import assert from 'node:assert';
import {hookType, scriptErrors} from './script.ts';

const crafted = {
  scenes: [
    {vo: "You've touched this every day and never noticed it."},
    {vo: 'In 1941, a dog came home from the Alps covered in burrs.'},
    {vo: 'Most people would brush them off. But George de Mestral put one under a microscope.'},
    {vo: 'Every burr was covered in hundreds of tiny hooks, so it gripped anything with a loop.'},
    {vo: 'Fourteen years later, US patent 2,717,437 turned that into a fastener.'},
    {vo: "Today it holds astronauts' gear in space, and the thing you touched today."},
    {},
  ],
  meta: {devices: ['novelty', 'reveal', 'contrast', 'proof', 'stakes', 'number', 'loop'], proof: {fact: 'US patent 2,717,437 (1955)', source: 'https://patents.google.com/patent/US2717437A/en'}, structure: 'story', cta: 'none'},
};
assert.deepStrictEqual(scriptErrors(crafted), [], 'a crafted script passes');

const flat = {
  scenes: [{vo: 'Hey guys, welcome back, today we are talking about the history of Velcro and where it came from.'}, {vo: 'And then a man saw a plant.'}, {vo: 'He made a fastener.'}],
  meta: {},
};
const e = scriptErrors(flat);
for (const want of ['hook: 18 words', 'hook: opens with a greeting', 'turns: 0', 'specificity', 'flat or banned phrase', 'loop:', 'declare novelty or open-loop', 'proof: meta.proof', 'structure:', 'cta:']) assert.ok(e.some((x) => x.includes(want)), `flat script must fail on "${want}"; got:\n${e.join('\n')}`);
assert.deepStrictEqual(scriptErrors({scenes: [{}, {}]}), [], 'a board with no voice is not judged here');
// a scene hook passes when its opening image is named; images must be concrete; countdown is gone
const scene = {...crafted, scenes: [{vo: 'A dog came home covered in the thing you touched today.'}, ...crafted.scenes.slice(1)], meta: {...crafted.meta, hook_image: 'burrs cling to a dog and to trousers on an Alpine path', payoff_image: 'a modern shoe strap closing with a rip'}};
assert.deepStrictEqual(scriptErrors(scene), [], 'a named scene hook passes');
assert.ok(scriptErrors({...scene, meta: {...scene.meta, hook_image: 'dog'}}).some((x) => x.startsWith('hook')), 'a vague opening image fails');
assert.ok(scriptErrors({...crafted, meta: {...crafted.meta, structure: 'countdown'}}).some((x) => x.startsWith('structure')), 'countdown is refused');
assert.deepStrictEqual(['Why do zips jam?', 'In 1859, the sun set paper on fire.', 'Nobody reads the label.', 'You touch this daily.', 'A dog walks home.'].map(hookType), ['question', 'number', 'contradiction', 'you', 'scene']);
// voice direction: tagged scripts need an arc, an attention hook and few holds
const tag = (feels: string[], holds: number[] = []) => ({...crafted, scenes: crafted.scenes.map((s, i) => (s.vo ? {...s, voice: {feel: feels[i] ?? 'warm', ...(holds.includes(i) ? {hold: 0.6} : {})}} : s))});
assert.deepStrictEqual(scriptErrors(tag(['curious', 'tense', 'surprised', 'warm', 'calm', 'triumphant'], [2])), []);
const flatVoice = scriptErrors(tag(['calm', 'calm', 'calm', 'calm', 'calm', 'calm'], [0, 1, 2]));
for (const want of ['fewer than 3 different feels', 'the hook is calm', 'more than 2 held silences']) assert.ok(flatVoice.some((x) => x.includes(want)), `flat voice must fail on "${want}"; got:\n${flatVoice.join('\n')}`);
console.log(`script ok: a crafted script passes; a flat one fails on ${e.length} exact reasons`);
