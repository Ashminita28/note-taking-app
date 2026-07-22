import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  getUserProfile,
  requestPasswordReset,
  verifyOtp,
  resetPassword,
} from '../../src/modules/auth/auth.service';
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
} from '../../src/modules/auth/auth.errors';
import { hashToken, signResetToken } from '../../src/modules/auth/auth.tokens';

const USER_ID = '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: USER_ID,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    passwordHash: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockPrisma() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordResetOtp: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return prisma as unknown as PrismaClient & {
    user: Record<string, ReturnType<typeof vi.fn>>;
    refreshToken: Record<string, ReturnType<typeof vi.fn>>;
    passwordResetOtp: Record<string, ReturnType<typeof vi.fn>>;
    $transaction: ReturnType<typeof vi.fn>;
  };
}

function buildOtpRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    userId: USER_ID,
    otpHash: hashToken('123456'),
    expiresAt: new Date(Date.now() + 10 * 60_000),
    used: false,
    resetTokenUsed: false,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('registerUser', () => {
  it('hashes the password, creates the user, and logs a simulated verification email', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(buildUser({ passwordHash: data.passwordHash as string })),
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const profile = await registerUser(prisma, {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Str0ng!Pass',
    });

    expect(profile).toEqual({ id: USER_ID, name: 'Ada Lovelace', email: 'ada@example.com' });
    const createdPasswordHash = prisma.user.create.mock.calls[0][0].data.passwordHash;
    expect(await bcrypt.compare('Str0ng!Pass', createdPasswordHash)).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[email:verification]'));
  });

  it('throws EmailAlreadyExistsError when the email is already registered', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser());

    await expect(
      registerUser(prisma, { name: 'Ada', email: 'ada@example.com', password: 'Str0ng!Pass' }),
    ).rejects.toThrow(EmailAlreadyExistsError);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('loginUser', () => {
  it('returns tokens and profile for valid credentials, invalidating prior sessions', async () => {
    const passwordHash = await bcrypt.hash('Str0ng!Pass', 4);
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await loginUser(prisma, { email: 'ada@example.com', password: 'Str0ng!Pass' });

    expect(result.user).toEqual({ id: USER_ID, name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(typeof result.accessToken).toBe('string');
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
  });

  it('throws InvalidCredentialsError for an unknown email', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      loginUser(prisma, { email: 'nobody@example.com', password: 'whatever' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('Str0ng!Pass', 4);
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser({ passwordHash }));

    await expect(
      loginUser(prisma, { email: 'ada@example.com', password: 'WrongPass1!' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });
});

describe('refreshTokens', () => {
  it('rotates a valid refresh token', async () => {
    const prisma = createMockPrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: USER_ID,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.refreshToken.delete.mockResolvedValue({});
    prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
    prisma.refreshToken.create.mockResolvedValue({});

    const result = await refreshTokens(prisma, { refreshToken: 'raw-token' });

    expect(typeof result.accessToken).toBe('string');
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } });
  });

  it('throws InvalidRefreshTokenError when the token has no matching record', async () => {
    const prisma = createMockPrisma();
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(refreshTokens(prisma, { refreshToken: 'unknown' })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
    expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
  });

  it('deletes the token and throws RefreshTokenExpiredError when expired', async () => {
    const prisma = createMockPrisma();
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: USER_ID,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() - 60_000),
    });
    prisma.refreshToken.delete.mockResolvedValue({});

    await expect(refreshTokens(prisma, { refreshToken: 'expired-token' })).rejects.toThrow(
      RefreshTokenExpiredError,
    );
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } });
  });
});

