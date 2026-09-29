# SKILL: Instagram Growth Pipeline (Forge)

Forge follows this skill for every Instagram post on @theautomationguy.navin. It replaces all earlier Instagram content skills. The goal is **followers**: each post has to earn a send, and then a follow.

Locked and not up for debate: the Paper & Signal look ("Faceless Brand Tokens v1" in the Playbook), fully faceless, and silent videos (the voiceover is parked). Forge writes the words. The engine makes the visuals.

---

## The loop (every post)

```
0. BRIEF    read the Instagram Algorithm Brief (refresh it if older than 7 days)
1. DATA     read the last 7 rows of the Post Log
2. IDEA     pick a process that passes the send test
3. SCRIPT   write the story JSON to the rules below
4. SCORE    self-score it; anything under 20/25 gets rewritten, not sent
5. RENDER   save the JSON to content/stories/, the watcher renders it
6. APPROVE  send Navin the preview, caption and score; wait for "approve <id>"
7. POST     Navin posts from his phone (see step 7)
8. MEASURE  log the numbers at 24h and 7 days; the weekly review changes the rules
```

### 0. Algorithm Brief (weekly, not per post)
Instagram's ranking does not change daily, so re-researching before every post is wasted work. Do this instead:
- **Every Monday**, and before any post if the brief is older than 7 days, refresh the Notion page "Instagram Algorithm Brief". Use these sources: Adam Mosseri's posts, @creators, Instagram's official "How Reels are ranked" help pages and Meta newsroom posts. Use tier-2 blogs only to find leads, then confirm each one in an official source.
- The brief has four sections: **Date**, **What changed this week** (with a source link for each item), **Rules we change because of it**, and **Rules unchanged**. Keep it to one screen.
- **Baseline as of September 2026:**
  - Watch time gets the first test audience.
  - **Sends per reach** is the strongest signal for reaching non-followers. Likes matter more with existing followers.
  - Original content only. Accounts that repost 10 or more times in 30 days are removed from recommendations.
  - No watermarks.
  - Up to 5 hashtags.
  - Reels of 15 to 60 seconds perform best.
  - **Trial Reels** (shown to non-followers first) unlock at 1,000 followers. Once available, every post goes out as a Trial first.

### 1. Data
Read the last 7 posts in the Notion "Post Log". Before scripting, write one line: **what worked, what to repeat, what to avoid.** If there is no data yet, write "no data yet".

### 2. Idea: the send test
Name the exact person the viewer would DM this to, for example "my accounts guy" or "my brother who runs the shop". If there is no specific person, drop the idea.
- Rotate role families and never use the same one twice in a row: accounts, orders and email, purchase and stock, dispatch and logistics, MIS reporting, sales follow-up, HR and admin.
- Every idea is one real, boring, repeated task an Indian SMB does by hand every day.
- Do not reuse a process that appears in the last 20 posts.

### 3. Script rules (hard)
Format: `"format": "story"`, `"template": "pile-to-flow"`, `"hookPattern"` (see 3b), exactly 6 scenes. The engine gate enforces the rules marked ⛔.

| # | type | job | rule |
|---|---|---|---|
| 1 | hook | Stop the scroll in 2 seconds | `text` max 6 words, a pain the viewer owns. `vo` ⛔ max 7 words. One *accent* on the pain word. |
| 2 | beat | Show the pile growing | Name the manual work concretely. End on "one by one" or a similar phrase. |
| 3 | beat | The turn | ⛔ Exactly 1 *accent* word (the camera whip pans on it). Usually "Here's the *fix.*" |
| 4 | beat | Steps 1 to 3 | ⛔ Exactly 3 *accent* words, one per node, in node order. |
| 5 | beat | Step 4 and the payoff | ⛔ At least 1 *accent* word (node 4 lights up on it). Say who still steps in: "Your team only checks the odd ones." |
| 6 | cta | Give a reason to follow | See the CTA rule. |

