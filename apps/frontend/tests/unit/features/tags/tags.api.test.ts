import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../../../../src/lib/api-client';
import { getTags, createTag } from '../../../../src/features/tags/tags.api';

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

  it('createTag posts the input to /tags', async () => {
    vi.mocked(apiClient.request).mockResolvedValue({ tag: {} });
    const input = { name: 'Work' };

    await createTag(input);

    expect(apiClient.request).toHaveBeenCalledWith({ path: '/tags', method: 'POST', body: input });
  });
});
