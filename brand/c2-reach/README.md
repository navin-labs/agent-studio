# C2 brand assets (Backstory, @backstory.minute)

Palette Archive Gold: navy `#0E1A2B`, paper `#F4F1EA`, gold `#E8A020` (accent), grey `#A8A59E` (handle). Contrast on navy: paper 15.5:1, gold 7.9:1, grey 7.1:1. No C1 lime or flow blue.

| File | Use | Size |
|---|---|---|
| `logo-master.svg` | the mark: a B cut into barcode bars (paper, three widths); the stem carries the rewind arrow (gold) at its waist | vector |
| `logo-small.svg` | small-size cut, the same B without barcode gaps, for 32 px and below (favicons, watermarks) | vector |
| `logo-circle-1080.png` | profile picture, all platforms (`mark.html?circle`) | 1080x1080 |
| `logo-mono.png` | one colour, paper on transparent, for watermarks and favicons (`mark.html?mono`) | 1080x1080 |
| `youtube-banner-2560x1440.png` | YouTube banner; lockup in the 1546x423 safe area, no side motif (read as artifacts in review) (`banner.html`) | 2560x1440 |
| `facebook-cover-1640x856.png` | Facebook cover, no logo, content inside x 59..1581, y 116..740 (`banner.html?fb`) | 1640x856 |
| `size-test-110-32.png` | legibility sheet on navy: colour, mono, small cut at 110, 32, 16 px (`mark.html?test`, window 400,540) | |
| `mark.html`, `banner.html` | sources | |

Re-render (run in this folder; window and output per row above, `--default-background-color=00000000` keeps the mono PNG transparent):
```
"../../engine/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell" --headless --hide-scrollbars --allow-file-access-from-files --default-background-color=00000000 --window-size=2560,1440 --screenshot="$PWD/youtube-banner-2560x1440.png" "file://$PWD/banner.html"
```
