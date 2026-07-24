import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../../../../src/lib/api-client';
import { getShares, createShare, revokeShare, getSharedNote } from '../../../../src/features/share/share.api';

vi.mock('../../../../src/lib/api-client', () => ({
  apiClient: { request: vi.fn() },
}));

describe('share.api', () => {
  afterEach(() => {
    vi.mocked(apiClient.request).mockClear();
  });

  it('getShares calls GET /shares', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ shares: [] });

    await getShares();

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/shares' });
  });

  it('createShare posts the input to /notes/:id/share', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ shareLink: {} });
    const input = { expiresInHours: 24 };

    await createShare('note-1', input);

    expect(apiClient.request).toHaveBeenCalledWith({
      path: '/notes/note-1/share',
      method: 'POST',
      body: input,
    });
  });

  it('revokeShare calls DELETE on /notes/:id/share', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ message: 'Share link revoked successfully.' });

    await revokeShare('note-1');

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/notes/note-1/share', method: 'DELETE' });
  });

  it('getSharedNote calls GET /shared/:token', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ note: {} });

    await getSharedNote('tok1');

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/shared/tok1' });
  });
});
