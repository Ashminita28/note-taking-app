import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../../../../src/lib/api-client';
import { getVersions, getVersion, restoreVersion } from '../../../../src/features/versions/versions.api';

vi.mock('../../../../src/lib/api-client', () => ({
  apiClient: { request: vi.fn() },
}));

describe('versions.api', () => {
  afterEach(() => {
    vi.mocked(apiClient.request).mockClear();
  });

  it('getVersions calls GET /notes/:id/versions', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ versions: [] });

    await getVersions('note-1');

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes/note-1/versions' });
  });

  it('getVersion calls GET /notes/:id/versions/:versionNumber', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ version: {} });

    await getVersion('note-1', 3);

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes/note-1/versions/3' });
  });

  it('restoreVersion posts to /notes/:id/versions/:versionNumber/restore', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ note: {} });

    await restoreVersion('note-1', 2);

    expect(apiClient.request).toHaveBeenCalledWith({
      path: '/notes/note-1/versions/2/restore',
      method: 'POST',
    });
  });
});
