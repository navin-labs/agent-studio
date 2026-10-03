# SKILL: Weekly Writer (Forge)

Forge follows this skill to write one channel's week of videos. Code has already picked each video's shape (the recipe); Forge only writes the words. Each board Forge writes becomes three videos, one per platform (YouTube, Instagram, Facebook), each with that platform's own call to action, end card and caption ending. Navin approves each video once on Telegram. Nothing is posted by Forge with this skill.

All paths are absolute. The project is `~/Dev/projects/agent-studio` (below: `STUDIO`).

---

## When
Once a week per live channel. Every Thursday the studio writes `recipes/<channel>/<next week>.json` and Telegram says "<channel> <week>: N recipes are ready" (N is the number of posting days that week: the channels post every other day from their launch, so 3 or 4; each recipe has its posting `date`). Run this skill for that channel and week (or when Navin says "write week <YYYY-Www> for <channel>"). Channels: `c1-automation`, `c2-reach`. (`c3-studio` is not open yet: it has no style preset, so its boards cannot render. Do not write C3 boards until Navin opens it.)

## Read (in this order, nothing else)
1. `STUDIO/recipes/<channel>/<week>.json`: the week's recipes (3 or 4: one per posting day). Each fixes `id`, `theme`, `style`, `hook_pattern`, the shot list (`primitives`) and `transitions`. **Never change any of them.**
2. `STUDIO/ideas/<channel>.jsonl`: the idea list, one JSON per line. The feed adds new ideas every morning (each with its source link); newest are at the bottom.
3. `STUDIO/state/learn/<channel>/scoreboard.md` if it exists: what worked. Lean on proven topics and hook words; avoid the bench.
4. `STUDIO/channels/<channel>/RULEBOOK.md`: honesty, CTA and hashtag rules.
5. `STUDIO/engine/src/primitives/specs.ts`: every shot's fields, character limits, length in seconds and what its `*accent*` words drive. Each spec has an `example`.
6. Reference boards: `STUDIO/engine/test/boards/host-supplier-bills.json` (C1 host, 8 shots), `STUDIO/engine/test/style-c1.json` (C1 explainer, 8 shots, about 46 s voiced), `STUDIO/engine/test/style-c2.json` (C2 story, 6 shots). Match their density.

## Ideas
- One idea per recipe, never reused. Copy its `source_url` into `meta.source` and its `id` into `meta.idea_id`.
- If there are fewer unused ideas than recipes, first add new lines to the idea file. Each needs a real link you opened (Reddit thread, Google Trends India, YouTube search, an Instagram question reply), and must match `STUDIO/schemas/idea.schema.json`: `id`, `channel`, `title`, `summary`, `source` (reddit, google-trends, youtube, ig-question), `source_url`, `date`. No link, no idea.
- The idea must pass the send test: name the exact person a viewer would DM it to.
- What counts as an idea depends on the channel (next section).

## Channels: what each one makes
| | C1 `c1-automation` | C2 `c2-reach` (Backstory) |
|---|---|---|
| Goal | Leads for automation work | Followers, future monetization |
| Topic | One boring manual task an Indian SME does every day, and how it can run itself. Rotate role families (accounts, orders and email, purchase and stock, dispatch, MIS reporting, sales follow-up, HR and admin); never the same twice in a row | Business and tech history in under a minute: how an everyday object came to be (the barcode, the shipping container, the spreadsheet), the person and the problem behind it. Story grammar: hook, the world before, the turn (who, where, when), one idea shown, why it matters today, follow. Every factual claim needs a source (`meta.source`); a Reddit post is a lead, not a source. No fiction as fact, no invented quotes, dates or numbers. No automation pitch. Rules: `channels/c2-reach/RULEBOOK.md` |
| Formats | host (Chiku, 8 shots) and explainer (8 shots), both **40 to 60 s, no exceptions**, night only | story (6 shots, archive only, Archive Gold): **25 to 45 s** for now; its 40 to 60 s target arrives with the phase-2 history shots |
| Closer CTA (write the kind) | about 1 in 5 `DM *AUDIT*` (kind dm-audit), the rest `*Follow*` (kind follow) | `*Follow*` (kind follow) or `*Send* it` (kind send) |
| Caption body must include | `Example data.` | `Example data.` when any number is illustrative; last line `Source: <meta.source>` |

