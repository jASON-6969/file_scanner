import type { EditRecipe, PageRecord } from './types';

export function normalizeOrder(pages: PageRecord[]): PageRecord[] {
  return pages.map((page, order) => ({ ...page, order }));
}

export function reorderPages(pages: PageRecord[], activeId: string, overId: string): PageRecord[] {
  const from = pages.findIndex((page) => page.id === activeId);
  const to = pages.findIndex((page) => page.id === overId);
  if (from < 0 || to < 0 || from === to) return pages;
  const next = [...pages];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return normalizeOrder(next);
}

export function updateSelectedPages(
  pages: PageRecord[],
  selectedIds: ReadonlySet<string>,
  updater: (recipe: EditRecipe) => EditRecipe,
): PageRecord[] {
  return pages.map((page) =>
    selectedIds.has(page.id) ? { ...page, recipe: updater(structuredClone(page.recipe)) } : page,
  );
}

export function rotateClockwise(rotation: EditRecipe['rotation']): EditRecipe['rotation'] {
  return ((rotation + 90) % 360) as EditRecipe['rotation'];
}
