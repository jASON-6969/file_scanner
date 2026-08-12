import heic2any from 'heic2any';
import * as pdfjs from 'pdfjs-dist';
import { createDefaultRecipe } from '../../domain/defaults';
import type { PageRecord, SourceKind } from '../../domain/types';
import { deleteUnreferencedSources, storeSource } from '../../storage/database';
import { detectDocumentCorners } from '../image/imageProcessor';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export interface ImportProgress {
  current: number;
  total: number;
  label: string;
}

export type ImportProgressHandler = (progress: ImportProgress) => void;

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The page could not be converted to an image.'))), type, quality);
  });
}

async function normalizeImage(blob: Blob, sourceName: string): Promise<Blob> {
  if (blob.type === 'image/heic' || blob.type === 'image/heif' || /\.hei[cf]$/i.test(sourceName)) {
    const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.95 });
    return Array.isArray(converted) ? converted[0] : converted;
  }
  return blob;
}

async function createPage(
  projectId: string,
  blob: Blob,
  sourceName: string,
  sourceKind: SourceKind,
  order: number,
  pdfPageNumber?: number,
): Promise<PageRecord> {
  const normalized = await normalizeImage(blob, sourceName);
  const bitmap = await createImageBitmap(normalized);
  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close();
  const recipe = createDefaultRecipe();
  try {
    recipe.crop = await detectDocumentCorners(normalized);
  } catch {
    // A full-page crop is already present when detection is unavailable.
  }
  const sourceBlobId = await storeSource(normalized);
  return {
    id: crypto.randomUUID(),
    projectId,
    sourceBlobId,
    sourceKind,
    sourceName,
    pdfPageNumber,
    order,
    width,
    height,
    recipe,
    createdAt: Date.now(),
  };
}

async function importPdf(
  projectId: string,
  file: File,
  startOrder: number,
  onProgress?: ImportProgressHandler,
): Promise<PageRecord[]> {
  const data = await file.arrayBuffer();
  let pdfDocument: pdfjs.PDFDocumentProxy;
  try {
    pdfDocument = await pdfjs.getDocument({ data }).promise;
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') throw new Error('Password-protected PDFs are not supported yet.');
    throw new Error(`Could not open ${file.name}. The PDF may be damaged or unsupported.`);
  }

  const pages: PageRecord[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      onProgress?.({ current: pageNumber, total: pdfDocument.numPages, label: `Rendering page ${pageNumber}` });
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(300 / 72, 4200 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas rendering is unavailable in this browser.');
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await canvasToBlob(canvas);
      pages.push(await createPage(projectId, blob, file.name, 'pdf', startOrder + pages.length, pageNumber));
      page.cleanup();
    }
  } catch (error) {
    await deleteUnreferencedSources(pages.map((page) => page.sourceBlobId));
    throw error;
  } finally {
    await pdfDocument.destroy();
  }
  return pages;
}

export async function importFiles(
  projectId: string,
  files: File[],
  startOrder: number,
  onProgress?: ImportProgressHandler,
): Promise<PageRecord[]> {
  const result: PageRecord[] = [];
  try {
    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      onProgress?.({ current: fileIndex + 1, total: files.length, label: `Importing ${file.name}` });
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const pages = await importPdf(projectId, file, startOrder + result.length, onProgress);
        result.push(...pages);
      } else if (IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp|hei[cf])$/i.test(file.name)) {
        result.push(await createPage(projectId, file, file.name, 'image', startOrder + result.length));
      } else if (/\.(docx?|pptx?)$/i.test(file.name)) {
        throw new Error('Word and PowerPoint conversion is planned for a later release. Export the file as PDF first.');
      } else {
        throw new Error(`${file.name} is not a supported image or PDF.`);
      }
    }
  } catch (error) {
    await deleteUnreferencedSources(result.map((page) => page.sourceBlobId));
    throw error;
  }
  return result;
}

export async function importCameraBlob(projectId: string, blob: Blob, order: number): Promise<PageRecord> {
  return createPage(projectId, blob, `Scan ${order + 1}`, 'camera', order);
}

export async function importCameraBlobs(
  projectId: string,
  blobs: Blob[],
  startOrder: number,
  onProgress?: ImportProgressHandler,
): Promise<PageRecord[]> {
  const pages: PageRecord[] = [];
  try {
    for (let index = 0; index < blobs.length; index += 1) {
      onProgress?.({ current: index + 1, total: blobs.length, label: `Cleaning capture ${index + 1}` });
      pages.push(await importCameraBlob(projectId, blobs[index], startOrder + index));
    }
  } catch (error) {
    await deleteUnreferencedSources(pages.map((page) => page.sourceBlobId));
    throw error;
  }
  return pages;
}
