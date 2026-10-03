// YouTube SEO preflight (concept from darkzOGx/youtube-automation-agent, MIT; rules are ours). The YouTube title, description and
// tags come from the storyboard (youtubeMeta, the one place dispatch also uses), and a checklist runs over them with rule IDs.
// Errors fail QA (Forge rewrites) and block dispatch; warnings ride along to Navin's Telegram approval. C2 (history, search-heavy)
// adds rules: the source link in the description, a name or a year in the title.
// Self-test: node studio/qa.test.ts
import fs from 'node:fs';

export type Meta = {title: string; description: string; tags: string[]};
type Doc = {channel?: string; caption?: string; hashtags?: string[]; meta?: {source?: string}};

// YouTube category: 28 Science & Technology (C1, C3), 27 Education (C2 Backstory)
export const categoryOf = (channel?: string) => (channel === 'c2-reach' ? '27' : '28');

// The AI-voiceover disclosure (engine/scripts/make.mjs puts it in every voiced variant's caption through the preset template)
export const AI_VOICE = 'Voiceover: AI-generated voice.';
// description: the YouTube variant's own caption.txt (its template already holds the CTA line, the disclosure and hashtags)
export const youtubeMeta = (doc: Doc, description: string): Meta => ({
  title: String(doc.caption ?? '').split('\n')[0].slice(0, 100),
  description: description.trim(),
  tags: (doc.hashtags ?? []).map((h) => h.replace(/^#/, '')),
});

const DASH_OR_EMOJI = /[\u2013\u2014]|\p{Extended_Pictographic}/u;
const words = (s: string) => (s.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);

// A variant's caption.txt ('' when missing: SEO then fails on the empty description, which is the right answer)
export const captionOf = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');

export const seoCheck = (m: Meta, doc: Doc) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const t = m.title.trim();
  if (!t) errors.push('SEO-T1 the title is empty (caption line 1)');
  if (t.length > 70) warnings.push(`SEO-T2 title is ${t.length} characters; search results cut it near 70`);
  else if (t && t.length < 20) warnings.push(`SEO-T3 title is ${t.length} characters; too short to say what the video is`);
  if (DASH_OR_EMOJI.test(m.title + m.description)) errors.push('SEO-T4 no em or en dashes and no emojis in the title or description');
  const body = m.description.replace(/#\S+/g, '').trim();
  if (body.length < 120) warnings.push(`SEO-D1 description has ${body.length} characters besides hashtags; the first lines are what search shows`);
  const hashtags = (m.description.match(/#\S+/g) ?? []).length;
  if (hashtags > 15) errors.push(`SEO-G3 ${hashtags} hashtags; YouTube ignores all of them above 15`);
  if (m.tags.length < 3) warnings.push(`SEO-G1 only ${m.tags.length} tag(s); use 3 to 5`);
  if (m.tags.join(',').length > 500) errors.push('SEO-G2 tags exceed YouTube\'s 500 characters');
  const tagWords = new Set(m.tags.flatMap(words));
  if (t && m.tags.length && !words(t).some((w) => tagWords.has(w) || [...tagWords].some((x) => x.includes(w) || w.includes(x)))) warnings.push('SEO-K1 no title keyword appears in the tags');
  if (doc.channel === 'c2-reach') {
    if (!doc.meta?.source || !m.description.includes(doc.meta.source)) errors.push('SEO-S1 C2: the description must carry the source link (end the caption with "Source: <meta.source>")');
    if (t && !/\b(1[0-9]{3}|20[0-9]{2})\b/.test(t) && !/\s[A-Z][a-z]+/.test(t)) warnings.push('SEO-H1 C2: put the name or the year people search for in the title');
  }
  return {errors, warnings};
};
