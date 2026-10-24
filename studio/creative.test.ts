// Self-test for the creative uniqueness rules, review gate and temporal QA. node studio/creative.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {Brief} from '../engine/src/films/brief.ts';
import {COORDS} from '../engine/src/films/brief.ts';
import {ANTI_SLOP, checkCreative, type FilmEntry, motionErrors, reviewErrors, SCORES} from './creative.ts';

const brief = (o: Partial<Omit<Brief, 'coords'>> & {coords?: Partial<Brief['coords']>} = {}): Brief => ({
  story_core: 'stock numbers lie', emotion: 'unease, then relief', hook: 'a torch finds a number in the dark', visual_question: 'what is missing?',
  metaphor: 'counting by torchlight', world: 'a dark godown at night', camera: 'world-space pushes', motion: 'physical weight', typography: 'typewriter ledger',
  material: 'night-signal', transitions: 'the torch beam carries the eye', sound: 'foley and one blackout', payoff: 'the lights come on',
  music: {caption: 'low cello drone, sparse piano', bpm: 70},
  ...o,
  coords: {luminance: 'dark', temperature: 'warm', rendering: 'vector-illustration', space: 'world-space', camera: 'push-pull', motion: 'physical', texture: 'grain', type: 'typewriter', hook: 'mystery', sound: 'foley-led', ...o.coords},
});
const film = (id: string, b: Brief, theme = 'night-signal'): FilmEntry => ({id, channel: 'c1', film: id, theme, brief: b, status: 'reviewed', at: ''});
const rules = (b: Brief, theme: string, h: FilmEntry[]) => checkCreative(b, theme, h).map((v) => v.rule);

// Navin's example: yesterday a dark warehouse with a flashlight; today a dark room with a spotlight must be rejected
const yesterday = film('godown', brief());
const lookalike = brief({world: 'a dark storeroom at night', metaphor: 'searching by spotlight', hook: 'a spotlight finds a figure', coords: {hook: 'contradiction', temperature: 'cool'}});
const r1 = rules(lookalike, 'archive-gold', [yesterday]);
assert.ok(r1.includes('distance') && r1.includes('look'), `lookalike passed: ${r1}`);
// a genuinely different film passes
const editorial = brief({
  world: 'a bright editorial paper desk', metaphor: 'a receipt that refuses to end', hook: 'a till roll unspools past the frame',
  music: {caption: 'plucked marimba, brushed snare, playful', bpm: 112},
  coords: {luminance: 'bright', temperature: 'neutral', rendering: 'paper-craft', space: 'layered', camera: 'tracking', motion: 'elastic', texture: 'paper', type: 'grotesk', hook: 'impossible', sound: 'rhythmic'},
});
assert.deepEqual(rules(editorial, 'paper', [yesterday]), []);
// same theme as the previous film, same hook twice in a row, a near-copy metaphor
assert.ok(rules(editorial, 'night-signal', [yesterday]).includes('palette'));
assert.ok(rules(brief({...editorial, coords: {...editorial.coords, hook: 'mystery'}}), 'paper', [yesterday]).includes('hook'));
assert.ok(rules(brief({...editorial, metaphor: 'counting by torch light'}), 'paper', [yesterday]).includes('metaphor'));
// rejected films never count; the look rule reaches back 5 films
assert.deepEqual(rules(lookalike, 'archive-gold', [{...yesterday, status: 'rejected'}]), []);
const between = [1, 2, 3].map((i) => film(`x${i}`, editorial, `t${i}`));
assert.ok(rules(lookalike, 'archive-gold', [yesterday, ...between.map((f, i) => ({...f, brief: brief({...editorial, world: `w${i} studio`, metaphor: `m${i} thing`, coords: {...editorial.coords, hook: (['scale', 'macro', 'silence'] as const)[i]}})}))]).includes('look'));

// review gate: every score >= 6, mean >= 7.5, all anti-slop tests, and bound to the reviewed film
const scores = Object.fromEntries(SCORES.map((s) => [s, 8])) as Record<(typeof SCORES)[number], number>;
const slop = Object.fromEntries(ANTI_SLOP.map((s) => [s, true])) as Record<(typeof ANTI_SLOP)[number], boolean>;
const good = {scores, anti_slop: slop, generic: '-', exceptional: '-', remove: '-', verdict: 'pass' as const, film_sha: 'abc'};
assert.deepEqual(reviewErrors(good, 'abc'), []);
assert.ok(reviewErrors(good, 'def')[0].includes('changed after the review'));
assert.ok(reviewErrors({...good, scores: {...scores, typography: 5}}, 'abc')[0].includes('typography'));
assert.ok(reviewErrors({...good, anti_slop: {...slop, works_muted: false}}, 'abc').some((e) => e.includes('works_muted')));
assert.ok(reviewErrors(undefined, 'abc')[0].includes('no creative review'));

// temporal QA: the live renders open on a blank frame and fail; a designed opening passes
const live = {first_frame_contrast: 0, change_by_0_3s: 1.4, hook_activity: 15.6, longest_still: 1.5, longest_still_at: 1, lufs: -14, true_peak: -2};
assert.equal(motionErrors(live).length, 2);
assert.deepEqual(motionErrors({...live, first_frame_contrast: 61.6, hook_activity: 321}), []);
assert.ok(motionErrors({...live, first_frame_contrast: 40, hook_activity: 90, longest_still: 4}).some((e) => e.includes('no visible change')));

// the schema's coordinate vocabulary is brief.ts's, word for word
const schema = JSON.parse(fs.readFileSync(new URL('../schemas/storyboard.schema.json', import.meta.url), 'utf8'));
for (const [k, v] of Object.entries(COORDS)) assert.deepEqual(schema.properties.brief.properties.coords.properties[k].enum, [...v], `schema coords.${k}`);
console.log('creative: ok');
