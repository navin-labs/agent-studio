# SKILL: Weekly Writer (Forge)

Forge follows this skill to write one channel's week of videos. It replaces "Instagram Growth Pipeline" for writing and rendering. Code has already picked each video's shape (the recipe); Forge only writes the words. Navin approves the whole week on one page. Nothing is posted by Forge.

All paths are absolute. The project is `~/Dev/projects/agent-studio` (below: `STUDIO`).

---

## When
Once a week per channel, after Navin says "write week <YYYY-Www> for <channel>" (for now: `c1-automation`), or when the recipe file for next week appears.

## Read (in this order, nothing else)
1. `STUDIO/recipes/<channel>/<week>.json`: 7 recipes. Each fixes `id`, `theme`, `hook_pattern`, the shot list (`primitives`) and `transitions`. **Never change any of them.**
2. `STUDIO/ideas/<channel>.jsonl`: the idea list, one JSON per line.
3. `STUDIO/state/learn/<channel>/scoreboard.md` if it exists: what worked. Lean on proven topics and hook words; avoid the bench.
4. `STUDIO/channels/<channel>/RULEBOOK.md`: honesty, CTA and hashtag rules.
5. `STUDIO/engine/src/primitives/specs.ts`: every shot's fields, character limits, length in seconds and what its `*accent*` words drive. Each spec has an `example`.
6. Reference boards: `STUDIO/engine/content/storyboards/host-supplier-bills.json` (host format, 8 shots) and `dispatch-lr.json` (composed format, 6 shots). Match their density.

## Ideas
- One idea per recipe, never reused. Copy its `source_url` into `meta.source` and its `id` into `meta.idea_id`.
- If fewer than 7 unused ideas exist, first add new lines to the idea file. Each needs a real link you opened (Reddit thread, Google Trends India, YouTube search, an Instagram question reply), and must match `STUDIO/schemas/idea.schema.json`: `id`, `channel`, `title`, `summary`, `source` (reddit, google-trends, youtube, ig-question), `source_url`, `date`. No link, no idea.
- The idea must pass the send test: name the exact person a viewer would DM it to. Rotate role families (accounts, orders and email, purchase and stock, dispatch, MIS reporting, sales follow-up, HR and admin); never the same family twice in a row.

## Write: one storyboard per recipe
Save to `STUDIO/engine/content/storyboards/<recipe id>.json` (file name = `id` = the recipe's `id`, e.g. `c1-2026-w41-3.json`). The watcher renders it within a minute.

```json
{
  "format": "storyboard",
  "id": "<recipe id>",
  "channel": "<channel>",
  "theme": "<recipe theme>",
  "host": "chiku", "captionStyle": "karaoke",
  "hookPattern": "<recipe hook_pattern>",
  "scenes": [
    {"primitive": "<recipe primitives[0]>", "params": {...}, "vo": "..."},
    {"primitive": "<recipe primitives[1]>", "transition": "<recipe transitions[1]>", "params": {...}, "vo": "..."}
  ],
  "caption": "...",
  "hashtags": ["#automation", "#smallbusinessindia", "..."],
  "meta": {"source": "<idea source_url>", "idea_id": "<idea id>", "recipe_id": "<recipe id>", "hero_metaphor": "<2 to 4 words: the video's central image>"}
}
```
Include `"host"` and `"captionStyle"` only when the first shot is `host-hook`.

### Hard rules (the watcher and QA reject a board that breaks them)
- Shots, theme, hook pattern and transitions exactly as the recipe. Scene 1 has no `transition`.
- Every text field within its `specs.ts` limit. Icons only from the icon list.
- `vo` is spoken by the voice at about 3 words per second. Each line must fit its shot's maximum seconds; the watcher says "shorten it" when it does not.
- Length: host videos 40 to 60 s, composed 20 to 45 s. Fill each shot close to its maximum; short lines make short videos.
- `*accent*` words drive the animation. Use them only where the spec's `cues` say (e.g. one per flow step, one per inbox row, one per chat message), never for decoration.
- Hook: the first shot's on-screen text is max 6 words, a pain the viewer owns today, in their words.
- The last shot is the closer (`host-cta` or `end-card`).
- Caption: line 1 restates the hook in max 125 characters; 2 to 4 short plain lines on how the flow works; then `Example data.`; last line the CTA plus "Send this to whoever ...". 3 to 5 hashtags, lowercase.
- CTA: in a week, about 1 in 5 is `DM *AUDIT*`, the rest `*Follow*` with a sub that promises the next post.
- Honesty: show how automation can work. Never claim a client, a result or a number saved. Sample data only, with invented Indian SME names and INR amounts in Indian grouping. No em or en dashes. No real brands. No banned phrases (the gate lists them).
- Truth test: each step can only act on data it has at that step. The done label must be what the last step truly produces.
- Variety: no two boards in the week share a caption opener, a topic or a `hero_metaphor`.

## Check
For each board, read `STUDIO/engine/content/storyboards/<id>.status.txt`:
- `ok`: rendered and passed QA. Done.
- `failed`: the gate or render stopped; the exact errors are listed. Fix the JSON and save it again.
- `failed QA`: rendered but a QA check failed (`FAIL <check> <error>`). Fix the JSON and save it again.
- Never use `--force`; never edit `.status.txt`.

Stop when all 7 say `ok`. Then tell Navin: "Week <week> for <channel> is ready for approval", with one line per video: id, topic, hook, CTA.

## Approve and publish (not Forge's job)
Navin approves on the weekly approval page. The dispatcher uploads approved videos to YouTube and puts each approved Instagram reel in `STUDIO/state/queue/instagram/<date>-<channel>-<id>/` (`reel.mp4`, `caption.txt`, `post.json` with `handles` and `scheduled_for`). Forge posts only folders from that queue, to the account in `handles`, at `scheduled_for`, and never anything else.

## Standing rules
- Forge writes only `.json` files into `STUDIO/engine/content/storyboards/` and new lines into `STUDIO/ideas/<channel>.jsonl`.
- Forge never edits engine code, recipes, `.status.txt` or `state/`; never reads `.env`; never deletes anything.
- No post, DM or send without Navin's approval. Never deny being AI if asked.
- On Instagram: never comment, like or follow.
- Old folder `~/Dev/projects/reel-engine/content/stories/` is retired once this skill is installed. Do not write there.
