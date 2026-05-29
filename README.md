<div align="center">

[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](./README.md)
[![Türkçe](https://img.shields.io/badge/Dil-T%C3%BCrk%C3%A7e-red?style=for-the-badge)](./README.tr.md)

</div>

---

<div align="center">

[![Mozilla Add-on Version](https://img.shields.io/amo/v/meshy-downloader?style=for-the-badge&label=mozilla%20add-on)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![Mozilla Add-on Rating](https://img.shields.io/amo/stars/meshy-downloader?style=for-the-badge&label=stars)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/reviews/)
[![License](https://img.shields.io/github/license/efebaykaraa/meshy_downloader?style=for-the-badge)](LICENSE)

[![Get the Add-on](https://img.shields.io/badge/GET%20THE-ADD--ON-1497D4?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)

</div>

---

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
3. Enable `Developer mode` in the top right.
4. Click `Load unpacked`.
5. Select the extracted folder, for example `meshy-downloader-chrome`.

### Firefox

You can install the published version from the [Mozilla Add-ons page](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/).

For manual installation:

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Select the compressed zip file you downloaded, for example `meshy-downloader-v<version>-firefox.zip`.

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

## Support

If this extension helped you, consider starring the repository or leaving a review on Mozilla Add-ons.

<div align="center">

[![Star on GitHub](https://img.shields.io/badge/Star%20on-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/efebaykaraa/meshy_downloader/stargazers)
[![Review on Mozilla](https://img.shields.io/badge/Review%20on-Mozilla-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/reviews/)

</div>

<img width="512" height="512" alt="Please drop a star" src="https://github.com/user-attachments/assets/b0c81c23-ac7d-4206-b8b2-0c35edec0b89" />