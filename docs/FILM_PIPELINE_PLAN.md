# Plan: an effect-driven film engine (every video a directed animation)

## Context
Today's videos are either template slideshows (21 primitives picked partly at random, SaaS cards for every story) or authored films where Claude hand-draws 800 to 1,340 lines of SVG per film. Those films fail review: objects look wrong, sit too small, captions cover them, and sessions crash. Navin wants every video to be a full animation that shows what the script says, looks different each time, and uses named cinematic effects (orbit, couch wall, UI word, frame break, digital zoom, phone mockup, checklist, headline wall, zoom-through cut, chart grow, pullback reveal, green screen, paper cut, doodle boil, vertigo, cover story, glass type, and more). It must run on autopilot, apart from his one Telegram approval tap.

**Allowed tools:** Claude (me), Forge/Muse, Stitch, plus code from these repos:
- huashu-motion and huashu-art-motion (MIT)
- awesome-opus5-5-videos (MIT; 703 prompts for code-drawn animation)
- youtube-automation-agent (MIT)
- MoneyPrinterTurbo (MIT)
- p5.brush (MIT)

No image or video generation models.

**Decisions (Navin, 2026-10-23):**
- three.js 3D is approved.
- Real-world objects are drawn in code *and* taken from public-domain images where needed.
- First build: **24 effects + 1 full film** (Velcro).
- "Couch wall" is a living-room set: a couch against a wall of frames, where the frames show story images. Confirm on its first preview.

## Core idea: films are composed from tested effects, not drawn from scratch
Three independent layers, so a small library gives many distinct films:
1. **Set-pieces (what is on screen):** couch wall, headline wall, cover story, phone mockup, checklist, chart grow, UI word, green screen, parallax world, macro loupe.
2. **Camera and transitions (how we move):** orbit, vertigo (dolly zoom), pullback reveal, digital zoom, zoom-through cut, frame break, match cut.
3. **Looks (what it is made of):** paper cut, doodle boil, glass type, plus the existing p5.brush paint, engraving, grain and halftone.

A shot = one set-piece + one camera move + the film's look + the script's objects and words.

**What the Director writes (~150 lines of `scene.json`, not 1,300 lines of drawing):**
- Picks effects per beat from the catalogue.
- Binds them to the voice timing (`useFilm().beats`).
- Fills them with the script's objects.

Every effect is a typed, previewed, tested Remotion component, so nothing is drawn blind.

## What each source contributes
| Source | Taken | Left out |
|---|---|---|
| huashu-motion | Rhythm rules (hook < 3 s, energy in steps, burst at ~37%, hero on the strongest beat, earned 0.5 to 1.6 s silence, contrast schedule); its QA checks (single-frame pops, dead time, empty frame 0, covered/cut text, flat energy, loop seam); director habits (3 directions, treatment with 4 key stills, hardest shot first, self-notes); sound hits on every landing | HTML/GSAP engine, cartoon character, signature, Kurzgesagt/Vox/3B1B-named grammars |
| huashu-art-motion | Painted-in-code techniques and public-domain art-style recipes (cave, Egyptian, Van Gogh, Klimt, Bauhaus, 8-bit) as looks; the reference-film breakdown idea (cuts, beat grid, motion heatmap) | Living-artist and studio styles (Shinkai, Rick & Morty) |
| awesome-opus5-5-videos | 703 prompts tagged canvas/svg/threejs/shader/gsap: technique references when building each effect (orbit, glass, chart, paper-cut, particles...) | Copying any creator's video |
| p5.brush | Already in `films/kit.tsx` (`Painted`): charcoal, ink, watercolour, hatching for looks and props | n/a |
| Stitch | Real, story-specific UI screens (HTML + design system) for phone mockup, UI word, checklist, chart grow, cover story layouts; rebuilt in Remotion and animated | n/a |
| youtube-automation-agent | Evidence desk idea (each factual claim linked to a source before approval), single-scene repair (re-render one shot) | Slideshow renderer |
| MoneyPrinterTurbo | Batch task queue idea | Stock footage, its LLM/TTS stack (ours is better) |
| Forge (Muse) | Writer (concrete, showable lines), fact-check with sources, Instagram/Facebook posting and metrics (retention per film), weekly trend notes | Images/video from Meta AI |