describe('logoutUser', () => {
  it('deletes the matching refresh token and returns a success message', async () => {
    const prisma = createMockPrisma();
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

    const result = await logoutUser(prisma, USER_ID, { refreshToken: 'raw-token' });

    expect(result).toEqual({ message: 'Logged out successfully.' });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledOnce();
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), userId: USER_ID },
    });
  });

  it('is idempotent when the token is already invalidated (0 rows deleted)', async () => {
    const prisma = createMockPrisma();
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      logoutUser(prisma, USER_ID, { refreshToken: 'already-gone' }),
    ).resolves.toEqual({
      message: 'Logged out successfully.',
    });
  });

  it("does not delete another user's refresh token", async () => {
    const prisma = createMockPrisma();
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
    const otherUserId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';

    await logoutUser(prisma, otherUserId, { refreshToken: 'raw-token' });

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), userId: otherUserId },
    });
  });
});

describe('getUserProfile', () => {
  it('returns the user profile for a valid userId', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());

    const result = await getUserProfile(prisma, USER_ID);

    expect(result).toEqual({
      user: { id: USER_ID, name: 'Ada Lovelace', email: 'ada@example.com' },
    });
  });
});

describe('requestPasswordReset', () => {
  it('generates and stores an OTP, logs the simulated email, and returns the generic message', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser());
    prisma.passwordResetOtp.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetOtp.create.mockResolvedValue(buildOtpRecord());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await requestPasswordReset(prisma, { email: 'ada@example.com' });

    expect(result).toEqual({
      message: 'If an account exists for that email, a reset code has been sent.',
    });
    expect(prisma.passwordResetOtp.create).toHaveBeenCalledOnce();
    const createdOtpHash = prisma.passwordResetOtp.create.mock.calls[0][0].data.otpHash;
    expect(typeof createdOtpHash).toBe('string');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SIMULATED EMAIL'));
  });

  it('invalidates any prior unused OTP before creating a new one (re-request)', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser());
    prisma.passwordResetOtp.updateMany.mockResolvedValue({ count: 1 });
    prisma.passwordResetOtp.create.mockResolvedValue(buildOtpRecord());
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await requestPasswordReset(prisma, { email: 'ada@example.com' });

    expect(prisma.passwordResetOtp.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, used: false },
      data: { used: true },
    });
  });

  it('returns the same generic message and writes nothing for an unknown email (enumeration prevention)', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const result = await requestPasswordReset(prisma, { email: 'nobody@example.com' });

    expect(result).toEqual({
      message: 'If an account exists for that email, a reset code has been sent.',
    });
    expect(prisma.passwordResetOtp.create).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});

describe('verifyOtp', () => {
  it('marks the OTP used and returns a reset token for a correct, unexpired OTP', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser());
    prisma.passwordResetOtp.findFirst.mockResolvedValue(buildOtpRecord());
    prisma.passwordResetOtp.update.mockResolvedValue({});

    const result = await verifyOtp(prisma, { email: 'ada@example.com', otp: '123456' });

    expect(typeof result.resetToken).toBe('string');
    expect(prisma.passwordResetOtp.update).toHaveBeenCalledWith({
      where: { id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' },
      data: { used: true },
    });
  });

  it('throws InvalidOtpError for an unknown email (does not reveal existence)', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      verifyOtp(prisma, { email: 'nobody@example.com', otp: '123456' }),
    ).rejects.toThrow(InvalidOtpError);
  });

  it('throws InvalidOtpError when no active OTP matches (wrong code or none requested)', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser());
    prisma.passwordResetOtp.findFirst.mockResolvedValue(null);

    await expect(
      verifyOtp(prisma, { email: 'ada@example.com', otp: '999999' }),
    ).rejects.toThrow(InvalidOtpError);
  });

  it('throws OtpExpiredError for a correct but expired OTP (hash checked before expiry)', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser());
    prisma.passwordResetOtp.findFirst.mockResolvedValue(
      buildOtpRecord({ expiresAt: new Date(Date.now() - 60_000) }),
    );

    await expect(
      verifyOtp(prisma, { email: 'ada@example.com', otp: '123456' }),
    ).rejects.toThrow(OtpExpiredError);
    expect(prisma.passwordResetOtp.update).not.toHaveBeenCalled();
  });

  it('throws InvalidOtpError when the OTP was already used (single-use)', async () => {
    const prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue(buildUser());
    // used:false is part of the query itself, so an already-used OTP simply never matches.
    prisma.passwordResetOtp.findFirst.mockResolvedValue(null);

    await expect(
      verifyOtp(prisma, { email: 'ada@example.com', otp: '123456' }),
    ).rejects.toThrow(InvalidOtpError);
  });
});

