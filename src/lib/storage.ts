import { browser } from '#imports';
import type { DownloaderState, MeshyAuthPayload } from './types';

const KEY = 'meshy-downloader-state';

const DEFAULT_STATE: DownloaderState = {
  neverShowAgain: false,
  githubStarPromptHidden: false,
  downloadCount: 0,
};

export async function getState(): Promise<DownloaderState> {
  const result = await browser.storage.local.get(KEY);
  return { ...DEFAULT_STATE, ...(result[KEY] ?? {}) };
}

export async function setState(patch: Partial<DownloaderState>): Promise<DownloaderState> {
  const previous = await getState();
  const next = { ...previous, ...patch };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export async function resetState(): Promise<DownloaderState> {
  await browser.storage.local.set({ [KEY]: DEFAULT_STATE });
  return DEFAULT_STATE;
}

export async function recordAuth(auth: MeshyAuthPayload): Promise<DownloaderState> {
  return setState({ lastAuth: auth, lastActionAt: Date.now() });
}

export async function recordDownload(): Promise<DownloaderState> {
  const previous = await getState();
  return setState({ downloadCount: previous.downloadCount + 1, lastActionAt: Date.now() });
}
