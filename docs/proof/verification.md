# Verification

Date: 2026-10-04. Node 26.0.0, macOS 27, Apple silicon. The install verified here is in production: C1 and C2 are live (`live.txt`).

## Code: commands and results
| Command | Result | Log |
|---|---|---|
| `cd engine && npm run check` | exit 0. `tsc` clean; theme gate: 41 contrast pairs pass, 0 fail; textcheck ok; schema validation: 19 samples ok; 12 of 12 test suites ok (recipe, qa, approval, dispatch, learn, telegram, metrics, run, feed, experiment, improve, loop) | `npm-check.txt` |
| `cd engine && VOICE=on npm run make -- test/style-c1.json test/style-c2.json` | six voiced renders (2 boards x 3 platforms) | |
| `node studio/qa.ts engine/test/style-c1.json --out engine/test/out --recipes engine/test/recipes --date 2026-10-04` | exit 0; YouTube, Instagram, Facebook PASS (36 of 36 checks) | `qa-c1.txt` |
| `node studio/qa.ts engine/test/style-c2.json --out engine/test/out --recipes engine/test/recipes --date 2026-10-04` | exit 0; YouTube, Instagram, Facebook PASS (36 of 36 checks) | `qa-c2.txt` |
| `node studio/simulate.ts` | exit 0 | `simulation.txt` |

QA runs 12 checks per variant: schema, text-limits (each voice line measured against its shot), audio (a voiced channel never passes silent), format, duration (measured on the file), safe-zones, fingerprint, naming, manifest, cta, destination, seo.

## The six test variants
Measured on the MP4 with `engine/scripts/probe.ts`: mp4, 1080x1920, 30 fps, with voice. Each manifest's `video_sha256` equals the SHA-256 of its MP4.

| Variant | Length | Allowed | CTA | End card | Destination | QA |
|---|---|---|---|---|---|---|
| C1 YouTube | 44.18 s | 40 to 60 s | Subscribe | @theautomationguynavin | the channel's own n8n upload workflow | PASS |
| C1 Instagram | 43.99 s | 40 to 60 s | Follow | @theautomationguynavin | `queue/c1-automation/instagram/` | PASS |
| C1 Facebook | 44.35 s | 40 to 60 s | Follow the page | no account (username pending) | `queue/c1-automation/facebook/`, page 1429203763599559 | PASS |
| C2 YouTube | 30.59 s | 25 to 45 s | Subscribe | @backstory.minute | the channel's own n8n upload workflow | PASS |
| C2 Instagram | 30.61 s | 25 to 45 s | Follow | @backstory.minute | `queue/c2-reach/instagram/` | PASS |
| C2 Facebook | 30.66 s | 25 to 45 s | Follow the page | no account (username pending) | `queue/c2-reach/facebook/`, page 1320532171147125 | PASS |

Facebook posts to its page by page ID while the username is pending (docs/DECISIONS.md, ADR 22).

## Simulation
A production cycle on the six real renders in a temporary sandbox (fake Telegram, fake n8n; nothing leaves the machine):
- 2 videos x 3 variants found with the right CTA, end card and QA state; six distinct files.
- One Telegram message per video; one tap approved all three variants.
- Dispatch plan: 2 YouTube jobs, each to its own channel's webhook; 4 queue items (Instagram by handle, Facebook by page ID); 0 blocked.
- 10 refusal cases refused: another channel's workflow, missing manifest, unknown platform, wrong channel/platform pair, wrong channel on the ledger line, changed destination handle, Facebook pending with no page ID, video changed after approval, approval taken back, duplicate queue item.
- The n8n dispatch check said yes only for the right channel and platform; a second run sent nothing.

## Production
`live.txt`, captured on launch day:
- Services: the approval receiver (healthy), the render watcher and the hourly loop, all under launchd; 8 n8n workflows active (the credential check runs by hand).
- Channels: C1 and C2 live, every other day from 2026-10-04; C3 not open.
- Launch videos, dispatched on 2026-10-04 (IST):

| Video | Facebook | YouTube | Instagram |
|---|---|---|---|
| C1 launch | 12:30 (queued) | 19:00, scheduled upload `QL_4Qj5fCmo` | 20:30 (queued) |
| C2 launch | 21:00 (queued) | 20:00, scheduled upload `kTwfqVnlSgg` | 21:00 (queued) |

YouTube publishes each scheduled upload at its time; the agent's Queue Publisher posts each Instagram and Facebook item at its time and records the post URL.

## Reproduce
```bash
cd engine && npm install && npm run check
VOICE=on npm run make -- test/style-c1.json test/style-c2.json test/demo.json
cd ..
node studio/qa.ts engine/test/style-c1.json --out engine/test/out --recipes engine/test/recipes --date <render date>
node studio/qa.ts engine/test/style-c2.json --out engine/test/out --recipes engine/test/recipes --date <render date>
node studio/simulate.ts
```
Voiceover needs the local voice setup (docs/INSTALL.md section 4).
