import { useMemo } from 'react';
import type { FilterPreset, PageRecord } from '../../domain/types';
import { usePagePreview } from '../../hooks/usePagePreview';

interface FilterPreviewProps {
  page: PageRecord;
  preset: FilterPreset;
}

export function FilterPreview({ page, preset }: FilterPreviewProps) {
  const previewPage = useMemo(() => ({
    ...page,
    recipe: { ...page.recipe, preset },
  }), [page, preset]);
  const preview = usePagePreview(previewPage, 260);

  return (
    <span className="filter-preview" aria-hidden="true">
      {preview.url ? <img src={preview.url} alt="" /> : <span className="filter-preview-placeholder" />}
    </span>
  );
}
