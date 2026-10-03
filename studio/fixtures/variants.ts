// Test fixture: what engine/scripts/make.mjs + studio/qa.ts leave on disk for a channel board, without rendering: one folder per
// platform variant (studio/variant.ts) with its video, caption (the style preset's template filled in), manifest (manifest.schema.json),
// QA result, render.json and, for YouTube, the thumbnail. Used by the dispatch, approval, telegram, run, loop, experiment and
// improve tests.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {Paths} from '../ledger.ts';
import {AI_VOICE} from '../seo.ts';
import {ctaKind, file, type Platform, PLATFORMS, variantDir} from '../variant.ts';

const ROOT = path.join(import.meta.dirname, '..', '..');
type Opts = {date: string; platforms?: readonly Platform[]; qa?: Partial<Record<Platform, boolean>>; mp4?: boolean; handle?: string; voice?: string | null; manifest?: (platform: Platform) => Record<string, unknown> | null};

export const renderVariants = (p: Paths, doc: any, o: Opts) => {
  const ch = JSON.parse(fs.readFileSync(path.join(p.channels, doc.channel, 'channel.json'), 'utf8'));
  const style = JSON.parse(fs.readFileSync(path.join(ROOT, 'styles', `${doc.style ?? ch.style}.json`), 'utf8'));
  const ig = ch.publishers.find((x: {platform: string}) => x.platform === 'instagram').handle;
  const voice = o.voice === undefined ? 'kokoro/af_heart/1.15' : o.voice;
  for (const platform of o.platforms ?? PLATFORMS) {
    const v = {channel: doc.channel, date: o.date, id: doc.id, platform};
    const spec = style.platforms[platform];
    const pub = ch.publishers.find((x: {platform: string}) => x.platform === platform);
    const kind = ctaKind(doc.scenes.at(-1).params.text)!;
    const cta = spec.cta[kind];
    const fill = (s: string) => s.replaceAll('{ig}', ig);
    const card = o.handle ?? (/^@/.test(pub?.handle ?? '') ? pub.handle : null);
    fs.mkdirSync(variantDir(p.out, v), {recursive: true});
    const video = `video ${doc.id} ${platform}`;
    if (o.mp4 !== false) fs.writeFileSync(file(p.out, v, 'mp4'), video);
    const caption = spec.caption.replace('{body}', doc.caption).replace('{cta}', fill(cta.line)).replace('{voice}', voice ? AI_VOICE : '').replace('{hashtags}', (doc.hashtags ?? []).join(' ')).replace(/\n{3,}/g, '\n\n').trim() + '\n';
    fs.writeFileSync(file(p.out, v, 'caption.txt'), caption);
    fs.writeFileSync(file(p.out, v, 'render.json'), JSON.stringify({handle: card, voice, style: style.id, platform, scenes: doc.scenes.map((s: {primitive: string}, i: number) => ({primitive: s.primitive, start: i * 5, end: i * 5 + 5}))}));
    fs.writeFileSync(file(p.out, v, 'contact.png'), 'png');
    if (spec.thumbnail) fs.writeFileSync(file(p.out, v, 'thumbnail.png'), 'png');
    if (spec.thumbnail && doc.meta?.thumb_b) fs.writeFileSync(file(p.out, v, 'thumbnail-b.png'), 'png');
    const files = {video: path.basename(file(p.out, v, 'mp4')), caption: path.basename(file(p.out, v, 'caption.txt')), ...(spec.thumbnail ? {thumbnail: path.basename(file(p.out, v, 'thumbnail.png'))} : {})};
    const pass = o.qa?.[platform] ?? true;
    const destination = pub ? {via: pub.via, handle: pub.handle, ...(pub.page_id ? {page_id: pub.page_id} : {})} : {via: 'n8n', handle: 'none'};
    const manifest = o.manifest
      ? o.manifest(platform)
      : {channel: doc.channel, platform, video_id: doc.id, date: o.date, style_version: style.id, voice, cta_kind: kind, cta_text: cta.text.replace(/\*/g, ''), cta_say: fill(cta.say), end_card_handle: card, destination, size: spec.size, video_sha256: createHash('sha256').update(video).digest('hex'), qa_status: pass ? 'pass' : 'fail', files};
    if (manifest) fs.writeFileSync(file(p.out, v, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(file(p.out, v, 'qa.json'), JSON.stringify({storyboard_id: doc.id, platform, pass, checks: pass ? [{name: 'cta', pass: true}] : [{name: 'cta', pass: false, error: 'planted failure'}], video_sha256: createHash('sha256').update(video).digest('hex')}));
  }
};
