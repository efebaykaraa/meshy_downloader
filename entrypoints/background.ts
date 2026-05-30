import { browser, defineBackground } from '#imports';
import { getState, recordAuth, recordDownload, resetState, setState } from '../src/lib/storage';
import type { PageState, TabState } from '../src/lib/types';
import { processTripoGlb } from '../src/lib/tripo-processing';
import { findWebsiteState, isSupportedWebsiteUrl } from '../src/lib/website-state-machine';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }

  return btoa(binary);
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getActiveTabState(): Promise<TabState> {
  const tab = await getActiveTab();
  const currentWebsite = findWebsiteState(tab?.url);
  const state: TabState = {
    tabId: tab?.id,
    url: tab?.url,
    isMeshy: currentWebsite?.id === 'meshy',
    currentWebsiteId: currentWebsite?.id,
    currentWebsiteLabel: currentWebsite?.label,
    isSupportedWebsite: currentWebsite !== undefined,
    shouldRedirect: currentWebsite === undefined,
  };

  if (state.isSupportedWebsite && tab?.id != null) {
    try {
      state.page = await browser.tabs.sendMessage(tab.id, { type: 'get-page-state' }) as PageState;
    } catch {
      console.warn('Failed to get page state from content script. The content script might not be ready yet.');
    }
  }

  return state;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'get-state') {
      return getState();
    }

    if (message.type === 'set-never-show-again') {
      return setState({ neverShowAgain: Boolean(message.value), lastActionAt: Date.now() });
    }

    if (message.type === 'reset-state') {
      return resetState();
    }

    if (message.type === 'open-workspace') {
      return browser.tabs.create({ url: findWebsiteState(sender.tab?.url)?.workspaceUrl ?? 'https://www.meshy.ai/workspace' });
    }

    if (message.type === 'check-current-tab' || message.type === 'get-active-tab-state') {
      return getActiveTabState();
    }

    if (message.type === 'record-page-seen') {
      return setState({ lastSeenUrl: sender.tab?.url, lastActionAt: Date.now() });
    }

    if (message.type === 'record-auth') {
      return recordAuth(message.auth);
    }

    if (message.type === 'record-download') {
      return recordDownload();
    }

    if (message.type === 'process-tripo-glb') {
      const url = typeof message.url === 'string' ? message.url : undefined;
      if (!url) return Promise.resolve({ ok: false, error: 'No Tripo3D GLB URL was provided.' });

      return processTripoGlb(url)
        .then((result) => ({
          ok: true,
          bufferBase64: arrayBufferToBase64(result.buffer),
          byteLength: result.byteLength,
          filename: result.filename,
          validation: result.validation,
        }))
        .catch((error) => ({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }));
    }

    if (message.type === 'download-active-tab-mesh') {
      return getActiveTab().then(async (tab) => {
        if (!tab?.id || !isSupportedWebsiteUrl(tab.url)) {
          return { ok: false, error: 'Active tab is not a supported website.' };
        }
        try {
          return await browser.tabs.sendMessage(tab.id, { type: 'download-last-mesh' });
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      });
    }
  });
});
