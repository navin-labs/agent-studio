// QA: the last gate before Navin sees a video. Deterministic, no vision model, no --force. Every failed check carries the exact
// error that goes back to Forge. evaluate() is pure (unit-tested in qa.test.ts); runQa() gathers the facts from disk.
//
// Every platform variant is checked on its own (studio/variant.ts): a variant that fails is held alone, the others go on.
//
// node studio/qa.ts <storyboard.json> [--out <renders root>] [--date YYYY-MM-DD] [--recipes <dir>]
//   reads each variant folder (engine/out/<channel>/<date>/<id>/<platform>/), writes <prefix>.qa.json there and the QA status into
//   its manifest. Exit 1 when any variant fails.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {lengthIssue, type Storyboard, validateStoryboard} from '../engine/src/composer/storyboard.ts';
import {type Probe, probeVideo} from '../engine/scripts/probe.ts';
import {loadSchema, validate} from '../schemas/validate.ts';
import {readFingerprints} from './ledger.ts';
import {checkNovelty, type Fingerprint} from './novelty.ts';
import {AI_VOICE, captionOf, seoCheck, youtubeMeta} from './seo.ts';
import {ctaKind, file, findVariants, ownWebhook, type Platform, PLATFORMS, prefix, ROUTE, type Variant, variantDir, youtubeWebhookPath} from './variant.ts';
import {type Recipe, recipeDate, recipeHash} from './recipe.ts';

export const CHECKS = ['schema', 'text-limits', 'audio', 'format', 'duration', 'safe-zones', 'fingerprint', 'naming', 'manifest', 'cta', 'destination', 'seo'] as const;
export type Check = {name: (typeof CHECKS)[number]; pass: boolean; error?: string; warning?: string};
export type QaResult = {storyboard_id: string; platform: Platform; pass: boolean; checks: Check[]; video_path: string; contact_sheet_path: string; video_sha256?: string};
type TextIssue = {level: 'error' | 'warning'; scene: number; primitive: string; text: string; problem: string};

export type QaInputs = {
  doc: Storyboard & {channel?: string};
  file: string; // storyboard file name
  variant: Variant;
  outDir: string; // engine/out (the renders root)
  files: string[]; // what is in the variant folder
  manifest: Record<string, any> | null; // <prefix>.manifest.json
  caption: string; // <prefix>.caption.txt
  spec: PlatformSpec | null; // the style preset's spec for this platform (styles/<id>.json "platforms")
  style: string | null; // the style preset the board renders in (its own "style", else the channel's)
  channel: {publishers: Publisher[]} | null; // channels/<channel>/channel.json
  render: {handle?: string | null; platform?: string | null; style?: string | null} | null; // <prefix>.render.json
  sha256: string | null; // of the video file
  siblings: Partial<Record<Platform, string>>; // video_sha256 of the video's other platform variants (none may be the same file)
  probe: Probe | null; // null = no video file
  textBoxes: {measured: number; issues: TextIssue[]} | null;
  sheet: boolean;
  voice?: string | null; // the AI voice the render used (manifest); every voiced variant's caption discloses it
  recipe: Recipe | null;
  date: string;
  history: Fingerprint[]; // approved / published videos
  themes?: number; // how many themes the channel renders in (1: the theme-run rule is off)
};

export type PlatformSpec = {size: {width: number; height: number}; thumbnail: boolean; end_card: {handle: string}; caption: string; cta: Record<string, {text: string; sub?: string; say: string; line: string}>; filename: string; destination: string};
export type Publisher = {platform: string; handle: string; via: string; page_id?: string; webhook?: string};
const REAL = /^@[A-Za-z0-9._]{1,30}$/;
const first = (s = '', re: RegExp) => s.split(re)[0].trim();
export const storyboardFingerprint = (doc: QaInputs['doc'], date: string): Fingerprint => {
  const primitives = doc.scenes.map((s) => s.primitive);
  return {
    id: doc.id,
    channel: doc.channel ?? '',
    date,
    primitives,
    opening: primitives[0],
    theme: doc.theme ?? 'paper',
    hook_pattern: doc.hookPattern ?? '',
    topic_text: first(doc.caption, /\n\s*\n/),
    caption_opener: first(doc.caption, /(?<=[.!?])\s/),
    hero_metaphor: doc.meta?.hero_metaphor,
    hash: recipeHash(doc.theme ?? 'paper', primitives, doc.hookPattern ?? ''),
  };
};

