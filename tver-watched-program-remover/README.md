# TVer Watched Program Remover

Hide watched episodes on TVer's My Page favorites (`https://tver.jp/mypage/fav`).

This repository contains:
- A Chrome extension (Manifest V3)
- A Tampermonkey userscript
- Shared logic used by both implementations

## Files

- `watched-core.js`: Shared DOM query and watched-item visibility logic
- `duration-filter.js`: Shared on-page controls for short-video visibility
- `main.js`: Chrome content script entry point
- `background.js`: Chrome action toggle and state persistence
- `manifest.json`: Chrome extension manifest
- `userscript.meta.js`: Tampermonkey metadata header
- `userscript.entry.js`: Tampermonkey runtime entry point
- `tver-watched-program-remover.user.js`: Generated userscript bundle
- `Makefile`: Build commands for userscript and release zip

## Chrome Extension

Load unpacked in Chrome:
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select this project directory

### Options

Right-click the extension icon and select **Options**.

- **Progress threshold**: Hide episodes whose progress is at or above this percentage (1–100). The default is 100%.
- **Progress bar CSS selector** (advanced): Override the selector when TVer's UI changes. The default supports both the current and previous progress bars.

Save to apply changes to open TVer favorites pages. **Restore defaults** saves the original settings immediately. These progress options are available in the Chrome extension; the userscript uses the default progress settings.

## Short Video Visibility

On the favorites page, **短い動画を表示** appears next to TVer's **本編のみ表示** checkbox in both versions. It is checked by default. Uncheck it to hide videos whose displayed runtime is at or below the selected number of minutes (10 minutes by default), including unwatched videos. Check it again to restore short videos that are not hidden by the watched-progress filter.

The minute limit can be changed on the page. Videos with an unknown runtime remain visible unless watched progress hides them. This filter uses the displayed duration label, not an exact playback duration.

The Chrome extension saves this preference in Chrome sync storage. The userscript saves it in this browser's TVer local storage. These preferences are independent when using both versions.

## Tampermonkey

Build the userscript:

```sh
make userscript
```

Then import `tver-watched-program-remover.user.js` into Tampermonkey.

## Build Release Zip (Chrome Web Store)

```sh
make dist
```

This generates:
- `dist/tver-watched-program-remover-v<version>.zip`

Only extension-required files are included in the zip.

## Clean Build Artifacts

```sh
make clean
```

## Versioning

Keep Chrome and userscript versions aligned:
- `manifest.json` -> `version`
- `userscript.meta.js` -> `@version`

Regenerate userscript after metadata changes:

```sh
make userscript
```

## ChangeLog

- 1.2.0: Add a short-video visibility checkbox and configurable duration limit beside TVer's main-episode filter in both versions.
- 1.1.0: Add Chrome extension options for the progress threshold and progress bar CSS selector. Keep existing defaults.
- 1.0.5: Fix watched-item hiding for TVer’s updated DOM.
- 1.0.4: Fix bugs.
- 1.0.3: Fix watched-item hiding for TVer’s updated DOM.
- 1.0.2: Update for TVer site UI changes. No other changes.
