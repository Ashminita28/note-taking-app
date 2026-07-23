import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.accessToken !== null);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
