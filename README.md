# Meshy Downloader

A WXT + Svelte browser extension that detects decoded Meshy model data on `meshy.ai` and offers a one-click `.glb` download popup.

Detects and downloads models from meshy.ai for free.

## Browser Support

| Browser | Status |
| --- | --- |
| Chrome | ✅ Works |
| Firefox | ✅ Works |
| Safari | ⚪ Not tested |

## Requirements

- Node.js 20+
- pnpm

## Install

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

## Build for Chrome

```bash
pnpm build
```

```text
Chrome -> Settings -> Extensions -> Load unpacked -> Select `.output/chrome-mv3`
```

## Build for Firefox

```bash
pnpm build:firefox
```

```text
Firefox -> about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> Select `.output/firefox-mv3/manifest.json`
```

Firefox may show a WXT warning about `data_collection_permissions`. The extension still builds; the warning is related to Firefox extension store requirements.

## Troubleshooting

- If anything goes wrong, reload the page and retry.
- Debug logs are printed with the `[Meshy Downloader]` prefix in the page console.

Please drop a star <3
