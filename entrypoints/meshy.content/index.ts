import { browser, createShadowRootUi, defineContentScript } from '#imports';
import { mount, unmount } from 'svelte';
import Overlay from './Overlay.svelte';
import type { MeshyAuthPayload, PageState } from '../../src/lib/types';

const BRIDGE_SOURCE = 'meshy-downloader-main-world';
const CONTENT_SOURCE = 'meshy-downloader-content-script';

let injected = false;
let lastAuth: MeshyAuthPayload | undefined;
let lastGlbBuffer: ArrayBuffer | undefined;
let lastGlbSize: number | undefined;
let pendingDownload = false;
let lastDownloadAt: number | undefined;
let modelGeneration = 0;
let currentModelKey: string | undefined;
const glbCache = new Map<string, { buffer: ArrayBuffer; byteLength: number }>();

function getStableModelKey(url: string | undefined) {
  if (!url) return undefined;

  try {
    const parsed = new URL(url, window.location.href);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split('?')[0];
  }
}

function getPageState(): PageState {
  return {
    injected,
    hasAuth: Boolean(lastAuth),
    hasDecodedGlb: Boolean(lastGlbBuffer),
    pendingDownload,
    lastAuth,
    lastGlbSize,
    lastDownloadAt,
  };
}

function makeFileName() {
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  return `meshy-model-${date}.glb`;
}

function downloadBuffer(buffer: ArrayBuffer, filename = makeFileName()) {
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
  window.dispatchEvent(new CustomEvent(`meshy-downloader:${type}`, { detail }));
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

async function handleAuthCaptured(auth: MeshyAuthPayload) {
  lastAuth = auth;

  await browser.runtime.sendMessage({ type: 'record-auth', auth }).catch(() => {});
  console.debug('[Meshy Downloader] Meshy auth captured', auth);
}

function handleModelJsonDetected(payload: { url?: string }) {
  const modelKey = getStableModelKey(payload.url);
  const isNewModel = modelKey !== undefined && modelKey !== currentModelKey;

  currentModelKey = modelKey ?? currentModelKey;

  console.debug('[Meshy Downloader] model.json detected', { url: payload.url, modelKey: currentModelKey, isNewModel });

  if (isNewModel) {
    modelGeneration += 1;
    lastGlbBuffer = undefined;
    lastGlbSize = undefined;
    pendingDownload = false;

    notifyOverlay('model-changed', {
      ...payload,
      generation: modelGeneration,
      modelKey: currentModelKey,
    });
  }

  if (!currentModelKey) return;
  const cached = glbCache.get(currentModelKey);
  if (!cached) return;

  lastGlbBuffer = cached.buffer.slice(0);
  lastGlbSize = cached.byteLength;
  pendingDownload = false;
  notifyOverlay('glb-ready', {
    byteLength: cached.byteLength,
    generation: modelGeneration,
    modelKey: currentModelKey,
    cached: true,
  });
}

function handleGlbReady(buffer: ArrayBuffer, byteLength: number) {
  lastGlbBuffer = buffer;
  lastGlbSize = byteLength;
  if (currentModelKey) {
    glbCache.set(currentModelKey, { buffer: buffer.slice(0), byteLength });
  }
  notifyOverlay('glb-ready', { byteLength, generation: modelGeneration, modelKey: currentModelKey });

  if (pendingDownload) {
    pendingDownload = false;
    downloadBuffer(buffer);
    notifyOverlay('download-started', { byteLength, generation: modelGeneration, modelKey: currentModelKey });
  }
}

async function handleUserChoice(choice: 'yes' | 'no' | 'never') {
  if (choice === 'never') {
    pendingDownload = false;
    await browser.runtime.sendMessage({ type: 'set-never-show-again', value: true });
    notifyOverlay('preference-saved');
    return;
  }

  if (choice === 'no') {
    pendingDownload = false;
    return;
  }

  if (lastGlbBuffer) {
    const buffer = lastGlbBuffer;
    pendingDownload = false;
    downloadBuffer(buffer);
    notifyOverlay('download-started', {
      byteLength: buffer.byteLength,
      generation: modelGeneration,
      modelKey: currentModelKey,
    });
  } else {
    pendingDownload = true;
    notifyOverlay('waiting-for-glb');
  }
}

export default defineContentScript({
  matches: ['https://www.meshy.ai/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== BRIDGE_SOURCE) return;

      if (data.type === 'installed') {
        injected = true;
        notifyOverlay('injected');
        return;
      }

      if (data.type === 'auth-captured') {
        void handleAuthCaptured(data.payload as MeshyAuthPayload);
        return;
      }

      if (data.type === 'model-json-detected') {
        handleModelJsonDetected(data.payload as { url?: string });
        return;
      }

      if (data.type === 'glb-ready') {
        const payload = data.payload as { data?: ArrayBuffer; byteLength?: number };
        const buffer = toArrayBuffer(payload.data);
        if (buffer) {
          handleGlbReady(buffer, payload.byteLength ?? buffer.byteLength);
        }
      }
    });

    window.postMessage({ source: CONTENT_SOURCE, type: 'status-request' }, window.location.origin);

    await browser.runtime.sendMessage({ type: 'record-page-seen' }).catch(() => {});

    const ui = await createShadowRootUi(ctx, {
      name: 'meshy-downloader-overlay',
      position: 'overlay',
      anchor: () => document.body ?? document.documentElement,
      onMount: (container) => {
        const app = mount(Overlay, { target: container });
        return app;
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });

    ui.mount();

    window.addEventListener('meshy-downloader:user-choice', (event) => {
      const choice = (event as CustomEvent).detail;
      if (choice === 'yes' || choice === 'no' || choice === 'never') {
        void handleUserChoice(choice);
      }
    });

    browser.runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== 'object') return;

      if (message.type === 'get-page-state') {
        return Promise.resolve(getPageState());
      }

      if (message.type === 'download-last-mesh') {
        if (!lastGlbBuffer) {
          return Promise.resolve({ ok: false, error: 'No decoded GLB is currently buffered. Click/open a model first.' });
        }
        downloadBuffer(lastGlbBuffer);
        return Promise.resolve({ ok: true, byteLength: lastGlbBuffer.byteLength });
      }
    });
  },
});
