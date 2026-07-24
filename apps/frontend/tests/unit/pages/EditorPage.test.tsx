import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EditorPage } from '../../../src/pages/EditorPage';
import { useNoteQuery } from '../../../src/features/notes/notes.hooks';
import { useAutosave } from '../../../src/features/notes/useAutosave';
import { useUIStore } from '../../../src/stores/ui.store';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../src/features/notes/notes.hooks', () => ({
  useNoteQuery: vi.fn(),
}));

vi.mock('../../../src/features/notes/useAutosave', () => ({
  useAutosave: vi.fn(),
}));

vi.mock('../../../src/features/notes/components/ActionHeader', () => ({
  ActionHeader: ({
    title,
    status,
    canDelete,
    autoFocusTitle,
  }: {
    title: string;
    status: string;
    canDelete: boolean;
    autoFocusTitle?: boolean;
  }) => (
    <div data-testid="action-header">
      {title} / {status} / {canDelete ? 'can-delete' : 'no-delete'} /{' '}
      {autoFocusTitle ? 'title-autofocus' : 'title-no-autofocus'}
    </div>
  ),
}));

vi.mock('../../../src/features/notes/components/TagBar', () => ({
  TagBar: ({ tags }: { tags: { name: string }[] }) => (
    <div data-testid="tag-bar">{tags.map((tag) => tag.name).join(',')}</div>
  ),
}));

vi.mock('../../../src/features/notes/components/NoteEditor', () => ({
  NoteEditor: ({ initialContent }: { initialContent: string }) => (
    <div data-testid="note-editor">{initialContent}</div>
  ),
}));

const sampleNote = {
  id: 'n1',
  title: 'Existing note',
  content: '<p>hello</p>',
  tags: [{ id: 't1', name: 'Work', color: '#111111' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/notes/:id" element={<EditorPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditorPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ editorDirty: false });
  });

  it('renders a blank editor immediately for /notes/new (Scenario 4)', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn() });

    renderAt('/notes/new');

    expect(screen.getByTestId('action-header')).toHaveTextContent('no-delete');
    expect(screen.getByTestId('action-header')).toHaveTextContent('title-autofocus');
    expect(screen.getByTestId('tag-bar')).toHaveTextContent('');
    expect(screen.getByTestId('note-editor')).toHaveTextContent('');
  });

  it('shows a loading skeleton while an existing note is being fetched', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn() });

    renderAt('/notes/n1');

    expect(screen.getByTestId('editor-skeleton')).toBeInTheDocument();
  });

  it('shows the not-found state on a 404', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn() });

    renderAt('/notes/does-not-exist');

    expect(screen.getByText('Note not found')).toBeInTheDocument();
  });

  it('seeds title/content/tags from the loaded note and allows delete', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: { note: sampleNote },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'saved', forceSave: vi.fn() });

    renderAt('/notes/n1');

    expect(screen.getByTestId('action-header')).toHaveTextContent('Existing note / saved / can-delete');
    expect(screen.getByTestId('action-header')).toHaveTextContent('title-no-autofocus');
    expect(screen.getByTestId('tag-bar')).toHaveTextContent('Work');
    expect(screen.getByTestId('note-editor')).toHaveTextContent('hello');
  });

  it('Ctrl+S calls forceSave', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: { note: sampleNote },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    const forceSave = vi.fn();
    vi.mocked(useAutosave).mockReturnValue({ status: 'saved', forceSave });

    renderAt('/notes/n1');
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    expect(forceSave).toHaveBeenCalled();
  });

  it('onCreated navigates to the new note id with replace (plan.md Decision 1)', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn() });

    renderAt('/notes/new');

    const onCreated = vi.mocked(useAutosave).mock.calls[0][0].onCreated;
    onCreated(sampleNote);

    expect(navigateMock).toHaveBeenCalledWith('/notes/n1', { replace: true });
  });
});
