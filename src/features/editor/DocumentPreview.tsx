import { LoaderCircle } from 'lucide-react';
import type { PageRecord } from '../../domain/types';
import { usePagePreview } from '../../hooks/usePagePreview';

export function DocumentPreview({ page }: { page: PageRecord }) {
  const preview = usePagePreview(page, 1800);
  if (preview.loading) return <div className="preview-status"><LoaderCircle className="spin" /> Rendering preview</div>;
  if (!preview.url) return <div className="preview-status error">{preview.error ?? 'Preview unavailable.'}</div>;
  return <div className="document-preview"><img src={preview.url} alt={`Preview of ${page.sourceName}`} /></div>;
}
