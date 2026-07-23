import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  LogoutRequest,
  LogoutResponse,
} from '@note-app/shared';
import { apiClient } from '../../lib/api-client';

export function registerUser(input: RegisterRequest): Promise<RegisterResponse> {
  return apiClient.request({ path: '/auth/register', method: 'POST', body: input });
}

export function loginUser(input: LoginRequest): Promise<LoginResponse> {
  return apiClient.request({ path: '/auth/login', method: 'POST', body: input });
}

export function forgotPassword(input: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  return apiClient.request({ path: '/auth/forgot-password', method: 'POST', body: input });
}

export function verifyOtp(input: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  return apiClient.request({ path: '/auth/verify-otp', method: 'POST', body: input });
}

export function resetPassword(input: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  return apiClient.request({ path: '/auth/reset-password', method: 'POST', body: input });
}

export function logoutUser(input: LogoutRequest): Promise<LogoutResponse> {
  return apiClient.request({ path: '/auth/logout', method: 'POST', body: input });
}
