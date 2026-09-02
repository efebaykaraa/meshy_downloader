import { browser, createShadowRootUi, defineContentScript } from '#imports';
import { mount, unmount } from 'svelte';
import Overlay from './Overlay.svelte';
import type { DownloaderState, PageState } from '../../src/lib/types';
import { findWebsiteState } from '../../src/lib/website-state-machine';

const websiteState = findWebsiteState(window.location.href);
const overlayConfig = websiteState?.overlay ?? {
  eventPrefix: 'meshy-downloader',
  assetLabel: 'Tripo3D model',
  fileFormat: 'GLB',
};

type TripoActiveModel = {
  url: string;
  modelKey: string;
  detectedAt: number;
};

let activeModel: TripoActiveModel | null = null;
let lastDownloadAt: number | undefined;
let modelGeneration = 0;
let pendingDownload = false;
let resourceObserver: PerformanceObserver | undefined;

function getModelKey(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.href);
    const dir = parsed.pathname.replace(/\/[^/]+$/, '');
    return `${parsed.origin}${dir}`;
  } catch {
    const noQuery = url.split('?')[0];
    return noQuery.replace(/\/[^/]+$/, '');
  }
}

function getPageState(): PageState {
  return {
    injected: true,
    hasAuth: false,
    hasDecodedGlb: activeModel !== null,
    hasActiveModel: activeModel !== null,
    activeModelUrl: activeModel?.url,
    pendingDownload,
    lastDownloadAt,
  };
}

function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
    return value as ArrayBuffer;
  }
  if (ArrayBuffer.isView(value)) {
    if (!(value.buffer instanceof ArrayBuffer)) return null;
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return null;
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.documentElement.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  lastDownloadAt = Date.now();
  browser.runtime.sendMessage({ type: 'record-download' }).catch(() => {});
}

function notifyOverlay(type: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(`${overlayConfig.eventPrefix}:${type}`, {
    detail: {
      assetLabel: overlayConfig.assetLabel,
      fileFormat: overlayConfig.fileFormat,
      ...(detail && typeof detail === 'object' ? detail : {}),
    },
  }));
}

function handleTripoGlbUrlDetected(payload: { url?: string; capturedAt?: number }) {
  if (!payload.url) return;
  if (activeModel?.url === payload.url) return;

  const modelKey = getModelKey(payload.url) ?? payload.url;
  activeModel = {
    url: payload.url,
    modelKey,
    detectedAt: payload.capturedAt ?? Date.now(),
  };
  modelGeneration += 1;
  pendingDownload = false;

  console.debug('[Meshy Downloader] Active Tripo3D model updated', activeModel);

  notifyOverlay('model-changed', {
    ...payload,
    generation: modelGeneration,
    modelKey,
  });
  notifyOverlay('glb-ready', {
    generation: modelGeneration,
    modelKey,
  });
}

function inspectResource(url: string) {
  if (!websiteState) return;

  for (const event of websiteState.network.detectRequest(url, window.location.href)) {
    if (event.type === 'tripo-glb-url-detected') {
      handleTripoGlbUrlDetected(event.payload as { url?: string; capturedAt?: number });
    }
  }
}

function installResourceObserver() {
  for (const entry of performance.getEntriesByType('resource')) {
    inspectResource(entry.name);
  }

  resourceObserver = new PerformanceObserver((entries) => {
    for (const entry of entries.getEntries()) {
      inspectResource(entry.name);
    }
  });

  resourceObserver.observe({ entryTypes: ['resource'] });
}

async function downloadActiveModel() {
  if (!activeModel) {
    notifyOverlay('download-error', {
      generation: modelGeneration,
      error: 'No Tripo3D model is currently detected. Open or select a model first.',
    });
    return { ok: false, error: 'No Tripo3D model URL is currently detected. Open or select a model first.' };
  }

  pendingDownload = true;
  notifyOverlay('download-processing', {
    generation: modelGeneration,
    modelKey: activeModel.modelKey,
  });

  const result = await browser.runtime.sendMessage({
    type: 'process-tripo-glb',
    url: activeModel.url,
  });

  pendingDownload = false;

  if (!result?.ok) {
    const error = result?.error ?? 'Failed to process Tripo3D model.';
    notifyOverlay('download-error', {
      generation: modelGeneration,
      modelKey: activeModel.modelKey,
      error,
    });
    return { ok: false, error };
  }

  let buffer = toArrayBuffer(result.buffer)
    ?? (typeof result.bufferBase64 === 'string' ? base64ToArrayBuffer(result.bufferBase64) : null);
  if (!buffer) {
    const error = 'Processed Tripo3D model did not return a downloadable buffer.';
    notifyOverlay('download-error', {
      generation: modelGeneration,
      modelKey: activeModel.modelKey,
      error,
    });
    return { ok: false, error };
  }

  try {
    const state = await browser.runtime.sendMessage({ type: 'get-state' }) as DownloaderState;
    const { formatGlbTextures } = await import('../../src/lib/texture-format');
    buffer = await formatGlbTextures(buffer, state.textureFormat);
    console.debug('[Meshy Downloader] Applied texture format to Tripo3D GLB', {
      textureFormat: state.textureFormat,
      byteLength: buffer.byteLength,
    });
  } catch (error) {
    console.warn('[Meshy Downloader] Texture format conversion failed — downloading without conversion', error);
  }

  downloadBuffer(buffer, result.filename ?? 'tripo_model_cleaned.glb');
  notifyOverlay('download-started', {
    byteLength: buffer.byteLength,
    generation: modelGeneration,
    modelKey: activeModel.modelKey,
  });

  return { ok: true, byteLength: buffer.byteLength };
}

export default defineContentScript({
  matches: ['https://www.tripo3d.ai/*', 'https://tripo3d.ai/*', 'https://studio.tripo3d.ai/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    await browser.runtime.sendMessage({ type: 'record-page-seen' }).catch(() => {});
    installResourceObserver();

    const ui = await createShadowRootUi(ctx, {
      name: 'tripo-downloader-overlay',
      position: 'overlay',
      anchor: () => document.body ?? document.documentElement,
      onMount: (container) => {
        const app = mount(Overlay, {
          target: container,
          props: overlayConfig,
        });
        return app;
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });

    ui.mount();

    window.addEventListener(`${overlayConfig.eventPrefix}:user-choice`, (event) => {
      const choice = (event as CustomEvent).detail;
      if (choice === 'yes') void downloadActiveModel();
      if (choice === 'no') pendingDownload = false;
    });

    browser.runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== 'object') return;

      if (message.type === 'get-page-state') {
        return Promise.resolve(getPageState());
      }

      if (message.type === 'download-last-mesh') {
        return downloadActiveModel();
      }
    });
  },
});
