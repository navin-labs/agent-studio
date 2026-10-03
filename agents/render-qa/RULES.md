# Render + QA: contract

Why: every check is deterministic, so bad videos never reach Navin, and each platform variant is judged on its own.

| | |
|---|---|
| Runs | Code, watcher on the Mac (`engine/scripts/watch.mjs`, LaunchAgent com.theautomationguy.studiowatch) |
| Input | Storyboard JSON in `engine/content/storyboards/` |
| Output | Per platform (youtube, instagram, facebook): `engine/out/<channel>/<date>/<id>/<platform>/` with the video, caption, manifest (schemas/manifest.schema.json), QA result (schemas/qa.schema.json), contact sheet, render.json, text boxes and, for YouTube, the thumbnail. Every file named `<channel>-<platform>-<date>-<id>.<kind>` |
| Tokens | 0 |

## Render
Each channel board renders once per platform from its style preset's spec for that platform (`styles/<id>.json` `platforms`: size, closer CTA text and spoken line, end card account, caption template, thumbnail, file name rule, destination). A new render replaces the board's old variant folders whole; a platform that fails to render fails alone. Only boards in the Writer's folder render into `engine/out/`; test boards render to `engine/test/out/`.

## Checks (per variant)
| Check | Pass |
|---|---|
| schema | Storyboard valid |
| text-limits | Every field within its primitive's limits |
| audio | An audio stream (the channel's local voice, or sfx; a silent video fails) |
| format | mp4, the preset's size for that platform (1080x1920), 30 fps |
| duration | Measured on the mp4: C1 40 to 60 s (host and explainer, no exceptions), C2 25 to 45 s, C3 20 to 45 s |
| safe-zones | Text boxes measured at compose time inside the Instagram and YouTube safe areas |
| fingerprint | Storyboard matches its recipe (shots, theme, style, hook pattern, transitions); novelty rules pass against approved videos, including topic, hero metaphor, caption opener |
| naming | Board file `<id>.json`; folder `<channel>/<date>/<id>/<platform>/`; every file starts with `<channel>-<platform>-<date>-<id>.` (a bare name such as `video.mp4` or `final.mp4` fails); contact sheet present; YouTube thumbnail present (and arm B when `meta.thumb_b`) |
| manifest | Schema-valid; channel, platform, video id and date match the folder; style version is the board's preset; render.json is this platform's render; every listed file exists; the video is the file the manifest's hash describes; no other platform's variant is the same file |
| cta | No CTA in the caption body; the closer text and spoken line are the preset's for this platform; the caption carries the platform's CTA line; Subscribe only on YouTube, never Follow there; an Instagram funnel says "Instagram" anywhere else; the end card names this platform's own account; a voiced video discloses the AI voice |
| destination | The channel has a publisher for this platform, not pending, reached the platform's way (YouTube: n8n with this channel's own webhook; Instagram, Facebook: the Forge queue; Facebook with a page_id); the manifest's destination is that publisher |
| seo | YouTube: the SEO preflight on the YouTube variant's own caption (and arm B's title); C2 on every platform: the caption carries the source link |

Code: `studio/qa.ts` (`node studio/qa.ts <storyboard.json> [--out <renders root>] [--date YYYY-MM-DD] [--recipes <dir>]`, writes each variant's `qa.json` (with the SHA-256 of the exact file it checked: approval and dispatch accept the result for that file only) and the manifest's `qa_status`; exit 1 when a variant fails a check the Writer fixes or did not render; a variant held only by `destination`, such as a pending Facebook username, is reported for Navin). Probe: `engine/scripts/probe.ts` (@remotion/media-parser, no ffprobe). Contact sheet: rendered by make.mjs (BoardSheet: every scene at mid-shot).

## Never
- Use a vision model.
- Pass a file that fails any check, or use `--force`.
- On fail: send the exact error back to Forge (the watcher writes it into `<id>.status.txt`).
