import { defineUnlistedScript } from '#imports';

type AnyRecord = Record<string, unknown>;

const BRIDGE_SOURCE = 'meshy-authorized-helper-main-world';
const INSTALLED_KEY = '__meshy_authorized_helper_installed__';

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
}

function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return null;
}

function looksLikeGlb(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new Uint8Array(buffer, 0, 4);
  return view[0] === 0x67 && view[1] === 0x6c && view[2] === 0x54 && view[3] === 0x46; // glTF
}

function postToContent(type: string, payload: AnyRecord) {
  window.postMessage({ source: BRIDGE_SOURCE, type, payload }, window.location.origin);
}

function maybeCaptureAuthorize(message: unknown) {
  if (!isRecord(message)) return;
  if (message.type !== 'authorize') return;

  const hostname = typeof message.hostname === 'string' ? message.hostname : undefined;
  const signature = typeof message.signature === 'string' ? message.signature : undefined;
  const timestamp = message.timestamp;

  if (!hostname || !signature || (typeof timestamp !== 'number' && typeof timestamp !== 'string')) return;

  postToContent('auth-captured', {
    hostname,
    timestamp,
    signature,
    capturedAt: Date.now(),
    url: window.location.href,
  });
}

function maybeCaptureProcessResult(message: unknown) {
  if (!isRecord(message)) return;
  if (message.type !== 'process' || message.success !== true) return;

  const raw = toArrayBuffer(message.data);
  if (!raw || !looksLikeGlb(raw)) return;

  const data = raw.slice(0);
  window.postMessage(
    {
      source: BRIDGE_SOURCE,
      type: 'glb-ready',
      payload: {
        data,
        byteLength: data.byteLength,
        capturedAt: Date.now(),
        url: window.location.href,
      },
    },
    window.location.origin,
    [data],
  );
}

function attachWorkerListener(worker: Worker) {
  worker.addEventListener('message', (event) => {
    try {
      maybeCaptureProcessResult(event.data);
    } catch (error) {
      console.warn('[Meshy Helper] Failed to inspect worker message', error);
    }
  });
}

export default defineUnlistedScript(() => {
  const w = window as typeof window & Record<string, unknown>;
  if (w[INSTALLED_KEY]) return;
  w[INSTALLED_KEY] = true;

  const NativeWorker = window.Worker;
  const nativePostMessage = NativeWorker.prototype.postMessage;

  NativeWorker.prototype.postMessage = function patchedWorkerPostMessage(message: unknown, transfer?: Transferable[]) {
    try {
      maybeCaptureAuthorize(message);
    } catch (error) {
      console.warn('[Meshy Helper] Failed to inspect Worker.postMessage payload', error);
    }

    return nativePostMessage.apply(this, arguments as unknown as [message: unknown, transfer?: Transferable[]]);
  };

  function WorkerWrapper(this: Worker, scriptURL: string | URL, options?: WorkerOptions): Worker {
    const worker = new NativeWorker(scriptURL, options);
    attachWorkerListener(worker);
    return worker;
  }

  WorkerWrapper.prototype = NativeWorker.prototype;
  Object.setPrototypeOf(WorkerWrapper, NativeWorker);

  window.Worker = WorkerWrapper as unknown as typeof Worker;

  postToContent('installed', { at: Date.now(), url: window.location.href });
});