## Calls to action: one kind per board, three platform versions
You choose the CTA **kind** by what you put in the closer's `text` (the last shot, `end-card` or `host-cta`): `*Follow*` (follow), `DM *AUDIT*` (dm-audit, C1 only), `*Send* it` (send, C2 only). The studio then renders three videos from the channel's style preset (`STUDIO/styles/<style>.json`, `platforms`), each with its own closer text, line under it, spoken CTA line, end card account and caption CTA line. You never write the platform words yourself.

| Kind | YouTube video says | Instagram video says | Facebook video says |
|---|---|---|---|
| follow (C1) | **Subscribe**: "Subscribe for more business automations." | **Follow**: "Follow for more business automations." | **Follow the page**: "Follow the page for more business automations." |
| dm-audit (C1) | **DM AUDIT on Instagram** @handle: "Send me the word audit on Instagram." | **DM AUDIT**: "Send me the word audit, and I will look at it for free." | **DM AUDIT on Instagram** @handle: "Send me the word audit on Instagram." |
| follow (C2) | **Subscribe**: "Subscribe for more backstories." | **Follow**: "Follow for more backstories." | **Follow the page**: "Follow the page for more backstories." |
| send (C2) | **Share it**: "Share this with someone curious." | **Send it**: "Send this to someone curious." | **Share it**: "Share this with someone curious." |

The rules behind the table (QA fails a variant that breaks them):
- "Subscribe" belongs to YouTube only; "Follow" never appears on YouTube.
- A CTA that sends people to Instagram from anywhere else (the DM AUDIT funnel on YouTube and Facebook) says "Instagram" out loud and on screen.
- No CTA words anywhere else: not in the caption body, not in any other shot's text or `vo`. Leave the closer's `vo` out; the platform's spoken line replaces it.

## Launch video (a recipe with `"launch": true`)
A channel's very first recipe carries `"launch": true`. It posts first, on YouTube, Instagram and Facebook together. Same recipe rules (shots, theme, hook pattern, CTA kind `follow`); only the content differs:
- C1: the channel promise. One boring task an Indian SME still does by hand, shown running by itself, then what the viewer gets here: one such task at a time, how it can run itself. No idea line needed: set `meta.idea_id` to `launch` and `meta.source` to the channel's own Instagram profile URL. Never promise a posting frequency ("every day") in text, voice or caption.
- C2: no intro. Write the single strongest story available (the one most people would send to a friend), held to every C2 sourcing rule.

