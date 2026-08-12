/// <reference lib="webworker" />

import cvReady from '@techstark/opencv-js';
import { FULL_CROP } from '../../domain/defaults';
import { cropDimensions } from '../../domain/geometry';
import type { CropQuad, EditRecipe, Point } from '../../domain/types';
import { orderDocumentCorners, scoreDocumentQuad } from './documentDetection';

interface RenderRequest {
  id: number;
  action: 'render';
  blob: Blob;
  recipe: EditRecipe;
  maxDimension: number;
  format: 'image/jpeg' | 'image/png';
  quality: number;
}

interface DetectRequest {
  id: number;
  action: 'detect';
  blob: Blob;
}

interface RenderResponse {
  id: number;
  action: 'render';
  blob?: Blob;
  width?: number;
  height?: number;
  error?: string;
}

interface DetectResponse {
  id: number;
  action: 'detect';
  crop?: CropQuad;
  error?: string;
}

const worker = self as unknown as DedicatedWorkerGlobalScope;

async function detectDocumentCorners(blob: Blob): Promise<CropQuad> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return structuredClone(FULL_CROP);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const cv = await cvReady;
  const source = cv.matFromImageData(context.getImageData(0, 0, width, height));
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const candidates: Array<{ crop: CropQuad; score: number }> = [];

  const collectCandidates = (binary: InstanceType<typeof cv.Mat>) => {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    try {
      cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      for (let index = 0; index < contours.size(); index += 1) {
        const contour = contours.get(index);
        const perimeter = cv.arcLength(contour, true);
        try {
          for (const epsilon of [0.015, 0.02, 0.03, 0.04]) {
            const polygon = new cv.Mat();
            try {
              cv.approxPolyDP(contour, polygon, perimeter * epsilon, true);
              if (polygon.rows !== 4 || !cv.isContourConvex(polygon)) continue;
              const crop = orderDocumentCorners(Array.from({ length: 4 }, (_, pointIndex): Point => ({
                x: polygon.data32S[pointIndex * 2] / width,
                y: polygon.data32S[pointIndex * 2 + 1] / height,
              })));
              const score = scoreDocumentQuad(crop);
              if (Number.isFinite(score)) candidates.push({ crop, score });
              break;
            } finally {
              polygon.delete();
            }
          }
        } finally {
          contour.delete();
        }
      }
    } finally {
      contours.delete();
      hierarchy.delete();
    }
  };

  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    for (const [low, high] of [[35, 105], [60, 180], [90, 240]]) {
      const edges = new cv.Mat();
      const closed = new cv.Mat();
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      try {
        cv.Canny(blurred, edges, low, high);
        cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
        collectCandidates(closed);
      } finally {
        edges.delete();
        closed.delete();
        kernel.delete();
      }
    }

    const threshold = new cv.Mat();
    try {
      cv.adaptiveThreshold(blurred, threshold, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 7);
      collectCandidates(threshold);
    } finally {
      threshold.delete();
    }
  } finally {
    source.delete();
    gray.delete();
    blurred.delete();
  }
  return candidates.sort((first, second) => second.score - first.score)[0]?.crop ?? structuredClone(FULL_CROP);
}

async function perspectiveCrop(imageData: ImageData, crop: CropQuad, maxDimension: number): Promise<ImageData> {
  const cv = await cvReady;
  const source = cv.matFromImageData(imageData);
  const dimensions = cropDimensions(crop, imageData.width, imageData.height, maxDimension);
  const destination = new cv.Mat();
  const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    crop.topLeft.x * imageData.width, crop.topLeft.y * imageData.height,
    crop.topRight.x * imageData.width, crop.topRight.y * imageData.height,
    crop.bottomRight.x * imageData.width, crop.bottomRight.y * imageData.height,
    crop.bottomLeft.x * imageData.width, crop.bottomLeft.y * imageData.height,
  ]);
  const destinationPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    dimensions.width - 1, 0,
    dimensions.width - 1, dimensions.height - 1,
    0, dimensions.height - 1,
  ]);
  const transform = cv.getPerspectiveTransform(sourcePoints, destinationPoints);

  try {
    cv.warpPerspective(
      source,
      destination,
      transform,
      new cv.Size(dimensions.width, dimensions.height),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255),
    );
    return new ImageData(new Uint8ClampedArray(destination.data), destination.cols, destination.rows);
  } finally {
    source.delete();
    destination.delete();
    sourcePoints.delete();
    destinationPoints.delete();
    transform.delete();
  }
}

function rotateImage(image: ImageData, degrees: number): ImageData {
  if (degrees === 0) return image;
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = Math.ceil(image.width * cos + image.height * sin);
  const height = Math.ceil(image.width * sin + image.height * cos);
  const source = new OffscreenCanvas(image.width, image.height);
  source.getContext('2d')?.putImageData(image, 0, 0);
  const output = new OffscreenCanvas(width, height);
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!context) return image;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.translate(width / 2, height / 2);
  context.rotate(radians);
  context.drawImage(source, -image.width / 2, -image.height / 2);
  return context.getImageData(0, 0, width, height);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

