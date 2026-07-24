import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../../../../src/lib/api-client';
import {
  getNotes,
  restoreNote,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} from '../../../../src/features/notes/notes.api';

vi.mock('../../../../src/lib/api-client', () => ({
  apiClient: { request: vi.fn() },
}));

describe('notes.api', () => {
  afterEach(() => {
    vi.mocked(apiClient.request).mockClear();
  });

  it('getNotes calls apiClient with the built query string', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ data: [], pagination: {} });

    await getNotes({ page: 1, sortBy: 'updatedAt', sortOrder: 'desc', tagIds: [], trash: false });

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes?page=1&sortBy=updatedAt&sortOrder=desc' });
  });

  it('restoreNote posts to the restore endpoint', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ note: {} });

    await restoreNote('note-1');

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes/note-1/restore', method: 'POST' });
  });

  it('getNote calls apiClient with the note detail path', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ note: {} });

    await getNote('note-1');

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes/note-1' });
  });

  it('createNote posts the input to /notes', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ note: {} });
    const input = { title: 'Untitled', content: '', tagIds: [] };

    await createNote(input);

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes', method: 'POST', body: input });
  });

  it('updateNote patches /notes/:id with the input', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ note: {} });
    const input = { title: 'Updated' };

    await updateNote('note-1', input);

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes/note-1', method: 'PATCH', body: input });
  });

  it('deleteNote calls DELETE on /notes/:id', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ message: 'Note deleted successfully.' });

    await deleteNote('note-1');

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes/note-1', method: 'DELETE' });
  });
});
