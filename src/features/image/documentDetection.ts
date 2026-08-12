import type { CropQuad, Point } from '../../domain/types';

export function orderDocumentCorners(points: Point[]): CropQuad {
  const sum = points.map((point) => point.x + point.y);
  const difference = points.map((point) => point.x - point.y);
  return {
    topLeft: points[sum.indexOf(Math.min(...sum))],
    topRight: points[difference.indexOf(Math.max(...difference))],
    bottomRight: points[sum.indexOf(Math.max(...sum))],
    bottomLeft: points[difference.indexOf(Math.min(...difference))],
  };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

function cornerQuality(previous: Point, corner: Point, next: Point): number {
  const first = { x: previous.x - corner.x, y: previous.y - corner.y };
  const second = { x: next.x - corner.x, y: next.y - corner.y };
  const denominator = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (!denominator) return 0;
  return 1 - Math.min(1, Math.abs((first.x * second.x + first.y * second.y) / denominator));
}

export function scoreDocumentQuad(crop: CropQuad): number {
  const points = [crop.topLeft, crop.topRight, crop.bottomRight, crop.bottomLeft];
  if (points.some((point) => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return -Infinity;

  const area = polygonArea(points);
  const sides = points.map((point, index) => distance(point, points[(index + 1) % points.length]));
  if (area < 0.08 || Math.min(...sides) < 0.12) return -Infinity;

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const boundingArea = Math.max(0.001, (maxX - minX) * (maxY - minY));
  const rectangularity = Math.min(1, area / boundingArea);
  const angles = points.reduce((sum, point, index) => (
    sum + cornerQuality(points[(index + 3) % points.length], point, points[(index + 1) % points.length])
  ), 0) / points.length;
  const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const centerQuality = 1 - Math.min(1, Math.hypot(centerX - 0.5, centerY - 0.5) / 0.71);

  return area * 0.68 + rectangularity * 0.17 + angles * 0.1 + centerQuality * 0.05;
}
