import { ArrowLeft, ArrowRight, Camera, FilePlus2, Redo2, RotateCw, Save, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FileImportButton } from '../../components/FileImportButton';
import { IconButton } from '../../components/IconButton';
import { importCameraBlob, importFiles, type ImportProgress } from '../import/fileImporter';
import { CameraModal } from '../camera/CameraModal';
import { CompletionPage } from '../completion/CompletionPage';
import { useProjectEditor } from '../../state/useProjectEditor';
import { CropEditor } from './CropEditor';
import { DocumentPreview } from './DocumentPreview';
import { PageStrip } from './PageStrip';
import { ToolPanel, type ToolTab } from './ToolPanel';

interface EditorWorkspaceProps {
  projectId: string;
  initialCamera?: boolean;
  initialFiles?: File[];
  onBack: () => void;
}

export function EditorWorkspace({ projectId, initialCamera, initialFiles, onBack }: EditorWorkspaceProps) {
  const { editor, error: loadError } = useProjectEditor(projectId);
  const [tab, setTab] = useState<ToolTab>('filters');
  const [cameraOpen, setCameraOpen] = useState(Boolean(initialCamera));
  const [stage, setStage] = useState<'edit' | 'complete'>('edit');
  const [busy, setBusy] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialImportStarted, setInitialImportStarted] = useState(false);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!editor) return;
    setError(null);
    try {
      const pages = await importFiles(editor.project.id, files, editor.pages.length, setBusy);
      editor.addPages(pages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Files could not be imported.');
    } finally {
      setBusy(null);
    }
  }, [editor]);

  useEffect(() => {
    if (editor && initialFiles?.length && !initialImportStarted) {
      setInitialImportStarted(true);
      void handleFiles(initialFiles);
    }
  }, [editor, handleFiles, initialFiles, initialImportStarted]);

  if (!editor) {
    return <main className="loading-screen"><span className="loader-ring" /> <p>{loadError ?? 'Opening local project'}</p></main>;
  }

  const addCameraShots = async (blobs: Blob[]) => {
    setError(null);
    try {
      const pages = [];
      for (let index = 0; index < blobs.length; index += 1) {
        setBusy({ current: index + 1, total: blobs.length, label: `Cleaning capture ${index + 1}` });
        pages.push(await importCameraBlob(editor.project.id, blobs[index], editor.pages.length + index));
      }
      editor.addPages(pages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Captured pages could not be added.');
    } finally {
      setBusy(null);
    }
  };

  const goBack = async () => {
    await editor.flushSave();
    onBack();
  };

  if (stage === 'complete') {
    return (
      <CompletionPage
        project={editor.project}
        pages={editor.pages}
        onSettings={editor.updateExportSettings}
        onBackToEditing={() => setStage('edit')}
        onSaveLocal={goBack}
      />
    );
  }

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div className="editor-title-group">
          <IconButton label="Back to projects" onClick={goBack}><ArrowLeft /></IconButton>
          <div>
            <input
              className="project-title-input"
              value={editor.project.name}
              maxLength={80}
              aria-label="Project name"
              onChange={(event) => editor.renameProject(event.target.value)}
            />
            <span className={`save-state ${editor.saveState}`}><Save size={12} /> {editor.saveState === 'saving' ? 'Saving' : editor.saveState === 'error' ? 'Not saved' : 'Saved locally'}</span>
          </div>
        </div>
        <div className="editor-header-actions">
          <IconButton label="Undo" onClick={editor.undo} disabled={!editor.canUndo}><Undo2 /></IconButton>
          <IconButton label="Redo" onClick={editor.redo} disabled={!editor.canRedo}><Redo2 /></IconButton>
          <button className="button primary next-button" onClick={async () => { await editor.flushSave(); setStage('complete'); }} disabled={!editor.pages.length}>
            <span>Next</span><ArrowRight size={18} />
          </button>
        </div>
      </header>

      {error && <div className="workspace-alert" role="alert"><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
      {busy && <div className="busy-banner"><span className="loader-ring small" /><span>{busy.label}</span><strong>{busy.current}/{busy.total}</strong></div>}

      {editor.pages.length === 0 ? (
        <section className="editor-empty">
          <div className="empty-document-icon"><FilePlus2 size={30} /></div>
          <h1>Add your first page</h1>
          <p>Scan a document or choose images and PDFs already on this device.</p>
          <div>
            <button className="button primary" onClick={() => setCameraOpen(true)}><Camera size={18} /> Scan pages</button>
            <FileImportButton onFiles={handleFiles} disabled={Boolean(busy)} />
          </div>
        </section>
      ) : (
        <div className="editor-layout">
          <div className="pages-column">
            <div className="pages-column-header"><span>{editor.pages.length} pages</span><button onClick={editor.selectAll}>Select all</button></div>
            <PageStrip
              pages={editor.pages}
              activeId={editor.activeId}
              selectedIds={editor.selectedIds}
              onActive={editor.setActive}
              onToggleSelected={editor.toggleSelected}
              onReorder={editor.reorder}
            />
            <div className="add-page-actions">
              <button onClick={() => setCameraOpen(true)} title="Scan more pages"><Camera size={18} /><span>Scan</span></button>
              <FileImportButton compact onFiles={handleFiles} disabled={Boolean(busy)} />
            </div>
          </div>

          <section className="canvas-area" aria-label="Page editor">
            <div className="canvas-toolbar">
              <span>Page {(editor.pages.findIndex((page) => page.id === editor.activeId) + 1) || 1}</span>
              <span>{editor.selectedIds.size > 1 ? `${editor.selectedIds.size} selected` : editor.activePage?.sourceName}</span>
              <IconButton label="Rotate selected pages" onClick={editor.rotateSelected}><RotateCw size={18} /></IconButton>
            </div>
            <div className="canvas-viewport">
              {editor.activePage && (tab === 'crop'
                ? <CropEditor page={editor.activePage} onCommit={editor.replaceCrop} />
                : <DocumentPreview page={editor.activePage} />)}
            </div>
          </section>

          <ToolPanel editor={editor} tab={tab} onTab={setTab} />
        </div>
      )}

      {cameraOpen && <CameraModal onClose={() => setCameraOpen(false)} onComplete={addCameraShots} onFallbackFiles={handleFiles} />}
    </main>
  );
}
