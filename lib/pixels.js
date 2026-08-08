import { Platform } from 'react-native';
import { toGrayscale } from './detect.js';

/**
 * Decode an image to grayscale intensities for analysis.
 *
 * Expo exposes no raw-pixel API, so the two platforms take different routes to
 * the same result: the browser has a decoder built in via canvas, while native
 * resizes through expo-image-manipulator and decodes the JPEG in pure JS.
 *
 * Images are downscaled first — detection cost scales with pixel count, and a
 * bullet hole only needs to be a handful of pixels across to be found.
 */

const DEFAULT_MAX_DIM = 900;

export async function loadGrayscale(uri, maxDim = DEFAULT_MAX_DIM) {
  return Platform.OS === 'web'
    ? loadViaCanvas(uri, maxDim)
    : loadViaManipulator(uri, maxDim);
}

function loadViaCanvas(uri, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);

      try {
        const { data } = ctx.getImageData(0, 0, w, h);
        resolve({ gray: toGrayscale(data, w, h), width: w, height: h });
      } catch (e) {
        // Cross-origin images taint the canvas and block getImageData.
        reject(new Error('Could not read image pixels: ' + e.message));
      }
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = uri;
  });
}

async function loadViaManipulator(uri, maxDim) {
  const ImageManipulator = require('expo-image-manipulator');
  const jpeg = require('jpeg-js');

  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: maxDim });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
    compress: 1, // analysis input — compression artifacts would blur holes
  });

  const bytes = base64ToBytes(result.base64);
  const decoded = jpeg.decode(bytes, { useTArray: true });
  return {
    gray: toGrayscale(decoded.data, decoded.width, decoded.height),
    width: decoded.width,
    height: decoded.height,
  };
}

function base64ToBytes(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

/**
 * Maps a point in image pixels into the app's normalized tap space.
 *
 * The photo is rendered with resizeMode="cover", so it is uniformly scaled to
 * fill the display box and the overflow is cropped. Both axes normalize by the
 * box *width* so the space stays isotropic and distances remain comparable.
 */
export function imageToNormalized(px, py, imgW, imgH, boxW, boxH) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const dispW = imgW * scale;
  const dispH = imgH * scale;
  const offX = (dispW - boxW) / 2;
  const offY = (dispH - boxH) / 2;
  return {
    x: (px * scale - offX) / boxW,
    y: (py * scale - offY) / boxW,
  };
}

/**
 * The inverse: a normalized tap back to image pixels.
 *
 * Needed to hand the detector the region the shooter marked. Note both axes
 * denormalize by the box *width*, matching imageToNormalized - using the height
 * for y would look almost right and drift with the aspect ratio.
 */
export function normalizedToImage(nx, ny, imgW, imgH, boxW, boxH) {
  const scale = Math.max(boxW / imgW, boxH / imgH);
  const offX = (imgW * scale - boxW) / 2;
  const offY = (imgH * scale - boxH) / 2;
  return {
    x: (nx * boxW + offX) / scale,
    y: (ny * boxW + offY) / scale,
  };
}

/** Box pixels per image pixel under the same "cover" fit. */
export function coverScale(imgW, imgH, boxW, boxH) {
  return Math.max(boxW / imgW, boxH / imgH);
}