- **Silent means read, not heard.** The `vo` field is the on-screen caption, read at about 2.4 words per second. Aim for **12 to 18 words** in each of beats 2 to 5, and **25 to 35 seconds** in total.
- **Accents** (`*word*`) are what drive the animation. Only put accents on cue words, never for decoration.
- **Share trigger:** one line has to make the viewer think "this is exactly us". Use a specific, recognisable detail (a sheet name, "every morning at 10", "WhatsApp from the owner").
- **CTA ratio:** in every 5 posts, 4 are follow CTAs and 1 is DM AUDIT. Follow CTAs are `"text": "*Follow*"` with a sub such as "One business automation, every day."; DM CTAs are `"text": "DM *AUDIT*"`. The follow reason must promise what comes next.
- **Honesty (⛔ banned phrases are enforced by the gate):**
  - Show how automation *can* work; never claim a client or a result.
  - No "3x" or "save 20 hours" claims.
  - Use sample data only, with invented Indian SMB names and INR amounts in Indian grouping.
  - Put "Example data." in every caption.
  - No em or en dashes.
  - While the video is silent, never mention a voiceover (⛔).

#### The `world` block (what appears on the cards)
```json
"world": {
  "item":    {"title": "ORDER", "id": "PO-", "start": 2201, "pill": "NEW", "amount": false},
  "counter": {"label": "TO TYPE", "icon": "mail"},
  "nodes": [
    {"icon": "inbox",  "label": "Read the email", "sub": "orders@ inbox"},
    {"icon": "search", "label": "Pull details",   "sub": "Item, qty, address"},
    {"icon": "sheet",  "label": "Add to sheet",   "sub": "Orders.xlsx"},
    {"icon": "send",   "label": "Confirm order",  "sub": "Reply in 1 minute"}
  ],
  "message": {"app": "EMAIL", "text": "Hi Gupta ji, order PO-2214 is confirmed. Dispatch on 24 Sep."},
  "done": "DONE"
}
```
Maximum lengths (⛔):

| Field | Max characters |
|---|---|
| item.title | 9 |
| item.id | 5 |
| item.pill | 6 |
| counter.label | 10 |
| node label | 16 |
| node sub | 22 |
| message.app | 12 |
| message.text | 90 |
| done | 8 |

Set `amount: true` only when the item carries money (invoices, payments).

Icons (only these): mail, inbox, send, phone, chat, whatsapp, sheet, table, file, invoice, receipt, download, copy, paste, keyboard, click, search, filter, tag, bell, check, checklist, clock, timer, hourglass, alert, calendar, user, users, truck, package, cart, rupee, chart, database, repeat, refresh, bot, zap, workflow, sparkles, attach, star. The icons hourglass, refresh, repeat, clock and timer spin while their step is active.

