// Telegram approvals: approve the week from the phone, anywhere, with nothing opened to the internet.
// send(): each QA-passed, not yet approved video of the week goes to Navin's chat with an Approve button (+ "Approve all").
// poll(): the Mac long-polls Telegram for button taps (no webhook, no tunnel). A tap only counts when it comes from
// TELEGRAM_CHAT_ID in that private chat; it is then turned into the same signed approval the web links use and goes through
// applyApproval() (QA, week, channel and replay checks all apply). The bot token never leaves .env and is never logged.
//
// node studio/telegram.ts <channel> <YYYY-Www> [--again]   send the week's QA-passed videos (each once; --again resends)
// polling runs inside approve-server.ts when TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set
import fs from 'node:fs';
import path from 'node:path';
import {decide} from './experiment.ts';
import {decideProposal} from './improve.ts';
import {applyResolve, resolveQuery} from './dispatch.ts';
import {applyApproval, approvalQuery, currentStatus, findVideo, needsApproval, PATHS, type Paths, qaSummary, shown, type Video, weekVideos} from './ledger.ts';
import type {Platform} from './variant.ts';

export type Tg = (method: string, body: Record<string, unknown> | FormData) => Promise<any>;
export const telegram = (token: string): Tg => async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, body instanceof FormData ? {method: 'POST', body} : {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram ${method}: ${j.description ?? `HTTP ${r.status}`}`); // never includes the token
  return j.result;
};

const button = (text: string, data: string) => ({inline_keyboard: [[{text, callback_data: data}]]}); // callback_data max 64 bytes

// What Navin has been shown: one render per line (`<id>|<video hash>`), so a re-render is shown again. Sends never repeat;
// "Approve all" covers only these.
const sentFile = (p: Paths) => path.join(p.state, 'telegram-sent.txt');
export const sentIds = (p: Paths = PATHS) => new Set(fs.existsSync(sentFile(p)) ? fs.readFileSync(sentFile(p), 'utf8').split('\n').filter(Boolean) : []);
export const renderKey = (v: Video) => `${v.id}|${shown(v)?.manifest?.video_sha256 ?? ''}`;


export const notify = (tg: Tg, chatId: string, text: string) => tg('sendMessage', {chat_id: chatId, text});

export const send = async (tg: Tg, chatId: string, channel: string, week: string, p: Paths = PATHS, o: {again?: boolean} = {}) => {
  const status = currentStatus(p);
  const sent = sentIds(p);
  const week_ = weekVideos(channel, week, p);
  // one message per render covers the video and its platform variants: shown once a variant passed QA and still needs approval
  const ready = week_.map((x) => x.video).filter((v) => v && needsApproval(v, status) && (o.again || !sent.has(renderKey(v))));
  for (const v of ready) {
    const q = qaSummary(v!);
    const show = v!.variants[q.passed[0]]!; // a passing variant's video stands for the others
    const form = new FormData();
    form.set('chat_id', chatId);
    const cta = (pl: Platform) => v!.variants[pl]?.manifest?.cta_text;
    const lines = [`${v!.id} (${v!.doc.channel})`, `Video: the ${q.passed[0]} variant`, '', String(v!.doc.caption).slice(0, 600), '', 'One tap approves every ready variant:', ...q.passed.map((pl) => `${pl}: ready, CTA "${cta(pl)}"`), ...q.held.map((h) => `${h.split(':')[0]}: HELD (not approved by this tap):${h.slice(h.indexOf(':') + 1)}`), ...(q.warnings.length ? ['', `SEO: ${q.warnings.join('; ')}`] : [])];
    form.set('caption', lines.join('\n').slice(0, 1000));
    form.set('reply_markup', JSON.stringify(button(`Approve (${q.passed.join(', ')})`, `a|${v!.id}`)));
    form.set('video', new Blob([fs.readFileSync(show.file('mp4'))], {type: 'video/mp4'}), path.basename(show.file('mp4')));
    await tg('sendVideo', form);
    // the YouTube thumbnail arms ride with the video: A is the control; B (when the board has one) is the experiment's variant
    for (const [kind, label] of [['thumbnail.png', 'Thumbnail A (control)'], ['thumbnail-b.png', `Thumbnail B, title B: ${v!.doc.meta?.title_b ?? '(same title)'}`]]) {
      const img = v!.variants.youtube?.file(kind);
      if (!img || !fs.existsSync(img)) continue;
      const ph = new FormData();
      ph.set('chat_id', chatId);
      ph.set('caption', `${v!.id}: ${label}`.slice(0, 1000));
      ph.set('photo', new Blob([fs.readFileSync(img)], {type: 'image/png'}), path.basename(img));
      await tg('sendPhoto', ph);
    }
    fs.mkdirSync(p.state, {recursive: true});
    fs.appendFileSync(sentFile(p), `${renderKey(v!)}\n`);
  }
  // once every video of the week has been shown: one "Approve all" (it approves only what was shown)
  const seen = sentIds(p);
  if (ready.length && week_.length > 1 && week_.every((x) => x.video && seen.has(renderKey(x.video))))
    await tg('sendMessage', {chat_id: chatId, text: `${channel} ${week}: all ${week_.length} videos are in this chat.`, reply_markup: button(`Approve all ${week_.length}`, `A|${channel}|${week}`)});
  return ready.map((v) => v!.id);
};

// Uploads whose YouTube result is unknown (claimed "dispatching", YouTube targeted, no YouTube URL): ask Navin once per claim,
// with two buttons. Nothing is ever retried until he answers.
const askedFile = (p: Paths) => path.join(p.state, 'telegram-stuck.txt');
export const askResolve = async (tg: Tg, chatId: string, p: Paths = PATHS) => {
  const asked = new Set(fs.existsSync(askedFile(p)) ? fs.readFileSync(askedFile(p), 'utf8').split('\n').filter(Boolean) : []);
  const unknown = [...currentStatus(p).values()].filter((e) => e.status === 'dispatching' && e.platform === 'youtube' && !e.post_urls?.some((u) => u.includes('youtube.com/')));
  const sent: string[] = [];
  for (const e of unknown) {
    const key = `${e.storyboard_id}|${e.updated_at}`;
    if (asked.has(key)) continue;
    await tg('sendMessage', {
      chat_id: chatId,
      text: `${e.storyboard_id}: YouTube did not answer clearly, so this video will not be sent again by itself. Check YouTube Studio, then tell me:`,
      reply_markup: {inline_keyboard: [[{text: 'Not uploaded', callback_data: `n|${e.storyboard_id}`}, {text: 'Uploaded', callback_data: `u|${e.storyboard_id}`}]]},
    });
    fs.mkdirSync(p.state, {recursive: true});
    fs.appendFileSync(askedFile(p), `${key}\n`);
    sent.push(e.storyboard_id);
  }
  return sent;
};

const ASK_ID = (id: string) => `Reply to this message with the YouTube video ID (or its link) for ${id}.`;
// The 11-character video id from a bare id or a YouTube link (shorts, watch, youtu.be, studio); null if it is neither.
export const youtubeId = (t: string) => {
  const s = t.trim();
  const m = s.match(/(?:youtube\.com\/(?:shorts\/|watch\?v=|video\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
  return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
};

// One update from getUpdates. Returns the reply shown to Navin, or null when the update is ignored.
export const onUpdate = async (tg: Tg, u: any, o: {chatId: string; secret: string; paths?: Paths; now?: number}) => {
  const p = o.paths ?? PATHS;
  const now = o.now ?? Date.now();
  const exp = Math.floor(now / 1000) + 60;
  // a text reply to "Reply ... with the YouTube video ID for <id>": the answer to an "Uploaded" tap
  const m = u.message;
  if (m) {
    const asked = String(m.reply_to_message?.text ?? '').match(/video ID \(or its link\) for ([a-z0-9][a-z0-9-]*)\.$/)?.[1];
    if (String(m.from?.id) !== o.chatId || String(m.chat?.id) !== o.chatId || !asked || m.reply_to_message?.from?.is_bot !== true) return null; // not Navin, or not an answer
    const yid = youtubeId(String(m.text ?? ''));
    let text: string;
    if (!yid) text = `That is not a YouTube video ID. Reply again to the question with the 11-character ID or the link.`;
    else
      try {
        applyResolve(resolveQuery(asked, yid, o.secret, exp), o.secret, p, now);
        text = `${asked}: recorded https://www.youtube.com/shorts/${yid}. The next hourly run finishes it without uploading again.`;
      } catch (e) {
        text = `Refused: ${(e as Error).message}`;
      }
    await tg('sendMessage', {chat_id: o.chatId, text});
    return text;
  }
  const q = u.callback_query;
  if (!q) return null;
  const mine = String(q.from?.id) === o.chatId && String(q.message?.chat?.id) === o.chatId; // Navin, in his private chat with the bot
  let text: string;
  if (!mine) text = 'Not allowed.';
  else if (/^x\|/.test(String(q.data))) {
    // the separate decision after an experiment result (studio/experiment.ts): adopt B or keep A
    const [, id, choice] = String(q.data).split('|');
    try {
      decide(p, id, choice === 'adopt' ? 'adopt' : 'keep', now);
      text = choice === 'adopt' ? `${id}: B adopted. The next hourly run applies it on YouTube.` : `${id}: keeping A.`;
    } catch (e) {
      text = `Refused: ${(e as Error).message}`;
    }
    await tg('sendMessage', {chat_id: o.chatId, text});
  } else if (/^p\|/.test(String(q.data))) {
    // a Tier 2 proposal from Learn (studio/improve.ts): only this tap applies it
    const [, id, choice] = String(q.data).split('|');
    try {
      text = decideProposal(p, id, choice === 'yes', now);
    } catch (e) {
      text = `Refused: ${(e as Error).message}`;
    }
    await tg('sendMessage', {chat_id: o.chatId, text});
  } else if (/^[nu]\|/.test(String(q.data))) {
    const id = String(q.data).slice(2);
    if (String(q.data)[0] === 'u') {
      await tg('sendMessage', {chat_id: o.chatId, text: ASK_ID(id), reply_markup: {force_reply: true, input_field_placeholder: 'YouTube video ID or link'}});
      text = `Waiting for the video ID of ${id}.`;
    } else
      try {
        applyResolve(resolveQuery(id, 'none', o.secret, exp), o.secret, p, now);
        text = `${id}: marked not uploaded. It goes out again within the hour.`;
      } catch (e) {
        text = `Refused: ${(e as Error).message}`;
      }
    await tg('sendMessage', {chat_id: o.chatId, text});
  } else {
    const [kind, a, b] = String(q.data ?? '').split('|');
    const v = kind === 'a' ? findVideo(a, p) : null;
    const target = kind === 'A' ? {channel: a, week: b, ids: weekVideos(a, b, p).flatMap((x) => (x.video && sentIds(p).has(renderKey(x.video)) ? [x.video.id] : []))} : v?.recipe ? {channel: v.doc.channel, week: v.recipe.week, ids: [v.id]} : null;
    if (!target) text = 'Video not found.';
    else
      try {
        const r = applyApproval(approvalQuery({...target, by: 'navin', exp}, o.secret), o.secret, {paths: p, now});
        const by = new Map<string, string[]>();
        for (const e of r.written) by.set(e.storyboard_id, [...(by.get(e.storyboard_id) ?? []), e.platform]);
        text = [r.written.length ? `Approved: ${[...by].map(([id, pfs]) => `${id} (${pfs.join(', ')})`).join(', ')}` : 'Nothing new approved.', ...r.skipped].join('\n');
      } catch (e) {
        text = `Refused: ${(e as Error).message}`;
      }
    await tg('sendMessage', {chat_id: o.chatId, text});
  }
  await tg('answerCallbackQuery', {callback_query_id: q.id, text: text.slice(0, 190)}).catch(() => {});
  return text;
};

