import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer/decoder';
import { dequantize } from './gltf-dequantize';
import { isTripoModelUrl } from './website-state-machine';

const EXT_MESHOPT_COMPRESSION = 'EXT_meshopt_compression';
const KHR_MESH_QUANTIZATION = 'KHR_mesh_quantization';
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const GLB_JSON_CHUNK = 0x4e4f534a;

type GlbSummary = {
  extensionsRequired: string[];
  extensionsUsed: string[];
  meshCount: number;
  materialCount: number;
  textureCount: number;
};

export type TripoProcessingResult = {
  buffer: ArrayBuffer;
  byteLength: number;
  filename: string;
  validation: {
    validGlb: boolean;
    meshCount: number;
    materialCount: number;
    textureCount: number;
    removedRequiredExtensions: boolean;
    sourceHadMaterials: boolean;
    sourceHadTextures: boolean;
    outputHasSourceMaterials: boolean;
    outputHasSourceTextures: boolean;
  };
};

function parseGlbSummary(buffer: ArrayBuffer): GlbSummary {
  if (buffer.byteLength < 20) throw new Error('Output is too small to be a GLB.');

  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('Output does not have a GLB header.');
  if (view.getUint32(4, true) !== GLB_VERSION) throw new Error('Output is not GLB version 2.');

  const declaredLength = view.getUint32(8, true);
  if (declaredLength > buffer.byteLength) throw new Error('Output GLB length is invalid.');

  let offset = 12;
  while (offset + 8 <= declaredLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > declaredLength) throw new Error('Output GLB chunk length is invalid.');

    if (chunkType === GLB_JSON_CHUNK) {
      const jsonText = new TextDecoder()
        .decode(new Uint8Array(buffer, chunkStart, chunkLength))
        .replace(/[\u0000\s]+$/u, '');
      const gltf = JSON.parse(jsonText) as {
        extensionsRequired?: string[];
        extensionsUsed?: string[];
        materials?: unknown[];
        meshes?: unknown[];
        textures?: unknown[];
      };

      return {
        extensionsRequired: gltf.extensionsRequired ?? [],
        extensionsUsed: gltf.extensionsUsed ?? [],
        meshCount: gltf.meshes?.length ?? 0,
        materialCount: gltf.materials?.length ?? 0,
        textureCount: gltf.textures?.length ?? 0,
      };
    }

    offset = chunkEnd;
  }

  throw new Error('Output GLB does not contain a JSON chunk.');
}

function makeTripoFilename(url: string) {
  const parsed = new URL(url);
  const filename = parsed.pathname.split('/').pop() ?? 'tripo_model.glb';
  if (filename.endsWith('_meshopt.glb')) return filename.replace(/_meshopt\.glb$/u, '_cleaned.glb');
  if (filename.endsWith('.glb')) return filename.replace(/\.glb$/u, '_cleaned.glb');
  return 'tripo_model_cleaned.glb';
}

export async function processTripoGlb(url: string): Promise<TripoProcessingResult> {
  if (!isTripoModelUrl(url)) {
    throw new Error('Refusing to process a non-Tripo3D model URL.');
  }

  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Failed to fetch Tripo3D GLB (${response.status} ${response.statusText}).`);
  }

  const sourceBuffer = await response.arrayBuffer();
  const sourceSummary = parseGlbSummary(sourceBuffer);

  await MeshoptDecoder.ready;

  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

  const document = await io.readBinary(new Uint8Array(sourceBuffer));
  await document.transform(dequantize());

  const meshoptExtension = document.getRoot().listExtensionsUsed()
    .find((extension) => extension.extensionName === EXTMeshoptCompression.EXTENSION_NAME);
  meshoptExtension?.dispose();

  const quantizationExtension = document.getRoot().listExtensionsUsed()
    .find((extension) => extension.extensionName === KHRMeshQuantization.EXTENSION_NAME);
  quantizationExtension?.dispose();

  const outputBytes = await io.writeBinary(document);
  const outputBuffer = outputBytes.buffer.slice(
    outputBytes.byteOffset,
    outputBytes.byteOffset + outputBytes.byteLength,
  );
  const outputSummary = parseGlbSummary(outputBuffer);
  const removedRequiredExtensions = !outputSummary.extensionsRequired.includes(EXT_MESHOPT_COMPRESSION)
    && !outputSummary.extensionsRequired.includes(KHR_MESH_QUANTIZATION);
  const validGlb = outputSummary.meshCount > 0 && removedRequiredExtensions;

  if (!validGlb) {
    throw new Error('Cleaned Tripo3D GLB validation failed.');
  }

  console.debug('[Meshy Downloader] Tripo3D GLB cleaned', {
    sourceByteLength: sourceBuffer.byteLength,
    outputByteLength: outputBuffer.byteLength,
    sourceSummary,
    outputSummary,
  });

  return {
    buffer: outputBuffer,
    byteLength: outputBuffer.byteLength,
    filename: makeTripoFilename(url),
    validation: {
      validGlb,
      meshCount: outputSummary.meshCount,
      materialCount: outputSummary.materialCount,
      textureCount: outputSummary.textureCount,
      removedRequiredExtensions,
      sourceHadMaterials: sourceSummary.materialCount > 0,
      sourceHadTextures: sourceSummary.textureCount > 0,
      outputHasSourceMaterials: sourceSummary.materialCount === 0 || outputSummary.materialCount > 0,
      outputHasSourceTextures: sourceSummary.textureCount === 0 || outputSummary.textureCount > 0,
    },
  };
}
