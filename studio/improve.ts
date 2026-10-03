// The self-improving loop's Tier 2 and its weekly note (docs/TECH.md "Self-improving loop").
//   Tier 1 (studio/learn.ts, applied by Recipe, the Writer and Dispatch without a tap, logged in state/learn/changes.jsonl):
//     rest losing primitives, prefer the ones that hold viewers, prefer winning hook patterns, Writer guidance on captions, CTA
//     and length within the approved style, posting times; thumbnail arms rotate in studio/experiment.ts (EXPERIMENTS=on).
//   Tier 2 (here): proposed to Navin on Telegram only when the evidence is there, applied only by his tap:
//     style  switch the channel to another style preset (a newer version, or back to one that scored better)
//     grammar  take a primitive out of the channel's grammar for good (it kept losing viewers or kept being rested)
//   Never touched by Learn or by a tap here: voices, colour tokens, the AI-voiceover disclosure, C2's every-claim-sourced rule,
//   approval gates, `live` flags, dispatch switches. applyProposal writes exactly one thing: channel.json "style", or the
//   channel's grammar removals (state/learn/<channel>/grammar.json). Any other kind is refused.
//
// node studio/improve.ts <channel>        what Learn would propose now, and the weekly note (dry run, nothing sent or applied)
import fs from 'node:fs';
import path from 'node:path';
import {changesFile, type Change, guidanceWords, learnFile, type Learned, MIN_N, UNBENCHABLE} from './learn.ts';
import {appendJsonl, PATHS, type Paths, readJsonl} from './ledger.ts';
import {FORMATS, loadStyle, type Recipe, type Style} from './recipe.ts';

export type Proposal = {id: string; channel: string; kind: 'style' | 'grammar'; title: string; before: string; after: string; expect: string; style?: string; primitive?: string; at: string; status: 'pending' | 'sent' | 'approved' | 'declined'};
export const proposalsFile = (p: Paths) => path.join(p.state, 'learn', 'proposals.jsonl');
export const grammarFile = (p: Paths, ch: string) => path.join(p.state, 'learn', ch, 'grammar.json');
export const GUARDED = ['voice', 'live', 'themes', 'disclosure', 'sourcing', 'approval', 'dispatch'] as const;
const STYLES = path.join(import.meta.dirname, '..', 'styles');

// The latest line per proposal id is its state.
export const proposals = (p: Paths = PATHS) => [...new Map(readJsonl<Proposal>(proposalsFile(p)).map((x) => [x.id, x])).values()];
const channelJson = (p: Paths, ch: string) => path.join(p.channels, ch, 'channel.json');
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