// Long-poll forever; the offset file stops a restart from replaying taps.
export const poll = async (tg: Tg, o: {chatId: string; secret: string}, p: Paths = PATHS) => {
  const f = path.join(p.state, 'telegram-offset');
  let offset = fs.existsSync(f) ? Number(fs.readFileSync(f, 'utf8')) : 0;
  for (;;) {
    try {
      for (const u of await tg('getUpdates', {offset, timeout: 50, allowed_updates: ['callback_query', 'message']})) {
        offset = u.update_id + 1;
        fs.writeFileSync(f, String(offset));
        console.log(`telegram: ${(await onUpdate(tg, u, o)) ?? 'ignored'}`.replace(/\n/g, '; '));
      }
    } catch (e) {
      console.error((e as Error).message);
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
};

if (import.meta.main) {
  const [channel, week] = process.argv.slice(2);
  if (!channel || !/^\d{4}-W\d{2}$/.test(week ?? '')) {
    console.error('usage: node studio/telegram.ts <channel> <YYYY-Www>');
    process.exit(2);
  }
  const envFile = path.join(import.meta.dirname, '..', '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  const {TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId} = process.env;
  if (!token || !chatId) {
    console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in agent-studio/.env first.');
    process.exit(2);
  }
  const ids = await send(telegram(token), chatId, channel, week, PATHS, {again: process.argv.includes('--again')});
  console.log(ids.length ? `sent ${ids.length} for approval: ${ids.join(', ')}` : 'nothing to send (no QA-passed video waiting for approval)');
}
