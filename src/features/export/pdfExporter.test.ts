import { describe, expect, it } from 'vitest';
import { createDefaultExportSettings } from '../../domain/defaults';
import { pageSizePoints } from './pdfExporter';

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
