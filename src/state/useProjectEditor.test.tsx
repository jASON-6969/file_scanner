import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultRecipe, createProject } from '../domain/defaults';
import type { PageRecord } from '../domain/types';
import { db, getSource, saveProject, storeSource } from '../storage/database';
import { useProjectEditor } from './useProjectEditor';

beforeEach(async () => {
  await db.transaction('rw', db.projects, db.pages, db.blobs, async () => {
    await db.projects.clear();
    await db.pages.clear();
    await db.blobs.clear();
  });
});

describe('project editor history', () => {
  it('keeps a deleted page source available when undo runs after autosave', async () => {
    const project = createProject('Undo page');
    const sourceBlobId = await storeSource(new Blob(['image'], { type: 'image/jpeg' }));
    const page: PageRecord = {
      id: crypto.randomUUID(), projectId: project.id, sourceBlobId, sourceKind: 'image', sourceName: 'page.jpg',
      order: 0, width: 100, height: 200, recipe: createDefaultRecipe(), createdAt: 1,
    };
    await saveProject({ project, pages: [page] });

    const { result } = renderHook(() => useProjectEditor(project.id));
    await waitFor(() => expect(result.current.editor).not.toBeNull());

    act(() => result.current.editor?.removeSelected());
    await waitFor(() => expect(result.current.editor?.saveState).toBe('saved'), { timeout: 2000 });
    await expect(getSource(sourceBlobId)).resolves.toBeDefined();

    act(() => result.current.editor?.undo());
    expect(result.current.editor?.pages).toHaveLength(1);
    await expect(getSource(sourceBlobId)).resolves.toBeDefined();
  });
});
