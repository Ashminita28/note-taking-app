import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../../../src/components/ProtectedRoute';
import { useAuthStore } from '../../../src/stores/auth.store';

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div>Dashboard Page</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('redirects to /login when unauthenticated', () => {
    renderProtected();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    useAuthStore.getState().setTokens('access', 'refresh');
    renderProtected();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});
