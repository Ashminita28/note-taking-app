import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { errorHandler } from '../../src/middleware/error-handler';

describe('errorHandler', () => {
  it('returns the standard 500 envelope for unhandled errors', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new Error('boom');
    });
    app.use(errorHandler);

    const response = await supertest(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
        details: [],
      },
    });
  });
});
