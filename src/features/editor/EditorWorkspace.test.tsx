import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorWorkspace } from './EditorWorkspace';

vi.mock('../../state/useProjectEditor', () => ({
  useProjectEditor: () => ({ editor: null, error: 'This local project could not be found.' }),
}));

vi.mock('../import/fileImporter', () => ({
  importCameraBlobs: vi.fn(),
  importFiles: vi.fn(),
}));

describe('editor loading errors', () => {
  it('allows returning to the project list when the project is missing', () => {
    const onBack = vi.fn();
    render(<EditorWorkspace projectId="missing" onBack={onBack} />);

    expect(screen.getByText('This local project could not be found.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to projects' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
