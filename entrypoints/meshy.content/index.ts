import { browser, createShadowRootUi, defineContentScript } from '#imports';
import { mount, unmount } from 'svelte';
import Overlay from './Overlay.svelte';
import type { MeshyAuthPayload, PageState } from '../../src/lib/types';

const BRIDGE_SOURCE = 'meshy-downloader-main-world';
const CONTENT_SOURCE = 'meshy-downloader-content-script';
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK = 0x4e4f534a;
const GLB_BIN_CHUNK = 0x004e4942;
const COMPONENT_UNSIGNED_BYTE = 5121;
const COMPONENT_UNSIGNED_SHORT = 5123;
const COMPONENT_UNSIGNED_INT = 5125;
const COMPONENT_FLOAT = 5126;
const KHR_MESH_QUANTIZATION = 'KHR_mesh_quantization';

let injected = false;
let lastAuth: MeshyAuthPayload | undefined;
let pendingDownload = false;
let lastDownloadAt: number | undefined;
let modelGeneration = 0;

// ── Model state ──
// model.json and model.meshy are captured independently and asynchronously.
// model.meshy (decoded into GLB by the worker) is the downloadable payload.
// model.json is used to signal the UI that a new model is being viewed.
//
// Either can arrive first. We use a stable key derived from the URL path
// (stripping the filename) to correlate the two.

/** The GLB buffer for the current model. Once set, never cleared to undefined. */
let currentGlb: { buffer: ArrayBuffer; byteLength: number; modelKey: string } | null = null;

/** The model key from the most recent model.json detection. */
let currentJsonModelKey: string | undefined;

/** Cache of GLBs by model key so revisiting a model doesn't require re-decode. */
const glbCache = new Map<string, { buffer: ArrayBuffer; byteLength: number }>();

type GltfAccessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
  sparse?: {
    count: number;
    indices: {
      bufferView: number;
      byteOffset?: number;
      componentType: number;
    };
    values: {
      bufferView: number;
      byteOffset?: number;
    };
  };
};

type GltfBufferView = {
  buffer?: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
  target?: number;
};

type GltfDocument = {
  accessors?: GltfAccessor[];
  buffers?: Array<{ byteLength: number }>;
  bufferViews?: GltfBufferView[];
  extensionsRequired?: string[];
  extensionsUsed?: string[];
  meshes?: Array<{
    primitives?: Array<{
      attributes?: Record<string, number>;
    }>;
  }>;
};

type GlbChunk = {
  type: number;
  data: Uint8Array;
};

/**
 * Derives a stable model key from any model-related URL (model.json, mesh.json, model.meshy).
 * Strips the filename and query params, keeping only origin + directory path.
 */
function getModelKey(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.href);
    // Remove the filename (last path segment) to get the directory
    const dir = parsed.pathname.replace(/\/[^/]+$/, '');
    return `${parsed.origin}${dir}`;
  } catch {
    // Fallback: strip query and filename
    const noQuery = url.split('?')[0];
    return noQuery.replace(/\/[^/]+$/, '');
  }
}

function getPageState(): PageState {
  return {
    injected,
    hasAuth: Boolean(lastAuth),
    hasDecodedGlb: currentGlb !== null,
    pendingDownload,
    lastAuth,
    lastGlbSize: currentGlb?.byteLength,
    lastDownloadAt,
  };
}

function makeFileName() {
  const date = new Date().toISOString().replace(/[:.]/g, '-');
  return `meshy-model-${date}.glb`;
}

function downloadBuffer(buffer: ArrayBuffer, filename = makeFileName()) {
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.documentElement.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  lastDownloadAt = Date.now();
  browser.runtime.sendMessage({ type: 'record-download' }).catch(() => {});
}

function notifyOverlay(type: string, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(`meshy-downloader:${type}`, { detail }));
}

function toArrayBuffer(value: unknown): ArrayBuffer | null {
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
    return value as ArrayBuffer;
  }
  if (ArrayBuffer.isView(value)) {
    if (!(value.buffer instanceof ArrayBuffer)) return null;
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
  }
  return null;
}

function align4(value: number) {
  return (value + 3) & ~3;
}

function getComponentCount(type: string) {
  switch (type) {
    case 'SCALAR': return 1;
    case 'VEC2': return 2;
    case 'VEC3': return 3;
    case 'VEC4': return 4;
    case 'MAT2': return 4;
    case 'MAT3': return 9;
    case 'MAT4': return 16;
    default: return 0;
  }
}

