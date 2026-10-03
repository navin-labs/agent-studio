# engine: the agent-studio renderer

The motion library and renderer inside agent-studio (Remotion 4, React 19, TypeScript). One storyboard JSON in, three finished platform videos out (YouTube, Instagram, Facebook), each checked by QA. How the studio around it works: `../docs/TECH.md`.

Commands run from this folder (`engine/`).

---

## How it works (hands-free)

1. Forge (the Weekly Writer skill) saves a storyboard into `content/storyboards/<id>.json`.
2. The watcher notices it within a few seconds and renders it once per platform, from the channel's style preset (`../styles/<id>.json` `platforms`): each platform gets its own closing call to action, spoken CTA line, end card account and caption ending, and YouTube its thumbnail.
3. Each platform's files land in `out/<channel>/<yyyy-mm-dd>/<id>/<platform>/`, every file named `<channel>-<platform>-<date>-<id>.<kind>` (video `.mp4`, `.caption.txt`, `.manifest.json`, `.qa.json`, `.contact.png`, YouTube `.thumbnail.png`).
4. QA checks each platform video on its own (`../studio/qa.ts`). The watcher writes `<id>.status.txt` next to the board: `ok`, `failed` or `failed QA`, with the exact errors per platform. Forge reads it and fixes its own mistakes.
5. Every platform folder is copied to **Google Drive > My Drive > Reel Engine > <channel> > <date> > <id> > <platform>** so it reaches your phone, and each QA-passed video arrives on Telegram for approval.

Nothing here publishes anything. Publishing is the dispatcher's job, and only after your approval (`../agents/dispatch/RULES.md`).

The Mac must be on, plugged in, lid open and on Wi-Fi for renders to happen.

---

## What to do, and when

| Situation | What to do |
|---|---|
| Normal day | Nothing. The watcher runs in the background and starts at every login. |
| Check a board before it renders | `npm run make -- content/storyboards/<id>.json --check` (quality gate only; nothing renders) |
| Render a board yourself | `npm run make -- content/storyboards/<id>.json`, then `open out/<channel>/<date>/<id>` |
| Render a test board | `npm run make -- test/style-c1.json` (test boards render to `test/out/`, never to `out/`) |
| One voice line sounds wrong | Edit that scene's `vo` (or add a `"say"` field with the spelling the voice needs) and save. Only changed lines get a new clip. |
| Pause auto-render | `launchctl unload ~/Library/LaunchAgents/com.theautomationguy.studiowatch.plist` |
| Resume auto-render | `npm run watch:install` |
| You moved the folder or reinstalled Node | `npm run watch:install` |

---

## One-time setup

```
npm install
cp .env.example .env    # then set VOICE=on in .env (voices: see "Voice")
npm run check           # types, themes, text QA, schemas, every studio test
npm run watch:install   # start auto-render (runs at every login from now on)
```

**Phone delivery:** install Google Drive for desktop on the Mac and sign in. The watcher finds `My Drive` by itself; with several Google accounts signed in, set the folder in `.env`: `RENDER_COPY_DIR=<path to My Drive>/Reel Engine`, then `npm run watch:install` again. macOS may show "Background Items Added: node": allow it, that is the watcher.

Is the watcher running?
```
launchctl list | grep studiowatch   # a line means it is running
tail -20 out/watch.log              # what it did recently
```

---

## Voice

Local, open-source voices with built-in speakers: no paid voice API, no voice cloning. Each channel picks its voice in `../channels/<id>/channel.json`:
```
"voice": {"engine": "kokoro", "voice": "af_heart", "speed": 1.15, "pronounce": {"Tally": "[Tally](/tˈæli/)"}}
```
| Engine | Voices | Speed on an Apple M5 (render seconds per minute of speech) | Notes |
|---|---|---|---|
| Kokoro (first choice) | built-in ids; locked: C1 `af_heart` 1.15, C2 `am_fenrir` 1.0 | about 6 s | native speed control; CPU |
| Parler-TTS mini v1 | named speakers, e.g. `Gary`, `Rick` | about 3.5 min | pace is described, not exact; GPU |
| Chatterbox | its default voice only | about 4.5 min | pace via cfg_weight; watermarked; GPU |

