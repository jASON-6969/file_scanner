import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CropQuad, PageRecord, Point } from '../../domain/types';
import { usePagePreview } from '../../hooks/usePagePreview';

const CORNERS: Array<{ key: keyof CropQuad; label: string }> = [
  { key: 'topLeft', label: 'Top left' },
  { key: 'topRight', label: 'Top right' },
  { key: 'bottomRight', label: 'Bottom right' },
  { key: 'bottomLeft', label: 'Bottom left' },
];

interface CropEditorProps {
  page: PageRecord;
  onCommit: (crop: CropQuad) => void;
}

export function CropEditor({ page, onCommit }: CropEditorProps) {
  const preview = usePagePreview(page, 1800, false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<CropQuad>(structuredClone(page.recipe.crop));
  const cropRef = useRef(crop);

  useEffect(() => {
    const next = structuredClone(page.recipe.crop);
    setCrop(next);
    cropRef.current = next;
  }, [page.id, page.recipe.crop]);

  const startDragging = (key: keyof CropQuad, event: React.PointerEvent) => {
    event.preventDefault();
    const move = (pointerEvent: PointerEvent) => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      const point: Point = {
        x: Math.max(0, Math.min(1, (pointerEvent.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (pointerEvent.clientY - rect.top) / rect.height)),
      };
      const next = { ...cropRef.current, [key]: point };
      cropRef.current = next;
      setCrop(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onCommit(cropRef.current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  if (preview.loading) return <div className="preview-status"><LoaderCircle className="spin" /> Loading original</div>;
  if (!preview.url) return <div className="preview-status error">{preview.error ?? 'Original page unavailable.'}</div>;

  const points = CORNERS.map(({ key }) => `${crop[key].x * 100},${crop[key].y * 100}`).join(' ');
  return (
    <div className="crop-stage">
      <div className="crop-frame" ref={frameRef}>
        <img src={preview.url} alt={`Original ${page.sourceName}`} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polygon points={points} />
          {CORNERS.map(({ key }) => <line key={`${key}-x`} x1="0" y1={crop[key].y * 100} x2="100" y2={crop[key].y * 100} />)}
        </svg>
        {CORNERS.map(({ key, label }) => (
          <button
            key={key}
            className="crop-handle"
            style={{ left: `${crop[key].x * 100}%`, top: `${crop[key].y * 100}%` }}
            onPointerDown={(event) => startDragging(key, event)}
            aria-label={`Move ${label} crop point`}
          />
        ))}
      </div>
    </div>
  );
}
