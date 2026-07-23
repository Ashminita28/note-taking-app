import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ResetPasswordForm } from '../../../../../src/features/auth/components/ResetPasswordForm';
import { resetPassword } from '../../../../../src/features/auth/auth.api';
import { ApiError } from '../../../../../src/lib/api-client';
import { toast } from '../../../../../src/components/ui/use-toast';

const navigateMock = vi.fn();
let mockLocationState: unknown = { resetToken: 'reset-token-123' };

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: mockLocationState }),
  };
});

vi.mock('../../../../../src/features/auth/auth.api', () => ({
  resetPassword: vi.fn(),
}));

vi.mock('../../../../../src/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <ResetPasswordForm />
    </MemoryRouter>,
  );
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    mockLocationState = { resetToken: 'reset-token-123' };
  });

  afterEach(() => {
    navigateMock.mockClear();
    vi.mocked(resetPassword).mockReset();
    vi.mocked(toast).mockClear();
  });

  it('redirects to /forgot-password when there is no reset token', () => {
    mockLocationState = null;
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordForm />} />
          <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Forgot Password Page')).toBeInTheDocument();
  });

  it('submits successfully with a toast and redirect to /login', async () => {
    vi.mocked(resetPassword).mockResolvedValue({ message: 'ok' });
    renderForm();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith({
        resetToken: 'reset-token-123',
        newPassword: 'Password1!',
      }),
    );
    expect(toast).toHaveBeenCalledWith({ title: 'Password reset successful! Please sign in.' });
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('shows a mismatch message when confirm does not match', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('shows a weak-password message', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('shows a banner for an expired reset token (410)', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new ApiError(410, 'RESET_TOKEN_EXPIRED', 'Expired'));
    renderForm();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(
      await screen.findByText('This reset link is no longer valid. Please request a new code.'),
    ).toBeInTheDocument();
  });

  it('shows a banner for PASSWORD_SAME_AS_CURRENT (422)', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new ApiError(422, 'PASSWORD_SAME_AS_CURRENT', 'Same password'));
    renderForm();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password1!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password1!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(
      await screen.findByText('New password must be different from your current password.'),
    ).toBeInTheDocument();
  });
});