#### Caption and hashtags
- **Line 1:** the hook restated as a statement, **max 125 characters** (anything longer is cut off before "more").
- **Then:** 2 to 4 short lines explaining the flow in plain words, including keywords people search for (for example "invoice reminder automation", "order processing").
- **Then:** `Example data.`
- **Last line:** the CTA plus a send prompt, for example "Follow for one business automation every day. Send this to whoever handles your orders."
- **Hashtags:** 3 to 5 (⛔). Mix 1 broad (#automation or #n8n), 1 audience (#smallbusinessindia) and 1 or 2 process tags.

### 3b. Script Rulebook (permanent; applies to every script, forever)
These rules come from how people behave, which doesn't change. The Algorithm Brief can **add** rules on top of them but never remove one.

**Psychology: every script must use all 6**
1. **Recognition in 1 second:** the hook names a pain the viewer has *today*, in their words ("typed by hand", "every morning"), never in automation jargon.
2. **Curiosity gap:** the hook shows the problem but not the fix. The fix only appears after the whip pan (scene 3).
3. **Specific beats generic:** at least 2 concrete details the viewer can picture, such as a file name, a time, an app or an amount. Specific means "this person knows my job".
4. **Identity send trigger:** the caption names a role, "Send this to whoever ___". People share to look helpful to a named person.
5. **Relief payoff:** scene 5 says who still steps in and why that's less work ("Your team only checks the odd ones"). Relief is what gets saved.
6. **Promise of more:** the CTA promises what the next post brings ("one automation, every day"). A follow is a bet on the next post.

**Truth (one false claim costs more than 10 good posts)**
- **The trigger test:** each step's action must be possible from the data available at that step. Software only knows what it has read. It can't "mark paid" from a bill, "know" a customer is happy, or "book" anything without a reply. If a step needs information nobody gave it, rewrite the step.
- **No step claims a result:** steps describe actions (read, check, send, add, remind, flag), never outcomes (saved, grew, fixed forever).
- **The done label** must be something the last step truly produces. "PAID" only works when the trigger is the money arriving.

**Variety (enforced by the engine gate)**
- Every script sets `"hookPattern"` to one of: `pile` ("Someone typed all of these."), `should-not` ("Supplier bills should not be typed twice."), `question` ("Who retyped 40 orders today?"), `number` ("3 exports, 1 sheet, every morning."), `confession` ("Most offices still do this by hand."), `myth` ("You don't need an ERP for this."), `before-after` ("10 AM report. Nobody built it.").
- ⛔ The same pattern can't appear 3 times in a row. ⛔ The caption line 1 can't reuse the frame or wording of the previous 2 posts.
- A batch of 7 uses at least 4 different patterns.

**Stories (the connector can't make real stickers)**
- Every poll card has the words "Reply 1 or 2" on it, with the two options numbered.
- Every question card has the words "Reply with your answer".
- A card that asks for nothing is not a Story post.

### 3c. Red-team pass (mandatory, before the scorecard)
Reread each script as a harsh reviewer who wants to reject it, and answer these in writing:
1. Which step fails the trigger test? *(If any does, rewrite it.)*
2. Would a stranger scrolling past know the topic within 2 seconds of the hook, with no caption?
3. Which of the 6 psychology rules is weakest? Improve it.
4. Is anything here that an accountant, a dispatcher or a shop owner would call wrong?
5. Does it look or read like any of the last 7 posts?

Fix everything these questions turn up **before** sending. Put the 5 answers, one line each, in the approval message under the scorecard. If Navin finds a problem the red-team pass missed, add it to this rulebook as a new rule the same day, so it never happens twice.

### 4. Scorecard (write it in the approval message)
Score each line from 1 to 5, and be honest. Anything under 20 gets rewritten before Navin sees it.

| Line | 5 means |
|---|---|
| Hook | A stranger knows what the video is about in 2 seconds, with no context |
| Send test | You can name who gets it DMed |
| Specific | At least 2 concrete details (file name, time, app, amount) |
| Original | Different process and role family from the last 20 posts |
| True | Nothing claimed that is not shown; example data is labelled |

### 5. Render
- Save the file as `content/stories/YYYY-MM-DD-<slug>.json`, with `id` set to the same slug.
- The watcher renders it into `out/<id>/` (reel.mp4, cover.png, caption.txt) and copies it to Drive under "Reel Engine".
- If the gate fails, `out/<id>/.status.txt` or the watcher log shows the errors. Fix the JSON, save it again, and never use `--force`.

### 6. Approve
Send Navin the reel.mp4 preview, the caption, the scorecard and the step 1 line. Nothing is posted without **"approve <id>"**.

### 7. Post
Navin posts from the phone app for now. The app lets him add a sound from Instagram's library at low volume; business accounts only see the commercial-safe library, which is fine. This is the one thing the API cannot do, and it helps silent reels.
- Post at the same time every day, using the most active hour shown in Insights.
- The cover is `cover.png`.
- Share it to the Story with a "send this to..." sticker.
- Forge never comments, likes or follows from the account.

### 8. Measure
Log each post in the Notion "Post Log" at **24 hours** and at **7 days**:
- views
- skip rate (or 3-second hold)
- average watch time
- sends
- saves
- follows from the post
- profile visits

Navin pastes the Insights screenshot if Forge cannot read it directly.

**Sunday review:** rank the week by sends per reach and follows per reach. Write 3 rule changes into the Algorithm Brief under "Rules we change". Stop using any hook pattern or role family in the bottom quartile for 2 weeks.

**Cadence:** 1 post per day. Never go below 5 per week, and never ship a post that scores under 20 just to hit the count.

---

## Standing rules (unchanged)
- Forge writes only `.json` files into the content folders.
- Forge never edits engine code or `.status.txt`, never reads `.env`, and never deletes anything.
- No post, DM or send without Navin's approval. Never deny being AI if asked.
- On Instagram: never comment, like or follow.

## Quality bar
`content/stories/story-order-emails.json` is the reference script. Match its density and specificity.
