# Final video design per channel

Status (2026-10-03): all locked. C1's two formats in night, both 40 to 60 s (Navin, 2026-10-03: no exceptions); the C2 grammar and pool change (studio/recipe.ts); C2 25 to 45 s until the phase-2 history shots. Every approved video renders as three platform videos (YouTube, Instagram, Facebook; docs/TECH.md "Variants"). Voices: local open-source engines with built-in voices (no paid voice API, no cloning), set per channel in `channels/<id>/channel.json` "voice": C1 = Kokoro af_heart 1.15, C2 = Kokoro am_fenrir 1.0. Every clip is levelled to the same loudness (scripts/tts_local.py).

## C2 length (decided 2026-10-03)
For now: the six beats at 25 to 45 s (the length gate's `story` format; Navin lowered the floor from 30 s). Today's C2 shot pool tops out around 30 s and a video never repeats a shot, so 40 to 60 s is not reachable without new shots. The 40 to 60 s target arrives with phase 2: archive photo pan, document reveal and timeline primitives, two shots for the turn and the idea.

## C1 The Automation Guy: two formats, Night Signal only

| | Host (Chiku) | Composed explainer |
|---|---|---|
| Length | 40 to 60 s | 40 to 60 s (no exceptions) |
| Theme | night | night |
| Beats (studio/recipe.ts `FORMATS`) | host-hook, pain, pain, contrast, flow, result, host-payoff, host-cta | `explainer`: hook, pain, pain, contrast, flow, result, payoff, end-card (8 beats, so it reaches 40 s; the old 6-beat composed shape topped out around 35 s) |
| Voice | Chiku's voice (choose below) | the same voice, so the channel sounds like one person |
| CTA | about 1 in 5 DM AUDIT, rest Follow (per platform: Subscribe on YouTube, Follow on Instagram, Follow the page on Facebook) | same |

To lock: the two rows above as they are (already in recipe.ts and the C1 rulebook) and one voice.

### Chiku's voice (locked 2026-10-03)
Kokoro `af_heart` at speed 1.15, with "Tally" pinned to /tˈæli/ (`voice.pronounce` in channels/c1-automation/channel.json). Confirmed through the pipeline: the voiced line's cache hash matches the text with the override.

## C2 Backstory: the short history story, Archive Gold only

### Scene grammar (six beats, 25 to 45 s for now)
| # | Beat | Time | Job | Primitive pool (proposal) |
|---|---|---|---|---|
| 1 | Hook | 0 to 3 s | the object or moment as a question, max 6 words | word-stack-slam, zoom-dive, split-flap, highlighter-swipe, counter-drop |
| 2 | The world before | 3 to 9 s | one concrete problem people had | pile-drop, conveyor, counter-drop, before-after-split |
| 3 | The turn | 9 to 20 s | who, where, when: the person and the fix | split-flap (the year), highlighter-swipe, word-stack-slam |
| 4 | One idea, shown | 20 to 30 s | how it works, one picture | maze-to-line, before-after-split, conveyor, zoom-dive |
| 5 | Why it matters today | 30 to 38 s | the link to now | counter-drop, word-stack-slam, split-flap |
| 6 | Follow card | 38 to 42 s | Backstory end card, `@backstory.minute` | end-card |

Applied: chat-pop and phone-buzz dropped (modern UI, wrong for history). The hook pool also takes highlighter-swipe and counter-drop, and the world-before pool before-after-split: with only three openers, each allowed twice a week, seven slots could not be filled. Recipe novelty rules unchanged.

### Pacing
- One sentence per beat, about 3.6 words a second (am_fenrir at 1.0, clips trimmed; C1's af_heart at 1.15 runs about 3.9).
- The year and the name always appear on screen when spoken (split-flap or highlighter).
- No music bed under the claim lines; a soft hit on the turn (beat 3).

### Sources (C2 rulebook)
- Every factual claim traces to `meta.source`. A claim the source does not support is cut.
- Each video's caption ends with "Source: <link>"; the YouTube description carries the same link (the SEO preflight will check it).
- No invented quotes, dates, numbers or people. Disputed details are said to be disputed or left out.

### C2 voice (locked 2026-10-03)
Kokoro `am_fenrir` at speed 1.0: calmer than C1's 1.15 so the channels stay distinct, and pitch about 140 Hz against af_heart's 205 Hz. Picked by ear after three rounds (round 1: bm_george, bm_fable, bf_emma, Parler Rick and David, Chatterbox; round 2 at pace 0.9: deeper voices, read as too slow; round 3 at pace 1.0 with a storyteller style for Parler). Kokoro was preferred over Parler partly because Parler renders differently every time, so a channel would not sound like one narrator.

## Render speed per minute of speech (Apple M5, measured 2026-10-03)
| Engine | Device | Render time per minute | Model load |
|---|---|---|---|
| Kokoro 82M | CPU | about 6 s (0.09 to 0.16 s per audio second) | about 5 s |
| Parler-TTS mini v1 | GPU (MPS) | about 2.4 to 3.5 min | about 11 s |
| Chatterbox | GPU (MPS) | about 2.6 to 4.5 min | about 12 s |
Parler and Chatterbox cut off long passages in one call (a 147-word text came out 19 s and 37 s); the pipeline voices one scene line at a time, which stays well inside their limit.
