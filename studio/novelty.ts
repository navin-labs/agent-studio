// The 7 novelty rules (docs/TECH.md). Pure functions over fingerprints: Recipe redraws until a plan passes, QA re-checks the finished video.
// A rule whose field is missing (topic, metaphor, caption opener are only known after writing) is skipped, not passed by accident.
// Self-test: node studio/recipe.test.ts

export type Fingerprint = {
  id: string;
  channel: string;
  date: string; // YYYY-MM-DD, one post per channel per day
  primitives: string[];
  opening: string;
  theme: string;
  hook_pattern: string;
  topic_text?: string;
  hero_metaphor?: string;
  caption_opener?: string;
  hash?: string; // recipe fingerprint: theme + shot sequence + hook pattern
};
export type Rule = 'topic' | 'structure' | 'opening' | 'hero-metaphor' | 'theme' | 'hook-pattern' | 'cross-channel';
export type Violation = {rule: Rule; error: string};

export const LIMITS = {topicSimilarity: 0.75, topicWindow: 60, structureDistance: 0.6, structureWindow: 10, openingPerWeek: 2, metaphorDays: 14, themeRun: 3, hookRun: 3, captionWindow: 2};

const DAY = 864e5;
export const addDays = (date: string, n: number) => new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);

// ISO week, e.g. 2026-W40; weeks start on Monday.
export const isoWeek = (date: string) => {
  const d = new Date(date + 'T00:00:00Z');
  const thu = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * DAY);
  const jan1 = Date.UTC(thu.getUTCFullYear(), 0, 1);
  return `${thu.getUTCFullYear()}-W${String(Math.ceil(((thu.getTime() - jan1) / DAY + 1) / 7)).padStart(2, '0')}`;
};
export const weekStart = (week: string) => {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  return addDays(jan4.toISOString().slice(0, 10), (w - 1) * 7 - ((jan4.getUTCDay() + 6) % 7));
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const trigrams = (s: string) => {
  const t = ` ${norm(s)} `;
  return new Set(Array.from({length: Math.max(0, t.length - 2)}, (_, i) => t.slice(i, i + 3)));
};
const jaccard = <T,>(a: Set<T>, b: Set<T>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / (a.size + b.size - inter || 1);
};
// ponytail: character-trigram Jaccard; TF-IDF if near-duplicate topics slip through with reworded titles.
export const topicSimilarity = (a: string, b: string) => jaccard(trigrams(a), trigrams(b));
// Shot set plus ordered neighbour pairs, so the same shots in a new order still count as different.
export const structureDistance = (a: string[], b: string[]) => {
  const bag = (p: string[]) => new Set([...p, ...p.slice(1).map((x, i) => `${p[i]}>${x}`)]);
  return 1 - jaccard(bag(a), bag(b));
};

// themes: how many themes the channel renders in; a one-theme channel (C1 night, C2 archive) cannot vary its theme, so that rule is off.
export const checkNovelty = (fp: Fingerprint, history: Fingerprint[], o: {themes?: number} = {}): Violation[] => {
  const out: Violation[] = [];
  const v = (rule: Rule, error: string) => out.push({rule, error});
  const before = history.filter((h) => h.date < fp.date).sort((a, b) => a.date.localeCompare(b.date));
  const mine = before.filter((h) => h.channel === fp.channel);
  const onDay = (n: number) => mine.find((h) => h.date === addDays(fp.date, -n));

  if (fp.topic_text)
    for (const h of before.slice(-LIMITS.topicWindow))
      if (h.topic_text && topicSimilarity(fp.topic_text, h.topic_text) >= LIMITS.topicSimilarity) v('topic', `topic too close to ${h.id} (${h.date}): "${h.topic_text}"`);

  for (const h of mine.slice(-LIMITS.structureWindow)) {
    const d = structureDistance(fp.primitives, h.primitives);
    if (d < LIMITS.structureDistance) v('structure', `shot sequence too close to ${h.id} (${h.date}): distance ${d.toFixed(2)} < ${LIMITS.structureDistance}`);
  }

  if (onDay(1)?.opening === fp.opening) v('opening', `opens with ${fp.opening} like yesterday's ${onDay(1)!.id}`);
  const week = mine.filter((h) => daysBetween(fp.date, h.date) < 7 && h.opening === fp.opening);
  if (week.length >= LIMITS.openingPerWeek) v('opening', `${fp.opening} already opened ${week.length} posts in the last 7 days`);

  if (fp.hero_metaphor) {
    const hit = mine.find((h) => h.hero_metaphor && norm(h.hero_metaphor) === norm(fp.hero_metaphor!) && daysBetween(fp.date, h.date) < LIMITS.metaphorDays);
    if (hit) v('hero-metaphor', `hero metaphor "${fp.hero_metaphor}" used by ${hit.id} (${hit.date}), within ${LIMITS.metaphorDays} days`);
  }

  const run = Array.from({length: LIMITS.themeRun - 1}, (_, i) => onDay(i + 1));
  if (o.themes !== 1 && run.every((h) => h?.theme === fp.theme)) v('theme', `theme ${fp.theme} would run ${LIMITS.themeRun} days in a row`);

  const last = mine.slice(-(LIMITS.hookRun - 1));
  if (last.length === LIMITS.hookRun - 1 && last.every((h) => h.hook_pattern === fp.hook_pattern)) v('hook-pattern', `hook pattern ${fp.hook_pattern} would run ${LIMITS.hookRun} posts in a row`);
  if (fp.caption_opener) {
    const hit = mine.slice(-LIMITS.captionWindow).find((h) => h.caption_opener && norm(h.caption_opener) === norm(fp.caption_opener!));
    if (hit) v('hook-pattern', `caption opener repeats ${hit.id}: "${fp.caption_opener}"`);
  }

  if (fp.hash) {
    const hit = history.find((h) => h.channel !== fp.channel && h.hash === fp.hash && isoWeek(h.date) === isoWeek(fp.date));
    if (hit) v('cross-channel', `recipe fingerprint ${fp.hash} already used on ${hit.channel} this week (${hit.id})`);
  }
  return out;
};
