export type MeshyAuthPayload = {
  hostname: string;
  timestamp: number | string;
  signature: string;
  capturedAt: number;
  url: string;
};

export type DownloaderState = {
  neverShowAgain: boolean;
  lastSeenUrl?: string;
  lastActionAt?: number;
  lastAuth?: MeshyAuthPayload;
  downloadCount: number;
};

export type TabState = {
  tabId?: number;
  url?: string;
  currentWebsiteId?: string;
  currentWebsiteLabel?: string;
  isSupportedWebsite: boolean;
  isMeshy: boolean;
  shouldRedirect: boolean;
  page?: PageState;
};

export type PageState = {
  injected: boolean;
  hasAuth: boolean;
  hasDecodedGlb: boolean;
  hasActiveModel?: boolean;
  activeModelUrl?: string;
  pendingDownload: boolean;
  lastAuth?: MeshyAuthPayload;
  lastGlbSize?: number;
  lastDownloadAt?: number;
};
