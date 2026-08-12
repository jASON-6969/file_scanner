import type { CropQuad, EditRecipe } from '../../domain/types';

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

interface WorkerResponse extends Partial<ProcessedImage> {
  id: number;
  action: 'render';
  error?: string;
}

interface DetectResponse {
  id: number;
  action: 'detect';
  crop?: CropQuad;
  error?: string;
}

let worker: Worker | null = null;
let sequence = 0;
const pending = new Map<number, { resolve: (value: ProcessedImage) => void; reject: (reason: Error) => void }>();
const pendingDetection = new Map<number, { resolve: (value: CropQuad) => void; reject: (reason: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse | DetectResponse>) => {
    if (event.data.action === 'detect') {
      const job = pendingDetection.get(event.data.id);
      if (!job) return;
      pendingDetection.delete(event.data.id);
      if (event.data.error || !event.data.crop) job.reject(new Error(event.data.error ?? 'Document detection returned an invalid result.'));
      else job.resolve(event.data.crop);
      return;
    }
    const job = pending.get(event.data.id);
    if (!job) return;
    pending.delete(event.data.id);
    if (event.data.error || !event.data.blob || !event.data.width || !event.data.height) {
      job.reject(new Error(event.data.error ?? 'Image processing returned an invalid result.'));
      return;
    }
    job.resolve({ blob: event.data.blob, width: event.data.width, height: event.data.height });
  };
  worker.onerror = () => {
    for (const job of pending.values()) job.reject(new Error('The image worker stopped unexpectedly.'));
    for (const job of pendingDetection.values()) job.reject(new Error('The image worker stopped unexpectedly.'));
    pending.clear();
    pendingDetection.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function processImage(
  blob: Blob,
  recipe: EditRecipe,
  options: { maxDimension: number; format?: 'image/jpeg' | 'image/png'; quality?: number },
): Promise<ProcessedImage> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({
      id,
      action: 'render',
      blob,
      recipe,
      maxDimension: options.maxDimension,
      format: options.format ?? 'image/jpeg',
      quality: options.quality ?? 0.9,
    });
  });
}

export function detectDocumentCorners(blob: Blob): Promise<CropQuad> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pendingDetection.set(id, { resolve, reject });
    getWorker().postMessage({ id, action: 'detect', blob });
  });
}
