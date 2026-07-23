import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserMenu } from '../../../../../src/features/auth/components/UserMenu';
import { useAuthStore } from '../../../../../src/stores/auth.store';

const logoutMock = vi.fn();

vi.mock('../../../../../src/features/auth/hooks/useLogout', () => ({
  useLogout: () => logoutMock,
}));

describe('UserMenu', () => {
  afterEach(() => {
    logoutMock.mockClear();
    useAuthStore.getState().clearAuth();
  });

  it('shows the user name on the trigger and email in the menu', () => {
    useAuthStore.getState().setUser({ id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' });

    render(<UserMenu />);
    expect(screen.getByRole('button', { name: 'User menu' })).toHaveTextContent('Ada Lovelace');

    fireEvent.keyDown(screen.getByRole('button', { name: 'User menu' }), { key: 'Enter' });
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('calls useLogout when "Sign out" is selected', () => {
    useAuthStore.getState().setUser({ id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' });

    render(<UserMenu />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'User menu' }), { key: 'Enter' });
    fireEvent.click(screen.getByText('Sign out'));

    expect(logoutMock).toHaveBeenCalled();
  });
});
