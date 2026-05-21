export type MeshyAuthPayload = {
  hostname: string;
  timestamp: number | string;
  signature: string;
  capturedAt: number;
  url: string;
};

export type HelperState = {
  neverShowAgain: boolean;
  lastSeenUrl?: string;
  lastActionAt?: number;
  lastAuth?: MeshyAuthPayload;
  downloadCount: number;
};

export type TabState = {
  tabId?: number;
  url?: string;
  isMeshy: boolean;
  shouldRedirect: boolean;
  page?: PageState;
};

export type PageState = {
  injected: boolean;
  hasAuth: boolean;
  hasDecodedGlb: boolean;
  pendingDownload: boolean;
  lastAuth?: MeshyAuthPayload;
  lastGlbSize?: number;
  lastDownloadAt?: number;
};
