# Meshy Downloader

A WXT + Svelte browser extension that detects decoded Meshy model data on `meshy.ai` and offers a one-click `.glb` download popup.

## Browser Support

| Browser | Status |
| --- | --- |
| Chrome | ✅ Works |
| Firefox | ✅ Works |
| Safari | ⚪ Not tested |

## Requirements

- Node.js 20+
- pnpm

Install dependencies:

```bash
pnpm install
```

## Install Prebuilt Extension
Prebuilt versions of the extension are available at the [releases page](https://github.com/efebaykaraa/meshy_downloader/releases/tag/Stable). Download the latest release and follow the instructions below to load the extension in your browser.

### Chrome
1. Extract the downloaded zip file.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode` (toggle in the top right).
4. Click `Load unpacked`.
5. Select the extracted folder (e.g., `meshy-downloader-chrome`).

### Firefox
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Select the compressed zip file you downloaded (e.g., `meshy-downloader-v<version>-firefox.zip`).

## Build for Chrome:

```bash
pnpm build
```

```text
Chrome -> Settings -> Extensions -> Load unpacked -> Select `.output/chrome-mv3`
```

## Build for Firefox:

```bash
pnpm zip:firefox
```

Output:

```text
.output/firefox-mv3
```

Firefox may show a WXT warning about `data_collection_permissions`. The extension still builds; the warning is related to Firefox extension store requirements.

## Install In Chrome

1. Run `pnpm build`.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `.output/chrome-mv3` folder.
6. Open `https://www.meshy.ai/workspace`.
7. Open or switch models. When a decoded GLB is available, the `Download now` popup appears.

After rebuilding, click the extension's reload button on `chrome://extensions`.

## Install In Firefox

1. Run `pnpm build:firefox`.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click `Load Temporary Add-on`.
4. Select `.output/firefox-mv3/manifest.json`.
5. Open `https://www.meshy.ai/workspace`.
6. Open or switch models. When a decoded GLB is available, the `Download now` popup appears.

Firefox temporary add-ons are removed when Firefox closes. Reload the add-on from `about:debugging` after rebuilding.

## Package A Zip

Chrome zip:

```bash
pnpm zip
```

Firefox zip:

```bash
pnpm zip:firefox
```

Generated archives are written under `.output`.

## Troubleshooting

- If the popup does not appear, reload the Meshy tab after loading or reloading the extension.
- If Chrome or Firefox still uses an old build, reload the extension from the browser extension page.
- If the popup appears but no download starts, open or switch to the model again so Meshy re-runs the model loading pipeline.
- Debug logs are printed with the `[Meshy Downloader]` prefix in the page console.
