import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordForm } from '../../../../../src/features/auth/components/ForgotPasswordForm';
import { forgotPassword } from '../../../../../src/features/auth/auth.api';
import { ApiError } from '../../../../../src/lib/api-client';
import { toast } from '../../../../../src/components/ui/use-toast';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('../../../../../src/features/auth/auth.api', () => ({
  forgotPassword: vi.fn(),
}));

vi.mock('../../../../../src/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <ForgotPasswordForm />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordForm', () => {
  afterEach(() => {
    navigateMock.mockClear();
    vi.mocked(forgotPassword).mockReset();
    vi.mocked(toast).mockClear();
  });

  it('navigates to /verify-otp with the email on any 200', async () => {
    vi.mocked(forgotPassword).mockResolvedValue({ message: 'ok' });
    renderForm();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/verify-otp', { state: { email: 'jane@example.com' } }),
    );
  });

  it('shows an invalid-email message without calling the API', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    expect(forgotPassword).not.toHaveBeenCalled();
  });

  it('shows a rate-limit toast and stays on the page for a 429', async () => {
    vi.mocked(forgotPassword).mockRejectedValue(new ApiError(429, 'OTP_RATE_LIMIT', 'Too many requests'));
    renderForm();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Too many requests' })),
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
