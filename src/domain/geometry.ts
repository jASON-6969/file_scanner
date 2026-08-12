import type { CropQuad, Point } from './types';

function distance(a: Point, b: Point, width: number, height: number): number {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
}

export function cropDimensions(crop: CropQuad, width: number, height: number, maxDimension: number) {
  const cropWidth = Math.max(
    distance(crop.topLeft, crop.topRight, width, height),
    distance(crop.bottomLeft, crop.bottomRight, width, height),
  );
  const cropHeight = Math.max(
    distance(crop.topLeft, crop.bottomLeft, width, height),
    distance(crop.topRight, crop.bottomRight, width, height),
  );
  const scale = Math.min(1, maxDimension / Math.max(cropWidth, cropHeight));
  return {
    width: Math.max(1, Math.round(cropWidth * scale)),
    height: Math.max(1, Math.round(cropHeight * scale)),
  };
}
