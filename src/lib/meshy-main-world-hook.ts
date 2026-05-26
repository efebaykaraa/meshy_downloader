type AnyRecord = Record<string, unknown>;

const BRIDGE_SOURCE = 'meshy-downloader-main-world';
const CONTENT_SOURCE = 'meshy-downloader-content-script';
const INSTALLED_KEY = '__meshy_downloader_installed__';

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
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

function postToContent(type: string, payload: AnyRecord) {
  try {
    window.postMessage({ source: BRIDGE_SOURCE, type, payload }, window.location.origin);
  } catch (error) {
    console.warn('[Meshy Downloader] Failed to post message to content script', error);
  }
}

function postGlbReady(buffer: ArrayBuffer, sourceUrl = window.location.href) {
  const data = buffer.slice(0);
  window.postMessage(
    {
      source: BRIDGE_SOURCE,
      type: 'glb-ready',
      payload: {
        data,
        byteLength: data.byteLength,
        capturedAt: Date.now(),
        url: sourceUrl,
      },
    },
    window.location.origin,
    [data],
  );
}

function maybeCaptureAuthorize(message: unknown) {
  if (!isRecord(message)) return;
  if (message.type !== 'authorize') return;

  const hostname = typeof message.hostname === 'string' ? message.hostname : undefined;
  const signature = typeof message.signature === 'string' ? message.signature : undefined;
  const timestamp = message.timestamp;

  if (!hostname || !signature || (typeof timestamp !== 'number' && typeof timestamp !== 'string')) return;

  console.debug('[Meshy Downloader] Meshy auth captured', { hostname, timestamp, signature });

  postToContent('auth-captured', {
    hostname,
    timestamp,
    signature,
    capturedAt: Date.now(),
    url: window.location.href,
  });
}

function getUrlString(input: unknown): string | undefined {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return undefined;
}

function parseUrl(input: unknown): URL | null {
  const urlString = getUrlString(input);
  if (!urlString) return null;

  try {
    return new URL(urlString, window.location.href);
  } catch {
    return null;
  }
}

function maybeCaptureModelJson(input: unknown) {
  const url = parseUrl(input);
  if (!url) return;

  const isModelJson = /(^|\/)(model|mesh)\.json$/i.test(url.pathname);
  if (!isModelJson) return;
  if (!url.searchParams.has('Expires')) return;

  console.debug('[Meshy Downloader] Meshy model JSON detected', url.href);
  postToContent('model-json-detected', {
    url: url.href,
    expires: url.searchParams.get('Expires'),
    capturedAt: Date.now(),
    pageUrl: window.location.href,
  });
}

function isModelBinaryUrl(input: unknown) {
  const url = parseUrl(input);
  return !!url && /(^|\/)model\.meshy$/i.test(url.pathname);
}

function maybeCaptureModelBinaryUrl(input: unknown) {
  const url = parseUrl(input);
  if (!url) return;
  if (!/(^|\/)model\.meshy$/i.test(url.pathname)) return;

  console.debug('[Meshy Downloader] Meshy model binary URL detected', url.href);
  postToContent('model-binary-detected', {
    url: url.href,
    capturedAt: Date.now(),
    pageUrl: window.location.href,
  });
}

async function maybePostGlbFromBuffer(buffer: ArrayBuffer, sourceUrl?: string) {
  if (!looksLikeGlb(buffer)) {
    console.debug('[Meshy Downloader] Binary response is not decoded GLB yet', {
      byteLength: buffer.byteLength,
      firstBytes: getBytePreview(buffer),
      url: sourceUrl,
    });
    return;
  }

  console.debug('[Meshy Downloader] GLB captured from network response', {
    byteLength: buffer.byteLength,
    url: sourceUrl,
  });
  postGlbReady(buffer, sourceUrl);
}

function maybeCaptureProcessResult(message: unknown) {
  if (!isRecord(message)) return;

  // Primary path: explicit process result with { type: 'process', success: true, data: ArrayBuffer }
  if (message.type === 'process' && message.success === true) {
    const raw = toArrayBuffer(message.data);
    if (raw && looksLikeGlb(raw)) {
      console.debug('[Meshy Downloader] GLB captured from worker process result', { byteLength: raw.byteLength });
      postGlbReady(raw);
      return;
    }
  }

  // Fallback: scan all top-level ArrayBuffer-like values in the message for GLB magic bytes.
  // Some model types may use a different message schema (e.g. different `type` value or
  // no `success` field), so we check any buffer-like property for the glTF magic header.
  for (const key of Object.keys(message)) {
    const raw = toArrayBuffer(message[key]);
    if (raw && looksLikeGlb(raw)) {
      console.debug('[Meshy Downloader] GLB captured from worker message property', { key, byteLength: raw.byteLength });
      postGlbReady(raw);
      return;
    }
  }
}

