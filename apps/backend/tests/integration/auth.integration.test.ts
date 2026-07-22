import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';
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
