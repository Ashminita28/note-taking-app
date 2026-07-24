import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SharedNoteContent } from '../../../../../src/features/share/components/SharedNoteContent';

let capturedEditable: boolean | undefined;

vi.mock('@tiptap/react', () => ({
  useEditor: (options: { editable?: boolean }) => {
    capturedEditable = options.editable;
    return { getHTML: () => '<p>content</p>' };
  },
  EditorContent: () => <div data-testid="shared-editor-content" />,
}));

describe('SharedNoteContent', () => {
  it('renders the editor content with no toolbar', () => {
    render(<SharedNoteContent content="<p>hello</p>" />);

    expect(screen.getByTestId('shared-editor-content')).toBeInTheDocument();
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('configures the editor as non-editable (read-only)', () => {
    render(<SharedNoteContent content="<p>hello</p>" />);

    expect(capturedEditable).toBe(false);
  });
});
