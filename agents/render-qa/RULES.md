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
| Audio stream | Present (see LOG open question 2) |
| Format | 1080x1920 @ 30fps |
| Duration | 20 to 45s |
| Safe zones | Text boxes measured at compose time |
| Fingerprint | Distance rules pass |
| Naming | Matches convention |

## Never
- Use a vision model.
- Pass a file that fails any check, or use `--force`.
- On fail: send the exact error back to Forge.
