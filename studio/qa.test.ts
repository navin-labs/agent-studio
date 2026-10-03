// node studio/qa.test.ts : QA passes a good platform variant and fails each broken fact with its exact error. No video needed
// (evaluate is pure). End to end on real renders: npm run make -- test/style-c1.json, then
//   node studio/qa.ts engine/test/style-c1.json --out engine/test/out --recipes engine/test/recipes
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {evaluate, type PlatformSpec, type QaInputs} from './qa.ts';
import {toFingerprint} from './recipe.ts';
import {AI_VOICE, seoCheck, youtubeMeta} from './seo.ts';
import {ctaKind, type Platform, prefix} from './variant.ts';

const ROOT = path.join(import.meta.dirname, '..');
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const doc = read('engine/test/boards/host-supplier-bills.json');
const recipe = read('studio/fixtures/recipes/host-supplier-bills.json')[0];
const c1 = read('channels/c1-automation/channel.json');
const style = read(`styles/${c1.style}.json`);
const FB = {platform: 'facebook', handle: '@theautomationguy.fb', via: 'forge-queue', page_id: '1429203763599559'};
const live = {...c1, publishers: c1.publishers.map((x: {platform: string}) => (x.platform === 'facebook' ? FB : x))}; // Facebook claimed
const IG = '@theautomationguynavin';
const SHA = {youtube: 'a'.repeat(64), instagram: 'b'.repeat(64), facebook: 'c'.repeat(64)};
const DATE = '2026-10-01';

// a good variant, as make.mjs renders it from the style preset for that platform
const good = (platform: Platform = 'youtube'): QaInputs => {
  const spec: PlatformSpec = structuredClone(style.platforms[platform]);
  const v = {channel: 'c1-automation', date: DATE, id: doc.id, platform};
  const kind = ctaKind(doc.scenes.at(-1).params.text)!;
  const cta = spec.cta[kind];
  const fill = (s: string) => s.replaceAll('{ig}', IG);
  const pub = live.publishers.find((x: {platform: string}) => x.platform === platform);
  const n = (k: string) => `${prefix(v)}.${k}`;
  const files = {video: `${prefix(v)}.mp4`, caption: n('caption.txt'), ...(spec.thumbnail ? {thumbnail: n('thumbnail.png')} : {})};
  return {
    doc: structuredClone(doc),
    file: 'host-supplier-bills.json',
    variant: v,
    outDir: '/x/out',
    files: [...Object.values(files), n('manifest.json'), n('contact.png'), n('render.json'), n('text-boxes.json'), n('cover.png')],
    manifest: {channel: v.channel, platform, video_id: v.id, date: DATE, style_version: style.id, voice: 'kokoro/af_heart/1.15', cta_kind: kind, cta_text: cta.text.replace(/\*/g, ''), cta_say: fill(cta.say), end_card_handle: pub.handle, destination: {via: pub.via, handle: pub.handle, ...(pub.page_id ? {page_id: pub.page_id} : {})}, size: spec.size, video_sha256: SHA[platform], qa_status: 'pending', files},
    caption: `${doc.caption}\n\n${fill(cta.line)}\n\n${AI_VOICE}\n\n${doc.hashtags.join(' ')}\n`,
    spec,
    style: style.id,
    channel: structuredClone(live),
    render: {handle: pub.handle, platform, style: style.id},
    sha256: SHA[platform],
    siblings: Object.fromEntries(Object.entries(SHA).filter(([k]) => k !== platform)),
    probe: {container: 'mp4', width: 1080, height: 1920, fps: 30.000000000000004, seconds: 43.86, audio: true},
    textBoxes: {measured: 254, issues: [{level: 'warning', scene: 1, primitive: 'ui-inbox', text: 'x', problem: 'caption overlaps "y"'}]},
    sheet: true,
    voice: 'kokoro/af_heart/1.15',
    recipe: structuredClone(recipe),
    date: DATE,
    history: [],
  };
};
const failing = (change: (x: QaInputs) => void, platform: Platform = 'youtube') => {
  const x = good(platform);
  change(x);
  return evaluate(x).checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.error}`);
};

for (const pf of ['youtube', 'instagram', 'facebook'] as const) {
  const ok = evaluate(good(pf));
  assert.ok(ok.pass, `${pf}: ${JSON.stringify(ok.checks.filter((c) => !c.pass))}`);
  assert.equal(ok.platform, pf);
}
assert.deepEqual(evaluate(good()).checks.map((c) => c.name), ['schema', 'text-limits', 'audio', 'format', 'duration', 'safe-zones', 'fingerprint', 'naming', 'manifest', 'cta', 'destination', 'seo'], 'every check runs, in order');

// SEO preflight (studio/seo.ts): errors fail QA with a rule ID, warnings never do; C2 needs the source link and a searchable name or year
assert.match(failing((x) => (x.doc.caption = 'Bills — done\n\nMore text.')).join(), /seo: SEO-T4/);
assert.match(failing((x) => (x.doc.hashtags = Array.from({length: 16}, (_, i) => `#tag${i}`), (x.caption += x.doc.hashtags.join(' ')))).join(), /seo: SEO-G3/);
const c2 = (cap: string) => ({...structuredClone(doc), channel: 'c2-reach', caption: cap, hashtags: ['#history', '#barcode', '#business'], meta: {...doc.meta, source: 'https://example.org/barcode'}});
const BODY = '\n\nA long enough description about the history of the barcode and the shop that tried it first, told in sixty seconds.';
const c2bad = seoCheck(youtubeMeta(c2(`how checkout got faster${BODY}`), `how checkout got faster${BODY}`), c2('x'));
assert.ok(c2bad.errors.some((e) => e.startsWith('SEO-S1')) && c2bad.warnings.some((w) => w.startsWith('SEO-H1')), JSON.stringify(c2bad));
const cap = `Who drew the first barcode in 1948?${BODY}\n\nSource: https://example.org/barcode`;
assert.deepEqual(seoCheck(youtubeMeta(c2(cap), cap), c2(cap)), {errors: [], warnings: []}, 'a sourced C2 title with a year passes clean');
assert.ok(evaluate(good()).checks.find((c) => c.name === 'seo')!.pass, 'warnings alone never fail QA');
assert.match(failing((x) => ((x.doc.meta as Record<string, unknown>).title_b = 'Bills — typed by hand every evening')).join(), /seo: title_b: SEO-T4/);

