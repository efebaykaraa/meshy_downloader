import { browser } from '#imports';
import type { HelperState, MeshyAuthPayload } from './types';

const KEY = 'meshy-authorized-helper-state';

const DEFAULT_STATE: HelperState = {
  neverShowAgain: false,
  downloadCount: 0,
};

export async function getState(): Promise<HelperState> {
  const result = await browser.storage.local.get(KEY);
  return { ...DEFAULT_STATE, ...(result[KEY] ?? {}) };
}

export async function setState(patch: Partial<HelperState>): Promise<HelperState> {
  const previous = await getState();
  const next = { ...previous, ...patch };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export async function resetState(): Promise<HelperState> {
  await browser.storage.local.set({ [KEY]: DEFAULT_STATE });
  return DEFAULT_STATE;
}

export async function recordAuth(auth: MeshyAuthPayload): Promise<HelperState> {
  return setState({ lastAuth: auth, lastActionAt: Date.now() });
}

export async function recordDownload(): Promise<HelperState> {
  const previous = await getState();
  return setState({ downloadCount: previous.downloadCount + 1, lastActionAt: Date.now() });
}
