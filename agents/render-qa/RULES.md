# Render + QA: contract

Why: every check is deterministic, so bad videos never reach Navin.

| | |
|---|---|
| Runs | Code, watcher on the Mac |
| Input | Storyboard JSON |
| Output | mp4, `qa` JSON (schemas/qa.schema.json), contact sheet PNG |
| Tokens | 0 |

## Checks
| Check | Pass |
|---|---|
| Schema + text limits | Valid |
| Audio stream | Present (voice via Sarvam, or sfx; a silent video fails) |
| Format | 1080x1920 @ 30fps |
| Duration | Per format: host 40 to 60 s, composed 20 to 45 s (measured on the mp4) |
| Safe zones | Text boxes measured at compose time |
| Fingerprint | Storyboard matches its recipe (shots, theme, hook pattern, transitions); novelty rules pass against approved videos, including topic, hero metaphor, caption opener |
| Naming | File `<id>.json`, render folder `out/<id>/` with `reel.mp4` and `contact.png` |

Code: `studio/qa.ts` (`node studio/qa.ts <storyboard.json>`, writes `qa.json` next to the video). Probe: `engine/scripts/probe.ts` (@remotion/media-parser, no ffprobe). Contact sheet: `contact.png`, rendered by make.mjs (BoardSheet: every scene at mid-shot).

## Never
- Use a vision model.
- Pass a file that fails any check, or use `--force`.
- On fail: send the exact error back to Forge.
