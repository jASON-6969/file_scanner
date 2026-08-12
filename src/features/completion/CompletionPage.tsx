import { ArrowLeft, CheckCircle2, Download, FileCheck2, HardDrive, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { sanitizeFileName } from '../../domain/defaults';
import type { ExportSettings, PageRecord, ProjectRecord } from '../../domain/types';
import { usePagePreview } from '../../hooks/usePagePreview';
import { downloadPdf, exportPdf, type ExportProgress } from '../export/pdfExporter';

interface CompletionPageProps {
  project: ProjectRecord;
  pages: PageRecord[];
  onSettings: (settings: Partial<ExportSettings>) => void;
  onBackToEditing: () => void;
  onSaveLocal: () => Promise<void>;
}

function CompletionThumbnail({ page, index }: { page: PageRecord; index: number }) {
  const preview = usePagePreview(page, 360);
  return (
    <div className="completion-thumb">
      {preview.url ? <img src={preview.url} alt={`Page ${index + 1}`} /> : <span className="thumb-placeholder" />}
      <span>{index + 1}</span>
    </div>
  );
}

export function CompletionPage({ project, pages, onSettings, onBackToEditing, onSaveLocal }: CompletionPageProps) {
  const settings = project.exportSettings;
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [saving, setSaving] = useState(false);

  const startExport = async () => {
    controller.current = new AbortController();
    setError(null);
    setComplete(false);
    try {
      const blob = await exportPdf(pages, settings, controller.current.signal, setProgress);
      downloadPdf(blob, sanitizeFileName(settings.fileName));
      setComplete(true);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') setError('Export cancelled.');
      else setError(reason instanceof Error ? reason.message : 'The PDF could not be exported.');
    } finally {
      setProgress(null);
      controller.current = null;
    }
  };

  return (
    <main className="completion-page">
      <header className="completion-header">
        <button className="completion-back" onClick={onBackToEditing}><ArrowLeft size={19} /> Back to editing</button>
        <div className="completion-brand"><FileCheck2 size={20} /> Clearfile</div>
      </header>

      <div className="completion-content">
        <section className="completion-summary" aria-labelledby="completion-title">
          <div className="completion-status-icon"><CheckCircle2 size={28} /></div>
          <p className="eyebrow">READY TO FINISH</p>
          <h1 id="completion-title">Your document is ready</h1>
          <p>{pages.length} page{pages.length === 1 ? '' : 's'} cleaned and arranged in final order.</p>
          <div className="completion-thumbs" aria-label="Final page order">
            {pages.map((page, index) => <CompletionThumbnail key={page.id} page={page} index={index} />)}
          </div>
        </section>

        <section className="finish-options" aria-labelledby="finish-options-title">
          <div className="finish-options-heading">
            <p className="eyebrow">OUTPUT</p>
            <h2 id="finish-options-title">Finish document</h2>
          </div>
          <div className="export-form completion-form">
            <label className="field"><span>File name</span><input value={settings.fileName} maxLength={80} onChange={(event) => onSettings({ fileName: event.target.value })} /></label>
            <div className="field"><span>Page size</span><div className="segmented">
              {(['a4', 'letter', 'original'] as const).map((value) => <button key={value} className={settings.paperSize === value ? 'is-active' : ''} onClick={() => onSettings({ paperSize: value })}>{value === 'a4' ? 'A4' : value === 'letter' ? 'Letter' : 'Original'}</button>)}
            </div></div>
            <div className="field"><span>Quality</span><div className="quality-list">
              {([
                ['professional', 'Professional', '300 DPI'],
                ['standard', 'Standard', '200 DPI'],
                ['small', 'Small file', '150 DPI'],
              ] as const).map(([value, label, detail]) => (
                <button key={value} className={settings.quality === value ? 'is-active' : ''} onClick={() => onSettings({ quality: value })}>
                  <span><strong>{label}</strong><small>{detail}</small></span><span className="radio-dot" />
                </button>
              ))}
            </div></div>
            <div className="field"><span>Margin</span><div className="segmented">
              {([0, 5, 10] as const).map((value) => <button key={value} className={settings.marginMm === value ? 'is-active' : ''} onClick={() => onSettings({ marginMm: value })}>{value} mm</button>)}
            </div></div>
          </div>

          {progress && (
            <div className="export-progress">
              <div><LoaderCircle className="spin" size={18} /><span>{progress.label}</span><strong>{progress.current}/{progress.total}</strong></div>
              <progress value={progress.current} max={progress.total} />
            </div>
          )}
          {complete && <div className="success-message"><CheckCircle2 size={18} /> PDF downloaded successfully.</div>}
          {error && <div className="inline-error">{error}</div>}

          <div className="finish-actions">
            <button
              className="button secondary save-local-button"
              disabled={Boolean(progress) || saving}
              onClick={async () => {
                setSaving(true);
                try { await onSaveLocal(); } finally { setSaving(false); }
              }}
            >
              <HardDrive size={18} /> {saving ? 'Saving' : 'Save locally'}
            </button>
            {progress ? (
              <button className="button primary" onClick={() => controller.current?.abort()}>Cancel export</button>
            ) : (
              <button className="button primary" onClick={startExport} disabled={!pages.length || !settings.fileName.trim()}>
                <Download size={18} /> Export PDF
              </button>
            )}
          </div>
          <p className="local-note">Save locally keeps this editable project in this browser and returns to your project list.</p>
        </section>
      </div>
    </main>
  );
}