// the engine's own checks
assert.deepEqual(failing((x) => delete (x.doc.meta as Record<string, unknown>).source), ['schema: $.meta: missing "source"']);
const tooLong = failing((x) => ((x.doc.scenes[0].params as {text: string}).text = 'x'.repeat(41)));
assert.equal(tooLong.length, 1);
assert.match(tooLong[0], /^text-limits: scene 1 \(host-hook\): host-hook.text: max 40 characters, got 41/);
assert.deepEqual(failing((x) => (x.probe!.audio = false)), ['audio: the video has no audio stream']);
assert.deepEqual(failing((x) => Object.assign(x.probe!, {width: 720, height: 1280, fps: 25})), ['format: frame is 720x1280, the youtube preset needs 1080x1920; 25.00 fps, needs 30']);
assert.deepEqual(failing((x) => (x.probe = null)), ['audio: no video file', 'format: no video file', 'duration: no video file']);
assert.deepEqual(failing((x) => (x.textBoxes = null)), ['safe-zones: no text-boxes.json: the render did not measure text']);
assert.deepEqual(failing((x) => x.textBoxes!.issues.push({level: 'error', scene: 1, primitive: 'ui-inbox', text: 'BY HAND', problem: 'outside the youtube safe area (x 895..979, y 311..337)'})), [
  'safe-zones: scene 2 (ui-inbox) "BY HAND": outside the youtube safe area (x 895..979, y 311..337)',
]);

// length: C1 is 40 to 60 s in both formats, no exceptions; C2 25 to 45 s (until its phase-2 shots arrive)
assert.deepEqual(failing((x) => (x.probe!.seconds = 38.2)), ['duration: c1 video is 38.2s, needs 40 to 60s']);
assert.deepEqual(failing((x) => (x.probe!.seconds = 60.5)), ['duration: c1 video is 60.5s, needs 40 to 60s']);
assert.deepEqual(failing((x) => ((x.doc.host = undefined), (x.probe!.seconds = 24.8))).filter((e) => e.startsWith('duration')), ['duration: c1 video is 24.8s, needs 40 to 60s'], 'the composed C1 format too');
const c2len = (s: number) => evaluate({...good(), doc: {...c2(cap), scenes: doc.scenes}, probe: {...good().probe!, seconds: s}}).checks.find((c) => c.name === 'duration')!;
assert.deepEqual([c2len(24.9).error, c2len(25).pass, c2len(45).pass, c2len(45.1).error], ['story video is 24.9s, needs 25 to 45s', true, true, 'story video is 45.1s, needs 25 to 45s']);