## Effect catalogue v1 (24)
Each effect is one file in `engine/src/fx/`, registered with a spec: id, layer (set-piece / camera / look), story jobs it serves, script cues that suggest it, duration range, props schema, assets it needs, sound cue.

| # | Effect | Layer | What it does |
|---|---|---|---|
| 1 | orbit | camera (3D) | Camera circles a 3D object or title |
| 2 | vertigo | camera (3D) | Dolly zoom: subject holds size, background stretches |
| 3 | pullback reveal | camera | Starts on a detail, pulls out to show the whole |
| 4 | digital zoom | camera | Punch-in with scan lines/pixel step, CCTV/screen feel |
| 5 | zoom-through cut | transition | Push into an object (lens, hole, screen) to land in the next scene |
| 6 | frame break | transition | The subject breaks out of its frame border into the next shot |
| 7 | match cut | transition | Shape/position match from one beat to the next |
| 8 | couch wall | set-piece | Living room: couch + wall of frames that fill with story images |
| 9 | headline wall | set-piece | Wall of newspaper headlines; camera finds the one that matters |
| 10 | cover story | set-piece | A magazine cover built for the story, then the camera dives in |
| 11 | phone mockup | set-piece | Phone with a live screen (Stitch UI), notifications, scroll |
| 12 | UI word | set-piece | Key words appear as UI: typed in a search bar, a notification, a button |
| 13 | checklist | set-piece | Items tick off in sync with the voice |
| 14 | chart grow | set-piece | Bars/lines grow to the spoken number, with annotation |
| 15 | green screen | set-piece | Cut-out subject keyed over a changing background |
| 16 | parallax world | set-piece | 3 depth layers with real parallax under the camera |
| 17 | macro loupe | set-piece | A tiny object magnified 10x beside its big subject |
| 18 | split-flap | set-piece | Exists (`primitives/split-flap.tsx`): years and numbers |
| 19 | stamp hit | set-piece | Exists (`stamp-hit.tsx`): verdicts, dates, "PATENTED" |
| 20 | kinetic type slam | set-piece | Exists (`word-stack-slam.tsx`): hook lines |
| 21 | draw-on | look/set-piece | Blueprint/patent lines draw themselves (`@remotion/paths` evolvePath) |
| 22 | paper cut | look | Cut-paper layers, fibre, lift shadows, stepped 12 fps |
| 23 | doodle boil | look | Hand-drawn lines that boil on 2s/3s (Rough.js seeds per step) |
| 24 | glass type | look (3D) | Titles as refractive glass in three.js |

After v1, the library grows weekly toward 40+ effects: typewriter, redaction reveal, x-ray, spotlight, receipt print, sticky notes, conspiracy board, page curl, shatter, halftone/risograph, isometric diorama, map flight, timeline scrub, polaroid drop, and more.

## Objects ("props") without image models
- **Prop library** `engine/src/props/`: each real-world thing is built once with care, reviewed, then reused across films:
  - 3D props from primitives with toon/paper shading (microscope, phone, lamp);
  - 2D props drawn from their real parts, with p5.brush texture (dog silhouette with pivots, burr with hooks);
  - public-domain sources traced or cut out (US patent drawings, CC0 museum scans, engravings).
- Each prop has a manifest: parts, pivots, bbox, source and licence, and the looks it supports.
- **Looks that suit code art:** silhouette, paper cut, engraving, blueprint, doodle and toon-3D make objects read clearly and hide imprecision. Photoreal is never attempted.

