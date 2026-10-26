// Self-test for engine/src/composer/artgate.ts: text-in-boxes scenes fail, more than 12 on-screen words fail, too few plates fail,
// and a composite board passes.
import assert from 'node:assert';
import {artIssues, MAX_WORDS, onScreenWords} from '../engine/src/composer/artgate.ts';

const comp = (extra = {}) => ({primitive: 'composite', params: {query: 'a very long plate query that never shows on screen at all', hero: '0.5', unit: 's', source: 'A long citation source line that is chrome', ...extra}});
const end = {primitive: 'end-card', params: {text: 'Follow', sub: 'More business automations.'}};
assert.strictEqual(onScreenWords(comp().params), 2, 'query and source are not on-screen words');
assert.deepStrictEqual(artIssues({scenes: [comp(), comp(), {primitive: 'flow-run', params: {nodes: [{label: 'Read'}, {label: 'Send'}]}}, end]}), []);
assert.match(artIssues({scenes: [comp(), comp(), {primitive: 'ui-sheet', params: {}}, end]}).join(), /scene 3 \(ui-sheet\) is text in boxes/);
assert.match(artIssues({scenes: [comp({quote: 'one two three four five six seven eight nine ten eleven twelve thirteen'}), comp(), end]}).join(), new RegExp(`puts 15 words on screen, at most ${MAX_WORDS}`));
assert.match(artIssues({scenes: [comp(), {primitive: 'counter-drop', params: {label: 'X'}}, {primitive: 'split-flap', params: {}}, {primitive: 'stamp-hit', params: {}}, {primitive: 'pile-drop', params: {}}, end]}).join(), /1 of 5 scenes have a photo or clip plate; at least 2/);
console.log('artgate ok: text boxes banned, 12-word cap (query and citation excluded), 40% of scenes on photo or clip plates');
