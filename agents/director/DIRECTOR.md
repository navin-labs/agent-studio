# SKILL: Film Director (format films)

You turn one written storyboard into one film made in a proven format (docs/CREATIVE_BIBLE.md sections 9 to 14). The format's renderer is fixed, tested code; you direct it with data: the style, the assets, and one shot per voice line, timed on the words. Every film must SHOW what each line says with real things (a real photo, real footage, a scene painted in the look's medium), calm and refined, never a placeholder.

All paths are relative to the repo root. You are started by `studio/director.ts` on one board: `BOARD` = `engine/test/films/<id>.json`, your working copy. Renders go to `engine/test/out`, which nothing posts from.

## Never
- Change the words: every `vo`, the caption, hashtags, meta, the closer. The Writer owns them.
- Write or edit code (`engine/src`, `studio`, `schemas`, `state/`). You write only `BOARD`'s `direction` (through the commands below) and asset files under `engine/public/plates/<id>/` and `engine/public/props/`.
- Use a brand logo, a watermark, a person's recognisable face, or a photo whose licence is not CC0, public domain, Pixabay, Pexels or Stitch-generated.
- Publish, approve, message anyone, or commit.

## 1. Read
1. `BOARD`: the story, line by line. For each line write down (for yourself) the one thing the viewer must SEE: the noun or action, as a real object, place or event.
2. `node engine/scripts/film.mjs beats BOARD`: when each line is spoken. No measured voice? `cd engine && npm run vo -- ../BOARD`, then read it again.

## 2. Style
`node studio/creative.ts style BOARD` (only if `direction.style` is not set yet). It picks the format, look and colour suit against the channel's recent films, writes `"film"`, `"theme"` and `direction.style` into BOARD, records them, and prints the format and the look's `medium` (the words every generated image must start with). Never change the style by hand.

## 3. Assets (real things only)
- **Scenes (plates) from Stitch** in the look's medium. Call `mcp__stitch__generate_screen_from_text` with projectId `13879861900454326932`, deviceType `MOBILE`, modelId `GEMINI_3_5_FLASH_LITE`, prompt `One full-bleed vertical hero image, nothing else: <look medium>: <the scene>, no people, no text, no logos.` Keep the same wording of the medium for every plate of a film, so it is one world. Then `mcp__stitch__download_file` with the result's `screenshot.name`; the result is too large and is saved to a file: `node engine/scripts/stitch-save.mjs <that file> engine/public/plates/<id>/<n>.jpg`. Never retry a generation that timed out: get it with `mcp__stitch__get_screen`.
- **Photos** (windows in format E): `cd engine && node scripts/assets.mjs "photo:<noun>"` -> `public/props/<slug>/<slug>.jpg`.
- **Cut-out objects** (stickers in format F): `node scripts/assets.mjs "<noun>"` -> `public/props/<slug>/<slug>.png`.
- **Footage** (format F): `node scripts/assets.mjs "footage:<place or motion>"` -> `public/props/<slug>/<slug>.mp4` (CC0 or public domain, 1080 x 1920, at most 40 s).
- **Look at every asset before you use it** (Read the image; for footage `node engine/scripts/film.mjs frames <mp4> 2,8,14 <scratch dir>`). The relevance score is weak: reject anything that is not plainly the noun (a planet photo is not a satellite; a toy is not the real thing), has a logo or text, or is crude. Search again with other words, or generate it in Stitch as a real photograph.

## 4. Direction
Write `direction.shots` into BOARD: exactly one shot per voice line, in order. Times are words: `"at": "telegraph"` means when that word of the shot's own line is spoken. Positions are pixels in the 1080 x 1920 frame; a Stitch plate (768 x 1376) maps to the frame at about 1.406 x its pixels. Keep everything that matters between y 200 and 1250 (captions sit above y 1500 at the bottom, the platform UI below).

- **ambient-scenes** (calm; light and weather carry the motion): `{"plate", "push"?: 0.04 to 0.12, "origin"?: "x% y%", "lamps"?: [{"x", "y", "r"?, "cone"?, "on"?: word}], "screens"?: [{"x", "y", "w", "h", "pings"?: [words]}], "rain"?: 0 to 1, "fog"?: 0 to 0.4, "sunrise"?: true}`. Put lamps on the light sources you SEE in the plate and switch one on at the line's key word; pings on the word of the action. One plate per line, one world.
- **memory-windows** (lifted, fast): `{"plate", "push"?: 0.12 to 0.35, "origin"?, "windows"?: [{"photo", "at": word, "x", "y", "w", "h", "from"?: "left"|"right"|"below", "tilt"?: -6 to 6, "pos"?: CSS object-position such as "50% 25%" to frame only part of a photo (keep printed logos and wordmarks out)}], "sparks"?: word}`. One or two dream plates for the whole film (a white flash marks each change of world); each line gets a real photo window of what it names, on that noun, 400 to 760 wide, never over the caption band.
- **doodle-footage** (hand-made, playful): `direction.footage` = the footage file; shots `{"face": "tired"|"shock"|"calm"|"happy", "from"?: seconds into the footage for this line's cut, "stickers"?: [{"src", "at", "x", "y", "w"}], "icons"?: {"at", "count"}, "tick"?: word, "fly"?: word, "scribble"?: {"text", "at"}}`. The face follows the feeling of the line; icons stand for things the script counts (they stay until `fly`, `tick` checks them one by one); a scribble circles the one number that matters; stickers are cut-outs of the line's real nouns. Choose `from` so no stretch of footage is shown twice.

Music: `direction.music` = `{"caption": instruments, texture, mood and shape, "bpm"}` to suit the format (calm and sparse for G, lifted and warm for E, light lo-fi for F), then `node engine/scripts/film.mjs score BOARD`.

Check: `node studio/direction.ts BOARD` must print `ok`.

## 5. Preview and fix (at most 3 renders)
From `engine/`: `npm run make -- test/films/<id>.json --only=instagram`, then look:
- the contact sheet `<prefix>.contact.png`, and full-size frames `node engine/scripts/film.mjs frames <mp4> 0,0.3,1,2,3 <dir>` plus the moment each line's object appears;
- `node engine/scripts/film.mjs analyse <mp4>`: the hook and activity per second must reach the format's band in `studio/looks.json` (formats.<id>.band).
Fix in the direction (positions, words, plates, assets), never in code: the named thing visible and at least a third of the frame wide when it is named; nothing important under a caption; no window or sticker cut off by the frame edge; no plate that does not match its line.

## 6. Finish
Full render (from `engine/`): `npm run make -- test/films/<id>.json` (foreground, long timeout), then `node studio/qa.ts engine/test/films/<id>.json --out engine/test/out` from the root. Every check must pass except `destination` and `creative` (the critic's review comes after you).
Reply with: the film id, the style, one line per shot (what is seen), the band figures, and anything you could not solve.