// the recipe and novelty
assert.deepEqual(failing((x) => (x.recipe = null)), ['fingerprint: recipe test-host-supplier-bills not found in recipes/']);
assert.deepEqual(failing((x) => (x.doc.theme = 'paper')), ['fingerprint: theme paper differs from recipe test-host-supplier-bills (night)']);
assert.deepEqual(failing((x) => (x.doc.scenes[1].transition = 'cut')), [
  'fingerprint: transitions differ from recipe test-host-supplier-bills: cut > cut > whip-pan > pixel-wipe > whip-pan > whip-pan > pixel-wipe > cut vs cut > whip-pan > whip-pan > pixel-wipe > whip-pan > whip-pan > pixel-wipe > cut',
]);
const prev = {...toFingerprint({...recipe, id: 'c1-old', week: '2026-W40', slot: 3, primitives: ['pile-drop', 'flow-run', 'end-card'], opening: 'pile-drop', hook_pattern: 'pile'}), caption_opener: 'Supplier bills do not need a person typing every line.', hero_metaphor: 'bills entering themselves'};
assert.deepEqual(failing((x) => ((x.history = [prev]), ((x.doc.meta as Record<string, unknown>).hero_metaphor = 'Bills entering themselves'))), [
  'fingerprint: hero-metaphor: hero metaphor "Bills entering themselves" used by c1-old (2026-09-30), within 14 days; hook-pattern: caption opener repeats c1-old: "Supplier bills do not need a person typing every line."',
]);

// naming: every file carries channel, platform, date and video id; the YouTube variant has its thumbnail
const P = 'c1-automation-youtube-2026-10-01-host-supplier-bills';
assert.deepEqual(failing((x) => (x.file = 'bills.json')), ['naming: file is bills.json, must be host-supplier-bills.json']);
assert.deepEqual(failing((x) => x.files.push('video.mp4', 'final.mp4')), [`naming: video.mp4: every file name carries channel, platform, date and video id (${P}.*); final.mp4: every file name carries channel, platform, date and video id (${P}.*)`]);
assert.match(failing((x) => (x.variant = {...x.variant, date: '2026-10-02'})).join(), /^naming: render folder c1-automation\/2026-10-02\/host-supplier-bills\/youtube must be c1-automation\/2026-10-01\/host-supplier-bills\/youtube; c1-automation-youtube-2026-10-01-host-supplier-bills\.mp4: every file name/);
assert.match(failing((x) => (x.files = x.files.filter((f) => !f.endsWith('.thumbnail.png')))).join(), /naming: no c1-automation-youtube-2026-10-01-host-supplier-bills\.thumbnail\.png \(the YouTube thumbnail\)/);
assert.match(failing((x) => ((x.doc.meta as Record<string, unknown>).thumb_b = 'Typed *by hand*')).join(), /thumbnail-b\.png was not rendered/);

// the manifest: complete, about this folder and file, and never another platform's video
assert.deepEqual(failing((x) => (x.manifest = null)), [`manifest: no ${P}.manifest.json`]);
assert.match(failing((x) => delete x.manifest!.destination).join(), /manifest: manifest \$: missing "destination"/);
assert.match(failing((x) => (x.manifest!.platform = 'instagram')).join(), /manifest: manifest platform is "instagram", the folder says youtube/);
assert.match(failing((x) => (x.manifest!.channel = 'c2-reach')).join(), /manifest channel is "c2-reach", the folder says c1-automation/);
assert.deepEqual(failing((x) => (x.render!.platform = 'instagram')), ['manifest: render.json says platform instagram: this is not the youtube render']);
assert.deepEqual(failing((x) => (x.manifest!.style_version = 'c1-night-signal-v1')), ['manifest: manifest style_version c1-night-signal-v1, the board renders in c1-night-v0: render it again']);
assert.deepEqual(failing((x) => (x.sha256 = 'f'.repeat(64))), ['manifest: the video file is not the one the manifest describes (video_sha256): render it again']);
assert.deepEqual(failing((x) => (x.siblings.instagram = SHA.youtube)), ['manifest: this video is the same file as the instagram variant: every platform is its own render']);
assert.match(failing((x) => (x.manifest!.files.video = 'video.mp4')).join(), /manifest: manifest \$\.files\.video: must match/);

