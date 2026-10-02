# C1 brand assets (The Automation Guy)

| File | Use | Size |
|---|---|---|
| `youtube-profile.png` | YouTube profile picture (existing mark, night background) | 800x800 |
| `youtube-banner.png` | YouTube banner, Night Signal (live on YouTube, chosen 2026-10-02); text and mark sit in the 1546x423 safe area | 2560x1440 |
| `youtube-banner.html` | banner source (night theme tokens, repo fonts) | |
| `facebook-cover.png` | Facebook cover (`?fb`): no logo (the profile picture sits at its lower left), centred text plus a Send Message line, per Forge review; content fits desktop (1640x624) and mobile (1522x856) crops | 1640x856 |
| `ig-highlight-start.png` | Instagram highlight cover "Start here" (the mark) | 1080x1920 |
| `ig-highlight-flow.png` | Instagram highlight cover "Automations" (flow nodes) | 1080x1920 |
| `ig-highlight.html` | highlight source (`?start`, `?flow`; window 1080,1920) | |
| `youtube-banner-paper.png` | Paper Day option, not used (`?paper`) | 2560x1440 |

Re-render the banner (for the cover: window 1640,856, file youtube-banner.html?fb, output facebook-cover.png) after editing the HTML (run in this folder):
```
"../../engine/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell" --headless --hide-scrollbars --allow-file-access-from-files --window-size=2560,1440 --screenshot="$PWD/youtube-banner.png" "file://$PWD/youtube-banner.html"
```
