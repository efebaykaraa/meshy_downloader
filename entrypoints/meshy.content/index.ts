import { browser, createShadowRootUi, defineContentScript, injectScript } from '#imports';
import { mount, unmount } from 'svelte';
import Overlay from './Overlay.svelte';
import type { MeshyAuthPayload, PageState } from '../../src/lib/types';

const BRIDGE_SOURCE = 'meshy-authorized-helper-main-world';

let injected = false;
let lastAuth: MeshyAuthPayload | undefined;
let lastGlbBuffer: ArrayBuffer | undefined;
let lastGlbSize: number | undefined;
let pendingDownload = false;
let lastDownloadAt: number | undefined;

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
  window.dispatchEvent(new CustomEvent(`meshy-helper:${type}`, { detail }));
}

async function handleAuthCaptured(auth: MeshyAuthPayload) {
  lastAuth = auth;
  lastGlbBuffer = undefined;
  lastGlbSize = undefined;
  pendingDownload = false;

  await browser.runtime.sendMessage({ type: 'record-auth', auth });
  notifyOverlay('auth-captured', auth);
}

function handleGlbReady(buffer: ArrayBuffer, byteLength: number) {
  lastGlbBuffer = buffer;
  lastGlbSize = byteLength;
  notifyOverlay('glb-ready', { byteLength });

  if (pendingDownload) {
    pendingDownload = false;
    downloadBuffer(buffer);
    notifyOverlay('download-started', { byteLength });
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

  pendingDownload = true;
  if (lastGlbBuffer) {
    const buffer = lastGlbBuffer;
    pendingDownload = false;
    downloadBuffer(buffer);
    notifyOverlay('download-started', { byteLength: buffer.byteLength });
  } else {
    notifyOverlay('waiting-for-glb');
  }
}

export default defineContentScript({
  matches: ['https://www.meshy.ai/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    await browser.runtime.sendMessage({ type: 'record-page-seen' }).catch(() => {});

    await injectScript('/meshy-main-world.js', { keepInDom: true });
    injected = true;

    const ui = await createShadowRootUi(ctx, {
      name: 'meshy-authorized-helper-overlay',
      position: 'overlay',
      anchor: 'body',
      onMount: (container) => {
        const app = mount(Overlay, { target: container });
        return app;
      },
      onRemove: (app) => {
        unmount(app);
      },
    });

    ui.mount();

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

      if (data.type === 'glb-ready') {
        const payload = data.payload as { data?: ArrayBuffer; byteLength?: number };
        if (payload.data instanceof ArrayBuffer) {
          handleGlbReady(payload.data, payload.byteLength ?? payload.data.byteLength);
        }
      }
    });

    window.addEventListener('meshy-helper:user-choice', (event) => {
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
