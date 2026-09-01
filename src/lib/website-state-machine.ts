type AnyRecord = Record<string, unknown>;

export const BRIDGE_SOURCE = 'meshy-downloader-main-world';
export const CONTENT_SOURCE = 'meshy-downloader-content-script';

export type WebsiteId = 'meshy' | 'tripo';

export type WebsiteBridgeEvent = {
  type:
    | 'auth-captured'
    | 'model-json-detected'
    | 'model-binary-detected'
    | 'texture-detected'
    | 'tripo-glb-url-detected'
    | 'glb-ready'
    | 'installed';
  payload: AnyRecord;
  transfer?: Transferable[];
};

type NetworkDetection = {
  detectRequest(input: unknown, pageUrl: string): WebsiteBridgeEvent[];
  isBinaryRequest(input: unknown): boolean;
};

type Deobfuscation = {
  detectWorkerPostMessage(message: unknown, pageUrl: string): WebsiteBridgeEvent[];
  detectWorkerMessage(message: unknown, pageUrl: string): WebsiteBridgeEvent[];
  detectBinaryResponse(buffer: ArrayBuffer, sourceUrl: string | undefined): WebsiteBridgeEvent[];
};

export type WebsiteState = {
  id: WebsiteId;
  label: string;
  workspaceUrl: string;
  overlay: {
    eventPrefix: string;
    assetLabel: string;
    fileFormat: string;
  };
  matchesUrl(url?: string): boolean;
  network: NetworkDetection;
  deobfuscation: Deobfuscation;
};

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
}

export function getUrlString(input: unknown): string | undefined {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return undefined;
}

function parseUrl(input: unknown, baseUrl: string): URL | null {
  const urlString = getUrlString(input);
  if (!urlString) return null;

  try {
    return new URL(urlString, baseUrl);
  } catch {
    return null;
  }
}

function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    if (!(value.buffer instanceof ArrayBuffer)) return null;
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return null;
}

function looksLikeGlb(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new Uint8Array(buffer, 0, 4);
  return view[0] === 0x67 && view[1] === 0x6c && view[2] === 0x54 && view[3] === 0x46; // glTF
}

function getBytePreview(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');
}

function makeGlbReadyEvent(buffer: ArrayBuffer, sourceUrl = globalThis.location?.href): WebsiteBridgeEvent {
  const data = buffer.slice(0);
  return {
    type: 'glb-ready',
    payload: {
      data,
      byteLength: data.byteLength,
      capturedAt: Date.now(),
      url: sourceUrl,
    },
    transfer: [data],
  };
}

function createMeshyState(): WebsiteState {
  function isMeshyUrl(url?: string) {
    return !!url && /^https:\/\/www\.meshy\.ai\//.test(url);
  }

  function isModelBinaryRequest(input: unknown) {
    const url = parseUrl(input, globalThis.location?.href ?? 'https://www.meshy.ai/');
    return !!url && /(^|\/)model\.meshy$/i.test(url.pathname);
  }

  return {
    id: 'meshy',
    label: 'Meshy',
    workspaceUrl: 'https://www.meshy.ai/workspace',
    overlay: {
      eventPrefix: 'meshy-downloader',
      assetLabel: 'model',
      fileFormat: 'GLB',
    },
    matchesUrl: isMeshyUrl,
    network: {
      detectRequest(input, pageUrl) {
        const url = parseUrl(input, pageUrl);
        if (!url) return [];

        const events: WebsiteBridgeEvent[] = [];
        const isModelJson = /(^|\/)(model|mesh)\.json$/i.test(url.pathname);

        if (isModelJson && url.searchParams.has('Expires')) {
          console.debug('[Meshy Downloader] Meshy model JSON detected', url.href);
          events.push({
            type: 'model-json-detected',
            payload: {
              url: url.href,
              expires: url.searchParams.get('Expires'),
              capturedAt: Date.now(),
              pageUrl,
            },
          });
        }

        if (/(^|\/)model\.meshy$/i.test(url.pathname)) {
          console.debug('[Meshy Downloader] Meshy model binary URL detected', url.href);
          events.push({
            type: 'model-binary-detected',
            payload: {
              url: url.href,
              capturedAt: Date.now(),
              pageUrl,
            },
          });
        }

        // Texture fallback: Meshy serves model textures as separate texture_*.png
        // files (e.g. texture_0.png). Track them so the content script can grab one
        // when the downloaded GLB has no embedded textures.
        const filename = url.pathname.split('/').pop() ?? '';
        if (/^texture_[^/]*\.png/i.test(filename)) {
          console.debug('[Meshy Downloader] Meshy texture URL detected', url.href);
          events.push({
            type: 'texture-detected',
            payload: {
              url: url.href,
              capturedAt: Date.now(),
              pageUrl,
            },
          });
        }

        return events;
      },
      isBinaryRequest: isModelBinaryRequest,
    },
    deobfuscation: {
      detectWorkerPostMessage(message, pageUrl) {
        if (!isRecord(message)) return [];
        if (message.type !== 'authorize') return [];

        const hostname = typeof message.hostname === 'string' ? message.hostname : undefined;
        const signature = typeof message.signature === 'string' ? message.signature : undefined;
        const timestamp = message.timestamp;

        if (!hostname || !signature || (typeof timestamp !== 'number' && typeof timestamp !== 'string')) {
          return [];
        }

        console.debug('[Meshy Downloader] Meshy auth captured', { hostname, timestamp, signature });

        return [{
          type: 'auth-captured',
          payload: {
            hostname,
            timestamp,
            signature,
            capturedAt: Date.now(),
            url: pageUrl,
          },
        }];
      },
      detectWorkerMessage(message) {
        if (!isRecord(message)) return [];

        if (message.type === 'process' && message.success === true) {
          const raw = toArrayBuffer(message.data);
          if (raw && looksLikeGlb(raw)) {
            console.debug('[Meshy Downloader] GLB captured from worker process result', { byteLength: raw.byteLength });
            return [makeGlbReadyEvent(raw)];
          }
        }

        for (const key of Object.keys(message)) {
          const raw = toArrayBuffer(message[key]);
          if (raw && looksLikeGlb(raw)) {
            console.debug('[Meshy Downloader] GLB captured from worker message property', {
              key,
              byteLength: raw.byteLength,
            });
            return [makeGlbReadyEvent(raw)];
          }
        }

        return [];
      },
      detectBinaryResponse(buffer, sourceUrl) {
        if (!looksLikeGlb(buffer)) {
          console.debug('[Meshy Downloader] Binary response is not decoded GLB yet', {
            byteLength: buffer.byteLength,
            firstBytes: getBytePreview(buffer),
            url: sourceUrl,
          });
          return [];
        }

        console.debug('[Meshy Downloader] GLB captured from network response', {
          byteLength: buffer.byteLength,
          url: sourceUrl,
        });

        return [makeGlbReadyEvent(buffer, sourceUrl)];
      },
    },
  };
}

