import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionContent } from '../../../../../src/features/versions/components/VersionContent';

let capturedEditable: boolean | undefined;

vi.mock('@tiptap/react', () => ({
  useEditor: (options: { editable?: boolean }) => {
    capturedEditable = options.editable;
    return { getHTML: () => '<p>content</p>' };
  },
  EditorContent: () => <div data-testid="version-editor-content" />,
}));

describe('VersionContent', () => {
  it('renders the editor content with no toolbar', () => {
    render(<VersionContent content="<p>hello</p>" />);

    expect(screen.getByTestId('version-editor-content')).toBeInTheDocument();
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('configures the editor as non-editable (read-only, FR-VER-003 AC-3)', () => {
    render(<VersionContent content="<p>hello</p>" />);

    expect(capturedEditable).toBe(false);
  });
});
