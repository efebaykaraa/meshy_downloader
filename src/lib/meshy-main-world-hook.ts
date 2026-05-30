import {
  BRIDGE_SOURCE,
  CONTENT_SOURCE,
  createWebsiteStateMachine,
  getUrlString,
  type WebsiteBridgeEvent,
} from './website-state-machine';

type AnyRecord = Record<string, unknown>;

const INSTALLED_KEY = '__meshy_downloader_installed__';

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
}

function postToContent(event: WebsiteBridgeEvent) {
  try {
    window.postMessage(
      { source: BRIDGE_SOURCE, type: event.type, payload: event.payload },
      window.location.origin,
      event.transfer,
    );
  } catch (error) {
    console.warn('[Meshy Downloader] Failed to post message to content script', error);
  }
}

function postInstalled() {
  postToContent({
    type: 'installed',
    payload: {
      at: Date.now(),
      url: window.location.href,
    },
  });
}

export function installMeshyMainWorldHook() {
  const stateMachine = createWebsiteStateMachine(window.location.href);
  const w = window as typeof window & Record<string, unknown>;

  if (w[INSTALLED_KEY]) {
    postInstalled();
    return;
  }
  w[INSTALLED_KEY] = true;

  const NativeWorker = window.Worker;
  const nativePostMessage = NativeWorker.prototype.postMessage;
  const nativeWorkerAddEventListener = NativeWorker.prototype.addEventListener;
  const nativeFetch = window.fetch;
  const nativeXhrOpen = XMLHttpRequest.prototype.open;
  const inspectedWorkers = new WeakSet<Worker>();

  function dispatch(events: WebsiteBridgeEvent[]) {
    for (const event of events) postToContent(event);
  }

  function refreshState() {
    stateMachine.transition(window.location.href);
    return stateMachine.current;
  }

  function detectRequest(input: unknown) {
    refreshState();
    dispatch(stateMachine.eventsFromRequest(input, window.location.href));
  }

  function detectWorkerPostMessage(message: unknown) {
    refreshState();
    dispatch(stateMachine.eventsFromWorkerPostMessage(message, window.location.href));
  }

  function detectWorkerMessage(message: unknown) {
    refreshState();
    dispatch(stateMachine.eventsFromWorkerMessage(message, window.location.href));
  }

  function detectBinaryResponse(buffer: ArrayBuffer, sourceUrl?: string) {
    refreshState();
    dispatch(stateMachine.eventsFromBinaryResponse(buffer, sourceUrl));
  }

  function inspectWorkerMessageEvent(event: MessageEvent) {
    try {
      detectWorkerMessage(event.data);
    } catch (error) {
      console.warn('[Meshy Downloader] Failed to inspect worker message', error);
    }
  }

  function attachWorkerListener(worker: Worker) {
    if (inspectedWorkers.has(worker)) return;
    inspectedWorkers.add(worker);
    worker.addEventListener('message', inspectWorkerMessageEvent);
  }

  NativeWorker.prototype.postMessage = function patchedWorkerPostMessage(message: unknown) {
    try {
      detectWorkerPostMessage(message);
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
    if (type === 'message') attachWorkerListener(this);

    return nativeWorkerAddEventListener.apply(
      this,
      arguments as unknown as Parameters<Worker['addEventListener']>,
    );
  };

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
      detectRequest(input);
    } catch (error) {
      console.warn('[Meshy Downloader] Failed to inspect fetch URL', error);
    }

    const responsePromise = nativeFetch.apply(this, [input, init]);

    if (stateMachine.isBinaryRequest(input)) {
      responsePromise
        .then((response) => response.clone().arrayBuffer().then((buffer) => detectBinaryResponse(buffer, response.url)))
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
      detectRequest(url);
    } catch (error) {
      console.warn('[Meshy Downloader] Failed to inspect XHR URL', error);
    }

    if (stateMachine.isBinaryRequest(url)) {
      this.addEventListener('load', () => {
        const sourceUrl = this.responseURL || getUrlString(url);
        const response = this.response;
        if (response instanceof ArrayBuffer) {
          detectBinaryResponse(response, sourceUrl);
        } else if (response instanceof Blob) {
          response
            .arrayBuffer()
            .then((buffer) => {
              detectBinaryResponse(buffer, sourceUrl);
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
    postInstalled();
  });

  postInstalled();
}
