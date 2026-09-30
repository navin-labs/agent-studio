# Reel Engine: theautomationguy.navin

> This is the engine inside agent-studio (`engine/`). It is not live yet: `~/Dev/projects/reel-engine` keeps rendering daily posts until the switch-over (BUILD_PLAN task B4b). Setup paths below still point at the live copy. Only the **story** format is supported here; reels and carousels were removed (ADR 9).

One JSON script in, a finished post out.

- **Stories**: the `pile-to-flow` motion video, silent by default (voiceover only with `VOICE=on`), captions and sound effects. 1080x1920. Renders in any theme: add `"theme": "paper" | "ink" | "mono" | "studio"` to the script (default `paper`).

Every command below runs from the project folder. Open Terminal and start with:
```
cd ~/Dev/projects/reel-engine
```

---

## How it works (hands-free)

1. Forge saves a script into `content/stories/<id>.json`.
2. The watcher on your Mac notices it within 3 seconds and renders it.
3. The watcher writes `<id>.status.txt` next to the script: `ok`, or `failed` plus the errors. Forge reads it and fixes its own mistakes.
4. The finished files are copied to **Google Drive → My Drive → Reel Engine → <id>**.
5. You open that folder in the Google Drive app on your phone, watch the reel and post it with the text from `caption.txt`.

The only rule: while you're away, the Mac must be **on, plugged in, lid open and on Wi-Fi**. With the lid closed it sleeps and nothing renders.

---

## What to do, and when

| Situation | What to do | Why |
|---|---|---|
| **Normal day** | Nothing. | The watcher runs in the background. |
| **Restart, shutdown or log out** | Nothing. | The watcher starts itself every time you log in. |
| **Leaving the Mac while you're out** | Plug it in, keep the lid open, leave Wi-Fi on. | Plugged in, the watcher keeps it awake. A closed lid always sleeps. |
| **Forge says "Ready: <id>"** | Phone: Google Drive app → My Drive → Reel Engine → <id>. Open `caption.txt` and copy the text. Open `reel.mp4` → ⋮ → Send a copy → Instagram. Set `cover.png` as the cover. | Posting stays with you. |
| **Forge says it failed twice** | Read the status file (see Troubleshooting), fix it or tell Forge what to change. | Forge makes at most 2 fix attempts, then hands over. |
| **You want to check a script before it renders** | `npm run make -- content/stories/<id>.json --check` | Runs the quality gate only. Nothing renders and no voice credit is used. |
| **You want to render something yourself** | `npm run make -- content/stories/<id>.json`, then `open out/<id>` | A manual render. Works any time, watcher or not. |
| **One voice line sounds wrong** | Edit that scene's `vo` (or add a `"say"` field with the spelling the voice needs) and save. | Saving triggers a re-render. Only the changed line gets a new voice clip. |
| **You change the voice or pace** | See "Voice settings" below. | The change applies to every future render. |
| **I send you a new engine zip** | See "Updating the engine" below. | Pulls in new features without losing your settings. |
| **You move the folder or reinstall Node** | `npm run watch:install` | The background service stores the folder path and Node's location, so it needs reinstalling. |
| **Pause auto-render** (travel, heavy work, battery) | `launchctl unload ~/Library/LaunchAgents/com.theautomationguy.reelwatch.plist` | Stops rendering and lets the Mac sleep normally. |
| **Resume auto-render** | `launchctl load -w ~/Library/LaunchAgents/com.theautomationguy.reelwatch.plist` | Scripts saved while it was paused render right away. |
| **Moving to a new Mac** | Follow "One-time setup" on the new Mac, then copy your `.env` over. | `.env` holds your Sarvam key and voice settings. |

---

## One-time setup (already done on this Mac)

```
# 1. Install Node.js LTS from nodejs.org
# 2. Unzip reel-engine.zip into ~/Dev/projects/reel-engine, then:
cd ~/Dev/projects/reel-engine
npm install
cp .env.example .env
open -e .env          # paste SARVAM_API_KEY, set SARVAM_SPEAKER=shubh and SARVAM_PACE=1.0, save
npm run make -- content/stories/story-order-emails.json    # test render
npm run watch:install # start auto-render (runs at every login from now on)
```

**Phone delivery:** install Google Drive for desktop (google.com/drive/download) on the Mac and sign in with theautomationguy.navin@gmail.com. Then run `npm run watch:install` again. Finished posts appear in the Google Drive app on your phone. If Drive for desktop has several Google accounts signed in, set the folder yourself in `.env`:
```
RENDER_COPY_DIR=/Users/navinrana/Library/CloudStorage/GoogleDrive-theautomationguy.navin@gmail.com/My Drive/Reel Engine
```

macOS may show "Background Items Added: node". Allow it, because that's the watcher.

---

## Is the watcher running?

```
launchctl list | grep reelwatch     # a line with "reelwatch" means it's running
tail -20 out/watch.log              # what it did recently
```

---

## Voice settings

Your settings live in `.env`. Current setup: Sarvam, speaker `shubh`, pace `1.0`.

```
open -e .env                                                      # view or edit settings
sed -i '' 's/^SARVAM_PACE=.*/SARVAM_PACE=1.0/' .env               # change speed (0.9 slower, 1.1 faster)
sed -i '' 's/^SARVAM_SPEAKER=.*/SARVAM_SPEAKER=shubh/' .env       # change voice
npm run make -- content/stories/<id>.json --force-vo                # rebuild a reel's voice with the new settings
```

Voice clips are cached in `public/vo/<id>/`. A re-render after a visual-only edit uses no voice credit.

