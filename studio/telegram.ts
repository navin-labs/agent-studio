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
import {applyResolve, resolveQuery} from './dispatch.ts';
import {applyApproval, approvalQuery, currentStatus, findVideo, PATHS, type Paths, weekVideos} from './ledger.ts';

export type Tg = (method: string, body: Record<string, unknown> | FormData) => Promise<any>;
export const telegram = (token: string): Tg => async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, body instanceof FormData ? {method: 'POST', body} : {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram ${method}: ${j.description ?? `HTTP ${r.status}`}`); // never includes the token
  return j.result;
};

const button = (text: string, data: string) => ({inline_keyboard: [[{text, callback_data: data}]]}); // callback_data max 64 bytes

// What Navin has been shown: one id per line. Sends never repeat; "Approve all" covers only these.
const sentFile = (p: Paths) => path.join(p.state, 'telegram-sent.txt');
export const sentIds = (p: Paths = PATHS) => new Set(fs.existsSync(sentFile(p)) ? fs.readFileSync(sentFile(p), 'utf8').split('\n').filter(Boolean) : []);

export const notify = (tg: Tg, chatId: string, text: string) => tg('sendMessage', {chat_id: chatId, text});

export const send = async (tg: Tg, chatId: string, channel: string, week: string, p: Paths = PATHS, o: {again?: boolean} = {}) => {
  const status = currentStatus(p);
  const sent = sentIds(p);
  const week_ = weekVideos(channel, week, p);
  const ready = week_.map((x) => x.video).filter((v) => v?.qa?.pass && !status.get(v.id)?.status?.match(/approved|dispatched|published/) && (o.again || !sent.has(v.id)));
  for (const v of ready) {
    const form = new FormData();
    form.set('chat_id', chatId);
    form.set('caption', `${v!.id}\n\n${String(v!.doc.caption).slice(0, 900)}`);
    form.set('reply_markup', JSON.stringify(button('Approve', `a|${v!.id}`)));
    form.set('video', new Blob([fs.readFileSync(path.join(v!.outDir, 'reel.mp4'))], {type: 'video/mp4'}), `${v!.id}.mp4`);
    await tg('sendVideo', form);
    fs.mkdirSync(p.state, {recursive: true});
    fs.appendFileSync(sentFile(p), `${v!.id}\n`);
  }
  // once every video of the week has been shown: one "Approve all" (it approves only what was shown)
  const shown = sentIds(p);
  if (ready.length && week_.length > 1 && week_.every((x) => x.video && shown.has(x.video.id)))
    await tg('sendMessage', {chat_id: chatId, text: `${channel} ${week}: all ${week_.length} videos are in this chat.`, reply_markup: button(`Approve all ${week_.length}`, `A|${channel}|${week}`)});
  return ready.map((v) => v!.id);
};

// Uploads whose YouTube result is unknown (claimed "dispatching", YouTube targeted, no YouTube URL): ask Navin once per claim,
// with two buttons. Nothing is ever retried until he answers.
const askedFile = (p: Paths) => path.join(p.state, 'telegram-stuck.txt');
export const askResolve = async (tg: Tg, chatId: string, p: Paths = PATHS) => {
  const asked = new Set(fs.existsSync(askedFile(p)) ? fs.readFileSync(askedFile(p), 'utf8').split('\n').filter(Boolean) : []);
  const unknown = [...currentStatus(p).values()].filter((e) => e.status === 'dispatching' && e.targets?.includes('youtube') && !e.post_urls?.some((u) => u.includes('youtube.com/')));
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
  else if (/^[nu]\|/.test(String(q.data))) {
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
    const target = kind === 'A' ? {channel: a, week: b, ids: weekVideos(a, b, p).flatMap((x) => (x.video && sentIds(p).has(x.video.id) ? [x.video.id] : []))} : v?.recipe ? {channel: v.doc.channel, week: v.recipe.week, ids: [v.id]} : null;
    if (!target) text = 'Video not found.';
    else
      try {
        const r = applyApproval(approvalQuery({...target, by: 'navin', exp}, o.secret), o.secret, {paths: p, now});
        text = [r.written.length ? `Approved: ${r.written.map((e) => e.storyboard_id).join(', ')}` : 'Nothing new approved.', ...r.skipped].join('\n');
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
