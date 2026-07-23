import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { OtpForm } from '../../../../../src/features/auth/components/OtpForm';
import { forgotPassword, verifyOtp } from '../../../../../src/features/auth/auth.api';
import { ApiError } from '../../../../../src/lib/api-client';

const navigateMock = vi.fn();
let mockLocationState: unknown = { email: 'jane@example.com' };

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: mockLocationState }),
  };
});

vi.mock('../../../../../src/features/auth/auth.api', () => ({
  forgotPassword: vi.fn(),
  verifyOtp: vi.fn(),
}));

function renderForm() {
  return render(
    <MemoryRouter>
      <OtpForm />
    </MemoryRouter>,
  );
}

function fillOtp(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    fireEvent.change(screen.getByLabelText(`Digit ${index + 1} of 6`), { target: { value: value[index] } });
  }
}

describe('OtpForm', () => {
  beforeEach(() => {
    mockLocationState = { email: 'jane@example.com' };
  });

  afterEach(() => {
    navigateMock.mockClear();
    vi.mocked(verifyOtp).mockReset();
    vi.mocked(forgotPassword).mockReset();
  });

  it('redirects to /forgot-password when no email is in location state', () => {
    mockLocationState = null;
    render(
      <MemoryRouter initialEntries={['/verify-otp']}>
        <Routes>
          <Route path="/verify-otp" element={<OtpForm />} />
          <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Forgot Password Page')).toBeInTheDocument();
  });

  it('verifies successfully and navigates to /reset-password with the token', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ resetToken: 'reset-token-123' });
    renderForm();

    fillOtp('123456');

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/reset-password', {
        state: { resetToken: 'reset-token-123' },
      }),
    );
  });

  it('auto-submits as soon as the 6th digit is entered, without clicking Verify', async () => {
    vi.mocked(verifyOtp).mockResolvedValue({ resetToken: 'reset-token-456' });
    renderForm();

    fillOtp('123456');

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/reset-password', {
        state: { resetToken: 'reset-token-456' },
      }),
    );
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });

  it('decrements the attempts counter on an incorrect code', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new ApiError(401, 'INVALID_OTP', 'Incorrect'));
    renderForm();

    fillOtp('111111');

    expect(await screen.findByText('Incorrect code. 4 attempts remaining.')).toBeInTheDocument();
  });

  it('disables Verify and reveals Resend on an expired code', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new ApiError(410, 'OTP_EXPIRED', 'Expired'));
    renderForm();

    fillOtp('111111');

    expect(await screen.findByText('Code expired.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
  });

  it('disables Resend while the code has not expired', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new ApiError(401, 'INVALID_OTP', 'Incorrect'));
    renderForm();

    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();

    fillOtp('111111');
    await screen.findByText('Incorrect code. 4 attempts remaining.');

    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();
  });

  it('shakes the OTP input on an incorrect code', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new ApiError(401, 'INVALID_OTP', 'Incorrect'));
    renderForm();

    fillOtp('111111');

    // Assert both effects of the same state update together — checking the shake class in a
    // separate `await` after the error text risks the real 400ms shake timeout already having
    // elapsed under a slow/loaded test run, removing the class before a later assertion runs.
    await waitFor(() => {
      expect(screen.getByText('Incorrect code. 4 attempts remaining.')).toBeInTheDocument();
      expect(screen.getByLabelText('Digit 1 of 6').parentElement).toHaveClass('animate-shake');
    });
  });

  it('resend re-requests a code and resets the attempts counter once expired', async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new ApiError(410, 'OTP_EXPIRED', 'Expired'));
    vi.mocked(forgotPassword).mockResolvedValue({ message: 'ok' });
    renderForm();

    fillOtp('111111');
    await screen.findByText('Code expired.');

    const resendButton = screen.getByRole('button', { name: 'Resend code' });
    expect(resendButton).not.toBeDisabled();
    fireEvent.click(resendButton);

    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith({ email: 'jane@example.com' }));
    expect(screen.queryByText('Code expired.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend code' })).toBeDisabled();
  });
});
