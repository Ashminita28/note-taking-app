import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { otpRequestRateLimiter, otpVerifyRateLimiter } from '../../src/modules/auth/auth.rate-limiters';

function buildApp(limiter: express.RequestHandler) {
  const app = express();
  app.use(express.json());
  app.post('/limited', limiter, (_req, res) => res.status(200).json({ ok: true }));
  return app;
}

describe('otpRequestRateLimiter', () => {
  it('allows up to 3 requests per email, then returns 429 OTP_RATE_LIMIT', async () => {
    const app = buildApp(otpRequestRateLimiter);

    for (let i = 0; i < 3; i += 1) {
      const res = await supertest(app).post('/limited').send({ email: 'ada@example.com' });
      expect(res.status).toBe(200);
    }

    const res = await supertest(app).post('/limited').send({ email: 'ada@example.com' });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: { code: 'OTP_RATE_LIMIT', message: 'Too many requests. Try again later.', details: [] },
    });
  });

  it('tracks quotas independently per email', async () => {
    const app = buildApp(otpRequestRateLimiter);

    for (let i = 0; i < 3; i += 1) {
      await supertest(app).post('/limited').send({ email: 'ada@example.com' });
    }

    const res = await supertest(app).post('/limited').send({ email: 'grace@example.com' });

    expect(res.status).toBe(200);
  });
});

describe('otpVerifyRateLimiter', () => {
  it('allows up to 5 requests per email, then returns 429 OTP_VERIFY_RATE_LIMIT', async () => {
    const app = buildApp(otpVerifyRateLimiter);

    for (let i = 0; i < 5; i += 1) {
      const res = await supertest(app).post('/limited').send({ email: 'ada@example.com' });
      expect(res.status).toBe(200);
    }

    const res = await supertest(app).post('/limited').send({ email: 'ada@example.com' });

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: {
        code: 'OTP_VERIFY_RATE_LIMIT',
        message: 'Too many attempts. Try again later.',
        details: [],
      },
    });
  });
});