function getComponentByteSize(componentType: number) {
  switch (componentType) {
    case 5120:
    case COMPONENT_UNSIGNED_BYTE:
      return 1;
    case 5122:
    case COMPONENT_UNSIGNED_SHORT:
      return 2;
    case COMPONENT_UNSIGNED_INT:
    case COMPONENT_FLOAT:
      return 4;
    default:
      return 0;
  }
}

function readUnsignedIndex(view: DataView, byteOffset: number, componentType: number) {
  switch (componentType) {
    case COMPONENT_UNSIGNED_BYTE:
      return view.getUint8(byteOffset);
    case COMPONENT_UNSIGNED_SHORT:
      return view.getUint16(byteOffset, true);
    case COMPONENT_UNSIGNED_INT:
      return view.getUint32(byteOffset, true);
    default:
      return undefined;
  }
}

function parseGlb(buffer: ArrayBuffer): { gltf: GltfDocument; bin: Uint8Array; chunks: GlbChunk[] } | null {
  if (buffer.byteLength < 20) return null;

  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== GLB_VERSION) return null;

  const declaredLength = view.getUint32(8, true);
  if (declaredLength > buffer.byteLength) return null;

  const chunks: GlbChunk[] = [];
  let offset = 12;
  while (offset + 8 <= declaredLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > declaredLength) return null;

    chunks.push({ type: chunkType, data: new Uint8Array(buffer, chunkStart, chunkLength) });
    offset = chunkEnd;
  }

  const jsonChunk = chunks.find((chunk) => chunk.type === GLB_JSON_CHUNK);
  const binChunk = chunks.find((chunk) => chunk.type === GLB_BIN_CHUNK);
  if (!jsonChunk || !binChunk) return null;

  const jsonText = new TextDecoder()
    .decode(jsonChunk.data)
    .replace(/[\u0000\s]+$/u, '');

  return {
    gltf: JSON.parse(jsonText) as GltfDocument,
    bin: binChunk.data,
    chunks,
  };
}

function buildGlb(gltf: GltfDocument, bin: Uint8Array) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const paddedJsonLength = align4(jsonBytes.byteLength);
  const paddedBinLength = align4(bin.byteLength);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;
  const output = new ArrayBuffer(totalLength);
  const view = new DataView(output);
  const bytes = new Uint8Array(output);

  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);

  view.setUint32(12, paddedJsonLength, true);
  view.setUint32(16, GLB_JSON_CHUNK, true);
  bytes.fill(0x20, 20, 20 + paddedJsonLength);
  bytes.set(jsonBytes, 20);

  const binHeaderOffset = 20 + paddedJsonLength;
  view.setUint32(binHeaderOffset, paddedBinLength, true);
  view.setUint32(binHeaderOffset + 4, GLB_BIN_CHUNK, true);
  bytes.set(bin, binHeaderOffset + 8);

  return output;
}

function getPositionAccessorIndices(gltf: GltfDocument) {
  const indices = new Set<number>();
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const position = primitive.attributes?.POSITION;
      if (typeof position === 'number') indices.add(position);
    }
  }
  return indices;
}

