import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../../../../src/lib/api-client';
import { getTags } from '../../../../src/features/tags/tags.api';

vi.mock('../../../../src/lib/api-client', () => ({
  apiClient: { request: vi.fn() },
}));

describe('tags.api', () => {
  afterEach(() => {
    vi.mocked(apiClient.request).mockClear();
  });

  it('getTags calls apiClient with the tags path', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ tags: [] });

    await getTags();

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/tags' });
  });
});
