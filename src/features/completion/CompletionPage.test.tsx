import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createProject } from '../../domain/defaults';
import { CompletionPage } from './CompletionPage';

vi.mock('../../hooks/usePagePreview', () => ({
  usePagePreview: () => ({ url: null, loading: false, error: null }),
}));

describe('completion page', () => {
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
});