Setup (one time; each engine in its own folder under `.venv-voice/`, which git ignores):
```
brew install espeak-ng
uv venv --python 3.12 .venv-voice/kokoro && VIRTUAL_ENV=.venv-voice/kokoro uv pip install "kokoro>=0.9.4" "transformers>=4.45" soundfile pip "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
uv venv --python 3.12 .venv-voice/parler && VIRTUAL_ENV=.venv-voice/parler uv pip install "parler-tts @ git+https://github.com/huggingface/parler-tts.git" soundfile
uv venv --python 3.11 .venv-voice/chatterbox && VIRTUAL_ENV=.venv-voice/chatterbox uv pip install chatterbox-tts soundfile "setuptools<81"
```
Try a line: `.venv-voice/kokoro/bin/python scripts/tts_local.py --engine kokoro --voice af_heart --speed 1.15 --text "Hello." --out /tmp/a.wav`
Voice clips are cached per platform in `public/vo/<id>/<platform>/` (the platforms share every line except the closing CTA); a visual-only edit re-voices nothing. Rebuild: `npm run make -- content/storyboards/<id>.json --force-vo`.

---

## All commands

| Command | What it does |
|---|---|
| `npm run make -- <board>.json` | Renders a board: one video per platform (production boards into `out/`, anything else into `test/out/`) |
| `npm run make -- <board>.json --out=<dir>` | Renders into another renders root |
| `npm run make -- <board>.json --check` | Quality gate only, no render |
| `npm run make -- <board>.json --no-vo` | Silent preview |
| `npm run make -- <board>.json --vo-only` | Generates voice clips only |
| `npm run make -- <board>.json --force-vo` | Rebuilds all voice clips |
| `npm run check` | TypeScript, theme gate, text QA self-test, schemas, every studio test (run before every commit) |
| `npm run gate:themes` | Contrast check for all themes + no raw colours outside `src/themes.ts` |
| `npm run stress` | Renders every UI field at its maximum length through text QA (must pass with 0 errors) |
| `npm run primitives -- --all-themes` | Validates every primitive's example and renders its contact sheet |
| `npm run watch` / `npm run watch:install` | Runs the watcher here / installs it in the background |
| `npm run studio` | Live visual editor in your browser |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Forge saved a board but nothing rendered | `launchctl list \| grep studiowatch`. If nothing prints, run `npm run watch:install`. Then `tail -20 out/watch.log`. |
| Status file says `failed` or `failed QA` | `cat content/storyboards/<id>.status.txt` shows the errors per platform. A board error is Forge's to fix; a variant "held for Navin" (for example an Instagram username still pending, or a Facebook page without its page_id) is a channel.json setting. |
| `Voice engine ... not installed` | Run that engine's line under "Voice" setup. |
| A render failed because the network dropped | Save the board again (even unchanged). The watcher only retries after a file changes. |
| Files not appearing in Google Drive | `grep copied out/watch.log \| tail -3`. If it says `copy failed`, allow the macOS permission prompt, or set `RENDER_COPY_DIR` in `.env` and run `npm run watch:install`. |

---

## What the quality gate blocks

- Em or en dashes
- Client claims ("my clients", "companies like yours", "we helped")
- Result claims ("3x", "save 20 hours", "guaranteed", "100%")
- Text over a primitive's limits, unknown icons, an unknown hook pattern or theme
- A channel board without a real Instagram handle or a style preset, a theme or transition the preset does not allow, a year-flap style without `meta.year`
- 3 to 5 hashtags only

---

## Licences

- Remotion is free for individuals and for-profit companies with up to 3 employees, including commercial use. A company licence is needed beyond that (see `node_modules/remotion/LICENSE.md`).
- Fonts: Inter, Inter Tight, JetBrains Mono, VT323 under the SIL Open Font License (`public/fonts/OFL-*.txt`).
- Icons: Lucide (ISC).
- The sound effects were generated for this project and are free to use.
