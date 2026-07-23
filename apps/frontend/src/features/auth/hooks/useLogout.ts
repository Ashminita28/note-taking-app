import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../stores/auth.store';
import { logoutUser } from '../auth.api';

/** Not wired to a button yet (no `UserMenu` until AB-1011) — exposed for that ticket to consume. */
export function useLogout(): () => Promise<void> {
  const navigate = useNavigate();

  return useCallback(async () => {
    const { refreshToken, clearAuth } = useAuthStore.getState();

    if (refreshToken) {
      await logoutUser({ refreshToken }).catch(() => {
        // Logout is idempotent server-side (AB-1002 spec) — a failed call still logs the user out locally.
      });
    }

    clearAuth();
    navigate('/login');
  }, [navigate]);
}
