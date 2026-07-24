import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NOTE_CONTENT_MAX_SIZE_BYTES } from '@note-app/shared';
import { useAutosave } from '../../../../src/features/notes/useAutosave';
import { createNote, updateNote } from '../../../../src/features/notes/notes.api';
import { NOTE_CONTENT_TOO_LARGE_MESSAGE } from '../../../../src/features/notes/notes.constants';
import { useUIStore } from '../../../../src/stores/ui.store';
import { ApiError } from '../../../../src/lib/api-client';
import type { EditorDraft } from '../../../../src/features/notes/notes.types';

vi.mock('../../../../src/features/notes/notes.api', () => ({
  createNote: vi.fn(),
  updateNote: vi.fn(),
}));

const sampleNote = {
  id: 'n1',
  title: 'Untitled',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUIStore.setState({ editorDirty: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not save when the draft is unchanged (dirty check)', () => {
    const draft: EditorDraft = { title: 'Untitled', content: '', tagIds: [] };
    renderHook(() => useAutosave({ id: 'new', isNew: true, draft, ready: true, onCreated: vi.fn() }), {
      wrapper: createWrapper(),
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(createNote).not.toHaveBeenCalled();
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('debounces for 2s of inactivity before creating a new note', async () => {
    vi.mocked(createNote).mockResolvedValue({ note: sampleNote });
    const onCreated = vi.fn();
    let draft: EditorDraft = { title: '', content: '', tagIds: [] };

    const { rerender } = renderHook(() => useAutosave({ id: 'new', isNew: true, draft, ready: true, onCreated }), {
      wrapper: createWrapper(),
    });

    draft = { title: 'My note', content: '', tagIds: [] };
    rerender();

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(createNote).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    // The debounce timer has fired and kicked off the (real, unfaked) mutation promise chain —
    // switch back to real timers so `waitFor`'s internal polling can actually observe it resolve.
    vi.useRealTimers();

    await waitFor(() => expect(createNote).toHaveBeenCalledWith({ title: 'My note', content: '', tagIds: [] }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(sampleNote));
  });

  it('uses updateNote (not createNote) once the note already exists', async () => {
    vi.mocked(updateNote).mockResolvedValue({ note: sampleNote });
    let draft: EditorDraft = { title: 'Existing', content: '', tagIds: [] };

    const { rerender } = renderHook(() => useAutosave({ id: 'n1', isNew: false, draft, ready: true, onCreated: vi.fn() }), {
      wrapper: createWrapper(),
    });

    draft = { title: 'Existing, edited', content: '', tagIds: [] };
    rerender();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(updateNote).toHaveBeenCalledWith('n1', { title: 'Existing, edited', content: '', tagIds: [] }),
    );
    expect(createNote).not.toHaveBeenCalled();
  });

  it('forceSave cancels the pending debounce and saves immediately', async () => {
    vi.mocked(updateNote).mockResolvedValue({ note: sampleNote });
    let draft: EditorDraft = { title: 'Existing', content: '', tagIds: [] };

    const { result, rerender } = renderHook(
      () => useAutosave({ id: 'n1', isNew: false, draft, ready: true, onCreated: vi.fn() }),
      { wrapper: createWrapper() },
    );

    draft = { title: 'Force saved', content: '', tagIds: [] };
    rerender();

    act(() => {
      result.current.forceSave();
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(updateNote).toHaveBeenCalledWith('n1', { title: 'Force saved', content: '', tagIds: [] }),
    );
  });

  it('shows an error status without calling the API when content exceeds the size limit', () => {
    const oversizedContent = 'a'.repeat(NOTE_CONTENT_MAX_SIZE_BYTES + 1);
    let draft: EditorDraft = { title: 'Existing', content: '', tagIds: [] };

    const { result, rerender } = renderHook(
      () => useAutosave({ id: 'n1', isNew: false, draft, ready: true, onCreated: vi.fn() }),
      { wrapper: createWrapper() },
    );

    draft = { title: 'Existing', content: oversizedContent, tagIds: [] };
    rerender();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(NOTE_CONTENT_TOO_LARGE_MESSAGE);
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('sets an error status when the save request fails', async () => {
    vi.mocked(updateNote).mockRejectedValue(new Error('network error'));
    let draft: EditorDraft = { title: 'Existing', content: '', tagIds: [] };

    const { result, rerender } = renderHook(
      () => useAutosave({ id: 'n1', isNew: false, draft, ready: true, onCreated: vi.fn() }),
      { wrapper: createWrapper() },
    );

    draft = { title: 'Existing, edited', content: '', tagIds: [] };
    rerender();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();

    await waitFor(() => expect(result.current.status).toBe('error'));
  });

  it('surfaces the server error message when the save request fails with an ApiError (Scenario 12)', async () => {
    vi.mocked(updateNote).mockRejectedValue(new ApiError(413, 'CONTENT_TOO_LARGE', 'Content exceeds the allowed size.'));
    let draft: EditorDraft = { title: 'Existing', content: '', tagIds: [] };

    const { result, rerender } = renderHook(
      () => useAutosave({ id: 'n1', isNew: false, draft, ready: true, onCreated: vi.fn() }),
      { wrapper: createWrapper() },
    );

    draft = { title: 'Existing, edited', content: '', tagIds: [] };
    rerender();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();

    await waitFor(() => expect(result.current.errorMessage).toBe('Content exceeds the allowed size.'));
  });

  it('does not save or mark dirty when an existing note finishes loading (ready flips true)', () => {
    // Reproduces the EditorPage sequence: mounts with the blank placeholder draft while the
    // note is still loading (`ready: false`), then the real note arrives in one update
    // (`ready: true` + real `draft` together). That transition must adopt the real draft as
    // the baseline, not treat it as a user edit against the blank placeholder.
    let draft: EditorDraft = { title: '', content: '', tagIds: [] };
    let ready = false;

    const { result, rerender } = renderHook(
      () => useAutosave({ id: 'n1', isNew: false, draft, ready, onCreated: vi.fn() }),
      { wrapper: createWrapper() },
    );

    draft = { title: 'Existing note', content: '<p>hello</p>', tagIds: ['tag-1'] };
    ready = true;
    rerender();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(updateNote).not.toHaveBeenCalled();
    expect(useUIStore.getState().editorDirty).toBe(false);
  });

  it('shows "Saved ✓" once an existing note finishes loading with no pending edits (Scenario 1)', () => {
    let draft: EditorDraft = { title: '', content: '', tagIds: [] };
    let ready = false;

    const { result, rerender } = renderHook(
      () => useAutosave({ id: 'n1', isNew: false, draft, ready, onCreated: vi.fn() }),
      { wrapper: createWrapper() },
    );

    expect(result.current.status).toBe('idle');

    draft = { title: 'Existing note', content: '<p>hello</p>', tagIds: ['tag-1'] };
    ready = true;
    rerender();

    expect(result.current.status).toBe('saved');
  });

  it('stays idle (not "saved") for a brand-new note that has never been created', () => {
    const draft: EditorDraft = { title: '', content: '', tagIds: [] };

    const { result } = renderHook(() => useAutosave({ id: 'new', isNew: true, draft, ready: true, onCreated: vi.fn() }), {
      wrapper: createWrapper(),
    });

    expect(result.current.status).toBe('idle');
  });

  it('chains into a newer edit that arrived while a save was still in flight (race regression)', async () => {
    // Reproduces the overlapping-save bug: an edit's debounce timer fires a save (A) that takes a
    // while to resolve; a further edit's debounce timer fires its own save (B) before A resolves.
    // B must not be silently dropped — once A resolves, its newer draft must still be sent.
    let resolveFirstSave: (value: { note: typeof sampleNote }) => void;
    const firstSave = new Promise<{ note: typeof sampleNote }>((resolve) => {
      resolveFirstSave = resolve;
    });
    vi.mocked(updateNote).mockReturnValueOnce(firstSave).mockResolvedValueOnce({ note: sampleNote });

    let draft: EditorDraft = { title: 'Existing', content: '', tagIds: [] };
    const { result, rerender } = renderHook(
      () => useAutosave({ id: 'n1', isNew: false, draft, ready: true, onCreated: vi.fn() }),
      { wrapper: createWrapper() },
    );

    // Edit A: debounce fires, PATCH #1 kicks off and stays pending. `advanceTimersByTimeAsync`
    // (rather than the sync variant used elsewhere in this file) flushes the microtasks around
    // the fired timer, so the mutation call is observable without switching to real timers —
    // needed here since a second fake-timer-driven debounce (edit B) still has to fire below.
    draft = { title: 'Edit A', content: '', tagIds: [] };
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(updateNote).toHaveBeenNthCalledWith(1, 'n1', { title: 'Edit A', content: '', tagIds: [] });

    // Edit B arrives and its own debounce fires *while PATCH #1 is still unresolved*.
    draft = { title: 'Edit B', content: '', tagIds: [] };
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    // B's own save attempt is dropped by the in-flight guard — no second call yet.
    expect(updateNote).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().editorDirty).toBe(true);

    // PATCH #1 (edit A) now resolves, which chains straight into saving edit B (no more debounce
    // timers to fire from here) — switch to real timers so `waitFor`'s polling can observe it.
    vi.useRealTimers();
    await act(async () => {
      resolveFirstSave!({ note: sampleNote });
      await firstSave;
    });

    // Edit B must be chained into automatically rather than lost, and dirty must not clear until
    // it is actually saved.
    await waitFor(() => expect(updateNote).toHaveBeenCalledTimes(2));
    expect(updateNote).toHaveBeenNthCalledWith(2, 'n1', { title: 'Edit B', content: '', tagIds: [] });
    await waitFor(() => expect(useUIStore.getState().editorDirty).toBe(false));
    await waitFor(() => expect(result.current.status).toBe('saved'));
  });

  it('still detects a real edit made right after an existing note finishes loading', async () => {
    vi.mocked(updateNote).mockResolvedValue({ note: sampleNote });
    let draft: EditorDraft = { title: '', content: '', tagIds: [] };
    let ready = false;

    const { rerender } = renderHook(
      () => useAutosave({ id: 'n1', isNew: false, draft, ready, onCreated: vi.fn() }),
      { wrapper: createWrapper() },
    );

    draft = { title: 'Existing note', content: '', tagIds: [] };
    ready = true;
    rerender();

    draft = { title: 'Existing note, edited', content: '', tagIds: [] };
    rerender();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(updateNote).toHaveBeenCalledWith('n1', { title: 'Existing note, edited', content: '', tagIds: [] }),
    );
  });
});
