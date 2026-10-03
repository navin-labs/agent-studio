# Proof pack: reproducible pre-launch verification

This folder is reproducible pre-launch verification of agent-studio. It is not proof of a production deployment: no channel is live and nothing has been published.

Everything here was produced on 2026-10-03 by running the commands in [verification.md](verification.md) against the repository's code and its two test boards (`engine/test/style-c1.json`, `engine/test/style-c2.json`). The logs are unedited command output (terminal colour codes removed).

| File | Contents |
|---|---|
| [verification.md](verification.md) | What was run, the results, the six variants, PASS and HOLD states, the safety state |
| `npm-check.txt` | `cd engine && npm run check` (types, theme gate, text QA, schemas, 12 test suites), then the theme gate and schema validation again with their output shown |
| `simulation.txt` | `node studio/simulate.ts`: one production cycle on the real test renders in a temporary sandbox, with a fake Telegram and a fake n8n |
| `qa-c1.txt`, `qa-c2.txt` | `node studio/qa.ts` on each test board: every check for every platform variant |
| `manifests/c{1,2}-{youtube,instagram,facebook}.json` | The six render manifests written by the renderer and updated by QA (`qa_status`), unchanged |
| `contact-sheets/c{1,2}-{youtube,instagram,facebook}.png` | Contact sheets made by the renderer for each variant: every scene at mid-shot |

## Videos
The six MP4 files are not committed (about 67 MB together). Each manifest's `video_sha256` identifies its file exactly. Reproduce them with:
```bash
cd engine && VOICE=on npm run make -- test/style-c1.json test/style-c2.json
```
They render to `engine/test/out/<channel>/<date>/<board>/<platform>/` (ignored by git). The files verified here:

| File | Size (bytes) |
|---|---|
| `engine/test/out/c1-automation/2026-10-03/style-c1/youtube/c1-automation-youtube-2026-10-03-style-c1.mp4` | 13484181 |
| `engine/test/out/c1-automation/2026-10-03/style-c1/instagram/c1-automation-instagram-2026-10-03-style-c1.mp4` | 13458428 |
| `engine/test/out/c1-automation/2026-10-03/style-c1/facebook/c1-automation-facebook-2026-10-03-style-c1.mp4` | 13448486 |
| `engine/test/out/c2-reach/2026-10-03/style-c2/youtube/c2-reach-youtube-2026-10-03-style-c2.mp4` | 8917457 |
| `engine/test/out/c2-reach/2026-10-03/style-c2/instagram/c2-reach-instagram-2026-10-03-style-c2.mp4` | 8886328 |
| `engine/test/out/c2-reach/2026-10-03/style-c2/facebook/c2-reach-facebook-2026-10-03-style-c2.mp4` | 8886433 |

A re-render produces new files with new hashes (QA then records the new hashes); the checks themselves are what is reproducible.