// What the evidence supports now. Each proposal is made once (its id is the change itself); a declined one is not asked again.
export const propose = (p: Paths, ch: string, now = Date.now(), stylesDir = STYLES): Proposal[] => {
  const lf = learnFile(ch, p);
  if (!fs.existsSync(lf)) return [];
  const L: Learned = JSON.parse(fs.readFileSync(lf, 'utf8'));
  const active = JSON.parse(fs.readFileSync(channelJson(p, ch), 'utf8')).style as string | undefined;
  const known = new Set(proposals(p).map((x) => x.id));
  const at = new Date(now).toISOString();
  const out: Proposal[] = [];
  const add = (x: Omit<Proposal, 'at' | 'status' | 'channel'>) => !known.has(x.id) && out.push({...x, channel: ch, at, status: 'pending'});
  const styles = L.scores?.styles ?? [];
  const row = (id?: string) => styles.find((r) => r.value === id);

  if (active) {
    const cur = loadStyle(active, stylesDir);
    const base = row(active);
    // a newer version of the channel's style: proposed once the current one has a baseline to compare against afterwards
    const newer = fs.readdirSync(stylesDir).map((f) => loadStyle(f.replace(/\.json$/, ''), stylesDir)).filter((s: Style) => s.channel === ch && s.version > cur.version).sort((a, b) => b.version - a.version)[0];
    if (newer && base && base.n >= MIN_N)
      add({id: `style:${ch}:${newer.id}`, kind: 'style', style: newer.id, title: `Switch ${ch} to ${newer.id}`, before: `${active}: ${pct(base.kpi)} over ${base.n} videos`, after: newer.about, expect: newer.expect ?? 'a clearer, more recognisable video'});
    // another version that has scored clearly better (10% over at least 2 x MIN_N videos each): switch back to it
    for (const r of styles.filter((x) => x.value !== active && x.n >= 2 * MIN_N && base && base.n >= 2 * MIN_N && x.kpi >= base.kpi * 1.1))
      add({id: `style:${ch}:${r.value}:back`, kind: 'style', style: r.value, title: `Switch ${ch} back to ${r.value}`, before: `${active}: ${pct(base!.kpi)} over ${base!.n} videos`, after: `${r.value}: ${pct(r.kpi)} over ${r.n} videos`, expect: `the channel KPI back toward ${pct(r.kpi)}`});
  }

  // grammar: a primitive that keeps losing viewers (retention <= 0.85 of the channel at the same scene, 2 x MIN_N videos), or
  // was rested twice; never one that some beat cannot do without
  const removed = new Set<string>(fs.existsSync(grammarFile(p, ch)) ? JSON.parse(fs.readFileSync(grammarFile(p, ch), 'utf8')).removed : []);
  const rested = readJsonl<Change>(changesFile(p)).filter((c) => c.channel === ch && c.what.startsWith('rested '));
  for (const s of L.scores?.primitives ?? []) {
    if (removed.has(s.primitive) || UNBENCHABLE.has(s.primitive) || !canRemove(ch, s.primitive, removed)) continue;
    const times = rested.filter((c) => c.what.startsWith(`rested ${s.primitive} `)).length;
    const leaking = s.retention !== undefined && s.retention <= 0.85 && (s.retention_n ?? 0) >= 2 * MIN_N;
    if (leaking || times >= 2)
      add({id: `grammar:${ch}:${s.primitive}`, kind: 'grammar', primitive: s.primitive, title: `Take ${s.primitive} out of ${ch}'s videos for good`, before: leaking ? `${s.primitive} keeps ${s.retention!.toFixed(2)} of the viewers the channel keeps at the same scene, over ${s.retention_n} videos` : `${s.primitive} was rested ${times} times (${pct(s.kpi)} over ${s.n} videos)`, after: `${s.primitive} is never drawn again; its beats use the other shots`, expect: 'retention at those scenes back to at least the channel average'});
  }
  appendJsonl(proposalsFile(p), out);
  return out;
};

// Removing must leave every beat of every format of this channel at least one primitive.
const canRemove = (ch: string, prim: string, removed: Set<string>) =>
  Object.values(FORMATS).filter((f) => (f.channels as readonly string[]).includes(ch)).every((f) => f.beats.every((b) => !b.includes(prim as never) || b.some((x) => x !== prim && !removed.has(x))));

// Navin's tap. Approve applies exactly one whitelisted change; decline records it. Nothing else can apply a proposal.
export const decideProposal = (p: Paths, id: string, yes: boolean, now = Date.now(), stylesDir = STYLES) => {
  const x = proposals(p).find((q) => q.id === id);
  if (!x) throw new Error(`no proposal ${id}`);
  if (x.status === 'approved' || x.status === 'declined') throw new Error(`${id} was already ${x.status}`);
  if (yes) applyProposal(p, x, stylesDir);
  appendJsonl(proposalsFile(p), [{...x, status: yes ? 'approved' : 'declined', at: new Date(now).toISOString()}]);
  return yes ? `Applied: ${x.title}.` : `Not now: ${x.title}.`;
};

