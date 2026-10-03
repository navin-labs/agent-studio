# Motion: rules, the two channel styles, and style presets

Status (2026-10-03): rules adopted engine-wide. Each channel's look is a versioned style preset (below). The channels run their current looks, `c1-night-v0` and `c2-archive-v0`; the signature styles `c1-night-signal-v1` and `c2-archive-gold-v1` are on review (test videos `engine/test/style-c1.json`, `style-c2.json`). Approving one is the one setting `"style"` in the channel's channel.json, or one tap on the Tier 2 proposal Learn sends once the current style has a baseline (docs/TECH.md "Self-improving loop").

## Which approach (compared 2026-10-03)
| | youtube-automation-agent (darkzOGx, MIT) | maker-motion skill (capitainenox/makers-skill) |
|---|---|---|
| Motion rules | none: a scene lasts as long as its narration, then ffmpeg joins the clips | cut rhythm per format, an easing table, exits faster than entrances, camera moves on every shot, kinetic type limits, transitions that carry meaning, SFX lead |
| Fit for composed short-form | no | yes |

Adopted: maker-motion's rules (principles and numbers, restated here in our words; its repository states no licence, so no text is copied). Nothing taken from youtube-automation-agent for motion.

## Rules (engine-wide)
- Never linear. Entrances ease out (`OUT`, 6 to 8 frames), exits ease in and are faster (`IN`, 4 to 5 frames), camera moves ease in and out (`INOUT`), fast arrivals from far away use `EXPO` (`engine/src/primitives/atoms.tsx`).
- Transitions last 9 frames (0.3 s). A cut is the default; any other transition has to mean something.
- Text lands on cuts: a shot's headline enters with the cut (within its first 6 frames), and caption words appear as they are spoken; one idea per card.
- No shot sits still unless stillness is the point: the camera makes one deliberate move per shot instead of a slow linear drift.
- Nothing above 0.5 s of dead air unless the pause is the point. Voice clips are trimmed to 40 ms of lead and tail (`scripts/tts_local.py`); the engine leaves 0.33 s between lines (`LEAD` + `TAIL_AUDIO`). Measured on the test videos: 0.42 to 0.45 s between lines. The end card's silent hold is the one deliberate pause.
- Max two colours plus paper per asset, and the colour means one thing.

## Style presets (`styles/<id>.json`)
A style is data, not code: the engine knows a small set of building blocks and a preset picks them. A new style is a new file next to the old one; a channel switches, and rolls back, with its one setting `"style"`. Every platform variant records the preset in its render.json (`style`) and manifest (`style_version`); approval copies it onto the ledger line and the fingerprint, so Learn scores each version.

| Field | Meaning |
|---|---|
| `id` | `<channel short>-<name>-v<version>`, the file name (`c1-night-signal-v1`) |
| `channel`, `version` | whose style, and which version (a higher version is what Learn proposes) |
| `about`, `expect` | what it looks like, and what it should improve (both shown in the Tier 2 proposal) |
| `theme` | the colour theme (role tokens in engine/src/themes.ts; a preset never holds colours) |
| `transitions` | the scene transitions Recipe may draw for this channel: `cut`, `whip-pan`, `ink-wipe`, `pixel-wipe`, `fold` |
| `opener` | the first 0.6 s of every video: `none`, `arrow-fold` (the C1 mark), `year-flap` (the story's year, needs `meta.year`) |
| `overlay` | over the whole video: `none`, `thread` (the timeline thread in the reveal colour), `thread-paper` |
| `camera` | `{pain, result, other}`: zoom per shot role; positive pushes in over the shot, negative pulls out by 60% of it, 0 holds. Left out: the old slow drift |
| `strike` | before/after shots strike through the manual steps, then one pulse of the `ok` colour on the automatic half |
| `platforms` | one spec per platform (`youtube`, `instagram`, `facebook`), each its own render: `size` (1080x1920, 9:16), `thumbnail` (YouTube: always), `end_card.handle` (the account the end card names: that platform's own), `caption` (template: `{body}` the board's caption, `{cta}` the CTA line, `{voice}` the AI-voice disclosure, `{hashtags}`), `cta` per kind (`follow`, `dm-audit`, `send`: closer `text`, `sub`, spoken `say`, caption `line`; `{ig}` = the Instagram handle), `filename` (`{channel}-{platform}-{date}-{id}`), `destination` (YouTube `n8n`, Instagram and Facebook `forge-queue`) |

Platform words, as the presets have them: YouTube says Subscribe (and "DM AUDIT on Instagram" for C1's audit funnel), Instagram says Follow (and DM AUDIT), Facebook says Follow the page (and "DM AUDIT on Instagram"). C2's send kind is Share it on YouTube and Facebook, Send it on Instagram. A new version of a style keeps all three platforms.

Validated by `schemas/style.schema.json` (`npm run check`; its enums are checked against engine/src/composer/style.ts, and each platform's `filename` and `destination` against studio/variant.ts). A preset holds no voice and no colours; its caption template keeps the `{voice}` disclosure slot, which Learn never removes. A building block that does not exist yet (a new opener or overlay) is the only thing that needs engine code.

## C1 Night Signal (`night-signal`)
- Signature: every video opens with the folded arrow (the C1 mark, traced to shapes in `composer/Signature.tsx`): the three arrows fly in, their flaps fold shut, the mark flies through the camera into the hook (0.6 s). The `fold` transition sweeps the arrow's chevron forward (left to right) between scenes.
- Lime means "automated": it is the `ok` role only (the after half, the done step, the zero). Everything else is paper and greys; the highlighter and captions mark words in paper.
- Manual steps are struck through as the divider sweeps; one lime pulse marks the after-state (`before-after-split`).
- Camera: push in on the pain (pile, inbox, sheet, chat), pull out on the result (counter, stamp, flow run, before/after, end card), a short settle on type.

## C2 Archive Gold (`archive-gold`)
- Signature: every story opens on its year landing in split-flap tiles (they flip blank, never through wrong digits), and a gold timeline thread under the captions draws itself through the story: a node marks each beat, and each reveal flares its node gold for about 0.6 s.
- Gold means "the reveal" and the story's thread: the `reveal` role. The year turns gold the moment its last tile lands; a name is highlighted gold in the shot and in the captions the moment it is spoken. Writers mark only the name and the year with `*accent*`.
- Camera: one slow, deliberate push per shot (5%, in and out eased). Mostly cuts; one quiet wipe at most.
- Anti-slop: flat geometric shapes, no film grain, no AI-cinematic imagery. Period details are checked (no rupee prices in a 1948 American shop).

## Open (Navin)
- Approve the two test videos: set `"style"` to `c1-night-signal-v1` / `c2-archive-gold-v1` (or tap the proposal when it comes).
- The thread is gold as it draws, flaring at each reveal (`thread`); `thread-paper` keeps it paper with gold flares only.
- C2 length: decided 2026-10-03: the floor is 25 s (six beats on today's shots); 40 to 60 s arrives with the phase-2 history shots (archive photo pan, document reveal, timeline). C1 is 40 to 60 s in both formats; its explainer has 8 beats so it reaches 40 s (the C1 test video renders at about 46 s with its voice).