function createTripoState(): WebsiteState {
  function isTripoPageUrl(url?: string) {
    return !!url && /^https:\/\/(?:(?:www|studio)\.)?tripo3d\.ai\//.test(url);
  }

  return {
    id: 'tripo',
    label: 'Tripo3D',
    workspaceUrl: 'https://www.tripo3d.ai/',
    overlay: {
      eventPrefix: 'meshy-downloader',
      assetLabel: 'Tripo3D model',
      fileFormat: 'GLB',
    },
    matchesUrl: isTripoPageUrl,
    network: {
      detectRequest(input, pageUrl) {
        const parsedUrl = parseUrl(input, pageUrl);
        const url = parsedUrl && isTripoModelUrl(parsedUrl.href) ? parsedUrl.href : undefined;
        if (!url) return [];

        console.debug('[Meshy Downloader] Tripo3D GLB URL detected', url);

        return [{
          type: 'tripo-glb-url-detected',
          payload: {
            url,
            capturedAt: Date.now(),
            pageUrl,
          },
        }];
      },
      isBinaryRequest() {
        return false;
      },
    },
    deobfuscation: {
      detectWorkerPostMessage() {
        return [];
      },
      detectWorkerMessage() {
        return [];
      },
      detectBinaryResponse() {
        return [];
      },
    },
  };
}

export function isTripoModelUrl(url: string) {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').pop() ?? '';
    return parsed.hostname === 'tripo-data.rg1.data.tripo3d.com'
      && parsed.pathname.includes('/tripo-studio/')
      && parsed.pathname.toLowerCase().includes('.glb')
      && filename.includes('tripo_pbr_model_')
      && filename.toLowerCase().endsWith('_meshopt.glb');
  } catch {
    return false;
  }
}

const websiteStates: WebsiteState[] = [createMeshyState(), createTripoState()];

export function findWebsiteState(url?: string): WebsiteState | undefined {
  return websiteStates.find((state) => state.matchesUrl(url));
}

export function isSupportedWebsiteUrl(url?: string) {
  return findWebsiteState(url) !== undefined;
}

export function createWebsiteStateMachine(initialUrl?: string) {
  let current = findWebsiteState(initialUrl);

  return {
    get current() {
      return current;
    },
    transition(url?: string) {
      current = findWebsiteState(url);
      return current;
    },
    eventsFromRequest(input: unknown, pageUrl: string) {
      return current?.network.detectRequest(input, pageUrl) ?? [];
    },
    isBinaryRequest(input: unknown) {
      return current?.network.isBinaryRequest(input) ?? false;
    },
    eventsFromWorkerPostMessage(message: unknown, pageUrl: string) {
      return current?.deobfuscation.detectWorkerPostMessage(message, pageUrl) ?? [];
    },
    eventsFromWorkerMessage(message: unknown, pageUrl: string) {
      return current?.deobfuscation.detectWorkerMessage(message, pageUrl) ?? [];
    },
    eventsFromBinaryResponse(buffer: ArrayBuffer, sourceUrl: string | undefined) {
      return current?.deobfuscation.detectBinaryResponse(buffer, sourceUrl) ?? [];
    },
  };
}
