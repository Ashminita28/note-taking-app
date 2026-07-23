import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from '../../../../../src/features/auth/components/LoginForm';
import { loginUser } from '../../../../../src/features/auth/auth.api';
import { ApiError } from '../../../../../src/lib/api-client';
import { useAuthStore } from '../../../../../src/stores/auth.store';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../../../src/features/auth/auth.api', () => ({
  loginUser: vi.fn(),
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>,
  );
}

describe('LoginForm', () => {
  afterEach(() => {
    navigateMock.mockClear();
    vi.mocked(loginUser).mockReset();
    useAuthStore.getState().clearAuth();
  });

  it('stores tokens/user and redirects to / on success', async () => {
    vi.mocked(loginUser).mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: { id: '1', name: 'Jane', email: 'jane@example.com' },
    });
    renderForm();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
    expect(useAuthStore.getState().accessToken).toBe('access');
    expect(useAuthStore.getState().user).toEqual({ id: '1', name: 'Jane', email: 'jane@example.com' });
  });

  it('shows required-field messages without calling the API', () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginUser).not.toHaveBeenCalled();
  });

  it('shows a generic banner on invalid credentials and preserves the email', async () => {
    vi.mocked(loginUser).mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials'));
    renderForm();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
