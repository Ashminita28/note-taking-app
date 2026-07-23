import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiClient } from '../../../../src/lib/api-client';
import {
  registerUser,
  loginUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
  logoutUser,
} from '../../../../src/features/auth/auth.api';

vi.mock('../../../../src/lib/api-client', () => ({
  apiClient: { request: vi.fn().mockResolvedValue({ ok: true }) },
}));

describe('auth.api', () => {
  afterEach(() => {
    vi.mocked(apiClient.request).mockClear();
  });

  it('registerUser posts to /auth/register', async () => {
    const input = { name: 'Jane', email: 'jane@example.com', password: 'Password1!' };
    await registerUser(input);
    expect(apiClient.request).toHaveBeenCalledWith({ path: '/auth/register', method: 'POST', body: input });
  });

  it('loginUser posts to /auth/login', async () => {
    const input = { email: 'jane@example.com', password: 'Password1!' };
    await loginUser(input);
    expect(apiClient.request).toHaveBeenCalledWith({ path: '/auth/login', method: 'POST', body: input });
  });

  it('forgotPassword posts to /auth/forgot-password', async () => {
    const input = { email: 'jane@example.com' };
    await forgotPassword(input);
    expect(apiClient.request).toHaveBeenCalledWith({
      path: '/auth/forgot-password',
      method: 'POST',
      body: input,
    });
  });

  it('verifyOtp posts to /auth/verify-otp', async () => {
    const input = { email: 'jane@example.com', otp: '123456' };
    await verifyOtp(input);
    expect(apiClient.request).toHaveBeenCalledWith({ path: '/auth/verify-otp', method: 'POST', body: input });
  });

  it('resetPassword posts to /auth/reset-password', async () => {
    const input = { resetToken: 'token', newPassword: 'Password1!' };
    await resetPassword(input);
    expect(apiClient.request).toHaveBeenCalledWith({
      path: '/auth/reset-password',
      method: 'POST',
      body: input,
    });
  });

  it('logoutUser posts to /auth/logout', async () => {
    const input = { refreshToken: 'refresh' };
    await logoutUser(input);
    expect(apiClient.request).toHaveBeenCalledWith({ path: '/auth/logout', method: 'POST', body: input });
  });
});