function readUnsignedShortAccessorAsFloats(gltf: GltfDocument, bin: Uint8Array, accessor: GltfAccessor) {
  const bufferView = accessor.bufferView != null ? gltf.bufferViews?.[accessor.bufferView] : undefined;
  const componentCount = getComponentCount(accessor.type);
  const componentByteSize = getComponentByteSize(accessor.componentType);
  if (!bufferView || componentCount === 0 || componentByteSize === 0) return null;
  if (accessor.componentType !== COMPONENT_UNSIGNED_SHORT) return null;

  const output = new Float32Array(accessor.count * componentCount);
  const binView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const baseOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView.byteStride ?? componentCount * componentByteSize;
  const min = new Array(componentCount).fill(Number.POSITIVE_INFINITY);
  const max = new Array(componentCount).fill(Number.NEGATIVE_INFINITY);
  const decode = accessor.normalized ? (value: number) => value / 65535 : (value: number) => value;

  for (let elementIndex = 0; elementIndex < accessor.count; elementIndex += 1) {
    const elementOffset = baseOffset + elementIndex * stride;
    for (let componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
      const value = decode(binView.getUint16(elementOffset + componentIndex * componentByteSize, true));
      output[elementIndex * componentCount + componentIndex] = value;
    }
  }

  if (accessor.sparse) {
    const indicesView = gltf.bufferViews?.[accessor.sparse.indices.bufferView];
    const valuesView = gltf.bufferViews?.[accessor.sparse.values.bufferView];
    const indexByteSize = getComponentByteSize(accessor.sparse.indices.componentType);
    if (!indicesView || !valuesView || indexByteSize === 0) return null;

    const indicesBaseOffset = (indicesView.byteOffset ?? 0) + (accessor.sparse.indices.byteOffset ?? 0);
    const valuesBaseOffset = (valuesView.byteOffset ?? 0) + (accessor.sparse.values.byteOffset ?? 0);
    const valuesStride = valuesView.byteStride ?? componentCount * componentByteSize;

    for (let sparseIndex = 0; sparseIndex < accessor.sparse.count; sparseIndex += 1) {
      const elementIndex = readUnsignedIndex(
        binView,
        indicesBaseOffset + sparseIndex * indexByteSize,
        accessor.sparse.indices.componentType,
      );
      if (elementIndex == null || elementIndex >= accessor.count) return null;

      const valueOffset = valuesBaseOffset + sparseIndex * valuesStride;
      for (let componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
        output[elementIndex * componentCount + componentIndex] = decode(
          binView.getUint16(valueOffset + componentIndex * componentByteSize, true),
        );
      }
    }
  }

  for (let elementIndex = 0; elementIndex < accessor.count; elementIndex += 1) {
    for (let componentIndex = 0; componentIndex < componentCount; componentIndex += 1) {
      const value = output[elementIndex * componentCount + componentIndex];
      min[componentIndex] = Math.min(min[componentIndex], value);
      max[componentIndex] = Math.max(max[componentIndex], value);
    }
  }

  return { data: new Uint8Array(output.buffer), min, max };
}

function hasQuantizedMeshAttributes(gltf: GltfDocument) {
  const quantizedSemantics = new Set(['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1', 'TEXCOORD_2', 'TEXCOORD_3']);
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      for (const [semantic, accessorIndex] of Object.entries(primitive.attributes ?? {})) {
        const accessor = gltf.accessors?.[accessorIndex];
        if (!accessor || !quantizedSemantics.has(semantic)) continue;
        if (accessor.componentType !== COMPONENT_FLOAT) return true;
      }
    }
  }
  return false;
}

function stripExtension(list: string[] | undefined, extensionName: string) {
  if (!list) return undefined;
  const next = list.filter((extension) => extension !== extensionName);
  return next.length > 0 ? next : undefined;
}

function normalizeQuantizedPositionsInGlb(buffer: ArrayBuffer) {
  try {
    const parsed = parseGlb(buffer);
    if (!parsed) return buffer;

    const { gltf, bin } = parsed;
    const accessors = gltf.accessors ?? [];
    const bufferViews = gltf.bufferViews ?? [];
    const positionAccessorIndices = getPositionAccessorIndices(gltf);
    const appendedChunks: Uint8Array[] = [];
    let appendedByteLength = 0;
    let convertedCount = 0;

    for (const accessorIndex of positionAccessorIndices) {
      const accessor = accessors[accessorIndex];
      if (!accessor || accessor.componentType !== COMPONENT_UNSIGNED_SHORT || accessor.type !== 'VEC3') continue;

      const converted = readUnsignedShortAccessorAsFloats(gltf, bin, accessor);
      if (!converted) continue;

      const byteOffset = align4(bin.byteLength + appendedByteLength);
      const paddingLength = byteOffset - (bin.byteLength + appendedByteLength);
      if (paddingLength > 0) {
        appendedChunks.push(new Uint8Array(paddingLength));
        appendedByteLength += paddingLength;
      }

      appendedChunks.push(converted.data);
      appendedByteLength += converted.data.byteLength;

      const sourceBufferView = accessor.bufferView != null ? bufferViews[accessor.bufferView] : undefined;
      const nextBufferViewIndex = bufferViews.length;
      bufferViews.push({
        buffer: 0,
        byteOffset,
        byteLength: converted.data.byteLength,
        target: sourceBufferView?.target,
      });

      accessor.bufferView = nextBufferViewIndex;
      accessor.byteOffset = 0;
      accessor.componentType = COMPONENT_FLOAT;
      delete accessor.normalized;
      accessor.min = converted.min;
      accessor.max = converted.max;
      delete accessor.sparse;

      convertedCount += 1;
    }

    if (convertedCount === 0) return buffer;

    const nextBin = new Uint8Array(bin.byteLength + appendedByteLength);
    nextBin.set(bin, 0);
    let writeOffset = bin.byteLength;
    for (const chunk of appendedChunks) {
      nextBin.set(chunk, writeOffset);
      writeOffset += chunk.byteLength;
    }

    gltf.bufferViews = bufferViews;
    gltf.buffers ??= [{ byteLength: 0 }];
    gltf.buffers[0].byteLength = nextBin.byteLength;
    gltf.extensionsRequired = stripExtension(gltf.extensionsRequired, KHR_MESH_QUANTIZATION);
    if (!hasQuantizedMeshAttributes(gltf)) {
      gltf.extensionsUsed = stripExtension(gltf.extensionsUsed, KHR_MESH_QUANTIZATION);
    }

    console.debug('[Meshy Downloader] Converted quantized POSITION accessors to FLOAT', {
      convertedCount,
      originalByteLength: buffer.byteLength,
      nextByteLength: nextBin.byteLength,
    });

    return buildGlb(gltf, nextBin);
  } catch (error) {
    console.warn('[Meshy Downloader] Failed to normalize quantized GLB positions', error);
    return buffer;
  }
}