const inspectedWorkers = new WeakSet<Worker>();

function inspectWorkerMessageEvent(event: MessageEvent) {
  try {
    maybeCaptureProcessResult(event.data);
  } catch (error) {
    console.warn('[Meshy Downloader] Failed to inspect worker message', error);
  }
}

function attachWorkerListener(worker: Worker) {
  if (inspectedWorkers.has(worker)) return;
  inspectedWorkers.add(worker);

  worker.addEventListener('message', inspectWorkerMessageEvent);
}

export function installMeshyMainWorldHook() {
  const w = window as typeof window & Record<string, unknown>;
  if (w[INSTALLED_KEY]) {
    postToContent('installed', { at: Date.now(), url: window.location.href });
    return;
  }
  w[INSTALLED_KEY] = true;

  const NativeWorker = window.Worker;
  const nativePostMessage = NativeWorker.prototype.postMessage;
  const nativeWorkerAddEventListener = NativeWorker.prototype.addEventListener;
  const nativeFetch = window.fetch;
  const nativeXhrOpen = XMLHttpRequest.prototype.open;

  NativeWorker.prototype.postMessage = function patchedWorkerPostMessage(message: unknown) {
    try {
      maybeCaptureAuthorize(message);
    } catch (error) {
      console.warn('[Meshy Downloader] Failed to inspect Worker.postMessage payload', error);
    }

    return nativePostMessage.apply(this, arguments as unknown as Parameters<Worker['postMessage']>);
  };

  NativeWorker.prototype.addEventListener = function patchedWorkerAddEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (type === 'message') {
      attachWorkerListener(this);
    }

    return nativeWorkerAddEventListener.apply(
      this,
      arguments as unknown as Parameters<Worker['addEventListener']>,
    );
  };

  // Intercept worker.onmessage = handler assignment.
  // If the page sets onmessage instead of using addEventListener, our listener
  // from attachWorkerListener would still fire (addEventListener and onmessage
  // are independent), but we must ensure attachWorkerListener is called at all.
  const onmessageDescriptor = Object.getOwnPropertyDescriptor(NativeWorker.prototype, 'onmessage');
  if (onmessageDescriptor) {
    const nativeOnmessageSetter = onmessageDescriptor.set;
    Object.defineProperty(NativeWorker.prototype, 'onmessage', {
      ...onmessageDescriptor,
      set(handler: ((this: Worker, ev: MessageEvent) => unknown) | null) {
        attachWorkerListener(this);
        return nativeOnmessageSetter?.call(this, handler);
      },
    });
  }

  window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
    try {
      maybeCaptureModelJson(input);
      maybeCaptureModelBinaryUrl(input);
    } catch (error) {
      console.warn('[Meshy Downloader] Failed to inspect fetch URL', error);
    }

    const responsePromise = nativeFetch.apply(this, [input, init]);

    if (isModelBinaryUrl(input)) {
      responsePromise
        .then((response) => response.clone().arrayBuffer().then((buffer) => maybePostGlbFromBuffer(buffer, response.url)))
        .catch((error) => console.warn('[Meshy Downloader] Failed to inspect fetch response', error));
    }

    return responsePromise;
  };

  XMLHttpRequest.prototype.open = function patchedXhrOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    try {
      maybeCaptureModelJson(url);
      maybeCaptureModelBinaryUrl(url);
    } catch (error) {
      console.warn('[Meshy Downloader] Failed to inspect XHR URL', error);
    }

    if (isModelBinaryUrl(url)) {
      this.addEventListener('load', () => {
        const sourceUrl = this.responseURL || getUrlString(url);
        const response = this.response;
        if (response instanceof ArrayBuffer) {
          void maybePostGlbFromBuffer(response, sourceUrl);
        } else if (response instanceof Blob) {
          response
            .arrayBuffer()
            .then((buffer) => {
              maybePostGlbFromBuffer(buffer, sourceUrl);
            })
            .catch((error) => console.warn('[Meshy Downloader] Failed to inspect XHR blob response', error));
        }
      });
    }

    return nativeXhrOpen.apply(this, arguments as unknown as Parameters<XMLHttpRequest['open']>);
  };

  function WorkerWrapper(this: Worker, scriptURL: string | URL, options?: WorkerOptions): Worker {
    const worker = new NativeWorker(scriptURL, options);
    attachWorkerListener(worker);
    return worker;
  }

  WorkerWrapper.prototype = NativeWorker.prototype;
  Object.setPrototypeOf(WorkerWrapper, NativeWorker);

  window.Worker = WorkerWrapper as unknown as typeof Worker;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!isRecord(data) || data.source !== CONTENT_SOURCE || data.type !== 'status-request') return;
    postToContent('installed', { at: Date.now(), url: window.location.href });
  });

  postToContent('installed', { at: Date.now(), url: window.location.href });
}
