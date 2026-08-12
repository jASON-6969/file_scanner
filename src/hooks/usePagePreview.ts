import { useEffect, useState } from 'react';
import type { PageRecord } from '../domain/types';
import { getSource } from '../storage/database';
import { processImage } from '../features/image/imageProcessor';

interface PreviewState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

export function usePagePreview(page: PageRecord | null, maxDimension = 1600, processed = true): PreviewState {
  const [state, setState] = useState<PreviewState>({ url: null, loading: Boolean(page), error: null });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    if (!page) {
      setState({ url: null, loading: false, error: null });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: null }));
    const timer = window.setTimeout(() => {
      getSource(page.sourceBlobId)
        .then(async (source) => processed ? (await processImage(source, page.recipe, { maxDimension, quality: 0.88 })).blob : source)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setState({ url: objectUrl, loading: false, error: null });
        })
        .catch((reason) => {
          if (!cancelled) setState({ url: null, loading: false, error: reason instanceof Error ? reason.message : 'Preview failed.' });
        });
    }, processed ? 100 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [maxDimension, page, processed]);

  return state;
}
