import { describe, expect, it } from 'vitest';
import { createDefaultExportSettings, createDefaultRecipe, sanitizeFileName } from './defaults';

describe('document defaults', () => {
  it('uses professional A4 export settings', () => {
    expect(createDefaultExportSettings('Official file')).toEqual({
      paperSize: 'a4',
      marginMm: 5,
      quality: 'professional',
      fileName: 'Official-file',
    });
  });

  it('starts with a non-destructive auto-clean recipe', () => {
    const recipe = createDefaultRecipe();
    expect(recipe.preset).toBe('auto');
    expect(recipe.crop.bottomRight).toEqual({ x: 1, y: 1 });
    expect(recipe.rotation).toBe(0);
    expect(recipe.intensity).toBe(86);
    expect(recipe.contrast).toBe(14);
    expect(recipe.sharpen).toBe(32);
  });

  it('removes unsafe filename characters', () => {
    expect(sanitizeFileName('  report: Q3 / final?.pdf  ')).toBe('report-Q3-final.pdf');
  });
});
