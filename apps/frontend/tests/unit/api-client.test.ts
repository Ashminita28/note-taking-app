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

  it('clears auth immediately on TOKEN_MISSING without attempting a refresh', async () => {
    useAuthStore.getState().setTokens('stale-token', 'refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'TOKEN_MISSING', message: 'x' } }), { status: 401 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.request({ path: '/notes' })).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears auth immediately on TOKEN_INVALID without attempting a refresh', async () => {
    useAuthStore.getState().setTokens('stale-token', 'refresh');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'TOKEN_INVALID', message: 'x' } }), { status: 401 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.request({ path: '/notes' })).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes an expired access token and retries the original request once', async () => {
    useAuthStore.getState().setTokens('stale-token', 'refresh-token');

    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          new Response(JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' }), {
            status: 200,
          }),
        );
      }
      const { accessToken } = useAuthStore.getState();
      if (accessToken === 'new-access') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'x' } }), { status: 401 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.request<{ ok: boolean }>({ path: '/notes' });

    expect(result).toEqual({ ok: true });
    expect(useAuthStore.getState().accessToken).toBe('new-access');
    expect(
      fetchMock.mock.calls.filter(([url]) => (url as string).endsWith('/auth/refresh')),
    ).toHaveLength(1);
  });

  it('shares a single in-flight refresh across concurrent 401s', async () => {
    useAuthStore.getState().setTokens('stale-token', 'refresh-token');

    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          new Response(JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' }), {
            status: 200,
          }),
        );
      }
      const { accessToken } = useAuthStore.getState();
      if (accessToken === 'new-access') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'x' } }), { status: 401 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([apiClient.request({ path: '/notes' }), apiClient.request({ path: '/tags' })]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => (url as string).endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('clears auth and surfaces the error when the refresh call itself fails', async () => {
    useAuthStore.getState().setTokens('stale-token', 'refresh-token');

    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token.' } }),
            { status: 401 },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'x' } }), { status: 401 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.request({ path: '/notes' })).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
    });
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('leaves the auth store untouched for a 401 from an unauthenticated endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'x' } }), {
          status: 401,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.request({ path: '/auth/login', method: 'POST' })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