async function handleAuthCaptured(auth: MeshyAuthPayload) {
  lastAuth = auth;
  await browser.runtime.sendMessage({ type: 'record-auth', auth }).catch(() => {});
  console.debug('[Meshy Downloader] Meshy auth captured', auth);
}

/**
 * Called when model.json (or mesh.json) is fetched — this signals the UI.
 * If the GLB for this model is already cached, show it immediately.
 * If not, the UI will show once handleGlbReady fires.
 */
function handleModelJsonDetected(payload: { url?: string }) {
  const modelKey = getModelKey(payload.url);
  const isNewModel = modelKey !== undefined && modelKey !== currentJsonModelKey;

  currentJsonModelKey = modelKey ?? currentJsonModelKey;

  console.debug('[Meshy Downloader] model.json detected', {
    url: payload.url,
    modelKey: currentJsonModelKey,
    isNewModel,
  });

  if (isNewModel) {
    modelGeneration += 1;
    pendingDownload = false;

    notifyOverlay('model-changed', {
      ...payload,
      generation: modelGeneration,
      modelKey: currentJsonModelKey,
    });
  }

  if (!currentJsonModelKey) return;

  // Check if GLB is already cached for this model
  const cached = glbCache.get(currentJsonModelKey);
  if (cached) {
    currentGlb = { buffer: cached.buffer.slice(0), byteLength: cached.byteLength, modelKey: currentJsonModelKey };
    notifyOverlay('glb-ready', {
      byteLength: cached.byteLength,
      generation: modelGeneration,
      modelKey: currentJsonModelKey,
      cached: true,
    });

    if (pendingDownload) {
      pendingDownload = false;
      downloadBuffer(currentGlb.buffer);
      notifyOverlay('download-started', {
        byteLength: currentGlb.byteLength,
        generation: modelGeneration,
        modelKey: currentJsonModelKey,
      });
    }
    return;
  }

  // Also check if the current GLB (from model.meshy) already belongs to this model
  if (currentGlb && currentGlb.modelKey === currentJsonModelKey) {
    notifyOverlay('glb-ready', {
      byteLength: currentGlb.byteLength,
      generation: modelGeneration,
      modelKey: currentJsonModelKey,
    });

    if (pendingDownload) {
      pendingDownload = false;
      downloadBuffer(currentGlb.buffer);
      notifyOverlay('download-started', {
        byteLength: currentGlb.byteLength,
        generation: modelGeneration,
        modelKey: currentJsonModelKey,
      });
    }
  }
}

/**
 * Called when model.meshy binary URL is fetched.
 * This lets us establish the model key early even before model.json arrives.
 */
function handleModelBinaryDetected(payload: { url?: string }) {
  const modelKey = getModelKey(payload.url);
  if (!modelKey) return;

  console.debug('[Meshy Downloader] model.meshy URL detected', { modelKey, url: payload.url });

  // If model.json hasn't arrived yet, we can still prepare the model key.
  // We don't bump generation or notify the UI here — that's model.json's job.
  // But if we already have a cached GLB for this key, pre-load it.
  const cached = glbCache.get(modelKey);
  if (cached && (!currentGlb || currentGlb.modelKey !== modelKey)) {
    currentGlb = { buffer: cached.buffer.slice(0), byteLength: cached.byteLength, modelKey };
    console.debug('[Meshy Downloader] Restored cached GLB from binary URL match', { modelKey, byteLength: cached.byteLength });
  }
}