## Write: one storyboard per recipe
Save to `STUDIO/engine/content/storyboards/<recipe id>.json` (file name = `id` = the recipe's `id`, e.g. `c1-2026-w42-3.json`). The watcher renders it within a minute, once per platform.

```json
{
  "format": "storyboard",
  "id": "<recipe id>",
  "channel": "<channel>",
  "theme": "<recipe theme>",
  "style": "<recipe style>",
  "host": "chiku", "captionStyle": "karaoke",
  "hookPattern": "<recipe hook_pattern>",
  "scenes": [
    {"primitive": "<recipe primitives[0]>", "params": {...}, "vo": "..."},
    {"primitive": "<recipe primitives[1]>", "transition": "<recipe transitions[1]>", "params": {...}, "vo": "..."},
    {"primitive": "end-card", "transition": "<recipe transitions[last]>", "params": {"text": "*Follow*", "sub": "..."}}
  ],
  "caption": "...",
  "hashtags": ["#automation", "#smallbusinessindia", "..."],
  "meta": {"source": "<idea source_url>", "idea_id": "<idea id>", "recipe_id": "<recipe id>", "hero_metaphor": "<2 to 4 words: the video's central image>"}
}
```
Copy `"style"` from the recipe. A style whose `opener` is `year-flap` (C2 Archive Gold) opens on the story's year: add `"year": "<the year the story turns on>"` to `meta`, and the year must be in the source.
Include `"host"` and `"captionStyle"` only when the first shot is `host-hook`.

### Hard rules (the watcher and QA reject a board that breaks them)
- Shots, theme, style, hook pattern and transitions exactly as the recipe. Scene 1 has no `transition`.
- Learn guidance: when the recipe has `guidance`, follow it where the channel rules leave a choice: `caption` (question, number or statement for caption line 1), `cta` (which CTA kind, within the channel's CTA rule), `seconds` (aim the video's length there, within the length rule). Its `evidence` says why; never copy it into the caption.
- C2 in a gold style: put `*accent*` only on the person's name and the year (they turn gold the moment they are spoken); nothing else gets an accent.
- Every text field within its `specs.ts` limit. Icons only from the icon list.
- `vo` is spoken by the voice at about 3.6 words per second, with a third of a second between lines. Each line must fit its shot's maximum seconds; the watcher says "shorten it" when it does not.
- Length, measured on every rendered video with its voice: **C1 40 to 60 s in both formats, no exceptions**; C2 25 to 45 s. Fill each shot close to its maximum; short lines make short videos, and a C1 video under 40 s fails QA on every platform.
- `*accent*` words drive the animation. Use them only where the spec's `cues` say (e.g. one per flow step, one per inbox row, one per chat message), never for decoration.
- Hook: the first shot's on-screen text is max 6 words, a pain the viewer owns today, in their words.
- The last shot is the closer (`host-cta` or `end-card`) with the CTA kind in its `text` (table above).
- Caption body (the studio adds the rest per platform: the CTA line, the AI-voice disclosure, the hashtags): line 1 restates the hook in max 125 characters; 2 to 4 short plain lines on how it works; then `Example data.`; last line "Send this to whoever ..." (C2: then `Source: <meta.source>`). No Follow, Subscribe or DM line. 3 to 5 hashtags in `hashtags`, lowercase.
- C2: put the name or the year people search for in caption line 1 (it becomes the YouTube title). The YouTube description must carry the source link (the SEO preflight fails a C2 board without it).
- Optional experiment arm B (YouTube title/thumbnail test): `meta.title_b` (another title, 10 to 100 chars) and/or `meta.thumb_b` (another thumbnail headline, max 60 chars, `*accent*` allowed). Use it on at most 2 boards a week; Navin approves both arms with the video.
- Honesty: show how automation can work. Never claim a client, a result or a number saved. Sample data only, with invented Indian SME names and INR amounts in Indian grouping. No em or en dashes. No real brands. No banned phrases (the gate lists them).
- Truth test: each step can only act on data it has at that step. The done label must be what the last step truly produces.
- Variety: no two boards in the week share a caption opener, a topic or a `hero_metaphor`.

## Check
For each board, read `STUDIO/engine/content/storyboards/<id>.status.txt`. It lists QA per platform (`youtube:`, `instagram:`, `facebook:`):
- `ok`: every platform video that can be approved rendered and passed QA. Lines under "held for Navin, not a board error" (for example an Instagram account that is not set up yet) are not yours to fix. Done.
- `failed`: the gate or the render stopped before any video was made; the exact errors are listed. Fix the JSON and save it again.
- `failed QA`: at least one platform video failed a check (`FAIL <check> <error>` under that platform), or did not render. Fix the JSON and save it again; the passing platforms stay approvable meanwhile.
- Never use `--force`; never edit `.status.txt`.

Stop when every board of the week says `ok`. Then tell Navin: "Week <week> for <channel> is ready for approval", with one line per video: id, topic, hook, CTA kind.

## Approve and publish (other skills)
Navin approves each video once on Telegram; one tap approves its YouTube, Instagram and Facebook versions that passed QA (a version that failed is held alone). Approved videos go out through the dispatcher: YouTube through that channel's own n8n workflow, Instagram and Facebook through the queue (`STUDIO/queue/<channel>/<platform>/`) that the **Queue Publisher** skill posts from. Post results come back through the **Metrics Reporter** skill. This skill only writes.

## Standing rules
- With this skill Forge writes only `.json` files into `STUDIO/engine/content/storyboards/` and new lines into `STUDIO/ideas/<channel>.jsonl`.
- Forge never edits engine code, recipes, style presets, `.status.txt`, `state/` or `queue/`; never reads `.env`; never deletes anything.
- No post, DM or send without Navin's approval. Never deny being AI if asked.
- On Instagram: never comment, like or follow.
- Old folder `~/Dev/projects/reel-engine/content/stories/` is retired. Do not write there.
