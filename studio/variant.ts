// Platform variants: every video is rendered once per platform (youtube, instagram, facebook), each its own render with its own
// CTA, end card, caption and (YouTube) thumbnail, from the platform's spec in the style preset. The one place that names their
// folders and files (docs/TECH.md "Variants").
//   renders  engine/out/<channel>/<yyyy-mm-dd>/<video id>/<platform>/<channel>-<platform>-<date>-<id>.<kind>
//   queue    queue/<channel>/<platform>/<channel>-<platform>-<date>-<id>.<kind>     (Forge's publish queue, Instagram and Facebook)
// Every file name carries channel, platform, date and video id, in render folders and in the queue alike; a bare name (video.mp4,
// final.mp4, reel.mp4) fails QA.
import fs from 'node:fs';
import path from 'node:path';

export const PLATFORMS = ['youtube', 'instagram', 'facebook'] as const;
export type Platform = (typeof PLATFORMS)[number];
export type Variant = {channel: string; date: string; id: string; platform: Platform};
// How each platform leaves the Mac: YouTube through that channel's own n8n upload workflow, the others through Forge's queue.
// Style presets (destination), channel.json publishers (via) and every manifest must agree with this; dispatch refuses otherwise.
export const ROUTE = {youtube: 'n8n', instagram: 'forge-queue', facebook: 'forge-queue'} as const satisfies Record<Platform, string>;
// The file name rule, also written into every style preset ("filename") so the preset states it (checked by schemas/validate.ts)
export const FILENAME = '{channel}-{platform}-{date}-{id}';
// Each YouTube channel has its own n8n upload workflow, at this webhook path (n8n/youtube-upload*.json); dispatch sends nowhere else
export const youtubeWebhookPath = (channel: string) => `/webhook/agent-studio-youtube-${channel}`;
export const ownWebhook = (channel: string, url: unknown) => typeof url === 'string' && URL.canParse(url) && new URL(url).pathname === youtubeWebhookPath(channel);

// The CTA kind a closer asks for (its text): follow (Subscribe on YouTube), dm-audit (an Instagram DM), send (share it).
export const ctaKind = (text = '') => (/audit/i.test(text) ? 'dm-audit' : /send|share/i.test(text) ? 'send' : /follow|subscribe/i.test(text) ? 'follow' : null);

export const prefix = (v: Variant) => FILENAME.replace('{channel}', v.channel).replace('{platform}', v.platform).replace('{date}', v.date).replace('{id}', v.id);
export const variantDir = (out: string, v: Variant) => path.join(out, v.channel, v.date, v.id, v.platform);
// kinds: mp4, caption.txt, manifest.json, thumbnail.png, thumbnail-b.png, contact.png, cover.png, qa.json, render.json, text-boxes.json
const name = (v: Variant, kind: string) => `${prefix(v)}${kind === 'mp4' ? '.mp4' : `.${kind}`}`;
export const file = (out: string, v: Variant, kind: string) => path.join(variantDir(out, v), name(v, kind));
export const queueDir = (queue: string, channel: string, platform: Platform) => path.join(queue, channel, platform);
export const queueFile = (queue: string, v: Variant, kind: string) => path.join(queueDir(queue, v.channel, v.platform), name(v, kind));

// Every rendered variant of a video, wherever its date folder is (the latest date wins if a board was rendered on two days).
export const findVariants = (out: string, id: string): Variant[] => {
  const found = new Map<Platform, Variant>();
  if (!fs.existsSync(out)) return [];
  for (const channel of fs.readdirSync(out))
    for (const date of /^c\d-/.test(channel) && fs.statSync(path.join(out, channel)).isDirectory() ? fs.readdirSync(path.join(out, channel)).sort() : [])
      for (const platform of PLATFORMS) {
        const v = {channel, date, id, platform};
        if (fs.existsSync(variantDir(out, v))) found.set(platform, v);
      }
  return [...found.values()];
};
