import type { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type {
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  LogoutRequest,
  UserProfile,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '@note-app/shared';
import { config } from '../../config/env.js';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenExpiredError,
  InvalidOtpError,
  OtpExpiredError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
  PasswordSameAsCurrentError,
} from './auth.errors.js';
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  generateOtp,
  signResetToken,
  verifyResetToken,
} from './auth.tokens.js';

function toUserProfile(user: User): UserProfile {
  return { id: user.id, name: user.name, email: user.email };
}

export async function registerUser(
  prisma: PrismaClient,
  input: RegisterRequest,
): Promise<UserProfile> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash },
  });

  console.log(
    `[email:verification] Welcome ${user.email} — please verify your account (simulated).`,
  );

  return toUserProfile(user);
}

export async function loginUser(
  prisma: PrismaClient,
  input: LoginRequest,
): Promise<LoginResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  // Single-active-session semantics (FRS AF-1): a new login invalidates any prior session.
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const { token: refreshToken, tokenHash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt } });

  return { accessToken, refreshToken, user: toUserProfile(user) };
}

export async function refreshTokens(
  prisma: PrismaClient,
  input: RefreshRequest,
): Promise<RefreshResponse> {
  const tokenHash = hashToken(input.refreshToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record) {
    throw new InvalidRefreshTokenError();
  }

  // Rotation: the presented token is invalidated on use whether or not it turns out expired.
  await prisma.refreshToken.delete({ where: { id: record.id } });

  if (record.expiresAt.getTime() < Date.now()) {
    throw new RefreshTokenExpiredError();
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const generated = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: generated.tokenHash, expiresAt: generated.expiresAt },
  });

  return { accessToken, refreshToken: generated.token };
}

export async function logoutUser(
  prisma: PrismaClient,
  userId: string,
  input: LogoutRequest,
): Promise<LogoutResponse> {
  const tokenHash = hashToken(input.refreshToken);
  // deleteMany (not delete) so an already-invalidated token still succeeds — logout is idempotent.
  await prisma.refreshToken.deleteMany({ where: { tokenHash, userId } });
  return { message: 'Logged out successfully.' };
}

export async function getUserProfile(
  prisma: PrismaClient,
  userId: string,
): Promise<{ user: UserProfile }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { user: toUserProfile(user) };
}

const GENERIC_RESET_MESSAGE = 'If an account exists for that email, a reset code has been sent.';

function logSimulatedOtpEmail(email: string, otp: string): void {
  console.log(
    [
      '══════════════════════════════════════════',
      '📧 SIMULATED EMAIL',
      `To: ${email}`,
      'Subject: Password Reset OTP',
      `Body: Your OTP is: ${otp}. Expires in ${config.OTP_EXPIRY_MINUTES} minutes.`,
      '══════════════════════════════════════════',
    ].join('\n'),
  );
}

export async function requestPasswordReset(
  prisma: PrismaClient,
  input: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Email-enumeration prevention (FR-PWD-001 AF-1): no DB write and no log for an unknown email,
  // but the response is identical either way.
  if (user) {
    // Re-request invalidation (FR-PWD-001 AF-2 / BR-010): supersede any still-active prior OTP.
    await prisma.passwordResetOtp.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const { otp, otpHash, expiresAt } = generateOtp();
    await prisma.passwordResetOtp.create({ data: { userId: user.id, otpHash, expiresAt } });

    logSimulatedOtpEmail(user.email, otp);
  }

  return { message: GENERIC_RESET_MESSAGE };
}

export async function verifyOtp(
  prisma: PrismaClient,
  input: VerifyOtpRequest,
): Promise<VerifyOtpResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    // Same generic error as "wrong OTP" (FR-PWD-002 EC-3) — never reveals whether the email exists.
    throw new InvalidOtpError();
  }

  const otpHash = hashToken(input.otp);
  const record = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, otpHash, used: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new InvalidOtpError();
  }

  // Hash match is checked before expiry (spec Scenario 12) so a correct-but-expired OTP gets
  // OTP_EXPIRED rather than the generic INVALID_OTP.
  if (record.expiresAt.getTime() < Date.now()) {
    throw new OtpExpiredError();
  }

  await prisma.passwordResetOtp.update({ where: { id: record.id }, data: { used: true } });

  const resetToken = signResetToken({ userId: user.id, otpId: record.id });
  return { resetToken };
}

export async function resetPassword(
  prisma: PrismaClient,
  input: ResetPasswordRequest,
): Promise<ResetPasswordResponse> {
  let payload;
  try {
    payload = verifyResetToken(input.resetToken);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ResetTokenExpiredError();
    }
    throw new InvalidResetTokenError();
  }

  const record = await prisma.passwordResetOtp.findUnique({ where: { id: payload.otpId } });
  if (!record || record.userId !== payload.userId || record.resetTokenUsed) {
    throw new InvalidResetTokenError();
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: payload.userId } });

  const isSameAsCurrent = await bcrypt.compare(input.newPassword, user.passwordHash);
  if (isSameAsCurrent) {
    throw new PasswordSameAsCurrentError();
  }

  const passwordHash = await bcrypt.hash(input.newPassword, config.BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetOtp.update({
      where: { id: record.id },
      data: { resetTokenUsed: true },
    }),
    // BR-013: force logout from every device, not just the single active session (contrast with login).
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);

  return { message: 'Password reset successful. Please log in with your new password.' };
}
