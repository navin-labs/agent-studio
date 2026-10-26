// The Meta skills (Instagram / Facebook publishing and analytics) are plain-text skills that Navin installs verbatim in Forge
// (docs/SETUP.md section 4, docs/INSTALL.md section 7). This test checks what can be checked without a live connector: that the
// files exist where the install docs say, that they carry the sections and rules the contract needs, that every JSON example in
// them is valid against the studio's own schemas, and that they never tell the agent to build a client, handle a token or start a
// login. It does NOT exercise the native connector (none is available to the development environment). Run: node studio/skills.test.ts
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {loadSchema, validate} from '../schemas/validate.ts';

const ROOT = path.join(import.meta.dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PUB = 'agents/publisher/FORGE_QUEUE_PUBLISHER.md';
const MET = 'agents/learn/FORGE_METRICS_REPORTER.md';
const pub = read(PUB);
const met = read(MET);

// ---- discoverable: the install docs name these files, and every skill file they name exists ----
for (const doc of ['docs/SETUP.md', 'docs/INSTALL.md']) {
  const named = [...read(doc).matchAll(/`(agents\/[a-z-]+\/[A-Z_]+\.md)`/g)].map((m) => m[1]);
  assert.ok(named.includes(PUB) && named.includes(MET), `${doc} tells Navin to install both Meta skills`);
  for (const f of named) assert.ok(fs.existsSync(path.join(ROOT, f)), `${doc} names ${f}, which must exist`);
}
// one skill per job: no second file claims the same ids or the same job
const skillFiles = fs.readdirSync(path.join(ROOT, 'agents'), {recursive: true, encoding: 'utf8'}).filter((f) => /^[a-z-]+\/[A-Z_]+\.md$/.test(f)).map((f) => `agents/${f}`);
const withId = (id: string) => skillFiles.filter((f) => read(f).includes(`Skill id: \`${id}\``));
assert.deepEqual(withId('meta-social-publishing'), [PUB]);
assert.deepEqual(withId('meta-social-analytics'), [MET]);
assert.deepEqual(skillFiles.filter((f) => /Meta (connector|tools)|native connector|insights/i.test(read(f)) && ![PUB, MET].includes(f)), [], 'no other skill uses the Meta connector (one skill per job)');

// ---- required content ----
const must = (text: string, name: string, res: RegExp[]) => res.forEach((re) => assert.match(text, re, `${name}: ${re}`));
must(pub, 'publisher', [
  /^# SKILL: /m, /## When/, /## Step 0: find out what the connector can do/, /## Check before posting/, /## Do\b/, /## Failures and retries/, /## Dry run and testing/, /## Limits of this skill/, /## Never/,
  /video_sha256/, /SHA-256 of `files\.video` equals the manifest/, /Never post the same item twice/, /posted\.json/, /Instagram and Facebook items are separate/,
  /Do not retry in this run/, /read the account's recent media/i, /dry run/i, /Never post early/, /manifest is the only source of where an item goes/i,
  /does not exist|not already posted/i, /rate limit/i, /Only the connector's own tools/,
]);
must(met, 'analytics', [
  /^# SKILL: /m, /## When/, /## Step 0: find out what the connector exposes/, /## Find the posts/, /## Write the rows/, /## Report to Navin/, /## Privacy/, /## Dry run and testing/, /## Failures/, /## Never/,
  /Zero is a number; missing is not zero/, /left out of the row/, /`reach` is required/, /Engagement rate = /, /lower bound/, /Read-only|read-only/, /n\/a: <reason>/,
  /equal\s+windows/, /No recommendation without evidence/, /Never print or store tokens/, /time zone/, /freshness/,
]);

// ---- the connector rules: both skills use only the connector Forge has ----
for (const [name, text] of [['publisher', pub], ['analytics', met]] as const) {
  assert.match(text, /native connector/, `${name} says it uses the existing native connector`);
  assert.match(text, /Names are not fixed by this repository/, `${name} does not invent tool names`);
  assert.match(text, /no live connector call was made when this skill was written/, `${name} is honest that the connector was not exercised`);
  // it forbids building a client or handling credentials ...
  assert.match(text, /write a REST client|writes? a Graph API client|no Graph API client/i, name);
  assert.match(text, /token/i, name);
  // ... and never instructs it: no addresses, no credential names, no commands that talk to Meta
  for (const bad of [/graph\.facebook\.com/i, /graph\.instagram\.com/i, /access_token\s*=/i, /client_secret/i, /app_secret/i, /curl\s/i, /fetch\(/, /Bearer /, /EAA[A-Za-z0-9]{20,}/, /oauth\/(authorize|access_token)/i])
    assert.doesNotMatch(text, bad, `${name} must not contain ${bad}`);
}
// the publisher never touches the other flows
assert.match(pub, /touch the YouTube or Telegram flows/);
assert.match(met, /Touch the YouTube numbers[^\n]*Telegram flow/);

// ---- every JSON example is valid against the studio's own schemas ----
const blocks = (text: string) => [...text.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1].replace(/<64 hex>/g, '0'.repeat(64)).replace(/"url": "https:\/\/www\.instagram\.com\/reel\/\.\.\."/, '"url": "https://www.instagram.com/reel/abc"')));
const [manifest, posted] = blocks(pub);
assert.deepEqual(validate(loadSchema('queue'), manifest), [], 'the manifest example matches schemas/queue.schema.json');
assert.equal(manifest.platform, 'facebook');
assert.match(manifest.files.video, /\.mp4$/);
assert.equal(path.basename(PUB).length > 0 && Object.keys(posted).sort().join(), 'posted_at,url', 'posted.json holds posted_at and url');
assert.match(posted.url, /^https:\/\/(www\.|m\.)?instagram\.com\//, 'the example URL is on the platform the studio expects (dispatch.ts markPublished)');
const [row] = blocks(met);
assert.deepEqual(validate(loadSchema('metrics'), row), [], 'the metrics example matches schemas/metrics.schema.json');
assert.deepEqual(validate(loadSchema('metrics'), {...row, reach: undefined}).length > 0, true, 'reach really is required by the schema');
assert.ok(validate(loadSchema('metrics'), {...row, invented_metric: 5}).length > 0, 'the schema refuses invented fields, as the skill says');
// the skill's file fields are the schema's fields
const q = JSON.parse(read('schemas/queue.schema.json'));
for (const k of q.required) assert.ok(k in manifest, `the manifest example carries ${k}`);

// ---- the skills' own paths and the studio's: the stem layout and folders match what dispatch writes ----
const variantSrc = read('studio/variant.ts');
for (const ext of ['mp4', 'caption.txt', 'manifest.json', 'posted.json']) assert.match(pub, new RegExp(`<stem>\\.${ext.replace('.', '\\.')}`), `the publisher names <stem>.${ext}`);
assert.match(variantSrc, /queue/, 'studio/variant.ts defines the queue layout the publisher reads');
assert.match(read('studio/dispatch.ts'), /\.posted\.json/, 'dispatch.ts reads the posted.json the publisher writes');
assert.match(read('studio/metrics.ts'), /inbox/, 'metrics.ts reads the rows the reporter writes');

// ---- no secrets in the skills ----
for (const t of [pub, met]) assert.doesNotMatch(t, /(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{30,}|xox[bp]-|BEGIN [A-Z ]*PRIVATE KEY)/);

console.log('skills ok: both Meta skills are named by the install docs and exist, carry their sections and safety rules, use only the native connector (no client, token, login or web address), and every JSON example validates against the studio schemas; the connector itself was not exercised');
