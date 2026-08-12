import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical } from 'lucide-react';
import type { PageRecord } from '../../domain/types';
import { usePagePreview } from '../../hooks/usePagePreview';

interface PageStripProps {
  pages: PageRecord[];
  activeId: string | null;
  selectedIds: Set<string>;
  onActive: (id: string) => void;
  onToggleSelected: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
}

function SortablePage({ page, index, active, selected, onActive, onToggleSelected }: {
  page: PageRecord;
  index: number;
  active: boolean;
  selected: boolean;
  onActive: () => void;
  onToggleSelected: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const preview = usePagePreview(page, 320);
  return (
    <div
      ref={setNodeRef}
      className={`page-thumb ${active ? 'is-active' : ''} ${selected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button className="page-thumb-main" onClick={onActive} aria-label={`Open page ${index + 1}`}>
        {preview.url ? <img src={preview.url} alt="" /> : <span className="thumb-placeholder" />}
        <span className="page-number">{index + 1}</span>
      </button>
      <button className="select-page" onClick={onToggleSelected} aria-label={`${selected ? 'Deselect' : 'Select'} page ${index + 1}`}>
        {selected && <Check size={13} />}
      </button>
      <button className="drag-page" {...attributes} {...listeners} aria-label={`Reorder page ${index + 1}`}>
        <GripVertical size={16} />
      </button>
    </div>
  );
}

export function PageStrip({ pages, activeId, selectedIds, onActive, onToggleSelected, onReorder }: PageStripProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  );
  const onDragEnd = (event: DragEndEvent) => {
    if (event.over && event.active.id !== event.over.id) onReorder(String(event.active.id), String(event.over.id));
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext
        items={pages.map((page) => page.id)}
        strategy={window.matchMedia('(min-width: 900px)').matches ? verticalListSortingStrategy : horizontalListSortingStrategy}
      >
        <div className="page-strip" aria-label="Document pages">
          {pages.map((page, index) => (
            <SortablePage
              key={page.id}
              page={page}
              index={index}
              active={page.id === activeId}
              selected={selectedIds.has(page.id)}
              onActive={() => onActive(page.id)}
              onToggleSelected={() => onToggleSelected(page.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
