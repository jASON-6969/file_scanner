import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultRecipe, sanitizeFileName } from '../domain/defaults';
import { normalizeOrder, reorderPages, rotateClockwise, updateSelectedPages } from '../domain/pageOperations';
import type { EditRecipe, ExportSettings, PageRecord, ProjectBundle, ProjectRecord } from '../domain/types';
import { loadProject, saveProject } from '../storage/database';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface ProjectEditor {
  project: ProjectRecord;
  pages: PageRecord[];
  activePage: PageRecord | null;
  activeId: string | null;
  selectedIds: Set<string>;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  setActive: (id: string) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  addPages: (pages: PageRecord[]) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  reorder: (activeId: string, overId: string) => void;
  updateRecipe: (patch: Partial<EditRecipe>) => void;
  replaceCrop: (crop: EditRecipe['crop']) => void;
  rotateSelected: () => void;
  resetSelected: () => void;
  applyActiveToAll: () => void;
  renameProject: (name: string) => void;
  updateExportSettings: (settings: Partial<ExportSettings>) => void;
  undo: () => void;
  redo: () => void;
  flushSave: () => Promise<void>;
}

function clonePages(pages: PageRecord[]): PageRecord[] {
  return structuredClone(pages);
}

export function useProjectEditor(projectId: string): { editor: ProjectEditor | null; error: string | null } {
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [past, setPast] = useState<PageRecord[][]>([]);
  const [future, setFuture] = useState<PageRecord[][]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);
  const latestBundle = useRef<ProjectBundle | null>(null);

  useEffect(() => {
    let cancelled = false;
    loaded.current = false;
    loadProject(projectId)
      .then((result) => {
        if (cancelled || !result) return;
        setBundle(result);
        latestBundle.current = result;
        const firstId = result.pages[0]?.id ?? null;
        setActiveId(firstId);
        setSelectedIds(firstId ? new Set([firstId]) : new Set());
        setPast([]);
        setFuture([]);
        setSaveState('saved');
        loaded.current = true;
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : 'Could not open this project.'));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    latestBundle.current = bundle;
    if (!bundle || !loaded.current) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      saveProject(bundle)
        .then(() => setSaveState('saved'))
        .catch((reason) => {
          setSaveState('error');
          setError(reason instanceof DOMException && reason.name === 'QuotaExceededError'
            ? 'Browser storage is full. Export or delete another local project before continuing.'
            : 'Changes could not be saved locally.');
        });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [bundle]);

  useEffect(() => {
    if (!bundle || bundle.pages.some((page) => page.id === activeId)) return;
    const nextId = bundle.pages[0]?.id ?? null;
    setActiveId(nextId);
    setSelectedIds(nextId ? new Set([nextId]) : new Set());
  }, [activeId, bundle]);

  const commitPages = useCallback((updater: (pages: PageRecord[]) => PageRecord[]) => {
    setBundle((current) => {
      if (!current) return current;
      const before = clonePages(current.pages);
      const after = normalizeOrder(updater(clonePages(current.pages)));
      setPast((items) => [...items.slice(-29), before]);
      setFuture([]);
      return { ...current, pages: after };
    });
  }, []);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id) && next.size > 1) next.delete(id);
      else next.add(id);
      return next;
    });
    setActiveId(id);
  }, []);

  const addPages = useCallback((newPages: PageRecord[]) => {
    if (!newPages.length) return;
    commitPages((pages) => [...pages, ...newPages]);
    setActiveId(newPages[0].id);
    setSelectedIds(new Set([newPages[0].id]));
  }, [commitPages]);

  const removeSelected = useCallback(() => {
    commitPages((pages) => pages.filter((page) => !selectedIds.has(page.id)));
    setBundle((current) => {
      const remaining = current?.pages.filter((page) => !selectedIds.has(page.id)) ?? [];
      const nextId = remaining[0]?.id ?? null;
      setActiveId(nextId);
      setSelectedIds(nextId ? new Set([nextId]) : new Set());
      return current;
    });
  }, [commitPages, selectedIds]);

  const duplicateSelected = useCallback(() => {
    commitPages((pages) => {
      const output: PageRecord[] = [];
      for (const page of pages) {
        output.push(page);
        if (selectedIds.has(page.id)) output.push({ ...structuredClone(page), id: crypto.randomUUID(), createdAt: Date.now() });
      }
      return output;
    });
  }, [commitPages, selectedIds]);

  const updateRecipe = useCallback((patch: Partial<EditRecipe>) => {
    commitPages((pages) => updateSelectedPages(pages, selectedIds, (recipe) => ({ ...recipe, ...patch })));
  }, [commitPages, selectedIds]);

  const rotateSelected = useCallback(() => {
    commitPages((pages) => updateSelectedPages(pages, selectedIds, (recipe) => ({
      ...recipe,
      rotation: rotateClockwise(recipe.rotation),
    })));
  }, [commitPages, selectedIds]);

  const resetSelected = useCallback(() => {
    commitPages((pages) => updateSelectedPages(pages, selectedIds, () => createDefaultRecipe()));
  }, [commitPages, selectedIds]);

  const applyActiveToAll = useCallback(() => {
    const active = bundle?.pages.find((page) => page.id === activeId);
    const allPages = bundle?.pages;
    if (!active || !allPages) return;
    commitPages((pages) => pages.map((page) => ({ ...page, recipe: structuredClone(active.recipe) })));
    setSelectedIds(new Set(allPages.map((page) => page.id)));
  }, [activeId, bundle, commitPages]);

  const renameProject = useCallback((name: string) => {
    const trimmed = name.trim() || 'Untitled scan';
    setBundle((current) => current ? {
      ...current,
      project: {
        ...current.project,
        name: trimmed,
        exportSettings: {
          ...current.project.exportSettings,
          fileName: current.project.exportSettings.fileName === sanitizeFileName(current.project.name)
            ? sanitizeFileName(trimmed)
            : current.project.exportSettings.fileName,
        },
      },
    } : current);
  }, []);

  const updateExportSettings = useCallback((settings: Partial<ExportSettings>) => {
    setBundle((current) => current ? {
      ...current,
      project: { ...current.project, exportSettings: { ...current.project.exportSettings, ...settings } },
    } : current);
  }, []);

  const undo = useCallback(() => {
    setPast((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setBundle((current) => {
        if (!current) return current;
        setFuture((next) => [clonePages(current.pages), ...next].slice(0, 30));
        return { ...current, pages: previous };
      });
      return items.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setBundle((current) => {
        if (!current) return current;
        setPast((previous) => [...previous.slice(-29), clonePages(current.pages)]);
        return { ...current, pages: next };
      });
      return items.slice(1);
    });
  }, []);

  const activePage = useMemo(
    () => bundle?.pages.find((page) => page.id === activeId) ?? bundle?.pages[0] ?? null,
    [activeId, bundle?.pages],
  );

  const flushSave = useCallback(async () => {
    if (latestBundle.current) await saveProject(latestBundle.current);
  }, []);

  const editor = bundle ? {
    project: bundle.project,
    pages: bundle.pages,
    activePage,
    activeId,
    selectedIds,
    saveState,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    setActive,
    toggleSelected,
    selectAll: () => setSelectedIds(new Set(bundle.pages.map((page) => page.id))),
    clearSelection: () => activeId && setSelectedIds(new Set([activeId])),
    addPages,
    removeSelected,
    duplicateSelected,
    reorder: (from: string, to: string) => commitPages((pages) => reorderPages(pages, from, to)),
    updateRecipe,
    replaceCrop: (crop: EditRecipe['crop']) => updateRecipe({ crop }),
    rotateSelected,
    resetSelected,
    applyActiveToAll,
    renameProject,
    updateExportSettings,
    undo,
    redo,
    flushSave,
  } satisfies ProjectEditor : null;

  return { editor, error };
}
