import { ArrowLeft, CheckCircle2, Download, FileCheck2, HardDrive, LoaderCircle, Share2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { sanitizeFileName } from '../../domain/defaults';
import type { ExportSettings, PageRecord, ProjectRecord } from '../../domain/types';
import { usePagePreview } from '../../hooks/usePagePreview';
import { canSharePdf, downloadPdf, exportPdf, sharePdf, type ExportProgress } from '../export/pdfExporter';

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
  const preparedPdf = useRef<{ blob: Blob; pages: PageRecord[]; settings: ExportSettings } | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preparePdf = async (signal: AbortSignal) => {
    if (preparedPdf.current?.pages === pages && preparedPdf.current.settings === settings) {
      return preparedPdf.current.blob;
    }

    const blob = await exportPdf(pages, settings, signal, setProgress);
    preparedPdf.current = { blob, pages, settings };
    return blob;
  };

  const runPdfAction = async (action: 'download' | 'share') => {
    if (action === 'share' && !canSharePdf()) {
      setComplete(null);
      setError('PDF file sharing is not supported by this browser.');
      return;
    }

    const abortController = new AbortController();
    controller.current = abortController;
    setError(null);
    setComplete(null);
    setProgress({ current: 0, total: pages.length, label: 'Preparing PDF' });
    try {
      const blob = await preparePdf(abortController.signal);
      const fileName = sanitizeFileName(settings.fileName);
      if (action === 'download') {
        downloadPdf(blob, fileName);
        setComplete('PDF downloaded successfully.');
      } else {
        await sharePdf(blob, fileName);
        setComplete('PDF shared successfully.');
      }
    } catch (reason) {
      if (abortController.signal.aborted) setError('Export cancelled.');
      else if (action === 'share' && reason instanceof DOMException && reason.name === 'AbortError') setError(null);
      else if (action === 'share' && reason instanceof DOMException && reason.name === 'NotAllowedError') {
        setError('The PDF is ready. Tap Share PDF again to open your phone share menu.');
      }
      else setError(reason instanceof Error ? reason.message : 'The PDF could not be exported.');
    } finally {
      setProgress(null);
      if (controller.current === abortController) controller.current = null;
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
          {complete && <div className="success-message"><CheckCircle2 size={18} /> {complete}</div>}
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
            <button
              className="button secondary share-pdf-button"
              disabled={Boolean(progress) || !pages.length || !settings.fileName.trim()}
              onClick={() => runPdfAction('share')}
            >
              <Share2 size={18} /> Share PDF
            </button>
            {progress ? (
              <button className="button primary" onClick={() => controller.current?.abort()}>Cancel export</button>
            ) : (
              <button className="button primary" onClick={() => runPdfAction('download')} disabled={!pages.length || !settings.fileName.trim()}>
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