export const evaluate = (x: QaInputs): QaResult => {
  const checks: Check[] = [];
  const add = (name: Check['name'], errors: string[]) => checks.push(errors.length ? {name, pass: false, error: errors.join('; ')} : {name, pass: true});
  const p = x.probe;

  add('schema', validate(loadSchema('storyboard'), x.doc));
  add('text-limits', validateStoryboard(x.doc).errors);
  add('audio', !p ? ['no video file'] : p.audio ? [] : ['the video has no audio stream']);
  add('format', !p ? ['no video file'] : [
    ...(p.container === 'mp4' ? [] : [`container is ${p.container}, needs mp4`]),
    ...(!x.spec ? [`the style preset has no ${x.variant.platform} spec`] : p.width === x.spec.size.width && p.height === x.spec.size.height ? [] : [`frame is ${p.width}x${p.height}, the ${x.variant.platform} preset needs ${x.spec.size.width}x${x.spec.size.height}`]),
    ...(Math.abs(p.fps - 30) < 0.01 ? [] : [`${p.fps.toFixed(2)} fps, needs 30`]),
  ]);
  const long = p ? lengthIssue(x.doc, p.seconds) : 'no video file';
  add('duration', long ? [long] : []);
  add('safe-zones', !x.textBoxes ? ['no text-boxes.json: the render did not measure text'] : !x.textBoxes.measured ? ['text boxes measured on 0 frames'] :
    x.textBoxes.issues.filter((i) => i.level === 'error').map((i) => `scene ${i.scene + 1} (${i.primitive}) "${i.text}": ${i.problem}`));

  const fp = storyboardFingerprint(x.doc, x.date);
  const recipeErrors: string[] = [];
  if (!x.recipe) recipeErrors.push(`recipe ${x.doc.meta?.recipe_id ?? '(none)'} not found in recipes/`);
  else {
    const r = x.recipe;
    const tr = x.doc.scenes.map((s) => s.transition ?? 'cut');
    if (r.primitives.join('>') !== fp.primitives.join('>')) recipeErrors.push(`shots differ from recipe ${r.id}: ${fp.primitives.join(' > ')} vs ${r.primitives.join(' > ')}`);
    if (r.theme !== fp.theme) recipeErrors.push(`theme ${fp.theme} differs from recipe ${r.id} (${r.theme})`);
    if (r.style && x.doc.style !== r.style) recipeErrors.push(`style ${x.doc.style ?? '(none)'} differs from recipe ${r.id} (${r.style}): copy the recipe's style`);
    if (r.hook_pattern !== fp.hook_pattern) recipeErrors.push(`hook pattern ${fp.hook_pattern} differs from recipe ${r.id} (${r.hook_pattern})`);
    if (r.transitions.join('>') !== tr.join('>')) recipeErrors.push(`transitions differ from recipe ${r.id}: ${tr.join(' > ')} vs ${r.transitions.join(' > ')}`);
  }
  add('fingerprint', [...recipeErrors, ...checkNovelty(fp, x.history.filter((h) => h.id !== fp.id), {themes: x.themes}).map((v) => `${v.rule}: ${v.error}`)]);

  const v = x.variant;
  const name = (kind: string) => path.basename(file(x.outDir, v, kind));
  const has = (kind: string) => x.files.includes(name(kind));
  add('naming', [
    ...(x.file === `${x.doc.id}.json` ? [] : [`file is ${x.file}, must be ${x.doc.id}.json`]),
    ...(v.channel === x.doc.channel && v.id === x.doc.id && v.date === x.date ? [] : [`render folder ${path.relative(x.outDir, variantDir(x.outDir, v))} must be ${x.doc.channel}/${x.date}/${x.doc.id}/${v.platform}`]),
    ...x.files.filter((f) => !f.startsWith('.') && !f.startsWith(`${prefix(v)}.`)).map((f) => `${f}: every file name carries channel, platform, date and video id (${prefix(v)}.*)`),
    ...(has('contact.png') ? [] : [`no ${name('contact.png')}`]),
    ...(v.platform === 'youtube' && !has('thumbnail.png') ? [`no ${name('thumbnail.png')} (the YouTube thumbnail)`] : []),
    ...(v.platform === 'youtube' && x.doc.meta?.thumb_b && !has('thumbnail-b.png') ? ['meta.thumb_b is set but thumbnail-b.png was not rendered'] : []),
  ]);

  // the manifest: complete (schemas/manifest.schema.json), about this exact folder and file, and not another platform's video
  const m = x.manifest;
  const want = {channel: v.channel, platform: v.platform, video_id: v.id, date: v.date};
  const pub = x.channel?.publishers.find((q) => q.platform === v.platform) ?? null;
  add('manifest', !m ? [`no ${name('manifest.json')}`] : [
    ...validate(loadSchema('manifest'), m).map((e) => `manifest ${e}`),
    ...Object.entries(want).filter(([k, val]) => m[k] !== val).map(([k, val]) => `manifest ${k} is ${JSON.stringify(m[k])}, the folder says ${val}`),
    ...(m.style_version !== x.style ? [`manifest style_version ${m.style_version}, the board renders in ${x.style ?? '(no style)'}: render it again`] : x.render?.style !== m.style_version ? [`manifest style_version ${m.style_version}, render.json ${x.render?.style ?? '(none)'}`] : []),
    ...(x.render?.platform === v.platform ? [] : [`render.json says platform ${x.render?.platform ?? '(none)'}: this is not the ${v.platform} render`]),
    ...Object.values((m.files ?? {}) as Record<string, string>).filter((f) => !x.files.includes(f)).map((f) => `manifest lists ${f}, which is not in the folder`),
    ...(x.sha256 && m.video_sha256 !== x.sha256 ? ['the video file is not the one the manifest describes (video_sha256): render it again'] : []),
    ...PLATFORMS.filter((o) => o !== v.platform && x.sha256 && x.siblings[o] === x.sha256).map((o) => `this video is the same file as the ${o} variant: every platform is its own render`),
  ]);

  // the CTA and the end card: this platform's words (the preset's), Subscribe only on YouTube, Follow never on YouTube, an
  // Instagram funnel names Instagram anywhere else, the end card names this platform's own account
  const kind = ctaKind(String(x.doc.scenes.at(-1)?.params?.text ?? ''));
  const ig = x.channel?.publishers.find((q) => q.platform === 'instagram')?.handle ?? '';
  const cta = kind ? x.spec?.cta[kind] : undefined;
  const fill = (t: string) => t.replaceAll('{ig}', ig);
  const said = `${m?.cta_text ?? ''} ${m?.cta_say ?? ''}`;
  const body = String(x.doc.caption ?? '');
  const card = x.spec?.end_card.handle === v.platform && pub && REAL.test(pub.handle) ? pub.handle : null;
  add('cta', [
    ...(/\b(follow|subscribe)\b|\bdm\s+\*?audit/i.test(body) ? ['the caption carries a CTA line; leave it out, each platform variant adds its own'] : []),
    ...(!cta ? [`the style preset has no ${v.platform} CTA for "${x.doc.scenes.at(-1)?.params?.text ?? ''}" (${kind ?? 'unknown kind'})`]
      : m && (m.cta_kind !== kind || m.cta_text !== cta.text.replace(/\*/g, '') || m.cta_say !== fill(cta.say)) ? [`the closer says "${m.cta_text}" / "${m.cta_say}", the ${v.platform} CTA is "${cta.text.replace(/\*/g, '')}" / "${fill(cta.say)}": render it again`]
      : !x.caption.includes(fill(cta.line)) ? [`the caption does not carry the ${v.platform} CTA line "${fill(cta.line)}"`] : []),
    ...(v.platform === 'youtube' && /\bfollow\b/i.test(`${said} ${x.caption}`) ? ['YouTube says Subscribe, never Follow'] : []),
    ...(v.platform !== 'youtube' && /\bsubscribe\b/i.test(`${said} ${x.caption}`) ? [`${v.platform} says Follow, never Subscribe`] : []),
    ...(v.platform !== 'instagram' && /\b(dm|audit)\b/i.test(said) && !/instagram/i.test(`${m?.cta_say ?? ''}`) ? ['a CTA that sends people to Instagram must say "Instagram" out loud'] : []),
    ...(v.platform !== 'instagram' && /\bdm audit\b/i.test(x.caption) && !/instagram/i.test(x.caption) ? ['the caption sends people to Instagram without naming it'] : []),
    ...(m && (m.end_card_handle ?? null) !== card ? [`the end card names ${m.end_card_handle ?? 'no account'}, the ${v.platform} end card names ${card ?? 'no account'}`] : []),
    ...(x.render && (x.render.handle ?? null) !== card ? [`render.json shows ${x.render.handle ?? 'no account'} on the end card, the ${v.platform} end card names ${card ?? 'no account'}: render it again`] : []),
    ...(x.voice && !x.caption.includes(AI_VOICE) ? [`a voiced video's caption must disclose it ("${AI_VOICE}")`] : []),
  ]);

  // where it goes: this channel's own publisher for this platform, reached the way the platform is (studio/variant.ts ROUTE). A
  // username still pending holds the variant (Navin claims it in channel.json); it is not the Writer's to fix.
  const d = m?.destination;
  add('destination', [
    ...(!pub ? [`${v.channel} has no ${v.platform} publisher in channel.json`]
      : pub.handle.startsWith('pending') ? [`${v.platform} username is still pending (${pub.handle}): held until it is claimed in channels/${v.channel}/channel.json, then render again`]
      : !REAL.test(pub.handle) ? [`${v.platform} handle "${pub.handle}" in channel.json is not an @handle`] : []),
    ...(pub && pub.via !== ROUTE[v.platform] ? [`channel.json sends ${v.platform} via ${pub.via}; it goes via ${ROUTE[v.platform]}`] : []),
    ...(x.spec && x.spec.destination !== ROUTE[v.platform] ? [`the preset sends ${v.platform} via ${x.spec.destination}; it goes via ${ROUTE[v.platform]}`] : []),
    ...(v.platform === 'youtube' && pub && !ownWebhook(v.channel, pub.webhook) ? [`no YouTube upload webhook of ${v.channel}'s own (channel.json webhook ${youtubeWebhookPath(v.channel)})`] : []),
    ...(v.platform === 'facebook' && pub && !pub.page_id ? ['Facebook needs the page_id in channel.json'] : []),
    ...(m && pub && d && (d.via !== pub.via || d.handle !== pub.handle || (d.page_id ?? null) !== (pub.page_id ?? null)) ? [`the manifest sends it to ${d.via} ${d.handle}${d.page_id ? ` (page ${d.page_id})` : ''}, channel.json says ${pub.via} ${pub.handle}${pub.page_id ? ` (page ${pub.page_id})` : ''}: render it again`] : []),
  ]);

  // search (YouTube) and sourcing (C2, every platform)
  const meta = youtubeMeta(x.doc, x.caption);
  const seo = v.platform === 'youtube' ? seoCheck(meta, x.doc) : {errors: x.doc.channel === 'c2-reach' && (!x.doc.meta?.source || !x.caption.includes(x.doc.meta.source)) ? ['C2: the caption must carry the source link'] : [], warnings: []};
  const metaB = v.platform === 'youtube' && x.doc.meta?.title_b ? {...meta, title: x.doc.meta.title_b} : null; // experiment arm B must pass too
  add('seo', [...seo.errors, ...(metaB ? seoCheck(metaB, x.doc).errors.map((e) => `title_b: ${e}`) : [])]);
  if (seo.warnings.length) checks.at(-1)!.warning = seo.warnings.join('; ');

  return {storyboard_id: x.doc.id, platform: v.platform, pass: checks.every((c) => c.pass), checks, video_path: file(x.outDir, v, 'mp4'), contact_sheet_path: file(x.outDir, v, 'contact.png'), ...(x.sha256 ? {video_sha256: x.sha256} : {})};
};

