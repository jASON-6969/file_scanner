import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultExportSettings } from '../../domain/defaults';
import { canSharePdf, pageSizePoints, sharePdf } from './pdfExporter';

afterEach(() => vi.unstubAllGlobals());

describe('PDF page sizing', () => {
  it('uses portrait A4 for portrait content', () => {
    const [width, height] = pageSizePoints(createDefaultExportSettings('test'), 1000, 1600);
    expect(width).toBeLessThan(height);
    expect(width).toBeCloseTo(595.28, 1);
  });

  it('automatically rotates Letter for landscape content', () => {
    const settings = { ...createDefaultExportSettings('test'), paperSize: 'letter' as const };
    expect(pageSizePoints(settings, 1600, 1000)).toEqual([792, 612]);
  });

  it('preserves original image aspect ratio', () => {
    const settings = { ...createDefaultExportSettings('test'), paperSize: 'original' as const };
    const [width, height] = pageSizePoints(settings, 2000, 1000);
    expect(width / height).toBeCloseTo(2);
  });
});

describe('PDF file sharing', () => {
  it('shares the generated PDF as a named file', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { canShare, share });

    await sharePdf(new Blob(['pdf'], { type: 'application/pdf' }), 'Official-file');

    expect(share).toHaveBeenCalledOnce();
    const shareData = share.mock.calls[0][0] as ShareData;
    expect(shareData.files).toHaveLength(1);
    expect(shareData.files?.[0].name).toBe('Official-file.pdf');
    expect(shareData.files?.[0].type).toBe('application/pdf');
  });

  it('detects when PDF file sharing is unavailable', () => {
    vi.stubGlobal('navigator', { canShare: vi.fn().mockReturnValue(false), share: vi.fn() });
    expect(canSharePdf()).toBe(false);
  });
});
