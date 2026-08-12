import type { CropQuad, EditRecipe, ExportSettings, ProjectRecord } from './types';

export const FULL_CROP: CropQuad = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomRight: { x: 1, y: 1 },
  bottomLeft: { x: 0, y: 1 },
};

export function createDefaultRecipe(): EditRecipe {
  return {
    rotation: 0,
    straighten: 0,
    crop: structuredClone(FULL_CROP),
    preset: 'auto',
    intensity: 86,
    brightness: 2,
    contrast: 14,
    sharpen: 32,
  };
}

export function createDefaultExportSettings(name: string): ExportSettings {
  return {
    paperSize: 'a4',
    marginMm: 5,
    quality: 'professional',
    fileName: sanitizeFileName(name),
  };
}

export function createProject(name = 'Untitled scan'): ProjectRecord {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    exportSettings: createDefaultExportSettings(name),
  };
}

export function sanitizeFileName(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim();
  return (cleaned || 'document').replace(/\s+/g, '-').slice(0, 80);
}
