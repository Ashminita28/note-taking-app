import type { Request, Response } from 'express';
import type {
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  LogoutRequest,
  ForgotPasswordRequest,
  VerifyOtpRequest,
  ResetPasswordRequest,
} from '@note-app/shared';
import { prisma } from '../../config/prisma.js';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  getUserProfile,
  requestPasswordReset,
  verifyOtp,
  resetPassword,
} from './auth.service.js';

export async function register(req: Request, res: Response): Promise<void> {
  const user = await registerUser(prisma, req.body as RegisterRequest);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await loginUser(prisma, req.body as LoginRequest);
  res.status(200).json(result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const result = await refreshTokens(prisma, req.body as RefreshRequest);
  res.status(200).json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const result = await logoutUser(prisma, req.userId as string, req.body as LogoutRequest);
  res.status(200).json(result);
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const result = await getUserProfile(prisma, req.userId as string);
  res.status(200).json(result);
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const result = await requestPasswordReset(prisma, req.body as ForgotPasswordRequest);
  res.status(200).json(result);
}

export async function verifyOtpHandler(req: Request, res: Response): Promise<void> {
  const result = await verifyOtp(prisma, req.body as VerifyOtpRequest);
  res.status(200).json(result);
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const result = await resetPassword(prisma, req.body as ResetPasswordRequest);
  res.status(200).json(result);
}
