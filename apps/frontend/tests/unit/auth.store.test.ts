import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../src/stores/auth.store';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('sets tokens and becomes authenticated', () => {
    useAuthStore.getState().setTokens('access', 'refresh');

    expect(useAuthStore.getState().accessToken).toBe('access');
    expect(useAuthStore.getState().refreshToken).toBe('refresh');
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it('sets the user', () => {
    const user = { id: '1', name: 'Jane Doe', email: 'jane@example.com' };
    useAuthStore.getState().setUser(user);

    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('clears all auth state', () => {
    useAuthStore.getState().setTokens('a', 'b');
    useAuthStore.getState().setUser({ id: '1', name: 'Jane Doe', email: 'jane@example.com' });

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });
});