// the CTA: this platform's words; Subscribe only on YouTube; an Instagram funnel names Instagram elsewhere; the end card's account
const asFollow = (x: QaInputs) => ((x.doc.scenes.at(-1)!.params as {text: string}).text = '*Follow*');
assert.ok(evaluate((() => { const x = good('instagram'); asFollow(x); const c = x.spec!.cta.follow; Object.assign(x.manifest!, {cta_kind: 'follow', cta_text: 'Follow', cta_say: c.say}); x.caption = x.caption.replace(/DM AUDIT.*\n/, `${c.line.replaceAll('{ig}', IG)}\n`); return x; })()).pass, 'an Instagram Follow variant passes');
assert.deepEqual(failing((x) => Object.assign(x.manifest!, {cta_text: 'Follow'})), ['cta: the closer says "Follow" / "Send me the word audit on Instagram.", the youtube CTA is "DM AUDIT" / "Send me the word audit on Instagram.": render it again; YouTube says Subscribe, never Follow']);
assert.deepEqual(failing((x) => (x.caption = x.caption.replace('Example data.', 'Example data. Subscribe for more.')), 'instagram'), ['cta: instagram says Follow, never Subscribe']);
assert.deepEqual(failing((x) => (x.doc.caption += '\n\nFollow for more.')), ['cta: the caption carries a CTA line; leave it out, each platform variant adds its own']);
assert.deepEqual(failing((x) => Object.assign(x.manifest!, {cta_say: 'Send me the word audit.'}), 'facebook'), ['cta: the closer says "DM AUDIT" / "Send me the word audit.", the facebook CTA is "DM AUDIT" / "Send me the word audit on Instagram.": render it again; a CTA that sends people to Instagram must say "Instagram" out loud']);
assert.deepEqual(failing((x) => (x.caption = x.caption.replace(/DM AUDIT to .*\n/, ''))), ['cta: the caption does not carry the youtube CTA line "DM AUDIT to @theautomationguynavin on Instagram and I will look at your most repetitive process for free."']);
assert.deepEqual(failing((x) => (x.caption = x.caption.replace(AI_VOICE, ''))), [`cta: a voiced video's caption must disclose it ("${AI_VOICE}")`]);
assert.deepEqual(failing((x) => ((x.manifest!.end_card_handle = '@backstory.minute'), (x.render!.handle = '@backstory.minute'))), ['cta: the end card names @backstory.minute, the youtube end card names @theautomationguynavin; render.json shows @backstory.minute on the end card, the youtube end card names @theautomationguynavin: render it again']);

// the destination: this channel's own publisher for this platform, reached the way the platform is
const pending = (x: QaInputs) => (x.channel = structuredClone(c1)); // the real C1: Facebook username still pending
// a pending username: Facebook still posts to its page by page_id, with no account on the end card; without a page_id, or on any
// other platform, the variant is held until the username is claimed
const asPending = (x: QaInputs) => ((x.manifest!.destination = {via: 'forge-queue', handle: c1.publishers[2].handle, page_id: '1429203763599559'}), (x.manifest!.end_card_handle = null), (x.render!.handle = null));
assert.deepEqual(failing((x) => (pending(x), asPending(x)), 'facebook'), []);
assert.deepEqual(failing((x) => (pending(x), asPending(x), (x.channel!.publishers[2] = {...x.channel!.publishers[2], page_id: undefined}), delete x.manifest!.destination.page_id), 'facebook'), [`destination: facebook username is still pending (${c1.publishers[2].handle}): held until it is claimed in channels/c1-automation/channel.json, then render again; Facebook needs the page_id in channel.json`]);
assert.match(failing((x) => ((x.channel!.publishers = x.channel!.publishers.map((q) => (q.platform === 'instagram' ? {...q, handle: 'pending_retry'} : q))), (x.manifest!.destination.handle = 'pending_retry')), 'instagram').join('\n'), /destination: instagram username is still pending \(pending_retry\): held/);

assert.deepEqual(failing((x) => (x.channel!.publishers = x.channel!.publishers.map((q) => (q.platform === 'youtube' ? {...q, webhook: undefined} : q)))), ["destination: no YouTube upload webhook of c1-automation's own (channel.json webhook /webhook/agent-studio-youtube-c1-automation)"]);
assert.deepEqual(failing((x) => (x.channel!.publishers = x.channel!.publishers.map((q) => (q.platform === 'youtube' ? {...q, webhook: 'http://localhost:5678/webhook/agent-studio-youtube-c2-reach'} : q)))), ["destination: no YouTube upload webhook of c1-automation's own (channel.json webhook /webhook/agent-studio-youtube-c1-automation)"]);
assert.match(failing((x) => (x.channel!.publishers = x.channel!.publishers.filter((q) => q.platform !== 'instagram')), 'instagram').join('\n'), /^destination: c1-automation has no instagram publisher in channel.json$/m);
assert.deepEqual(failing((x) => (x.manifest!.destination.handle = '@someone.else'), 'instagram'), ['destination: the manifest sends it to forge-queue @someone.else, channel.json says forge-queue @theautomationguynavin: render it again']);
assert.match(failing((x) => (x.channel!.publishers = x.channel!.publishers.map((q) => (q.platform === 'facebook' ? {...q, page_id: undefined} : q))), 'facebook').join(), /destination: Facebook needs the page_id in channel.json/);
assert.match(failing((x) => (x.spec!.destination = 'n8n'), 'instagram').join(), /destination: the preset sends instagram via n8n; it goes via forge-queue/);
assert.match(failing((x) => (x.spec = null), 'instagram').join(), /format: the style preset has no instagram spec/);

console.log('qa ok: a good variant passes on each platform; every broken fact (length, naming, manifest, CTA, end card, destination, recipe, SEO) fails with its exact error');
