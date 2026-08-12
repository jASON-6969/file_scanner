import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../storage/database';
import { importCameraBlobs } from './fileImporter';

vi.mock('heic2any', () => ({ default: vi.fn() }));

vi.mock('../image/imageProcessor', () => ({
  detectDocumentCorners: vi.fn().mockResolvedValue({
    topLeft: { x: 0, y: 0 }, topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 }, bottomLeft: { x: 0, y: 1 },
  }),
}));

beforeEach(async () => {
  await db.transaction('rw', db.projects, db.pages, db.blobs, async () => {
    await db.projects.clear();
    await db.pages.clear();
    await db.blobs.clear();
  });
});

describe('camera import', () => {
  it('cleans sources created before a later capture fails', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn()
      .mockResolvedValueOnce({ width: 100, height: 200, close })
      .mockRejectedValueOnce(new Error('Invalid image')));

    await expect(importCameraBlobs('project', [new Blob(['one']), new Blob(['two'])], 0)).rejects.toThrow('Invalid image');
    expect(await db.blobs.count()).toBe(0);
    expect(close).toHaveBeenCalledOnce();
  });
});