## Pipeline (autopilot)
1. **Forge** writes the board weekly, with concrete, showable lines and a source per fact (`agents/writer/FORGE_WEEKLY_WRITER.md` updated).
2. **Voice timing**: existing measured Kokoro clips (`make.mjs --vo-only`, `film.mjs beats`).
3. **Director pass 1** (headless Claude, `studio/director.ts`):
   - breakdown: every object, person, place, date and action per line, with its time window;
   - the look and palette (new theme in `themes.ts`);
   - the effect plan per beat;
   - the uniqueness gate (`studio/creative.ts` extended: effect combination, look and camera family differ from recent films).
4. **Director pass 2**: `scene.json` (validated by `schemas/scene.schema.json`) plus at most one small signature-moment TSX. Stitch screens are generated for UI effects (cached in `engine/public/ui/<film>/`). Missing props are built and added to the prop library.
5. **Render**: `SceneFilm` renders `scene.json` through the effect registry. A 540p preview comes first, then the full render of 3 platform variants (existing `make.mjs`).
6. **Gates**:
   - existing 12 QA checks;
   - the new huashu checks;
   - **grounding by construction**: every effect reports its focal object's box, so size (hero at least 35% of width), caption overlap, timing against the spoken word and dead bands are checked from data, no detector needed;
   - Critic (separate Claude session, `CRITIC.md` rewritten) reads frames, answers a yes/no checklist and emits fix codes per shot. Up to 2 revision rounds per shot; then the film is held with frames sent to Telegram.
7. **Telegram tap** → dispatch (unchanged). Forge posts to Instagram/Facebook and reports retention, which feeds Learn.

