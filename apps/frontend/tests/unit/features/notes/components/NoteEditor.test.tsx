import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteEditor } from '../../../../../src/features/notes/components/NoteEditor';
import type { NoteEditorHandle } from '../../../../../src/features/notes/components/NoteEditor';

let capturedOnUpdate: ((args: { editor: { getHTML: () => string } }) => void) | undefined;
const codeBlockRun = vi.fn();
const strikeRun = vi.fn();
const orderedListRun = vi.fn();
const setContentMock = vi.fn();

vi.mock('@tiptap/react', () => ({
  useEditor: (options: { onUpdate?: (args: { editor: { getHTML: () => string } }) => void }) => {
    capturedOnUpdate = options.onUpdate;
    return {
      isActive: () => false,
      getAttributes: () => ({}),
      chain: () => ({
        focus: () => ({
          toggleCodeBlock: () => ({ run: codeBlockRun }),
          toggleStrike: () => ({ run: strikeRun }),
          toggleOrderedList: () => ({ run: orderedListRun }),
        }),
      }),
      getHTML: () => '<p>updated</p>',
      commands: { setContent: setContentMock },
    };
  },
  EditorContent: () => <div data-testid="editor-content" />,
}));

vi.mock('../../../../../src/features/notes/components/TipTapToolbar', () => ({
  TipTapToolbar: ({ linkPopoverOpen }: { linkPopoverOpen: boolean }) => (
    <div data-testid="toolbar-stub">{linkPopoverOpen ? 'link-open' : 'link-closed'}</div>
  ),
}));

describe('NoteEditor', () => {
  it('renders the toolbar and editor content', () => {
    render(<NoteEditor initialContent="<p>hi</p>" onContentChange={vi.fn()} />);
    expect(screen.getByTestId('toolbar-stub')).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
  });

  it('calls onContentChange when the editor reports an update', () => {
    const onContentChange = vi.fn();
    render(<NoteEditor initialContent="<p>hi</p>" onContentChange={onContentChange} />);

    capturedOnUpdate?.({ editor: { getHTML: () => '<p>updated</p>' } });

    expect(onContentChange).toHaveBeenCalledWith('<p>updated</p>');
  });

  it('Ctrl+K opens the link popover', () => {
    const { container } = render(<NoteEditor initialContent="<p>hi</p>" onContentChange={vi.fn()} />);
    expect(screen.getByTestId('toolbar-stub')).toHaveTextContent('link-closed');

    fireEvent.keyDown(container.firstChild as Element, { key: 'k', ctrlKey: true });

    expect(screen.getByTestId('toolbar-stub')).toHaveTextContent('link-open');
  });

  it('Ctrl+Shift+E toggles a code block', () => {
    const { container } = render(<NoteEditor initialContent="<p>hi</p>" onContentChange={vi.fn()} />);

    fireEvent.keyDown(container.firstChild as Element, { key: 'E', ctrlKey: true, shiftKey: true });

    expect(codeBlockRun).toHaveBeenCalled();
  });

  it('Ctrl+Shift+X toggles strikethrough', () => {
    const { container } = render(<NoteEditor initialContent="<p>hi</p>" onContentChange={vi.fn()} />);

    fireEvent.keyDown(container.firstChild as Element, { key: 'X', ctrlKey: true, shiftKey: true });

    expect(strikeRun).toHaveBeenCalled();
  });

  it('Ctrl+Shift+9 toggles an ordered list', () => {
    const { container } = render(<NoteEditor initialContent="<p>hi</p>" onContentChange={vi.fn()} />);

    // `code` (not `key`) since shift+9 produces "(" on a US layout — the handler matches on
    // the physical key so the shortcut works regardless of layout.
    fireEvent.keyDown(container.firstChild as Element, { code: 'Digit9', ctrlKey: true, shiftKey: true });

    expect(orderedListRun).toHaveBeenCalled();
  });

  it('exposes an imperative setContent handle that calls editor.commands.setContent (AB-1015)', () => {
    const ref = createRef<NoteEditorHandle>();
    render(<NoteEditor ref={ref} initialContent="<p>hi</p>" onContentChange={vi.fn()} />);

    ref.current?.setContent('<p>restored</p>');

    expect(setContentMock).toHaveBeenCalledWith('<p>restored</p>');
  });
});