describe('resetPassword', () => {
  it('updates the password, marks the reset token used, and deletes all refresh tokens', async () => {
    const prisma = createMockPrisma();
    const passwordHash = await bcrypt.hash('OldStr0ng!Pass', 4);
    const resetToken = signResetToken({ userId: USER_ID, otpId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' });
    prisma.passwordResetOtp.findUnique.mockResolvedValue(buildOtpRecord());
    prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser({ passwordHash }));
    prisma.user.update.mockResolvedValue({});
    prisma.passwordResetOtp.update.mockResolvedValue({});
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

    const result = await resetPassword(prisma, { resetToken, newPassword: 'NewStr0ng!Pass' });

    expect(result).toEqual({
      message: 'Password reset successful. Please log in with your new password.',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { passwordHash: expect.any(String) },
    });
    expect(prisma.passwordResetOtp.update).toHaveBeenCalledWith({
      where: { id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' },
      data: { resetTokenUsed: true },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
  });

  it('throws InvalidResetTokenError for a malformed/invalid token', async () => {
    const prisma = createMockPrisma();

    await expect(
      resetPassword(prisma, { resetToken: 'not-a-real-token', newPassword: 'NewStr0ng!Pass' }),
    ).rejects.toThrow(InvalidResetTokenError);
  });

  it('throws ResetTokenExpiredError for an expired reset token', async () => {
    const prisma = createMockPrisma();
    const jwt = await import('jsonwebtoken');
    const { config } = await import('../../src/config/env');
    const expiredToken = jwt.default.sign(
      { userId: USER_ID, otpId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', purpose: 'password_reset' },
      config.JWT_SECRET,
      { expiresIn: -10 },
    );

    await expect(
      resetPassword(prisma, { resetToken: expiredToken, newPassword: 'NewStr0ng!Pass' }),
    ).rejects.toThrow(ResetTokenExpiredError);
  });

  it('throws InvalidResetTokenError when the reset token was already used (single-use)', async () => {
    const prisma = createMockPrisma();
    const resetToken = signResetToken({ userId: USER_ID, otpId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' });
    prisma.passwordResetOtp.findUnique.mockResolvedValue(
      buildOtpRecord({ resetTokenUsed: true }),
    );

    await expect(
      resetPassword(prisma, { resetToken, newPassword: 'NewStr0ng!Pass' }),
    ).rejects.toThrow(InvalidResetTokenError);
  });

  it("throws InvalidResetTokenError when the otpId row belongs to a different user", async () => {
    const prisma = createMockPrisma();
    const resetToken = signResetToken({ userId: USER_ID, otpId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' });
    prisma.passwordResetOtp.findUnique.mockResolvedValue(
      buildOtpRecord({ userId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d' }),
    );

    await expect(
      resetPassword(prisma, { resetToken, newPassword: 'NewStr0ng!Pass' }),
    ).rejects.toThrow(InvalidResetTokenError);
  });

  it('throws PasswordSameAsCurrentError when the new password matches the current one', async () => {
    const prisma = createMockPrisma();
    const passwordHash = await bcrypt.hash('SameStr0ng!Pass', 4);
    const resetToken = signResetToken({ userId: USER_ID, otpId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' });
    prisma.passwordResetOtp.findUnique.mockResolvedValue(buildOtpRecord());
    prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser({ passwordHash }));

    await expect(
      resetPassword(prisma, { resetToken, newPassword: 'SameStr0ng!Pass' }),
    ).rejects.toThrow(PasswordSameAsCurrentError);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
  });
});