## Critical files
- **New:**
  - `engine/src/fx/*` (effects + `registry.ts`)
  - `engine/src/fx/camera.tsx` (WorldCamera 2D + 3D)
  - `engine/src/films/SceneFilm.tsx`
  - `engine/src/props/*`
  - `schemas/scene.schema.json`
  - `docs/FX.md` (catalogue)
  - `engine/scripts/fx-gallery.mjs` (renders every effect's preview + contact sheet)
  - `agents/director/references/` (rhythm and QA notes adapted from huashu, MIT notice kept)
- **Changed:**
  - `engine/src/films/index.ts` (SceneFilm)
  - `engine/src/composer/Composer.tsx` (focal-box probe beside the existing text-box probe)
  - `studio/qa.ts` + `studio/qa.test.ts` (new checks)
  - `studio/creative.ts` (+ test: effect/look uniqueness)
  - `studio/director.ts` (two passes, Stitch step)
  - `agents/director/DIRECTOR.md`, `CRITIC.md`
  - `agents/writer/FORGE_WEEKLY_WRITER.md`
  - `engine/package.json` (`three`, `@react-three/fiber`, `@remotion/three` pinned to 4.0.527)
- **Reused:**
  - `films/kit.tsx`: `useFilm`, `cam`/`camAt`, `settle`, `k`, easings, `Grain`, `Sketch`, `Painted`, `Score`, `Foley`, `Captions`, `rng`
  - existing primitives `split-flap`, `stamp-hit`, `word-stack-slam`, `zoom-dive` (wrapped as effects)
  - `film.mjs` (`beats`, `frames`, `master`, `motion`, `score`), `stills.mjs --comp`, `make.mjs`, `creative.ts`, the QA chain

## Build order (one BUILD_PLAN task per session, each ends with check + commit)
| # | Task | Done when |
|---|---|---|
| F1 | Foundation: `scene.json` schema, `SceneFilm`, WorldCamera 2D/3D, three.js deps, effect registry + gallery script | a 3-shot demo `scene.json` renders; `npm run check` passes |
| F2 | Effects batch 1 (8): orbit, vertigo, pullback reveal, zoom-through cut, parallax world, macro loupe, paper cut, doodle boil | each has a gallery preview + contact sheet Navin has seen |
| F3 | Effects batch 2 (8): couch wall, headline wall, cover story, phone mockup (Stitch), UI word (Stitch), checklist, chart grow, glass type | same |
| F4 | Effects batch 3 (8): digital zoom, frame break, match cut, green screen, draw-on, split-flap, stamp hit, kinetic type slam | same; all 24 in `docs/FX.md` |
| F5 | Prop library v1 for Velcro: Alps layers, dog (parts + pivots), burr, 1940s microscope (3D), de Mestral silhouette, hooks/loops mechanism, US 2,717,437 patent drawing (PD) | each prop passes a Critic look-check at phone size |
| F6 | Gates: huashu QA checks, focal-box probe + grounding-by-construction, effect/look uniqueness, Critic checklist + fix codes | tests in `qa.test.ts` / `creative.test.ts` fail on the old films' known faults (tiny burr, caption over jacket) |
| F7 | Director: two-pass skill, `director.ts` flow, Stitch step (check that headless `claude -p` reaches Stitch; else a UI-screen cache made in sessions), Forge writer update | Velcro film made end to end by the pipeline with no hand edits |
| F8 | Proof + autopilot: blind comparison against `c2-2026-w41-1`, `FILMS=on` in the watcher | the new film passes QA and the Critic, Navin prefers it, and the next Forge board renders to Telegram unattended |

## Verification
- `cd engine && npm run check` after every task (types, themes, text QA, all studio tests).
- `node scripts/fx-gallery.mjs`: renders each effect alone (540p) with a contact sheet. Every effect is seen before use.
- Velcro film: `npm run make -- test/films/<id>.json`, then `node studio/qa.ts engine/test/films/<id>.json --out engine/test/out`. All checks pass, including grounding (every script object at least its size class at its spoken time, 0 caption collisions, 0 dead bands), loudness -14 LUFS.
- `node engine/scripts/film.mjs frames <mp4> 0,0.3,1,2,3 <dir>` plus contact sheet reviewed by the Critic and by Navin.
- Autopilot: one Forge board flows Writer → Director → render → QA → Telegram with no manual step.

## Open items (not blocking F1)
- Stitch commercial-use terms and headless access (checked in F7).
- Instagram/Facebook posting needs a tap per post in Muse; full autopilot would need the Meta Graph API via the existing n8n. Navin decides at F8.
- Remotion company licence if the studio grows beyond an individual/small team.

---

## Update 2026-10-25: the "Editorial Object" engine (replaces the code-drawn props of F2)
Why: Navin's references (the PickUs ad, Video-93990) and three rejected hooks showed the root cause: objects drawn from code shapes never look real. The house format is now **Editorial Object** (docs/CREATIVE_BIBLE.md section 9): real cut-out objects that act on big editorial type, in a calm paper world with one accent colour.

### What the reference does, and how we build each part
| Reference element | How we build it (Remotion, 2D compositing) | Source repo/skill |
|---|---|---|
| Real objects (glasses, column, notepad, magnifier, pens) | **Asset pipeline:** search Pixabay → Pexels → Openverse (CC0/PD) → Stitch photo; cut out locally (BiRefNet, MIT); trim, grade to the film's tones; cache in a prop library with source and licence | MoneyPrinterTurbo (stock search pattern), youtube-automation-agent (licence and evidence ledger), Stitch |
| Object lands and settles | `ObjectLand`: enters with motion blur and slight rotation, settles with an eased spring; soft drop and contact shadow | huashu rhythm (enter 0.3 to 0.4 s, settle, hold); Remotion best practices |
| Object acts on the words (lens magnifies, magnifier reveals hidden text) | `Lens`: a scaled copy of the type layer clipped to the lens circle; hidden text exists only inside the lens | awesome-opus prompts (lens/refraction), Remotion masks |
| Column crumbles, glass shatters | `Shatter`: the cut-out split into shards with clip-path polygons that fall and spin; shards reused as foreground flyers | awesome-opus (shatter/particles) |
| Three type voices with huge contrast | `TypeStack`: grotesk (Inter), condensed display (Anton or Bebas Neue, OFL), serif italic (Instrument Serif or Newsreader, OFL); reveals: focus-pull, rise, letter slide | huashu kinetic-type language; Remotion fonts |
| Red laser strike, red pen circle, highlight box | `Strike` (line with glow), `PenCircle` (exists, retuned), `Box` | huashu-art-motion y2 evidence-board grammar (red pen, paper, stepped 12 fps) |
| Editorial texture (definition paragraph, crop marks, dimension lines, X2/X4, braille dots) | `Marks` layer driven by the script: the definition comes from the Writer (Forge) | huashu editorial-collage and system-diagram languages |
| Focus pulls as transitions, depth | `FocusPull` (whole-frame blur to sharp), foreground flyers out of focus | huashu camera grammar (slow for transitions, fast only for reveals) |
| Chromatic edge, grain, slight flicker | `PaperWorld` look: paper tone, grain (kit `Grain`), RGB-split on edges, vignette | film kit |
| Pinned note card, end CTA ring + pill | `PinnedCard`, `CtaRing` | Stitch can design the card or CTA layout |
| Calm but always moving | Energy band 150 to 450 hook, 60 to 160 per second (reference: 396 / 91) | QA (`film.mjs analyse`) |

### Per channel (same engine, two worlds)
- **C2 Backstory:** warm paper, deep red accent, serif italic leads. Objects: historical things, patents, instruments.
- **C1 The Automation Guy:** graphite paper (dark), lime accent, grotesk leads. Objects: invoices, phones, laptops, notepads, plus Stitch UI screens placed as objects.

### Asset sources and their rules
| Source | Status | Rules |
|---|---|---|
| Pixabay | key added by Navin (`PIXABAY_API_KEY`) | commercial use OK; no logos or identifiable faces in the frame |
| Pexels | key to add (`PEXELS_API_KEY`) | same |
| Openverse | no key | CC0 and public domain only |
| Unsplash | Navin has app credentials | **Not used for now:** its API guidelines require hotlinking the returned URLs and forbid storing and self-hosting images, which a rendered video needs |
| Stitch | connected (MCP) | fallback for objects stock lacks; check Google Labs commercial terms before production |
| Puter.js | not used | "user pays" model: needs a Puter account login per user; limits and commercial terms not published; Stitch already covers generation |

### Build order (replaces F2 and F2b)
| # | Task | Done when |
|---|---|---|
| E1 | Asset pipeline: `assets.mjs` search (Pixabay, Pexels, Openverse) → rank (plain background, no logos or faces) → download → BiRefNet cut-out → trim and grade → `public/props/<slug>/` with manifest | `node scripts/assets.mjs "burdock burr" "dog" "magnifying glass" "white sneaker velcro"` returns 4 clean cut-outs with licences |
| E2 | Paper world, type system (3 OFL fonts bundled), marks layer | a still frame matches the reference's feel side by side |
| E3 | Object effects: ObjectLand, Lens, Shatter, Flyers, FocusPull, Strike, PenCircle, PinnedCard | each in the gallery |
| E4 | The Velcro film (about 20 s) in this format | measured inside the band, Navin approves |
| E5 | scene.json + Director + QA (band, grounding, licence/no-logo check) | the next Forge board renders to Telegram unattended |

---

## Update 2026-10-25 (b): four formats, Forge's brief corrected
Forge's brief (kinetic type + network-line 3D) is right on the two effects. It needs four corrections:
1. **Reference 1 is already in hand.** Video-28089 is Rituraj Das's "Creative Inflation / Flow State" reel; the frame-by-frame spec is in CREATIVE_BIBLE section 10, so no link is needed. It is more than glow text: the films run on **real cut-out objects tinted into one hue**, with the transcript as typography. Glow and per-word stagger are the type layer of that format.
2. **A third reference, Video-45335 (Flat Journey), was missing from the brief.** Two-colour flat illustration that scrolls through a world on a timeline. It needs a vector-illustration mode in the asset pipeline (Pixabay `image_type=vector`, Openverse SVG, Stitch flat illustration), recoloured to two inks with grain.
3. **"No per-film SVG drawing" stays, with one clarification:** abstract subjects (networks, flows, data) are code-native (format C). Real things are always assets (formats A, B, D).
4. **Channels:** C (Network Line) is C1 positioning; B and A serve both channels; D is C2 history first.

### Format engine work (extends E2 and E3)
| Format | New engine parts | Asset mode |
|---|---|---|
| A Editorial Object | PaperWorld, TypeStack, Marks, ObjectLand, Lens, Shatter, FocusPull, Strike, PenCircle | photo cut-out |
| B Duotone Story | Duotone grade (by theme), KineticTranscript (word-timed; keyword vs connector sizing; glow; stagger), Orbit ring, PixelDissolve | photo cut-out (B&W then tinted) |
| C Network Line | three.js: LineGrow, Branches (splines + nodes), NodeTunnel, WireMesh, Planet; Split world (black/white wedge); MinimalCaption | none (code-native) |
| D Flat Journey | WorldScroll (horizontal camera over placed props), Timeline scrubber, Spotlight, two-ink recolour + grain | vector illustration (recoloured) |

### Proof tests (blind-compared with the reference at phone size before any full film)
| # | Test | Length | Green-light when |
|---|---|---|---|
| P1 | B Duotone Story: the Velcro hook (burr, dog, magnifier, sneaker, all tinted) with a kinetic transcript | 15 s | inside its band (hook 60+, 20+ per second), Navin prefers or can't tell |
| P2 | C Network Line: "From manual work, to a workflow, to a system that runs itself" (C1) | 10 to 15 s | same, band hook 94+, 39+ per second |
| P3 | D Flat Journey: one era-to-era scroll with a timeline (C2) | 10 to 15 s | same, band hook 32+, 23+ per second |
| P4 | A Editorial Object: the Velcro hook | 15 s | same, band hook 238+, 55+ per second |
Each proof either gets green-lit, retuned, or killed before it costs a full build.

### Proof results (2026-10-25), measured with `film.mjs analyse` against each format's own reference
| Proof | Composition | Hook (floor) | Per second (floor) | Longest still | Verdict |
|---|---|---|---|---|---|
| P1 Duotone Story | `DuoVelcro` (src/fx/duotone.tsx) | 70 (60) | 25 (20) | 0.3 s | green |
| P2 Network Line | `NetC1` (src/fx/network.tsx) | 190 (94) | 49 (39) | 0.8 s | green |
| P3 Flat Journey | `FlatVelcro` (src/fx/journey.tsx) | 42 (32) | 34 (23) | 0.8 s | green |
| P4 Editorial Object | `EdVelcro` (src/fx/editorial.tsx) | 150 (238) | 48 (55) | 0.4 s | look approved in frames; calmer than its busy reference by choice (calm-not-forced rule). Raise only if Navin wants the reference's density |
Lessons:
- Stock and generated plates become one film through the grade: duotone S-curve (B), B&W + contrast (A), paper keyed to transparency (D).
- Multiply blending fails inside clipped containers (they isolate the blend); key the paper to alpha instead.
- three.js lines are 1 px: use thin tubes so they survive phone size.
- A magnifier photo's glass is opaque: hidden words go on top of it, measured to the glass centre.
- Every held beat needs one slow, real change (wedge opening, page push, Ken Burns), not just a glow.
Next: E4/E5, turning these into scene.json-driven effects the Director picks per film, plus the asset step for flat illustrations (paper keying) in assets.mjs.
