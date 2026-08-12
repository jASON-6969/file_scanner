import Dexie, { type EntityTable } from 'dexie';
import type { PageRecord, ProjectBundle, ProjectRecord, SourceBlobRecord } from '../domain/types';

class ScannerDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  pages!: EntityTable<PageRecord, 'id'>;
  blobs!: EntityTable<SourceBlobRecord, 'id'>;

  constructor() {
    super('clearfile-scanner');
    this.version(1).stores({
      projects: 'id, updatedAt, createdAt',
      pages: 'id, projectId, sourceBlobId, [projectId+order]',
      blobs: 'id, createdAt',
    });
  }
}

export const db = new ScannerDatabase();

export async function listProjects(): Promise<ProjectRecord[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function loadProject(projectId: string): Promise<ProjectBundle | null> {
  const project = await db.projects.get(projectId);
  if (!project) return null;
  const pages = await db.pages.where('projectId').equals(projectId).sortBy('order');
  return { project, pages };
}

export async function saveProject(bundle: ProjectBundle): Promise<void> {
  const updated = { ...bundle.project, updatedAt: Date.now() };
  await db.transaction('rw', db.projects, db.pages, db.blobs, async () => {
    await db.projects.put(updated);
    const existingIds = await db.pages.where('projectId').equals(updated.id).primaryKeys();
    const activeIds = new Set(bundle.pages.map((page) => page.id));
    const removedIds = existingIds.filter((id) => !activeIds.has(id));
    const removedPages = removedIds.length ? await db.pages.bulkGet(removedIds) : [];
    if (removedIds.length) await db.pages.bulkDelete(removedIds);
    await db.pages.bulkPut(bundle.pages.map((page, order) => ({ ...page, order })));
    for (const sourceId of new Set(removedPages.flatMap((page) => page ? [page.sourceBlobId] : []))) {
      const references = await db.pages.where('sourceBlobId').equals(sourceId).count();
      if (references === 0) await db.blobs.delete(sourceId);
    }
  });
}

export async function storeSource(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await db.blobs.add({ id, blob, mimeType: blob.type, size: blob.size, createdAt: Date.now() });
  return id;
}

export async function getSource(id: string): Promise<Blob> {
  const record = await db.blobs.get(id);
  if (!record) throw new Error('The original page could not be found in local storage.');
  return record.blob;
}

export async function deleteUnreferencedSources(sourceIds: string[]): Promise<void> {
  await db.transaction('rw', db.pages, db.blobs, async () => {
    for (const sourceId of new Set(sourceIds)) {
      const references = await db.pages.where('sourceBlobId').equals(sourceId).count();
      if (references === 0) await db.blobs.delete(sourceId);
    }
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.transaction('rw', db.projects, db.pages, db.blobs, async () => {
    const pages = await db.pages.where('projectId').equals(projectId).toArray();
    await db.pages.where('projectId').equals(projectId).delete();
    await db.projects.delete(projectId);
    for (const sourceId of new Set(pages.map((page) => page.sourceBlobId))) {
      const references = await db.pages.where('sourceBlobId').equals(sourceId).count();
      if (references === 0) await db.blobs.delete(sourceId);
    }
  });
}

export async function duplicateProject(sourceId: string): Promise<ProjectRecord> {
  const bundle = await loadProject(sourceId);
  if (!bundle) throw new Error('Project not found.');
  const now = Date.now();
  const project: ProjectRecord = {
    ...bundle.project,
    id: crypto.randomUUID(),
    name: `${bundle.project.name} copy`,
    createdAt: now,
    updatedAt: now,
    exportSettings: { ...bundle.project.exportSettings, fileName: `${bundle.project.exportSettings.fileName}-copy` },
  };
  const pages = bundle.pages.map((page, order) => ({ ...page, id: crypto.randomUUID(), projectId: project.id, order }));
  await saveProject({ project, pages });
  return project;
}

export async function storageSummary(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 };
}
