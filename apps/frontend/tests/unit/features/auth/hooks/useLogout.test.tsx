import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLogout } from '../../../../../src/features/auth/hooks/useLogout';
import { useAuthStore } from '../../../../../src/stores/auth.store';
import { logoutUser } from '../../../../../src/features/auth/auth.api';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../../../../src/features/auth/auth.api', () => ({
  logoutUser: vi.fn(),
}));

describe('useLogout', () => {
  afterEach(() => {
    navigateMock.mockClear();
    vi.mocked(logoutUser).mockClear();
    useAuthStore.getState().clearAuth();
  });

  it('calls logoutUser, clears the store, and navigates to /login', async () => {
    useAuthStore.getState().setTokens('access', 'refresh-token');
    vi.mocked(logoutUser).mockResolvedValue({ message: 'ok' });

    const { result } = renderHook(() => useLogout());
    await act(async () => {
      await result.current();
    });

    expect(logoutUser).toHaveBeenCalledWith({ refreshToken: 'refresh-token' });
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('still clears the store and navigates when logoutUser rejects', async () => {
    useAuthStore.getState().setTokens('access', 'refresh-token');
    vi.mocked(logoutUser).mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useLogout());
    await act(async () => {
      await result.current();
    });

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('skips the API call when there is no refresh token', async () => {
    const { result } = renderHook(() => useLogout());
    await act(async () => {
      await result.current();
    });

    expect(logoutUser).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });
});
