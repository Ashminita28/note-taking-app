import { describe, it, expect } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import supertest from 'supertest';
import { requireAuth } from '../../src/middleware/auth.middleware';
import { errorHandler } from '../../src/middleware/error-handler';
import { signAccessToken } from '../../src/modules/auth/auth.tokens';
import { config } from '../../src/config/env';

function buildApp() {
  const app = express();
  app.get('/protected', requireAuth, (req, res) => {
    res.status(200).json({ userId: req.userId });
  });
  app.use(errorHandler);
  return app;
}

describe('requireAuth', () => {
  it('rejects a request with no Authorization header', async () => {
    const response = await supertest(buildApp()).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_MISSING');
  });

  it('rejects a request with a non-Bearer Authorization header', async () => {
    const response = await supertest(buildApp())
      .get('/protected')
      .set('Authorization', 'Basic somevalue');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_MISSING');
  });

  it('rejects a malformed/invalid-signature token', async () => {
    const response = await supertest(buildApp())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(
      { userId: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01', email: 'ada@example.com' },
      config.JWT_SECRET,
      { expiresIn: -10 },
    );

    const response = await supertest(buildApp())
      .get('/protected')
      .set('Authorization', `Bearer ${expired}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('sets req.userId and calls next() for a valid token', async () => {
    const token = signAccessToken({
      userId: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01',
      email: 'ada@example.com',
    });

    const response = await supertest(buildApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.userId).toBe('9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01');
  });
});
