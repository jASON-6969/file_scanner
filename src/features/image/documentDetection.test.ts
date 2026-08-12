import { describe, expect, it } from 'vitest';
import { orderDocumentCorners, scoreDocumentQuad } from './documentDetection';

describe('document boundary candidates', () => {
  it('orders unordered points clockwise from the top left', () => {
    expect(orderDocumentCorners([
      { x: 0.9, y: 0.85 },
      { x: 0.12, y: 0.1 },
      { x: 0.08, y: 0.9 },
      { x: 0.88, y: 0.14 },
    ])).toEqual({
      topLeft: { x: 0.12, y: 0.1 },
      topRight: { x: 0.88, y: 0.14 },
      bottomRight: { x: 0.9, y: 0.85 },
      bottomLeft: { x: 0.08, y: 0.9 },
    });
  });

  it('prefers the large document-shaped candidate', () => {
    const document = {
      topLeft: { x: 0.08, y: 0.08 },
      topRight: { x: 0.9, y: 0.1 },
      bottomRight: { x: 0.92, y: 0.91 },
      bottomLeft: { x: 0.07, y: 0.88 },
    };
    const backgroundObject = {
      topLeft: { x: 0.18, y: 0.2 },
      topRight: { x: 0.58, y: 0.22 },
      bottomRight: { x: 0.6, y: 0.53 },
      bottomLeft: { x: 0.2, y: 0.5 },
    };

    expect(scoreDocumentQuad(document)).toBeGreaterThan(scoreDocumentQuad(backgroundObject));
  });

  it('rejects tiny or out-of-bounds candidates', () => {
    expect(scoreDocumentQuad({
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.15, y: 0.1 },
      bottomRight: { x: 0.15, y: 0.15 },
      bottomLeft: { x: 0.1, y: 0.15 },
    })).toBe(-Infinity);
    expect(scoreDocumentQuad({
      topLeft: { x: -0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.1 },
      bottomRight: { x: 0.9, y: 0.9 },
      bottomLeft: { x: 0.1, y: 0.9 },
    })).toBe(-Infinity);
  });
});
