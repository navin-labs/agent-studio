# Proof pack

Evidence that agent-studio works, in two parts: a reproducible verification of the code (anyone can rerun it), and a snapshot of the production install on launch day. Logs are unedited command output (terminal colour codes removed). Produced on 2026-10-04.

| File | Contents |
|---|---|
| [verification.md](verification.md) | What was run and what it returned: checks, QA per platform, the simulation, the six test variants, the live state |
| [demo/c1-automation-youtube-2026-10-04-style-c1.mp4](demo/c1-automation-youtube-2026-10-04-style-c1.mp4) | One of the six test variants, committed unchanged (44.18 s, 1080x1920, 30 fps, voiced, 12.3 MB): C1's YouTube render of `engine/test/style-c1.json`. Its SHA-256 equals `video_sha256` in `manifests/c1-youtube.json`. Described in the main README, "Demo" |
| `live.txt` | The production install: services, n8n workflows, live channels, the ledger and the queue on launch day |
| `npm-check.txt` | `cd engine && npm run check` (types, theme gate, text QA, schemas, 12 test suites), then the theme gate and schema validation with their output shown |
| `simulation.txt` | `node studio/simulate.ts`: a full production cycle on real renders in a temporary sandbox (fake Telegram, fake n8n) |
| `qa-c1.txt`, `qa-c2.txt` | `node studio/qa.ts` on the two test boards: every check for every platform variant |
| `manifests/c{1,2}-{youtube,instagram,facebook}.json` | The six render manifests, unchanged |
| `contact-sheets/c{1,2}-{youtube,instagram,facebook}.png` | Contact sheets for each test variant: every scene at mid-shot |

Check the committed video against its manifest:
```bash
shasum -a 256 docs/proof/demo/c1-automation-youtube-2026-10-04-style-c1.mp4
grep video_sha256 docs/proof/manifests/c1-youtube.json
```

## Test videos
The other five test-board MP4s are not committed (about 50 MB). Each manifest's `video_sha256` identifies its file. Reproduce all six with:
```bash
cd engine && VOICE=on npm run make -- test/style-c1.json test/style-c2.json
```
They render to `engine/test/out/<channel>/<render date>/<board>/<platform>/` (ignored by git), for example `engine/test/out/c1-automation/2026-10-04/style-c1/youtube/`. A re-render produces new files and new hashes; the checks are what is reproducible.
