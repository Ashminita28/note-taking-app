import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
import { config } from '../../src/config/env';
import { resetAuthTables } from './setup';

const app = createApp();

const VALID_USER = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'Str0ng!Pass' };

async function registerAndLogin() {
  await supertest(app).post('/api/auth/register').send(VALID_USER);
  const res = await supertest(app)
    .post('/api/auth/login')
    .send({ email: VALID_USER.email, password: VALID_USER.password });
  return res.body as { accessToken: string; refreshToken: string; user: unknown };
}

/** Triggers forgot-password for an already-registered `email`, capturing the OTP from the console-logged simulated email (never returned in the response body). */
async function requestOtp(email: string): Promise<string> {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  await supertest(app).post('/api/auth/forgot-password').send({ email });
  const emailCall = logSpy.mock.calls.find((call) => String(call[0]).includes('SIMULATED EMAIL'));
  logSpy.mockRestore();

  const match = /Your OTP is: (\d{6})/.exec(String(emailCall?.[0]));
  if (!match) {
    throw new Error('OTP not found in simulated email log');
  }
  return match[1];
}

/** Registers `email` and triggers forgot-password, returning the captured OTP. */
async function registerAndRequestOtp(email: string): Promise<string> {
  await supertest(app)
    .post('/api/auth/register')
    .send({ name: 'Reset Tester', email, password: 'Str0ng!Pass' });
  return requestOtp(email);
}

