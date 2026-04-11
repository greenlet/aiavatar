/**
 * Convert FBX files to GLB using Three.js (Node.js).
 * Usage: node convert_fbx_to_glb.mjs [input.fbx] [output.glb]
 *
 * If no arguments given, runs all conversions listed below.
 */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Node.js polyfills for Three.js browser APIs ──────────────────────
if (typeof document === 'undefined') {
  const noop = () => {};
  const emptyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWNgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC4xMkMEa+wAAAANSURBVBhXY2BgYPgPAAEEAQBbSMJWAAAAAElFTkSuQmCC',
    'base64',
  );
  globalThis.document = {
    createElementNS(_ns, tag) {
      if (tag === 'canvas') {
        return {
          width: 1, height: 1, style: {},
          getContext() {
            return {
              fillStyle: '', fillRect: noop, drawImage: noop,
              getImageData: () => ({ data: new Uint8Array(4) }),
              putImageData: noop, createImageData: () => ({ data: new Uint8Array(4) }),
            };
          },
          toDataURL() { return 'data:image/png;base64,'; },
          toBlob(cb, _mime) { cb(new Blob([emptyPng], { type: 'image/png' })); },
          addEventListener: noop,
        };
      }
      if (tag === 'img') {
        return { set src(_v) {}, style: {}, addEventListener: noop, removeEventListener: noop };
      }
      return {};
    },
    createElement(tag) { return this.createElementNS(null, tag); },
  };
}
if (typeof window === 'undefined') {
  globalThis.window = globalThis;
}
if (typeof self === 'undefined') {
  globalThis.self = globalThis;
}
if (typeof HTMLCanvasElement === 'undefined') {
  globalThis.HTMLCanvasElement = class HTMLCanvasElement {};
}
if (typeof OffscreenCanvas === 'undefined') {
  globalThis.OffscreenCanvas = class OffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { return document.createElementNS(null, 'canvas').getContext(); }
  };
}
if (typeof FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onloadend) this.onloadend({ target: this });
        if (this.onload) this.onload({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
        if (this.onloadend) this.onloadend({ target: this });
        if (this.onload) this.onload({ target: this });
      });
    }
  };
}

// ── Helpers ───────────────────────────────────────────────────────────
const TEX_PROPS = [
  'map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap',
  'aoMap', 'alphaMap', 'bumpMap', 'displacementMap', 'envMap',
  'lightMap', 'specularMap',
];

function stripTextures(object) {
  object.traverse((node) => {
    if (!node.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      for (const prop of TEX_PROPS) {
        if (mat[prop]) mat[prop] = null;
      }
    }
  });
}

// ── Conversion logic ─────────────────────────────────────────────────
async function convertFbxToGlb(inputPath, outputPath) {
  const buf = fs.readFileSync(inputPath);
  const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  const loader = new FBXLoader();
  const group = loader.parse(arrayBuf, path.dirname(inputPath) + '/');

  // Strip textures — can't decode images in Node.js without native deps
  stripTextures(group);

  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(group, { binary: true, animations: group.animations });

  fs.writeFileSync(outputPath, Buffer.from(glb));
  const size = fs.statSync(outputPath).size;
  console.log(`  ✓ ${outputPath} (${(size / 1024).toFixed(0)} KB)`);
}

// ── Default conversion list ──────────────────────────────────────────
const conversions = [
  ['models/v05/Ch31_nonPBR.fbx', 'models/v05/model.glb'],
];

// ── CLI ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length === 2) {
  // Single conversion: node convert_fbx_to_glb.mjs input.fbx output.glb
  await convertFbxToGlb(args[0], args[1]);
} else if (args.length === 0) {
  // Batch: run all conversions
  for (const [inp, out] of conversions) {
    const inputPath = path.join(__dirname, inp);
    const outputPath = path.join(__dirname, out);
    if (!fs.existsSync(inputPath)) {
      console.log(`  SKIP (not found): ${inp}`);
      continue;
    }
    console.log(`Converting: ${inp}`);
    await convertFbxToGlb(inputPath, outputPath);
  }
  console.log('\nAll conversions complete.');
} else {
  console.error('Usage: node convert_fbx_to_glb.mjs [input.fbx output.glb]');
  process.exit(1);
}
