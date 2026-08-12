export type FilterPreset = 'original' | 'auto' | 'color' | 'grayscale' | 'black-white';
export type PaperSize = 'a4' | 'letter' | 'original';
export type ExportQuality = 'small' | 'standard' | 'professional';
export type SourceKind = 'camera' | 'image' | 'pdf';

export interface Point {
  x: number;
  y: number;
}

export interface CropQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export interface EditRecipe {
  rotation: 0 | 90 | 180 | 270;
  straighten: number;
  crop: CropQuad;
  preset: FilterPreset;
  intensity: number;
  brightness: number;
  contrast: number;
  sharpen: number;
}

export interface PageRecord {
  id: string;
  projectId: string;
  sourceBlobId: string;
  sourceKind: SourceKind;
  sourceName: string;
  pdfPageNumber?: number;
  order: number;
  width: number;
  height: number;
  recipe: EditRecipe;
  createdAt: number;
}

export interface SourceBlobRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
}

export interface ExportSettings {
  paperSize: PaperSize;
  marginMm: 0 | 5 | 10;
  quality: ExportQuality;
  fileName: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  exportSettings: ExportSettings;
}

export interface ProjectBundle {
  project: ProjectRecord;
  pages: PageRecord[];
}

export type PersistedAction =
  | { type: 'update-pages'; before: PageRecord[]; after: PageRecord[] }
  | { type: 'update-settings'; before: ExportSettings; after: ExportSettings };
