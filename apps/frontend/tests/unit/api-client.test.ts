import { describe, it, expect, vi, afterEach } from 'vitest';
import { ERROR_CODES } from '@note-app/shared';
import { apiClient, ApiError } from '../../src/lib/api-client';
import { useAuthStore } from '../../src/stores/auth.store';

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.getState().clearAuth();
  });

  it('attaches the bearer token when authenticated', async () => {
    useAuthStore.getState().setTokens('my-token', 'refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.request({ path: '/notes' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.headers.get('Authorization')).toBe('Bearer my-token');
  });

  it('omits the Authorization header when unauthenticated', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.request({ path: '/public' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Headers }];
    expect(init.headers.has('Authorization')).toBe(false);
  });

  it('throws an ApiError with the parsed error envelope on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'NOTE_NOT_FOUND', message: 'Note not found.', details: [] } }),
          { status: 404 },
        ),
      ),
    );

    await expect(apiClient.request({ path: '/notes/1' })).rejects.toMatchObject({
      status: 404,
      code: 'NOTE_NOT_FOUND',
      message: 'Note not found.',
    });
  });

  it('falls back to a default error envelope when the response body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 500 })));

    await expect(apiClient.request({ path: '/notes' })).rejects.toMatchObject({
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again.',
    });
  });

  it('clears auth on a 401 response', async () => {
    useAuthStore.getState().setTokens('stale-token', 'refresh');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'x' } }), {
            status: 401,
          }),
        ),
    );

    await expect(apiClient.request({ path: '/notes' })).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
