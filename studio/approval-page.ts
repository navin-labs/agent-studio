// The weekly approval page: one static HTML per channel and week. Every recipe slot shows its contact sheet, hook, caption and
// QA result; only videos whose QA passed get an approve link, and "approve all" covers exactly those. Links are signed
// (ledger.ts) and expire after LINK_DAYS. Needs APPROVAL_WEBHOOK_URL and APPROVAL_SECRET in the environment.
//
// node studio/approval-page.ts <channel> <YYYY-Www>   -> state/approval/<channel>/<week>/index.html (+ contact sheets beside it)
import fs from 'node:fs';
import path from 'node:path';
import {approvalQuery, currentStatus, findVideo, PATHS, type Paths, weekRecipes} from './ledger.ts';
import {recipeDate} from './recipe.ts';

export const LINK_DAYS = 7;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);
const plain = (s = '') => s.replace(/\*/g, '');

export type Row = {slot: number; date: string; recipeId: string; id?: string; state: 'approve' | 'approved' | 'failed' | 'missing'; note: string; hook?: string; caption?: string; sheet?: string; seconds?: string};

export const buildPage = (channel: string, week: string, env: {url: string; secret: string; now?: number; by?: string}, p: Paths = PATHS) => {
  if (!/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)[:/])/.test(env.url)) throw new Error('APPROVAL_WEBHOOK_URL must be https, or http on localhost (the local n8n)');
  if (env.secret.length < 16) throw new Error('APPROVAL_SECRET must be at least 16 characters');
  const now = env.now ?? Date.now();
  const exp = Math.floor(now / 1000) + LINK_DAYS * 86400;
  const by = env.by ?? 'navin';
  const recipes = weekRecipes(channel, week, p);
  if (!recipes.length) throw new Error(`no recipes for ${channel} ${week}`);
  const status = currentStatus(p);
  const dir = path.join(p.state, 'approval', channel, week);
  fs.mkdirSync(dir, {recursive: true});
  const boards = [...p.content].flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d, {recursive: true, encoding: 'utf8'}).filter((f) => f.endsWith('.json')).map((f) => path.join(d, f)) : []));
  const rows: Row[] = recipes.map((r) => {
    const base = {slot: r.slot, date: recipeDate(r), recipeId: r.id};
    const file = boards.find((f) => {
      try {
        const d = JSON.parse(fs.readFileSync(f, 'utf8'));
        return d?.meta?.recipe_id === r.id && d.channel === channel;
      } catch {
        return false;
      }
    });
    if (!file) return {...base, state: 'missing', note: 'not written yet'};
    const v = findVideo(path.basename(file, '.json'), p)!;
    const first = v.doc.scenes[0];
    const row = {...base, id: v.id, hook: plain(first.vo ?? first.params?.text), caption: v.doc.caption};
    if (!v.qa) return {...row, state: 'missing', note: 'not rendered and checked yet'};
    const sheet = path.join(v.outDir, 'contact.png');
    if (fs.existsSync(sheet)) fs.copyFileSync(sheet, path.join(dir, `${v.id}.png`));
    const withSheet = {...row, sheet: fs.existsSync(sheet) ? `${v.id}.png` : undefined};
    if (!v.qa.pass) return {...withSheet, state: 'failed', note: v.qa.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.error}`).join('\n')};
    const st = status.get(v.id)?.status;
    if (st && st !== 'qa-failed' && st !== 'rendered' && st !== 'pending-approval') return {...withSheet, state: 'approved', note: st};
    return {...withSheet, state: 'approve', note: 'QA passed'};
  });

  const link = (ids: string[]) => `${env.url}?${approvalQuery({channel, week, ids, by, exp}, env.secret)}`;
  const ready = rows.filter((r) => r.state === 'approve').map((r) => r.id!);
  const card = (r: Row) => `
  <article class="${r.state}">
    <header><b>${esc(r.date)}</b> slot ${r.slot} <code>${esc(r.id ?? r.recipeId)}</code> <span class="tag">${esc(r.state === 'approve' ? 'ready' : r.state)}</span></header>
    ${r.sheet ? `<img src="${esc(r.sheet)}" alt="contact sheet for ${esc(r.id)}">` : ''}
    ${r.hook ? `<p class="hook">${esc(r.hook)}</p>` : ''}
    ${r.caption ? `<details><summary>Caption</summary><pre>${esc(r.caption)}</pre></details>` : ''}
    ${r.state === 'approve' ? `<a class="btn" href="${esc(link([r.id!]))}">Approve</a>` : `<pre class="note">${esc(r.note)}</pre>`}
  </article>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Approve ${esc(channel)} ${esc(week)}</title>
<style>
:root{--bg:#F4F1EA;--card:#fff;--ink:#111;--muted:#6b6b6b;--ok:#2f7d32;--bad:#b3261e;--accent:#C6F432}
@media (prefers-color-scheme:dark){:root{--bg:#0B0B10;--card:#15151C;--ink:#F4F1EA;--muted:#9C9A94}}
body{margin:0;padding:16px;background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,sans-serif}
main{max-width:1160px;margin:auto;display:grid;gap:16px}
article{background:var(--card);border-radius:12px;padding:16px;display:grid;gap:10px}
article.failed{outline:2px solid var(--bad)} article.approved{opacity:.7}
img{width:100%;height:auto;border-radius:8px}
.tag{float:right;font-size:13px;color:var(--muted)} .hook{font-size:20px;font-weight:700;margin:0}
pre{white-space:pre-wrap;margin:0;font:13px/1.4 ui-monospace,monospace} .note{color:var(--muted)} .failed .note{color:var(--bad)}
.btn{justify-self:start;background:var(--accent);color:#0B0B10;font-weight:700;padding:10px 18px;border-radius:999px;text-decoration:none}
</style></head><body><main>
<h1>${esc(channel)} · ${esc(week)}</h1>
<p>${ready.length} of ${rows.length} ready. Links expire ${esc(new Date(exp * 1000).toISOString().slice(0, 16).replace('T', ' '))} UTC. Nothing is published until approved.</p>
${ready.length > 1 ? `<a class="btn" href="${esc(link(ready))}">Approve all ${ready.length}</a>` : ''}
${rows.map(card).join('')}
</main></body></html>
`;
  const out = path.join(dir, 'index.html');
  fs.writeFileSync(out, html);
  return {file: out, rows, ready};
};

if (import.meta.main) {
  const [channel, week] = process.argv.slice(2);
  if (!channel || !/^\d{4}-W\d{2}$/.test(week ?? '')) {
    console.error('usage: node studio/approval-page.ts <channel> <YYYY-Www>');
    process.exit(2);
  }
  const envFile = path.join(import.meta.dirname, '..', '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.APPROVAL_WEBHOOK_URL;
  const secret = process.env.APPROVAL_SECRET;
  if (!url || !secret) {
    console.error('Set APPROVAL_WEBHOOK_URL and APPROVAL_SECRET (16+ characters) in agent-studio/.env first.');
    process.exit(1);
  }
  const r = buildPage(channel, week, {url, secret});
  for (const row of r.rows) console.log(`${row.date} slot ${row.slot} ${row.state.padEnd(8)} ${row.id ?? row.recipeId}`);
  console.log(`-> ${path.relative(path.join(PATHS.state, '..'), r.file)}`);
}