async function applyFilter(imageData: ImageData, recipe: EditRecipe): Promise<ImageData> {
  const data = imageData.data;
  const amount = recipe.intensity / 100;
  const contrast = (259 * (recipe.contrast * 1.2 + 255)) / (255 * (259 - recipe.contrast * 1.2));
  const brightness = recipe.brightness * 1.8;

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index];
    let green = data[index + 1];
    let blue = data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    if (recipe.preset === 'color') {
      red = luminance + (red - luminance) * 1.16;
      green = luminance + (green - luminance) * 1.12;
      blue = luminance + (blue - luminance) * 1.12;
    } else if (recipe.preset === 'grayscale') {
      red = green = blue = luminance;
    }

    const presetContrast = recipe.preset === 'grayscale' ? 1.1 : 1;
    red = (red - 128) * presetContrast + 128;
    green = (green - 128) * presetContrast + 128;
    blue = (blue - 128) * presetContrast + 128;
    red = contrast * (red - 128) + 128 + brightness;
    green = contrast * (green - 128) + 128 + brightness;
    blue = contrast * (blue - 128) + 128 + brightness;

    data[index] = clamp(data[index] * (1 - amount) + red * amount);
    data[index + 1] = clamp(data[index + 1] * (1 - amount) + green * amount);
    data[index + 2] = clamp(data[index + 2] * (1 - amount) + blue * amount);
  }

  const cv = await cvReady;
  let current = cv.matFromImageData(imageData);
  try {
    if (recipe.preset === 'auto') {
      const gray = new cv.Mat();
      const background = new cv.Mat();
      const normalized = new cv.Mat();
      const enhanced = new cv.Mat();
      const cleanRgba = new cv.Mat();
      const blended = new cv.Mat();
      const sigma = Math.max(12, Math.min(42, Math.max(current.cols, current.rows) / 55));
      cv.cvtColor(current, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, background, new cv.Size(0, 0), sigma, sigma, cv.BORDER_REPLICATE);
      cv.divide(gray, background, normalized, 245);
      cv.equalizeHist(normalized, enhanced);
      cv.cvtColor(enhanced, cleanRgba, cv.COLOR_GRAY2RGBA);
      cv.addWeighted(current, 1 - amount, cleanRgba, amount, 0, blended);
      current.delete();
      current = blended;
      gray.delete();
      background.delete();
      normalized.delete();
      enhanced.delete();
      cleanRgba.delete();
    } else if (recipe.preset === 'black-white') {
      const gray = new cv.Mat();
      const binary = new cv.Mat();
      const rgba = new cv.Mat();
      cv.cvtColor(current, gray, cv.COLOR_RGBA2GRAY);
      cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 12);
      cv.cvtColor(binary, rgba, cv.COLOR_GRAY2RGBA);
      current.delete();
      current = rgba;
      gray.delete();
      binary.delete();
    }

    if (recipe.sharpen > 0) {
      const blurred = new cv.Mat();
      const sharpened = new cv.Mat();
      cv.GaussianBlur(current, blurred, new cv.Size(0, 0), 1.4);
      const strength = Math.min(1.5, recipe.sharpen / 55);
      cv.addWeighted(current, 1 + strength, blurred, -strength, 0, sharpened);
      current.delete();
      current = sharpened;
      blurred.delete();
    }
    return new ImageData(new Uint8ClampedArray(current.data), current.cols, current.rows);
  } finally {
    current.delete();
  }
}

async function render(request: RenderRequest): Promise<RenderResponse> {
  try {
    const bitmap = await createImageBitmap(request.blob);
    const sourceScale = Math.min(1, Math.max(request.maxDimension, 640) / Math.max(bitmap.width, bitmap.height));
    const sourceWidth = Math.max(1, Math.round(bitmap.width * sourceScale));
    const sourceHeight = Math.max(1, Math.round(bitmap.height * sourceScale));
    const sourceCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) throw new Error('Canvas processing is unavailable in this browser.');
    sourceContext.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);
    bitmap.close();

    const cropped = await perspectiveCrop(
      sourceContext.getImageData(0, 0, sourceWidth, sourceHeight),
      request.recipe.crop,
      request.maxDimension,
    );
    const rotated = rotateImage(cropped, request.recipe.rotation + request.recipe.straighten);
    const filtered = await applyFilter(rotated, request.recipe);
    const output = new OffscreenCanvas(filtered.width, filtered.height);
    output.getContext('2d')?.putImageData(filtered, 0, 0);
    const blob = await output.convertToBlob({ type: request.format, quality: request.quality });
    return { id: request.id, action: 'render', blob, width: filtered.width, height: filtered.height };
  } catch (error) {
    return { id: request.id, action: 'render', error: error instanceof Error ? error.message : 'Image processing failed.' };
  }
}

worker.onmessage = async (event: MessageEvent<RenderRequest | DetectRequest>) => {
  if (event.data.action === 'detect') {
    try {
      const crop = await detectDocumentCorners(event.data.blob);
      worker.postMessage({ id: event.data.id, action: 'detect', crop } satisfies DetectResponse);
    } catch (error) {
      worker.postMessage({
        id: event.data.id,
        action: 'detect',
        error: error instanceof Error ? error.message : 'Document detection failed.',
      } satisfies DetectResponse);
    }
    return;
  }
  worker.postMessage(await render(event.data));
};

export {};
