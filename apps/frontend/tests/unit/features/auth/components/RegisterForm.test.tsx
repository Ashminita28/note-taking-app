import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterForm } from '../../../../../src/features/auth/components/RegisterForm';
import { registerUser } from '../../../../../src/features/auth/auth.api';
import { ApiError } from '../../../../../src/lib/api-client';
import { toast } from '../../../../../src/components/ui/use-toast';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../../../src/features/auth/auth.api', () => ({
  registerUser: vi.fn(),
}));

vi.mock('../../../../../src/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  );
}

describe('RegisterForm', () => {
  afterEach(() => {
    navigateMock.mockClear();
    vi.mocked(registerUser).mockReset();
    vi.mocked(toast).mockClear();
  });

  it('submits and redirects to /login on success', async () => {
    vi.mocked(registerUser).mockResolvedValue({
      user: { id: '1', name: 'Jane Doe', email: 'jane@example.com' },
    });
    renderForm();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(registerUser).toHaveBeenCalledWith({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password1!',
      }),
    );
    expect(toast).toHaveBeenCalledWith({ title: 'Account created! Please sign in.' });
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('shows field errors without calling the API for blank fields', async () => {
    renderForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Full name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it('shows a password complexity message', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'alllowercase1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Must contain at least one uppercase letter')).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it('shows a banner for a duplicate email (409)', async () => {
    vi.mocked(registerUser).mockRejectedValue(new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'Email exists'));
    renderForm();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('maps server-side 422 VALIDATION_ERROR details to fields', async () => {
    vi.mocked(registerUser).mockRejectedValue(
      new ApiError(422, 'VALIDATION_ERROR', 'Invalid', [{ field: 'email', message: 'Server says invalid' }]),
    );
    renderForm();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Server says invalid')).toBeInTheDocument();
  });
});
