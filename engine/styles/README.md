# Format styles

A format style is a visual world any primitive board can wear. It decides far more than colour:

| Field | What it controls |
|---|---|
| `theme` | The palette, as role tokens in `src/themes.ts` (WCAG AA text pairs, plus ink on `flow` at 3.2:1 for chat bubbles) |
| `fonts` | Display, title, caption and data faces (loaded in `src/fonts.ts`, OFL / Apache-2.0 in `public/fonts/`) |
| `spring` | The default spring of every entrance in the primitives (`springFrom`) |
| `caption` | Caption case; uppercase captions set 14% smaller so they stay inside the platform safe areas |
| `cameraMode` | How every shot moves: `3d-tilt`, `whip-pan`, `kinetic-punch`, `handheld-doc` (or `still`) |
| `fxOverlay` | The texture over the frame: `crt`, `print`, `film`, `tactical` (or `none`) |
| `hostMode` | The mascot: `keep` its colours, `tint` it into the palette, or `hide` it |
| `pace` | `quick` speeds every line that sets no pace of its own (x1.1); `steady` leaves the voice alone |
| `fits` | The primitives the style was tuned on |

```bash
npm run make -- test/demo.json --style=newsreel            # full render in a style
npm run sheet -- test/demo.json --style=orbit-intel         # contact sheet only: every scene's middle frame, before voice or MP4
```

A board can also carry `"formatStyle": "<id>"`; the flag wins. Authored films (`"film"`) keep their own look.

## How the modes work

- **Camera** (`src/composer/look.tsx`): the shot layer moves, the captions do not. The camera rests at 95% so its biggest move
  peaks at full size and text never leaves the safe area. `3d-tilt` swings each shot in on alternating sides and drifts on
  its axis; `kinetic-punch` zooms on every power word (strong) and every fourth word (light), about one hit per 1.0 to 1.8 s;
  `handheld-doc` drifts on Perlin noise; `whip-pan` turns every cut into a motion-blurred whip.
- **Overlay**: `crt` = scanlines, a rolling bright band, red/blue fringe and phosphor glow; `print` = halftone dot screen,
  animated paper grain and the accent plate printed off register; `film` = grain, dust, scratches, flicker, gate weave, and
  the picture steps on twos (15 fps) while the voice stays smooth; `tactical` = grid, corner brackets, radar sweep and ticking
  telemetry. Overlays sit outside the measured scene, so they never count as text.
- **Host**: `tint` maps the mascot's light and dark onto the style's accent and shadow with an SVG filter; `hide` removes it.

## Visual-mode primitives

Shots that are not business UI, made for the styles that need them:

| Primitive | What it shows | Styles |
|---|---|---|
| `rpg-panel` | 8-bit status screen: stepped stat bars fill per cue, then a dialogue box types on twos | `game-show`, `hud` |
| `point-cloud` | A rotating scanned point cloud, a scan line, a reticle that locks and reads out a value | `orbit-intel`, `hud`, `blueprint` |
| `line-draw` | One hand-drawn line travels stop to stop, circling and writing each label | `whiteboard`, `line-draw`, `telestrator`, `engraving` |
| `intertitle` | Silent-film card: iris in, ruled frame, line, sub line, flourish | `newsreel`, `light-table`, `engraving`, `woodcut`, `constructivist` |

## The library (29 styles)

