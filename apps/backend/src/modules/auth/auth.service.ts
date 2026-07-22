import type { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import type {
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  LogoutRequest,
  UserProfile,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
} from '@note-app/shared';
import { config } from '../../config/env.js';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenExpiredError,
} from './auth.errors.js';
import { signAccessToken, generateRefreshToken, hashToken } from './auth.tokens.js';

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
