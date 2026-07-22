import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { rateLimitHandler } from '../../src/middleware/rate-limiter';

describe('rateLimitHandler', () => {
  it('returns the standard 429 envelope', async () => {
    const app = express();
    app.get('/limited', (req, res) => rateLimitHandler(req, res));

    const response = await supertest(app).get('/limited');

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        details: [],
      },
    });
  });
});
