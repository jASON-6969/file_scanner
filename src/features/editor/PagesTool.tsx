import { Camera, Copy, Files, RotateCw, Trash2 } from 'lucide-react';
import { FileImportButton } from '../../components/FileImportButton';
import type { ProjectEditor } from '../../state/useProjectEditor';
import { PageStrip } from './PageStrip';

interface PagesToolProps {
  editor: ProjectEditor;
  onScan: () => void;
  onFiles: (files: File[]) => void;
  importDisabled?: boolean;
}

export function PagesTool({ editor, onScan, onFiles, importDisabled }: PagesToolProps) {
  return (
    <div className="pages-tool">
      <div className="pages-tool-header">
        <span>{editor.pages.length} page{editor.pages.length === 1 ? '' : 's'}</span>
        <button onClick={editor.selectAll}>Select all</button>
      </div>

      <PageStrip
        pages={editor.pages}
        activeId={editor.activeId}
        selectedIds={editor.selectedIds}
        onActive={editor.setActive}
        onToggleSelected={editor.toggleSelected}
        onReorder={editor.reorder}
      />

      <div className="pages-tool-add">
        <button className="button secondary icon-command" onClick={onScan}>
          <Camera size={18} /><span>Scan</span>
        </button>
        <FileImportButton compact onFiles={onFiles} disabled={importDisabled} />
      </div>

      <div className="pages-tool-actions">
        <div className="selection-summary"><Files size={18} /><span>{editor.selectedIds.size} of {editor.pages.length} selected</span></div>
        <div className="button-grid">
          <button className="button secondary" onClick={editor.clearSelection}>Select one</button>
          <button className="button secondary" onClick={editor.duplicateSelected}><Copy size={17} /> Duplicate</button>
          <button className="button secondary" onClick={editor.rotateSelected}><RotateCw size={17} /> Rotate</button>
          <button className="button danger-button" onClick={editor.removeSelected}><Trash2 size={17} /> Delete</button>
        </div>
      </div>
    </div>
  );
}
