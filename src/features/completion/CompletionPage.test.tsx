import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRecipe, createProject } from '../../domain/defaults';
import type { PageRecord } from '../../domain/types';
import { CompletionPage } from './CompletionPage';

const pdfMocks = vi.hoisted(() => ({
  canSharePdf: vi.fn(),
  downloadPdf: vi.fn(),
  exportPdf: vi.fn(),
  sharePdf: vi.fn(),
}));

vi.mock('../../hooks/usePagePreview', () => ({
  usePagePreview: () => ({ url: null, loading: false, error: null }),
}));

vi.mock('../export/pdfExporter', () => pdfMocks);

const page: PageRecord = {
  id: 'page-1',
  projectId: 'project-1',
  sourceBlobId: 'source-1',
  sourceKind: 'image',
  sourceName: 'scan.jpg',
  order: 0,
  width: 1200,
  height: 1600,
  recipe: createDefaultRecipe(),
  createdAt: 1,
};

describe('completion page', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    pdfMocks.canSharePdf.mockReturnValue(true);
    pdfMocks.exportPdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    pdfMocks.sharePdf.mockResolvedValue(undefined);
  });

  it('separates editing, local save, and PDF export actions', async () => {
    const onBackToEditing = vi.fn();
    const onSaveLocal = vi.fn().mockResolvedValue(undefined);
    render(
      <CompletionPage
        project={createProject('Official file')}
        pages={[]}
        onSettings={vi.fn()}
        onBackToEditing={onBackToEditing}
        onSaveLocal={onSaveLocal}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Your document is ready' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to editing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save locally' }));
    expect(onBackToEditing).toHaveBeenCalledOnce();
    expect(onSaveLocal).toHaveBeenCalledOnce();
  });

  it('exports and sends the PDF through native file sharing', async () => {
    render(
      <CompletionPage
        project={createProject('Official file')}
        pages={[page]}
        onSettings={vi.fn()}
        onBackToEditing={vi.fn()}
        onSaveLocal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share PDF' }));

    await waitFor(() => expect(pdfMocks.sharePdf).toHaveBeenCalledOnce());
    expect(pdfMocks.sharePdf).toHaveBeenCalledWith(expect.any(Blob), 'Official-file');
    expect(pdfMocks.downloadPdf).not.toHaveBeenCalled();
    expect(screen.getByText('PDF shared successfully.')).toBeInTheDocument();
  });

  it('reports browsers that cannot share PDF files without exporting', () => {
    pdfMocks.canSharePdf.mockReturnValue(false);
    render(
      <CompletionPage
        project={createProject('Official file')}
        pages={[page]}
        onSettings={vi.fn()}
        onBackToEditing={vi.fn()}
        onSaveLocal={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share PDF' }));

    expect(screen.getByText('PDF file sharing is not supported by this browser.')).toBeInTheDocument();
    expect(pdfMocks.exportPdf).not.toHaveBeenCalled();
  });
});
