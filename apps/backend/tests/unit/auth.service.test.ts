import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  getUserProfile,
} from '../../src/modules/auth/auth.service';
import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenExpiredError,
} from '../../src/modules/auth/auth.errors';

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
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return prisma as unknown as PrismaClient & {
    user: Record<string, ReturnType<typeof vi.fn>>;
    refreshToken: Record<string, ReturnType<typeof vi.fn>>;
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
