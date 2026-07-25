import { describe, it, expect, vi, afterEach } from 'vitest';
import { forwardRef, useImperativeHandle } from 'react';
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
    onShare,
    onHistory,
  }: {
    title: string;
    status: string;
    canDelete: boolean;
    autoFocusTitle?: boolean;
    onShare?: () => void;
    onHistory?: () => void;
  }) => (
    <div data-testid="action-header">
      {title} / {status} / {canDelete ? 'can-delete' : 'no-delete'} /{' '}
      {autoFocusTitle ? 'title-autofocus' : 'title-no-autofocus'}
      {onShare && (
        <button type="button" onClick={onShare}>
          Share
        </button>
      )}
      {onHistory && (
        <button type="button" onClick={onHistory}>
          History
        </button>
      )}
    </div>
  ),
}));

vi.mock('../../../src/features/share/components/ShareModal', () => ({
  ShareModal: ({ noteId, open }: { noteId: string; open: boolean }) => (
    <div data-testid="share-modal">
      {noteId} / {open ? 'open' : 'closed'}
    </div>
  ),
}));

vi.mock('../../../src/features/versions/components/VersionHistoryDrawer', () => ({
  VersionHistoryDrawer: ({
    noteId,
    open,
    onRestored,
  }: {
    noteId: string;
    open: boolean;
    onRestored: (note: { title: string; content: string }) => void;
  }) => (
    <div data-testid="version-history-drawer">
      {noteId} / {open ? 'open' : 'closed'}
      <button
        type="button"
        onClick={() => onRestored({ title: 'Restored title', content: '<p>restored</p>' })}
      >
        Simulate Restore
      </button>
    </div>
  ),
}));

vi.mock('../../../src/features/notes/components/TagBar', () => ({
  TagBar: ({ tags }: { tags: { name: string }[] }) => (
    <div data-testid="tag-bar">{tags.map((tag) => tag.name).join(',')}</div>
  ),
}));

const noteEditorSetContentMock = vi.fn();
vi.mock('../../../src/features/notes/components/NoteEditor', () => ({
  NoteEditor: forwardRef<{ setContent: (html: string) => void }, { initialContent: string }>(
    function NoteEditor({ initialContent }, ref) {
      useImperativeHandle(ref, () => ({ setContent: noteEditorSetContentMock }), []);
      return <div data-testid="note-editor">{initialContent}</div>;
    },
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
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn(), syncBaseline: vi.fn() });

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
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn(), syncBaseline: vi.fn() });

    renderAt('/notes/n1');

    expect(screen.getByTestId('editor-skeleton')).toBeInTheDocument();
  });

  it('shows the not-found state on a 404', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn(), syncBaseline: vi.fn() });

    renderAt('/notes/does-not-exist');

    expect(screen.getByText('Note not found')).toBeInTheDocument();
  });

  it('seeds title/content/tags from the loaded note and allows delete', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: { note: sampleNote },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'saved', forceSave: vi.fn(), syncBaseline: vi.fn() });

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
    vi.mocked(useAutosave).mockReturnValue({ status: 'saved', forceSave, syncBaseline: vi.fn() });

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
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn(), syncBaseline: vi.fn() });

    renderAt('/notes/new');

    const onCreated = vi.mocked(useAutosave).mock.calls[0][0].onCreated;
    onCreated(sampleNote);

    expect(navigateMock).toHaveBeenCalledWith('/notes/n1', { replace: true });
  });

  it('clicking Share opens ShareModal for the current note (AB-1014)', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: { note: sampleNote },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'saved', forceSave: vi.fn(), syncBaseline: vi.fn() });

    renderAt('/notes/n1');

    expect(screen.getByTestId('share-modal')).toHaveTextContent('n1 / closed');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    expect(screen.getByTestId('share-modal')).toHaveTextContent('n1 / open');
  });

  it('clicking History opens VersionHistoryDrawer for the current note (AB-1015)', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: { note: sampleNote },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'saved', forceSave: vi.fn(), syncBaseline: vi.fn() });

    renderAt('/notes/n1');

    expect(screen.getByTestId('version-history-drawer')).toHaveTextContent('n1 / closed');
    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(screen.getByTestId('version-history-drawer')).toHaveTextContent('n1 / open');
  });

  it('does not offer History for a brand-new, unsaved note (Scenario 2)', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    vi.mocked(useAutosave).mockReturnValue({ status: 'idle', forceSave: vi.fn(), syncBaseline: vi.fn() });

    renderAt('/notes/new');

    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument();
  });

  it('a restore from the drawer updates the draft and pushes the content into the live editor (plan.md Decision 1)', () => {
    vi.mocked(useNoteQuery).mockReturnValue({
      data: { note: sampleNote },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useNoteQuery>);
    const syncBaseline = vi.fn();
    vi.mocked(useAutosave).mockReturnValue({ status: 'saved', forceSave: vi.fn(), syncBaseline });

    renderAt('/notes/n1');
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Restore' }));

    expect(screen.getByTestId('action-header')).toHaveTextContent('Restored title');
    expect(screen.getByTestId('note-editor')).toHaveTextContent('restored');
    expect(syncBaseline).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Restored title', content: '<p>restored</p>' }),
    );
    expect(noteEditorSetContentMock).toHaveBeenCalledWith('<p>restored</p>');
  });
});
