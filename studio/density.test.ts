// Self-test for engine/src/composer/density.ts: a board that keeps moving passes, a headline that sits for 4 s fails with its place.
import assert from 'node:assert';
import {densityIssues, longestStill, MAX_GAP_SECONDS} from '../engine/src/composer/density.ts';

const board = (scenes: object[]) => ({format: 'storyboard', id: 't', channel: 'c1-automation', scenes}) as never;
const inbox = (vo: string) => ({primitive: 'ui-inbox', vo, params: {title: 'Inbox', mode: 'manual', rows: [{from: 'A', subject: 'a'}, {from: 'B', subject: 'b'}, {from: 'C', subject: 'c'}]}});
const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen';

// 1) rows reveal every ~1 s: passes
assert.deepStrictEqual(densityIssues(board([inbox(long), inbox(long)])), [], 'a board with steady reveals passes');

// 2) a statement that sits still for the whole shot fails, and says where
const still = board([inbox(long), {primitive: 'chat-pop', vo: long + ' ' + long, params: {app: 'Chat', text: 'hello'}}]);
const issue = densityIssues(still);
assert.ok(issue.length === 1 && issue[0].startsWith('density:') && issue[0].includes('scene 2') && issue[0].includes('chat-pop'), `a long chat-pop holds too long: ${issue}`);
assert.ok(longestStill(still).seconds > MAX_GAP_SECONDS);

// 3) caption words changing do not count: the same still scene fails with or without a vo (captions follow the vo)
assert.ok(densityIssues(board([inbox(long), {primitive: 'chat-pop', vo: long + ' ' + long + ' ' + long, params: {app: 'Chat', text: 'hello'}}])).length === 1, 'more spoken words never help');

// 4) a cue (an accent word late in the line) is a real event and splits the gap
const cued = board([inbox(long), {primitive: 'highlighter-swipe', vo: 'one two three four five *six seven* eight nine ten eleven twelve *thirteen* fourteen', params: {text: 'one *two* three four *five*'}}]);
assert.ok(longestStill(cued).seconds < longestStill(board([inbox(long), {primitive: 'chat-pop', vo: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen', params: {app: 'Chat', text: 'hello'}}])).seconds, 'accent cues add events');

// 5) a closing card is a deliberate hold and is exempt
assert.deepStrictEqual(densityIssues(board([inbox(long), {primitive: 'end-card', vo: long + ' ' + long, params: {cta: 'Follow *now*', promise: 'p', author: 'a'}}])).filter((x) => x.includes('end-card')), [], 'closers are exempt');
console.log(`density ok: steady reveals pass; a ${longestStill(still).seconds.toFixed(1)} s hold fails and names scene 2`);
