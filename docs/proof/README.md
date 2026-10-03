# Proof pack

Evidence that agent-studio works, in two parts: a reproducible verification of the code (anyone can rerun it), and the production state of the live install it runs. Logs are unedited command output (terminal colour codes removed). Produced on 2026-10-04.

| File | Contents |
|---|---|
| [verification.md](verification.md) | What was run and what it returned: checks, QA per platform, the simulation, the six test variants, the live state |
| [demo/demo.mp4](demo/demo.mp4) | A demo render (21.4 s, 1080x1920, voiced, 7.3 MB): a neutral board about the pipeline itself, no channel, no account (`engine/test/demo.json`) |
| [demo/contact.png](demo/contact.png) | The demo's contact sheet: every scene at mid-shot |
| `live.txt` | The production install: services, n8n workflows, live channels, the ledger and the queue on launch day |
| `npm-check.txt` | `cd engine && npm run check` (types, theme gate, text QA, schemas, 12 test suites), then the theme gate and schema validation with their output shown |
| `simulation.txt` | `node studio/simulate.ts`: a full production cycle on real renders in a temporary sandbox (fake Telegram, fake n8n) |
| `qa-c1.txt`, `qa-c2.txt` | `node studio/qa.ts` on the two test boards: every check for every platform variant |
| `manifests/c{1,2}-{youtube,instagram,facebook}.json` | The six render manifests, unchanged |
| `contact-sheets/c{1,2}-{youtube,instagram,facebook}.png` | Contact sheets for each test variant |

![Demo contact sheet](demo/contact.png)

## Test videos
The six test-board MP4s are not committed (about 65 MB). Each manifest's `video_sha256` identifies its file. Reproduce them with:
```bash
cd engine && VOICE=on npm run make -- test/style-c1.json test/style-c2.json
```
They render to `engine/test/out/<channel>/<date>/<board>/<platform>/` (ignored by git). A re-render produces new files and new hashes; the checks are what is reproducible.