const ROOT = path.join(import.meta.dirname, '..');
const readJson = (f: string) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const allRecipes = (dir: string): Recipe[] => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {recursive: true, encoding: 'utf8'}).filter((f) => f.endsWith('.json')).flatMap((f) => readJson(path.join(dir, f)) as Recipe[]);
};

// QA every platform variant of a board; each result goes to <prefix>.qa.json and its status into the variant's manifest.
export const runQa = async (boardPath: string, opts: {out?: string; date?: string; recipes?: string} = {}): Promise<QaResult[]> => {
  const doc = readJson(boardPath);
  const out = path.resolve(opts.out ?? path.join(ROOT, 'engine/out'));
  const recipe = allRecipes(path.resolve(opts.recipes ?? path.join(ROOT, 'recipes'))).find((r) => r.id === doc.meta?.recipe_id) ?? null;
  const date = opts.date ?? (recipe ? recipeDate(recipe) : new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  const ch = readJson(path.join(ROOT, 'channels', String(doc.channel), 'channel.json'));
  const styleId = doc.style ?? ch?.style ?? null;
  const style = styleId ? readJson(path.join(ROOT, 'styles', `${styleId}.json`)) : null;
  const variants = findVariants(out, doc.id);
  if (!variants.length) throw new Error(`${doc.id}: no platform variants rendered under ${path.relative(ROOT, out)}/<channel>/<date>/${doc.id}/`);
  const rel = (f: string) => path.relative(ROOT, f);
  const sha = (v: Variant) => (fs.existsSync(file(out, v, 'mp4')) ? createHash('sha256').update(fs.readFileSync(file(out, v, 'mp4'))).digest('hex') : null);
  const shas = new Map(variants.map((v) => [v.platform, sha(v)]));
  const results: QaResult[] = [];
  for (const v of variants) {
    const dir = variantDir(out, v);
    const manifest = readJson(file(out, v, 'manifest.json'));
    const r = evaluate({
      doc,
      file: path.basename(boardPath),
      variant: v,
      outDir: out,
      files: fs.readdirSync(dir).filter((f) => !f.startsWith('.')), // Finder and editor dotfiles are not part of the render
      manifest,
      caption: captionOf(file(out, v, 'caption.txt')),
      spec: style?.platforms?.[v.platform] ?? null,
      style: styleId,
      channel: ch,
      render: readJson(file(out, v, 'render.json')),
      sha256: shas.get(v.platform) ?? null,
      siblings: Object.fromEntries(variants.filter((o) => o.platform !== v.platform).map((o) => [o.platform, readJson(file(out, o, 'manifest.json'))?.video_sha256 ?? shas.get(o.platform)])),
      probe: fs.existsSync(file(out, v, 'mp4')) ? await probeVideo(file(out, v, 'mp4')) : null,
      textBoxes: readJson(file(out, v, 'text-boxes.json')),
      sheet: fs.existsSync(file(out, v, 'contact.png')),
      voice: manifest?.voice ?? null,
      recipe,
      date,
      history: readFingerprints(), // approved videos, appended by ledger.ts on approval
      themes: ch?.style ? 1 : ch?.themes?.length,
    });
    const res = {...r, video_path: rel(r.video_path), contact_sheet_path: rel(r.contact_sheet_path)};
    const bad = validate(loadSchema('qa'), res);
    if (bad.length) throw new Error(`qa result breaks qa.schema.json: ${bad.join('; ')}`);
    fs.writeFileSync(file(out, v, 'qa.json'), JSON.stringify(res, null, 2) + '\n');
    if (manifest) fs.writeFileSync(file(out, v, 'manifest.json'), JSON.stringify({...manifest, qa_status: res.pass ? 'pass' : 'fail'}, null, 2) + '\n');
    results.push(res);
  }
  return results;
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const board = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!board) {
    console.error('usage: node studio/qa.ts <storyboard.json> [--out <renders root>] [--date YYYY-MM-DD] [--recipes <dir>]');
    process.exit(2);
  }
  const rs = await runQa(board, {out: opt('--out'), date: opt('--date'), recipes: opt('--recipes')});
  for (const r of rs) {
    console.log(`${r.platform}:`);
    for (const c of r.checks) console.log(`  ${c.pass ? 'pass' : 'FAIL'} ${c.name.padEnd(12)}${c.error ? c.error : ''}`);
  }
  // a failure the Writer fixes (the board) vs a variant held only because its account is not set up (Navin, channel.json)
  const missing = PLATFORMS.filter((pl) => !rs.some((r) => r.platform === pl));
  const writer = rs.filter((r) => r.checks.some((c) => !c.pass && c.name !== 'destination')).map((r) => r.platform);
  const held = rs.filter((r) => !r.pass && !writer.includes(r.platform)).map((r) => `${r.platform} (${r.checks.find((c) => !c.pass)!.error})`);
  const passed = rs.filter((r) => r.pass).map((r) => r.platform);
  if (missing.length) console.log(`not rendered: ${missing.join(', ')} (the render failed; see the render log above)`);
  if (held.length) console.log(`held for Navin, not a board error: ${held.join('; ')}`);
  console.log(writer.length || missing.length ? `QA failed: ${rs[0].storyboard_id} ${[...writer, ...missing].join(', ')} (held; errors above go back to Forge)${passed.length ? `; ${passed.join(', ')} passed and can be approved` : ''}` : `QA passed: ${rs[0].storyboard_id} (${passed.join(', ') || 'no variant approvable yet'})`);
  process.exit(writer.length || missing.length ? 1 : 0);
}
