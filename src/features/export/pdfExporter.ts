import { PDFDocument, PageSizes } from 'pdf-lib';
import type { ExportSettings, PageRecord } from '../../domain/types';
import { getSource } from '../../storage/database';
import { processImage } from '../image/imageProcessor';

const DPI = { small: 150, standard: 200, professional: 300 } as const;
const JPEG_QUALITY = { small: 0.72, standard: 0.84, professional: 0.92 } as const;

export interface ExportProgress {
  current: number;
  total: number;
  label: string;
}

export function pageSizePoints(settings: ExportSettings, imageWidth: number, imageHeight: number): [number, number] {
  if (settings.paperSize === 'original') {
    const longest = 842;
    const ratio = imageWidth / imageHeight;
    return ratio >= 1 ? [longest, longest / ratio] : [longest * ratio, longest];
  }
  const base = settings.paperSize === 'letter' ? PageSizes.Letter : PageSizes.A4;
  return imageWidth > imageHeight ? [base[1], base[0]] : [base[0], base[1]];
}

export async function exportPdf(
  pages: PageRecord[],
  settings: ExportSettings,
  signal: AbortSignal,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  if (!pages.length) throw new Error('Add at least one page before exporting.');
  const pdf = await PDFDocument.create();
  pdf.setTitle(settings.fileName);
  pdf.setCreator('Clearfile');
  pdf.setProducer('Clearfile on-device document scanner');
  pdf.setCreationDate(new Date());
  const dpi = DPI[settings.quality];

  for (let index = 0; index < pages.length; index += 1) {
    if (signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
    onProgress?.({ current: index + 1, total: pages.length, label: `Preparing page ${index + 1}` });
    const source = await getSource(pages[index].sourceBlobId);
    const expectedMaxDimension = Math.round((11.7 * dpi));
    const isBlackWhite = pages[index].recipe.preset === 'black-white';
    const processed = await processImage(source, pages[index].recipe, {
      maxDimension: expectedMaxDimension,
      format: isBlackWhite ? 'image/png' : 'image/jpeg',
      quality: JPEG_QUALITY[settings.quality],
    });
    const embedded = isBlackWhite
      ? await pdf.embedPng(await processed.blob.arrayBuffer())
      : await pdf.embedJpg(await processed.blob.arrayBuffer());
    const [pageWidth, pageHeight] = pageSizePoints(settings, processed.width, processed.height);
    const pdfPage = pdf.addPage([pageWidth, pageHeight]);
    const margin = (settings.marginMm / 25.4) * 72;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;
    const scale = Math.min(availableWidth / processed.width, availableHeight / processed.height);
    const drawWidth = processed.width * scale;
    const drawHeight = processed.height * scale;
    pdfPage.drawImage(embedded, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }

  onProgress?.({ current: pages.length, total: pages.length, label: 'Finishing PDF' });
  const bytes = await pdf.save({ useObjectStreams: true });
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
}

export function downloadPdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${fileName || 'document'}.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