**To use your own voice for a reel:** record one clip per scene and name them `s01.m4a`, `s02.m4a`, and so on in scene order. Put them in `public/vo/<id>/`. The engine uses your recordings and never overwrites them.

---

## Updating the engine

When I send you a new `reel-engine.zip`, download it, then run:

```
cd ~/Dev/projects/reel-engine
unzip -o "$(ls -t ~/Downloads/reel-engine*.zip | head -1)" -x ".env" -d .
npm install
npm run watch:install
```

This updates the code but keeps your `.env`, your scripts and your renders.

---

## All commands

| Command | What it does |
|---|---|
| `npm run make -- <file>.json` | Renders a story into `out/<id>/` |
| `npm run gate:themes` | Contrast check for all themes + no raw colours outside `src/themes.ts` |
| `npm run stress` | Render every UI field at its maximum length through text QA (must pass with 0 errors) |
| `npm run primitives -- --all-themes` | Validate every primitive's example and render its contact sheet to `out/primitives/` |
| `npm run make -- <file>.json --check` | Quality gate only, no render |
| `npm run make -- <file>.json --no-vo` | Silent preview (no voice credit) |
| `npm run make -- <file>.json --vo-only` | Generates voice clips only |
| `npm run make -- <file>.json --force-vo` | Rebuilds all voice clips |
| `npm run make -- <file>.json --force` | Renders even if the quality gate fails (not for real posts) |
| `npm run watch` | Runs the watcher in this Terminal window (for testing) |
| `npm run watch:install` | Installs or reinstalls the background watcher |
| `npm run studio` | Live visual editor in your browser |
| `open out/<id>` | Opens a finished post |
| `pbcopy < out/<id>/caption.txt` | Copies the caption to the clipboard |
| `ls content/stories` | Lists the scripts Forge has saved |

---

## Your cloned voice (one-time setup)

Every video speaks in your own voice, cloned locally with Chatterbox (open-source, MIT licence, free). You record once; after that no human input is needed. Captions must say "Voiceover: AI (my cloned voice)".

1. **Record** the text in `voice/RECORD_THIS.md` (about 60 seconds, quiet room, phone Voice Memos). AirDrop it to the Mac.
2. **Convert and place it** (change the path to your file):
```
cd ~/Dev/projects/reel-engine
afconvert -f WAVE -d LEI16@24000 -c 1 ~/Downloads/"New Recording.m4a" voice/navin.wav
```
3. **Install the clone** (about 5 minutes, downloads a few GB the first time it runs):
```
python3 -m venv .venv-voice
.venv-voice/bin/pip install --upgrade pip
.venv-voice/bin/pip install chatterbox-tts
echo "CLONE_VOICE=voice/navin.wav" >> .env
```
4. **Test it:** `npm run make -- content/stories/story-invoice-chase.json --force-vo && open out/story-invoice-chase/reel.mp4`

**Quality gate before you ship it:** listen once. If it sounds robotic or has glitches, record a cleaner, longer sample and repeat step 2. Don't publish a bad clone.
To go back to Sarvam: delete the `CLONE_VOICE` line in `.env`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Forge saved a script but nothing rendered | `launchctl list \| grep reelwatch`. If nothing prints, run `npm run watch:install`. Then check `tail -20 out/watch.log`. |
| Status file says `failed` | `cat content/stories/<id>.status.txt` shows the errors. Quality gate errors mean the script breaks a rule, so Forge should fix it. |
| `Sarvam TTS 401` or `403` | The key is wrong or has no credit. Check `SARVAM_API_KEY` in `.env` and your Sarvam dashboard. |
| A render failed because the internet dropped | Save the script again (even unchanged). The watcher only retries after a file changes. |
| `command not found: npm` | Node isn't installed. Get the LTS version from nodejs.org. |
| Mac was asleep all day | The lid was closed, or it wasn't plugged in. Everything saved while it slept renders when it wakes. |
| Running low on disk | Old renders in `out/<id>/` are safe to delete once posted. Copies stay in Google Drive. |
| Files not appearing in Google Drive | Check the log: `grep copied out/watch.log \| tail -3`. If it says `copy failed`, allow the macOS permission prompt, or set `RENDER_COPY_DIR=` in `.env` to your Drive folder and run `npm run watch:install`. |

---

## What the quality gate blocks

- Em or en dashes
- Client claims ("my clients", "companies like yours", "we helped")
- Result claims ("3x", "save 20 hours", "guaranteed", "100%")
- Wrong structure: a story must start with `hook` and end with `cta`
- Unknown theme: use `paper`, `ink`, `mono` or `studio`
- Word limits: 28 words of voiceover per scene, 10 words of hook text, 32 words per slide
- UI limits: 5 emails, 6 sheet rows and 4 columns, 5 chat messages, 6 steps, 4 flow nodes, 3 notifications

---

## Extras

- **Background music:** put a royalty-free track in `public/music/` and add `"music": "track.mp3"` to the story script. It plays at 7% volume.
- **Sound effects** are on by default. Add `"sfx": false` to a script to turn them off.
- **Look and feel:** colours, fonts, handle and safe zones are in `src/theme.ts`. The logo is in `public/brand/`.

## Licences

- Remotion is free for individuals and for-profit companies with up to 3 employees, including commercial use. A company licence is needed beyond that. You may not resell this engine itself as a product (see `node_modules/remotion/LICENSE.md`).
- Inter font: SIL Open Font License (`public/fonts/OFL-Inter.txt`).
- Icons: Lucide (ISC).
- The sound effects were generated for this project and are free to use.
