import { describe, expect, it } from 'vitest';
import { createDefaultRecipe } from './defaults';
import { reorderPages, rotateClockwise, updateSelectedPages } from './pageOperations';
import type { PageRecord } from './types';

function page(id: string, order: number): PageRecord {
  return {
    id,
    projectId: 'project',
    sourceBlobId: `blob-${id}`,
    sourceKind: 'image',
    sourceName: `${id}.jpg`,
    order,
    width: 100,
    height: 200,
    recipe: createDefaultRecipe(),
    createdAt: 1,
  };
}

describe('page operations', () => {
  it('reorders pages and normalizes every order value', () => {
    const result = reorderPages([page('a', 0), page('b', 1), page('c', 2)], 'c', 'a');
    expect(result.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(result.map((item) => item.order)).toEqual([0, 1, 2]);
  });

  it('updates only selected pages', () => {
    const result = updateSelectedPages([page('a', 0), page('b', 1)], new Set(['b']), (recipe) => ({ ...recipe, brightness: 20 }));
    expect(result[0].recipe.brightness).toBe(2);
    expect(result[1].recipe.brightness).toBe(20);
  });

  it('rotates through the four supported orientations', () => {
    expect([0, 90, 180, 270].map((value) => rotateClockwise(value as 0 | 90 | 180 | 270))).toEqual([90, 180, 270, 0]);
  });
});