/**
 * Called when the worker decodes model.meshy into a GLB.
 * This is the actual downloadable payload. It may arrive before or after model.json.
 */
function handleGlbReady(buffer: ArrayBuffer, byteLength: number, sourceUrl?: string) {
  const normalizedBuffer = normalizeQuantizedPositionsInGlb(buffer);
  const normalizedByteLength = normalizedBuffer.byteLength;
  // Derive model key from the GLB source URL (which is the model.meshy URL or page URL)
  const modelKey = getModelKey(sourceUrl) ?? currentJsonModelKey ?? `unknown-${Date.now()}`;

  currentGlb = { buffer: normalizedBuffer, byteLength: normalizedByteLength, modelKey };

  // Cache it
  glbCache.set(modelKey, { buffer: normalizedBuffer.slice(0), byteLength: normalizedByteLength });

  console.debug('[Meshy Downloader] GLB ready', {
    modelKey,
    byteLength: normalizedByteLength,
    originalByteLength: byteLength,
    sourceUrl,
  });

  notifyOverlay('glb-ready', { byteLength: normalizedByteLength, generation: modelGeneration, modelKey });

  if (pendingDownload) {
    pendingDownload = false;
    downloadBuffer(normalizedBuffer);
    notifyOverlay('download-started', { byteLength: normalizedByteLength, generation: modelGeneration, modelKey });
  }
}

async function handleUserChoice(choice: 'yes' | 'no' | 'never') {
  switch (choice) {
    case 'yes':
      if (!currentGlb) {
        // GLB hasn't arrived yet — queue the download for when it does
        console.debug('[Meshy Downloader] User chose to download, but GLB not yet available — queuing');
        pendingDownload = true;
        notifyOverlay('download-pending', {
          generation: modelGeneration,
          modelKey: currentJsonModelKey,
        });
        break;
      }
      console.debug('[Meshy Downloader] User chose to download the model');
      pendingDownload = false;
      downloadBuffer(currentGlb.buffer);
      notifyOverlay('download-started', {
        byteLength: currentGlb.byteLength,
        generation: modelGeneration,
        modelKey: currentGlb.modelKey,
      });
      break;
    case 'no':
      pendingDownload = false;
      break;
    case 'never':
      pendingDownload = false;
      await browser.runtime.sendMessage({ type: 'set-never-show-again', value: true });
      notifyOverlay('preference-saved');
      break;
  }
}

export default defineContentScript({
  matches: ['https://www.meshy.ai/*'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== BRIDGE_SOURCE) return;

      if (data.type === 'installed') {
        injected = true;
        notifyOverlay('injected');
        return;
      }

      if (data.type === 'auth-captured') {
        void handleAuthCaptured(data.payload as MeshyAuthPayload);
        return;
      }

      if (data.type === 'model-binary-detected') {
        handleModelBinaryDetected(data.payload as { url?: string });
        return;
      }

      if (data.type === 'model-json-detected') {
        handleModelJsonDetected(data.payload as { url?: string });
        return;
      }

      if (data.type === 'glb-ready') {
        const payload = data.payload as { data?: ArrayBuffer; byteLength?: number; url?: string };
        const buffer = toArrayBuffer(payload.data);
        if (buffer) {
          handleGlbReady(buffer, payload.byteLength ?? buffer.byteLength, payload.url as string | undefined);
        }
      }
    });

    window.postMessage({ source: CONTENT_SOURCE, type: 'status-request' }, window.location.origin);

    await browser.runtime.sendMessage({ type: 'record-page-seen' }).catch(() => {});

    const ui = await createShadowRootUi(ctx, {
      name: 'meshy-downloader-overlay',
      position: 'overlay',
      anchor: () => document.body ?? document.documentElement,
      onMount: (container) => {
        const app = mount(Overlay, { target: container });
        return app;
      },
      onRemove: (app) => {
        if (app) unmount(app);
      },
    });

    ui.mount();

    window.addEventListener('meshy-downloader:user-choice', (event) => {
      const choice = (event as CustomEvent).detail;
      void handleUserChoice(choice);
    });

    browser.runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== 'object') return;

      if (message.type === 'get-page-state') {
        return Promise.resolve(getPageState());
      }

      if (message.type === 'download-last-mesh') {
        if (!currentGlb) {
          return Promise.resolve({ ok: false, error: 'No decoded GLB is currently buffered. Click/open a model first.' });
        }
        downloadBuffer(currentGlb.buffer);
        return Promise.resolve({ ok: true, byteLength: currentGlb.byteLength });
      }
    });
  },
});