| Style | Look | Camera | Overlay | Host | Display face |
|---|---|---|---|---|---|
| `art-deco` | Lacquer black, ivory and gold: geometric caps, every shot swings in on its axis. | 3d-tilt | none | tint | Limelight |
| `blueprint` | White line on engineering blue under a tactical grid and radar; shots tilt in like a drafting table. | 3d-tilt | tactical | tint | Space Grotesk |
| `constructivist` | Soviet montage: red and black diagonals on cream, slab caps, whip cuts, film on twos. | whip-pan | film | tint | Oswald |
| `countdown` | A live clock: black, red seconds, condensed numerals, every beat a hit. | kinetic-punch | none | hide | Oswald |
| `dark-keynote` | A launch stage: near-black, one lime key light, every shot swings in on a 3D tilt. | 3d-tilt | none | hide | Inter Tight |
| `data-story` | Data journalism on warm paper: serif headline, a calm sans, blue to red, a hand-held reporter camera. | handheld-doc | none | hide | Instrument Serif |
| `engraving` | A copperplate museum label: sepia paper, old-style serif, plate grain, a slow hand-held camera. | handheld-doc | print | tint | IM Fell English |
| `game-show` | Prime-time game show: violet stage, gold and pink, pixel score type, a punch on every point. | kinetic-punch | none | hide | Press Start 2P |
| `halftone` | A comic-print case file: navy on cream, dot screen and grain, yellow highlighter, springy punch-ins. | kinetic-punch | print | tint | Bricolage Grotesque |
| `headline-bar` | Social news: white page, black condensed headlines on yellow bars, a punch on every key word. | kinetic-punch | none | hide | Bebas Neue |
| `hud` | A hologram heads-up display: cyan on black, scanlines, tilted panels. | 3d-tilt | crt | tint | Share Tech Mono |
| `investigation` | Forensic documentary: greyscale evidence on near-black, a serif title, one orange marker, case-file grid, hand-held drift. | handheld-doc | tactical | hide | Instrument Serif |
| `isometric` | A clean isometric explainer: cool paper, indigo and teal, shots tilt in on a 3D axis. | 3d-tilt | none | hide | Space Grotesk |
| `light-table` | Prints on a glowing archive table: warm dark, serif type, film dust and flicker, a hand-held camera. | handheld-doc | film | tint | IM Fell English |
| `line-draw` | One continuous line: black on cream, one orange, every idea drawn live. | handheld-doc | none | hide | Poiret One |
| `news-desk` | A news round-up: charcoal cards, lemon lower thirds, condensed caps, whip cuts. | whip-pan | none | hide | Bebas Neue |
| `newsreel` | A 1930s newsreel: silver greys, condensed caps, intertitles, film dust and flicker on twos. | handheld-doc | film | tint | Oswald |
| `ops-board` | An engineering status board: pale grey, amber callouts, mono telemetry, a grid behind every shot. | 3d-tilt | tactical | hide | Oswald |
| `orbit-intel` | A satellite briefing: deep blue-black, teal scan light, radar sweep and telemetry. | 3d-tilt | tactical | hide | Share Tech Mono |
| `paper-cut` | Red paper cut-outs: cream type on festival red, gold highlights, print grain. | kinetic-punch | print | tint | Bebas Neue |
| `pictogram` | Olympic-style pictograms: white, black and five bright signals, quick punches. | kinetic-punch | none | hide | Space Grotesk |
| `risograph` | Two plates off register on off-white: blue and yellow, fluoro pink alerts, grain and dot screen. | kinetic-punch | print | tint | Archivo Black |
| `screenprint` | A silkscreen travel poster: flat inks on cream, slab caps, dot screen, punch-ins. | kinetic-punch | print | tint | Oswald |
| `sixties-titles` | A 60s title sequence: flat orange, black shapes, condensed caps, whip cuts. | whip-pan | print | hide | Archivo Black |
| `swiss-motion` | A strict grid, one family, lowercase captions, one red signal; every power word punches in. | kinetic-punch | none | hide | Archivo Black |
| `telestrator` | A sports breakdown: pitch green, yellow marker, condensed caps, whip cuts. | whip-pan | none | hide | Oswald |
| `terminal-dark` | Amber phosphor on warm black: scanlines, colour fringe, a whip between every beat. | whip-pan | crt | tint | VT323 |
| `whiteboard` | A whiteboard explainer: marker handwriting, live stroke drawing, a hand-held camera. | handheld-doc | none | hide | Caveat |
| `woodcut` | A woodcut folk print: black slab caps, one red, carved grain, heavy punches. | kinetic-punch | print | tint | Alfa Slab One |

Check: `node ../studio/formatstyle.test.ts` (themes, faces, primitives, modes, contrast, and that no two styles share camera,
overlay and display face). It runs in `npm run check`.
