import { WebIO } from '@gltf-transform/core';
import {
  ALL_EXTENSIONS,
  EXTTextureAVIF,
  EXTTextureWebP,
  KHRTextureBasisu,
} from '@gltf-transform/extensions';
import type { TextureFormat } from './types';

const TARGET_MIME_TYPES: Record<Exclude<TextureFormat, 'default'>, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
};

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== mimeType) {
          reject(new Error(`Browser could not encode ${mimeType}.`));
          return;
        }
        resolve(blob);
      },
      mimeType,
      mimeType === 'image/png' ? undefined : 0.92,
    );
  });
}

async function transcodeImage(
  image: Uint8Array<ArrayBuffer>,
  sourceMimeType: string,
  targetMimeType: string,
) {
  if (sourceMimeType === targetMimeType) return image;

  const imageUrl = URL.createObjectURL(new Blob([image], { type: sourceMimeType }));
  const imageElement = new Image();

  try {
    imageElement.src = imageUrl;
    await imageElement.decode();

    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser could not create a texture conversion canvas.');

    if (targetMimeType === 'image/jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(imageElement, 0, 0);
    const blob = await canvasToBlob(canvas, targetMimeType);
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

/**
 * Re-encodes every embedded GLB texture with browser image codecs, then uses
 * glTF-Transform to replace texture payloads and update format extensions.
 */
export async function formatGlbTextures(buffer: ArrayBuffer, format: TextureFormat) {
  if (format === 'default') return buffer;

  const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.readBinary(new Uint8Array(buffer));
  const targetMimeType = TARGET_MIME_TYPES[format];
  let convertedTextureCount = 0;

  for (const texture of document.getRoot().listTextures()) {
    const image = texture.getImage();
    if (!image) continue;

    const convertedImage = await transcodeImage(image, texture.getMimeType(), targetMimeType);
    texture
      .setImage(convertedImage)
      .setMimeType(targetMimeType)
      .setURI('');
    convertedTextureCount += 1;
  }

  if (convertedTextureCount === 0) return buffer;

  document.disposeExtension(EXTTextureAVIF.EXTENSION_NAME);
  document.disposeExtension(KHRTextureBasisu.EXTENSION_NAME);

  if (format === 'webp') {
    const webpExtension = document.getRoot().listExtensionsUsed()
      .find((extension) => extension.extensionName === EXTTextureWebP.EXTENSION_NAME)
      ?? document.createExtension(EXTTextureWebP);
    webpExtension.setRequired(true);
  } else {
    document.disposeExtension(EXTTextureWebP.EXTENSION_NAME);
  }

  const output = await io.writeBinary(document);
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}
