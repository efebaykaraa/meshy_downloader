import type {
  Accessor,
  Document,
  GLTF,
  Primitive,
  Transform,
  TypedArray,
} from '@gltf-transform/core';
import { MathUtils } from '@gltf-transform/core';

type DequantizeOptions = {
  pattern?: RegExp;
};

const DEQUANTIZE_DEFAULTS: Required<DequantizeOptions> = {
  pattern: /^((?!JOINTS_).)*$/,
};

function createTransform(name: string, fn: Transform): Transform {
  Object.defineProperty(fn, 'name', { value: name });
  return fn;
}

function dequantizeAttributeArray(
  srcArray: TypedArray,
  componentType: GLTF.AccessorComponentType,
  normalized: boolean,
): Float32Array<ArrayBuffer> {
  const dstArray = new Float32Array(srcArray.length);

  for (let index = 0; index < srcArray.length; index += 1) {
    dstArray[index] = normalized
      ? MathUtils.decodeNormalizedInt(srcArray[index], componentType)
      : srcArray[index];
  }

  return dstArray;
}

function dequantizeAttribute(attribute: Accessor): void {
  const srcArray = attribute.getArray();
  if (!srcArray) return;

  attribute
    .setArray(dequantizeAttributeArray(srcArray, attribute.getComponentType(), attribute.getNormalized()))
    .setNormalized(false);
}

function dequantizePrimitive(primitive: Primitive, options: Required<DequantizeOptions>): void {
  for (const semantic of primitive.listSemantics()) {
    if (options.pattern.test(semantic)) {
      dequantizeAttribute(primitive.getAttribute(semantic)!);
    }
  }

  for (const target of primitive.listTargets()) {
    for (const semantic of target.listSemantics()) {
      if (options.pattern.test(semantic)) {
        dequantizeAttribute(target.getAttribute(semantic)!);
      }
    }
  }
}

export function dequantize(options: DequantizeOptions = DEQUANTIZE_DEFAULTS): Transform {
  const resolvedOptions: Required<DequantizeOptions> = {
    pattern: options.pattern ?? DEQUANTIZE_DEFAULTS.pattern,
  };

  return createTransform('dequantize', (document: Document): void => {
    for (const mesh of document.getRoot().listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        dequantizePrimitive(primitive, resolvedOptions);
      }
    }

    document.disposeExtension('KHR_mesh_quantization');
  });
}
