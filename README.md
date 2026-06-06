<div align="center">

[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](./README.md)
[![Türkçe](https://img.shields.io/badge/Dil-T%C3%BCrk%C3%A7e-red?style=for-the-badge)](./README.tr.md)

</div>

---

<div align="center">

[![Mozilla Add-on Version](https://img.shields.io/amo/v/meshy-downloader?style=for-the-badge&label=mozilla%20add-on)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/gmiabmjbibonhgpdbgoinabillaeonpk?style=for-the-badge&label=chrome%20web%20store)](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk)
[![License](https://img.shields.io/github/license/efebaykaraa/meshy_downloader?style=for-the-badge)](LICENSE)

[![Get the Firefox Add-on](https://img.shields.io/badge/GET%20THE-FIREFOX%20ADD--ON-1497D4?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![Get it on Chrome](https://img.shields.io/badge/GET%20IT%20ON-CHROME-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk)

</div>

---

# Meshy Downloader

A WXT + Svelte browser extension that detects downloadable 3D models on supported AI model-generation websites and offers a one-click `.glb` download popup.

Meshy Downloader currently supports:

* `meshy.ai`
* `tripo3d.ai`
* `studio.tripo3d.ai`

The extension started as a Meshy-only downloader, because apparently every website needs its own strange little way of serving models. It now uses a provider-based architecture so each supported website can have isolated detection, processing, and download behavior.

## Features

* Detects and downloads models from Meshy.
* Detects Tripo3D `.glb` model requests from `tripo-data.rg1.data.tripo3d.com`.
* Tracks the newest valid Tripo3D `tripo_pbr_model_*_meshopt.glb` request as the active downloadable model.
* Ignores Tripo3D preview and static assets such as `.webp`, `.jpg`, `.png`, `.js`, `.css`, and `.wasm`.
* Processes Tripo3D models into cleaned `.glb` files before saving.
* Keeps Meshy and Tripo3D logic isolated through provider-specific state handling.
* Uses a shared popup and overlay UI for supported providers.
* Available on Mozilla Add-ons and the Chrome Web Store.

## Supported Websites

| Website | Status | Notes |
| --- | --- | --- |
| `meshy.ai` | ✅ Supported | Existing Meshy detection and download behavior |
| `tripo3d.ai` | ✅ Supported | Detects valid Tripo3D `.glb` model requests |
| `studio.tripo3d.ai` | ✅ Supported | Detects valid Tripo3D `.glb` model requests |

## Browser Support

| Browser | Status | Install |
| --- | --- | --- |
| Chrome | ✅ Works | [Chrome Web Store](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk) |
| Firefox | ✅ Works | [Mozilla Add-ons](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/) |
| Safari | ⚪ Not tested | Not available |

## Requirements

* Node.js 20+
* pnpm

## Install

```bash
pnpm install
```

## Install from Browser Stores

### Chrome

Install the published Chrome version from the [Chrome Web Store](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk).

### Firefox

Install the published Firefox version from the [Mozilla Add-ons page](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/).

## Install Prebuilt Extension Manually

Prebuilt versions of the extension are available on the [releases page](https://github.com/efebaykaraa/meshy_downloader/releases/tag/Stable).

Download the latest release and follow the instructions below to load the extension manually in your browser.

### Chrome

1. Extract the downloaded zip file.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode` in the top right.
4. Click `Load unpacked`.
5. Select the extracted folder, for example `meshy-downloader-chrome`.

### Firefox

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

## How It Works

Meshy Downloader watches network activity on supported websites and detects valid model files requested by the page.

For Tripo3D, the extension only uses model URLs that the page has already requested naturally. It does not modify, forge, or regenerate signed URLs.

When a valid Tripo3D model is detected, the extension stores the newest matching model request as the active downloadable model. The model is processed only after the user clicks the download button.

## Tripo3D Model Processing

Tripo3D models are cleaned before download.

The extension:

1. Fetches the active detected `.glb` URL.

2. Decodes `EXT_meshopt_compression` using `meshoptimizer`.

3. Dequantizes `KHR_mesh_quantization` using `gltf-transform`.

4. Writes a cleaned GLB file, for example:

   ```text
   tripo_pbr_model_<id>_cleaned.glb
   ```

5. Validates that the cleaned output:

   * is a valid GLB file,
   * contains meshes,
   * no longer requires `EXT_meshopt_compression`,
   * no longer requires `KHR_mesh_quantization`.

This processing is only applied to Tripo3D models. Meshy downloads keep their existing behavior.

## Project Structure

Important files:

```text
src/lib/website-state-machine.ts
src/lib/tripo-processing.ts
entrypoints/tripo.content/index.ts
entrypoints/tripo.content/Overlay.svelte
entrypoints/shared/OverlayShell.svelte
entrypoints/background.ts
entrypoints/popup/App.svelte
wxt.config.ts
```

## Dependencies

Main model-processing dependencies:

* `@gltf-transform/core`
* `@gltf-transform/extensions`
* `@gltf-transform/functions`
* `meshoptimizer`

## Troubleshooting

* If anything goes wrong, reload the page and retry.
* Make sure the model is visible or has been loaded by the website before trying to download it.
* On Tripo3D, switch to the model you want before clicking download. The extension tracks the newest valid visible model request.
* Debug logs are printed with the `[Meshy Downloader]` prefix in the page console.

## Validation

Before releasing, check that:

* Meshy still detects and downloads models as before.
* Tripo3D detects only valid `tripo_pbr_model_*_meshopt.glb` URLs.
* Switching between multiple Tripo3D models updates the active model.
* Tripo3D downloads produce cleaned GLB files that open in Blender or a standard GLB viewer.
* Tripo3D cleanup does not run on Meshy or unrelated websites.
* Chrome and Firefox builds both work before publishing.

Run:

```bash
pnpm build
pnpm build:firefox
```

## Support

If this extension helped you, consider starring the repository or leaving a review on Mozilla Add-ons or the Chrome Web Store.

<div align="center">

[![Star on GitHub](https://img.shields.io/badge/Star%20on-GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/efebaykaraa/meshy_downloader/stargazers)
[![Review on Mozilla](https://img.shields.io/badge/Review%20on-Mozilla-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/reviews/)
[![Review on Chrome](https://img.shields.io/badge/Review%20on-Chrome%20Web%20Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk)

</div>

<img width="512" height="512" alt="Please drop a star" src="https://github.com/user-attachments/assets/b0c81c23-ac7d-4206-b8b2-0c35edec0b89" />