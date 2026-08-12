import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultRecipe, createProject } from '../domain/defaults';
import type { PageRecord } from '../domain/types';
import { db, deleteProject, duplicateProject, getSource, listProjects, loadProject, saveProject, storeSource } from './database';

beforeEach(async () => {
  await db.transaction('rw', db.projects, db.pages, db.blobs, async () => {
    await db.projects.clear();
    await db.pages.clear();
    await db.blobs.clear();
  });
});

describe('local project storage', () => {
  it('saves pages in their normalized order and reloads them', async () => {
    const project = createProject('Test project');
    const sourceBlobId = await storeSource(new Blob(['image'], { type: 'image/jpeg' }));
    const page = (id: string, order: number): PageRecord => ({
      id,
      projectId: project.id,
      sourceBlobId,
      sourceKind: 'image',
      sourceName: `${id}.jpg`,
      order,
      width: 100,
      height: 200,
      recipe: createDefaultRecipe(),
      createdAt: 1,
    });
    await saveProject({ project, pages: [page('second', 8), page('first', 4)] });
    const loaded = await loadProject(project.id);
    expect(loaded?.pages.map((item) => [item.id, item.order])).toEqual([['second', 0], ['first', 1]]);
    expect(await listProjects()).toHaveLength(1);
  });

  it('keeps shared blobs until the final duplicated project is deleted', async () => {
    const project = createProject('Shared source');
    const sourceBlobId = await storeSource(new Blob(['image'], { type: 'image/jpeg' }));
    await saveProject({
      project,
      pages: [{
        id: crypto.randomUUID(), projectId: project.id, sourceBlobId, sourceKind: 'image', sourceName: 'page.jpg',
        order: 0, width: 100, height: 200, recipe: createDefaultRecipe(), createdAt: 1,
      }],
    });
    const copy = await duplicateProject(project.id);
    await deleteProject(project.id);
    await expect(getSource(sourceBlobId)).resolves.toBeDefined();
    await deleteProject(copy.id);
    await expect(getSource(sourceBlobId)).rejects.toThrow('could not be found');
  });

  it('removes an orphaned source when its final page is removed', async () => {
    const project = createProject('Remove page');
    const sourceBlobId = await storeSource(new Blob(['image'], { type: 'image/jpeg' }));
    await saveProject({
      project,
      pages: [{
        id: crypto.randomUUID(), projectId: project.id, sourceBlobId, sourceKind: 'image', sourceName: 'page.jpg',
        order: 0, width: 100, height: 200, recipe: createDefaultRecipe(), createdAt: 1,
      }],
    });
    await saveProject({ project, pages: [] });
    await expect(getSource(sourceBlobId)).rejects.toThrow('could not be found');
  });
});