export const applyProposal = (p: Paths, x: Pick<Proposal, 'kind' | 'channel' | 'style' | 'primitive'>, stylesDir = STYLES) => {
  if (x.kind === 'style') {
    const s = loadStyle(x.style!, stylesDir);
    if (s.channel !== x.channel) throw new Error(`${s.id} belongs to ${s.channel}`);
    const f = channelJson(p, x.channel);
    const before = JSON.parse(fs.readFileSync(f, 'utf8'));
    fs.writeFileSync(f, JSON.stringify({...before, style: s.id}, null, 2) + '\n'); // the one setting; voice, live, CTAs untouched
  } else if (x.kind === 'grammar') {
    const f = grammarFile(p, x.channel);
    const g = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {removed: []};
    if (!canRemove(x.channel, x.primitive!, new Set(g.removed))) throw new Error(`${x.primitive} is the last option in a beat`);
    fs.mkdirSync(path.dirname(f), {recursive: true});
    fs.writeFileSync(f, JSON.stringify({removed: [...new Set([...g.removed, x.primitive])]}, null, 2) + '\n');
  } else throw new Error(`Learn never changes "${x.kind}" (guarded: ${GUARDED.join(', ')})`);
};

const end = (s: string) => s.replace(/\.$/, '');
export const proposalText = (x: Proposal) => `Proposal for ${x.channel}: ${x.title}.\nNow: ${end(x.before)}.\nAfter: ${end(x.after)}.\nLearn expects: ${end(x.expect)}.\nNothing changes unless you tap Approve.`;

// The weekly note (sent with the Thursday recipes): what changed by itself this week and why, what waits for a tap, what is
// being tested next. Plain words.
export const weeklyNote = (p: Paths, ch: string, week: string, recipes: Pick<Recipe, 'experiment' | 'primitives'>[], now = Date.now()) => {
  const since = new Date(now - 7 * 864e5).toISOString();
  const changes = readJsonl<Change>(changesFile(p)).filter((c) => c.channel === ch && c.at >= since);
  const open = proposals(p).filter((x) => x.channel === ch && (x.status === 'pending' || x.status === 'sent'));
  const L: Learned | null = fs.existsSync(learnFile(ch, p)) ? JSON.parse(fs.readFileSync(learnFile(ch, p), 'utf8')) : null;
  const proven = new Set([...(L?.proven ?? []), ...(L?.retention?.holds ?? [])]);
  const tried = [...new Set(recipes.filter((r) => r.experiment).flatMap((r) => r.primitives).filter((x) => !proven.has(x)))];
  return [
    `${ch}, plan for ${week}: what the system learned`,
    changes.length ? `Changed by itself this week:\n${changes.map((c) => `- ${c.what}. Why: ${c.evidence}.`).join('\n')}` : `Changed by itself this week: nothing (${L?.videos ?? 0} videos with numbers so far; it needs ${MIN_N} per shot or pattern before it changes anything).`,
    open.length ? `Waiting for your tap:\n${open.map((x) => `- ${x.title}`).join('\n')}` : 'Waiting for your tap: nothing.',
    `Testing next: ${recipes.filter((r) => r.experiment).length} of ${recipes.length} videos try something not yet proven${tried.length ? ` (${tried.slice(0, 5).join(', ')})` : ''}.${L?.guidance?.writer ? ` The Writer follows Learn's guidance: ${guidanceWords(L.guidance.writer)}.` : ''}`,
  ].join('\n\n');
};

if (import.meta.main) {
  const ch = process.argv[2];
  if (!ch) {
    console.error('usage: node studio/improve.ts <channel>');
    process.exit(2);
  }
  const lf = learnFile(ch, PATHS);
  const L = fs.existsSync(lf) ? (JSON.parse(fs.readFileSync(lf, 'utf8')) as Learned) : null;
  console.log(L ? `findings from ${L.updated ?? L.week}: ${L.videos} videos` : 'no findings yet (Learn has not run for this channel)');
  console.log(`open proposals: ${proposals().filter((x) => x.channel === ch && ['pending', 'sent'].includes(x.status)).map((x) => x.title).join('; ') || 'none'} (dry run; the hourly tick proposes and sends)`);
}