/** Directly ages the caller's active OTP row so expiry can be tested without a real 10-minute wait. */
async function expireActiveOtp(email: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.passwordResetOtp.updateMany({
    where: { userId: user.id, used: false },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
}

beforeEach(async () => {
  await resetAuthTables();
});

afterAll(async () => {
  await resetAuthTables();
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('registers a new user and returns 201 with the user profile', async () => {
    const res = await supertest(app).post('/api/auth/register').send(VALID_USER);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
    expect(res.body.user.id).toEqual(expect.any(String));
  });

  it('returns 409 EMAIL_ALREADY_EXISTS for a duplicate email (case-insensitive)', async () => {
    await supertest(app).post('/api/auth/register').send(VALID_USER);
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ ...VALID_USER, email: 'ADA@EXAMPLE.COM' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('returns 422 VALIDATION_ERROR for a weak password', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ ...VALID_USER, password: 'weak' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 VALIDATION_ERROR for missing fields', async () => {
    const res = await supertest(app)
      .post('/api/auth/register')
      .send({ email: VALID_USER.email });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('stores the password as a bcrypt hash, never in plain text', async () => {
    await supertest(app).post('/api/auth/register').send(VALID_USER);
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });

    expect(stored.passwordHash).not.toBe(VALID_USER.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and returns access/refresh tokens', async () => {
    await supertest(app).post('/api/auth/register').send(VALID_USER);
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.user).toMatchObject({ email: 'ada@example.com' });
  });

  it('returns 401 INVALID_CREDENTIALS for an unknown email', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 INVALID_CREDENTIALS for an incorrect password', async () => {
    await supertest(app).post('/api/auth/register').send(VALID_USER);
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: 'WrongPass1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 422 VALIDATION_ERROR for missing fields', async () => {
    const res = await supertest(app).post('/api/auth/login').send({ email: VALID_USER.email });

    expect(res.status).toBe(422);
  });

  it('invalidates the previous refresh token on re-login (single-session)', async () => {
    await supertest(app).post('/api/auth/register').send(VALID_USER);
    const first = await supertest(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    await supertest(app)
      .post('/api/auth/login')
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    const refreshRes = await supertest(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates a valid refresh token', async () => {
    const { refreshToken } = await registerAndLogin();
    const res = await supertest(app).post('/api/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('returns 401 INVALID_REFRESH_TOKEN when the token was already used (rotation)', async () => {
    const { refreshToken } = await registerAndLogin();
    await supertest(app).post('/api/auth/refresh').send({ refreshToken });
    const res = await supertest(app).post('/api/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 401 INVALID_REFRESH_TOKEN for an unknown token', async () => {
    const res = await supertest(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns 422 VALIDATION_ERROR for a missing refresh token', async () => {
    const res = await supertest(app).post('/api/auth/refresh').send({});

    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/logout', () => {
  it('logs out and invalidates the refresh token', async () => {
    const { accessToken, refreshToken } = await registerAndLogin();
    const logoutRes = await supertest(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logoutRes.status).toBe(200);

    const refreshRes = await supertest(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('is idempotent — logging out twice both return 200', async () => {
    const { accessToken, refreshToken } = await registerAndLogin();
    await supertest(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    const res = await supertest(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
  });

  it('returns 401 TOKEN_MISSING with no Authorization header', async () => {
    const res = await supertest(app).post('/api/auth/logout').send({ refreshToken: 'x' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('returns 401 TOKEN_INVALID for a malformed access token', async () => {
    const res = await supertest(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ refreshToken: 'x' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user profile', async () => {
    const { accessToken, user } = await registerAndLogin();
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual(user);
  });

  it('returns 401 TOKEN_MISSING with no Authorization header', async () => {
    const res = await supertest(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('returns 401 TOKEN_INVALID for a malformed access token', async () => {
    const res = await supertest(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('logs the simulated OTP email and returns the generic success message', async () => {
    const email = 'forgot-happy@example.com';
    await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Reset Tester', email, password: 'Str0ng!Pass' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const res = await supertest(app).post('/api/auth/forgot-password').send({ email });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'If an account exists for that email, a reset code has been sent.',
    });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SIMULATED EMAIL'));
    logSpy.mockRestore();
  });

  it('returns the identical response and logs nothing for an unknown email (enumeration prevention)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const res = await supertest(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'forgot-unknown@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'If an account exists for that email, a reset code has been sent.',
    });
    // The request-logger middleware always logs the access line; only the simulated-email
    // block (only emitted for a real user) is what enumeration prevention forbids here.
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes('SIMULATED EMAIL'))).toBe(
      false,
    );
    logSpy.mockRestore();
  });

  it('invalidates a prior OTP when a new one is requested before it expires', async () => {
    const email = 'forgot-rerequest@example.com';
    const firstOtp = await registerAndRequestOtp(email);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await supertest(app).post('/api/auth/forgot-password').send({ email });
    vi.restoreAllMocks();

    const res = await supertest(app).post('/api/auth/verify-otp').send({ email, otp: firstOtp });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('returns 422 VALIDATION_ERROR for an invalid email format', async () => {
    const res = await supertest(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 429 OTP_RATE_LIMIT after 3 requests for the same email', async () => {
    const email = 'forgot-ratelimit@example.com';
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    for (let i = 0; i < 3; i += 1) {
      const res = await supertest(app).post('/api/auth/forgot-password').send({ email });
      expect(res.status).toBe(200);
    }
    const res = await supertest(app).post('/api/auth/forgot-password').send({ email });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('OTP_RATE_LIMIT');
    vi.restoreAllMocks();
  });
});

describe('POST /api/auth/verify-otp', () => {
  it('returns a reset token for a correct, unexpired OTP', async () => {
    const email = 'verify-happy@example.com';
    const otp = await registerAndRequestOtp(email);

    const res = await supertest(app).post('/api/auth/verify-otp').send({ email, otp });

    expect(res.status).toBe(200);
    expect(typeof res.body.resetToken).toBe('string');
  });

  it('returns 401 INVALID_OTP for an incorrect code', async () => {
    const email = 'verify-wrong@example.com';
    await registerAndRequestOtp(email);

    const res = await supertest(app)
      .post('/api/auth/verify-otp')
      .send({ email, otp: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('returns 401 INVALID_OTP when no OTP was ever requested', async () => {
    const res = await supertest(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'verify-none@example.com', otp: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('returns 410 OTP_EXPIRED for a correct but expired OTP', async () => {
    const email = 'verify-expired@example.com';
    const otp = await registerAndRequestOtp(email);
    await expireActiveOtp(email);

    const res = await supertest(app).post('/api/auth/verify-otp').send({ email, otp });

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('returns 401 INVALID_OTP when the OTP is reused (single-use)', async () => {
    const email = 'verify-reuse@example.com';
    const otp = await registerAndRequestOtp(email);
    await supertest(app).post('/api/auth/verify-otp').send({ email, otp });

    const res = await supertest(app).post('/api/auth/verify-otp').send({ email, otp });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('returns 422 VALIDATION_ERROR for a non-6-digit OTP', async () => {
    const res = await supertest(app)
      .post('/api/auth/verify-otp')
      .send({ email: 'verify-validation@example.com', otp: '123' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 429 OTP_VERIFY_RATE_LIMIT after 5 attempts for the same email', async () => {
    const email = 'verify-ratelimit@example.com';
    await registerAndRequestOtp(email);

    for (let i = 0; i < 5; i += 1) {
      const res = await supertest(app)
        .post('/api/auth/verify-otp')
        .send({ email, otp: '000000' });
      expect(res.status).toBe(401);
    }
    const res = await supertest(app)
      .post('/api/auth/verify-otp')
      .send({ email, otp: '000000' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('OTP_VERIFY_RATE_LIMIT');
  });
});

describe('POST /api/auth/reset-password', () => {
  // This test chains 8 sequential requests plus 4 real-cost-factor bcrypt operations —
  // comfortably over the 5s default under load.
  it('resets the password and invalidates every existing session', async () => {
    const email = 'reset-happy@example.com';
    await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Reset Tester', email, password: 'Str0ng!Pass' });
    const loginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ email, password: 'Str0ng!Pass' });
    const oldRefreshToken = loginRes.body.refreshToken as string;

    const otp = await requestOtp(email);
    const verifyRes = await supertest(app).post('/api/auth/verify-otp').send({ email, otp });

    const res = await supertest(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: verifyRes.body.resetToken, newPassword: 'NewStr0ng!Pass' });

    expect(res.status).toBe(200);

    const oldLoginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ email, password: 'Str0ng!Pass' });
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await supertest(app)
      .post('/api/auth/login')
      .send({ email, password: 'NewStr0ng!Pass' });
    expect(newLoginRes.status).toBe(200);

    const refreshRes = await supertest(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldRefreshToken });
    expect(refreshRes.status).toBe(401);
  }, 15000);

  it('returns 401 INVALID_RESET_TOKEN when the reset token is reused', async () => {
    const email = 'reset-reuse@example.com';
    const otp = await registerAndRequestOtp(email);
    const verifyRes = await supertest(app).post('/api/auth/verify-otp').send({ email, otp });
    const resetToken = verifyRes.body.resetToken as string;
    await supertest(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'NewStr0ng!Pass' });

    const res = await supertest(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'AnotherStr0ng!Pass' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('returns 401 INVALID_RESET_TOKEN for a malformed token', async () => {
    const res = await supertest(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: 'not-a-real-token', newPassword: 'NewStr0ng!Pass' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  it('returns 410 RESET_TOKEN_EXPIRED for an expired reset token', async () => {
    const email = 'reset-expired@example.com';
    await supertest(app)
      .post('/api/auth/register')
      .send({ name: 'Reset Tester', email, password: 'Str0ng!Pass' });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const otpRecord = await prisma.passwordResetOtp.create({
      data: { userId: user.id, otpHash: 'unused', expiresAt: new Date(Date.now() + 60_000) },
    });
    const expiredToken = jwt.sign(
      { userId: user.id, otpId: otpRecord.id, purpose: 'password_reset' },
      config.JWT_SECRET,
      { expiresIn: -10 },
    );

    const res = await supertest(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: expiredToken, newPassword: 'NewStr0ng!Pass' });

    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('RESET_TOKEN_EXPIRED');
  });

  it('returns 422 VALIDATION_ERROR for a weak new password', async () => {
    const email = 'reset-weak@example.com';
    const otp = await registerAndRequestOtp(email);
    const verifyRes = await supertest(app).post('/api/auth/verify-otp').send({ email, otp });

    const res = await supertest(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: verifyRes.body.resetToken, newPassword: 'weak' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 PASSWORD_SAME_AS_CURRENT when the new password matches the current one', async () => {
    const email = 'reset-samepass@example.com';
    const otp = await registerAndRequestOtp(email);
    const verifyRes = await supertest(app).post('/api/auth/verify-otp').send({ email, otp });

    const res = await supertest(app)
      .post('/api/auth/reset-password')
      .send({ resetToken: verifyRes.body.resetToken, newPassword: 'Str0ng!Pass' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PASSWORD_SAME_AS_CURRENT');
  });

  it('returns 422 VALIDATION_ERROR for missing fields', async () => {
    const res = await supertest(app).post('/api/auth/reset-password').send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
