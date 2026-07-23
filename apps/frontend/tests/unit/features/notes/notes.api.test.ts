import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../../../../src/lib/api-client';
import { getNotes, restoreNote } from '../../../../src/features/notes/notes.api';

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
});
