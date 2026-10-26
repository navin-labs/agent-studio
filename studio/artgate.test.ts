// Self-test for engine/src/composer/artgate.ts: text-in-boxes scenes fail, more than 12 on-screen words fail, too few plates fail,
// and a composite board passes.
import assert from 'node:assert';
import {artIssues, MAX_WORDS, onScreenWords} from '../engine/src/composer/artgate.ts';

const comp = (extra = {}) => ({primitive: 'composite', params: {query: 'a very long plate query that never shows on screen at all', objectNoun: 'stopwatch', actionMode: 'zoom-through', source: 'A long citation source line that is chrome', ...extra}});
const end = {primitive: 'end-card', params: {text: 'Follow', sub: 'More business automations.'}};
assert.strictEqual(onScreenWords(comp().params), 2, 'query, source and mode are not on-screen words');
assert.deepStrictEqual(artIssues({scenes: [comp(), comp({actionMode: 'missing-ghost'}), comp({actionMode: 'spotlight-search'}), end]}), []);
assert.match(artIssues({scenes: [comp(), comp(), {primitive: 'ui-sheet', params: {}}, end]}).join(), /scene 3 \(ui-sheet\) is a drawn box or diagram/);
assert.match(artIssues({scenes: [comp({objectNoun: 'one two three four five six seven eight nine ten eleven twelve thirteen'}), comp(), end]}).join(), new RegExp(`puts 14 words on screen, at most ${MAX_WORDS}`));
assert.match(artIssues({scenes: [{primitive: 'host-hook', params: {text: 'x'}}, {primitive: 'host-payoff', params: {text: 'x'}}, {primitive: 'host-hook', params: {text: 'x'}}, {primitive: 'host-hook', params: {text: 'x'}}, end]}).join(), /0 of 4 scenes have a photo or clip plate; at least 2/);
assert.match(artIssues({scenes: [comp(), comp(), {primitive: 'flow-run', params: {}}, end]}).join(), /scene 3 \(flow-run\) is a drawn box or diagram/);
assert.match(artIssues({scenes: [comp({objectNoun: undefined}), comp(), end]}).join(), /composite needs objectNoun and actionMode/);
assert.match(artIssues({scenes: [comp(), comp(), comp(), comp(), end]}).join(), /4 composites use 1 action mode/);
assert.match(artIssues({scenes: [comp({hero: '40'}), comp(), end]}).join(), /composite has a hero number/);
assert.match(artIssues({scenes: [comp({quote: 'x'}), comp(), end]}).join(), /composite has a quote/);
console.log('artgate ok: text boxes banned, 12-word cap (query and citation excluded), 40% of scenes on photo or clip plates');
