import { browser, defineBackground } from '#imports';
import { getState, recordAuth, recordDownload, resetState, setState } from '../src/lib/storage';
import type { PageState, TabState } from '../src/lib/types';

const WORKSPACE_URL = 'https://www.meshy.ai/workspace';

function isMeshyUrl(url?: string) {
  return !!url && /^https:\/\/www\.meshy\.ai\//.test(url);
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getActiveTabState(): Promise<TabState> {
  const tab = await getActiveTab();
  const state: TabState = {
    tabId: tab?.id,
    url: tab?.url,
    isMeshy: isMeshyUrl(tab?.url),
    shouldRedirect: !isMeshyUrl(tab?.url),
  };

  if (state.isMeshy && tab?.id != null) {
    try {
      state.page = await browser.tabs.sendMessage(tab.id, { type: 'get-page-state' }) as PageState;
    } catch {
      // Content script may not have loaded yet, or the tab may be on a restricted page.
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
      return browser.tabs.create({ url: WORKSPACE_URL });
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

    if (message.type === 'download-active-tab-mesh') {
      return getActiveTab().then(async (tab) => {
        if (!tab?.id || !isMeshyUrl(tab.url)) {
          return { ok: false, error: 'Active tab is not Meshy.' };
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
