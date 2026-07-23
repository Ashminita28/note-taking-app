import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { errorHandler } from '../../src/middleware/error-handler';
import { AppError, ValidationError } from '../../src/errors/app-error';

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

  it('maps a thrown AppError to its statusCode/code/message/details', async () => {
    const app = express();
    app.get('/conflict', () => {
      throw new AppError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
    });
    app.use(errorHandler);

    const response = await supertest(app).get('/conflict');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists.',
        details: [],
      },
    });
  });

  it('maps an Express payload-too-large error to 413 CONTENT_TOO_LARGE', async () => {
    const app = express();
    app.get('/too-large', () => {
      const err = new Error('request entity too large') as Error & { type: string };
      err.type = 'entity.too.large';
      throw err;
    });
    app.use(errorHandler);

    const response = await supertest(app).get('/too-large');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: {
        code: 'CONTENT_TOO_LARGE',
        message: 'Note content exceeds the maximum allowed size.',
        details: [],
      },
    });
  });

  it('includes field-level details for a ValidationError', async () => {
    const app = express();
    app.get('/invalid', () => {
      throw new ValidationError([{ field: 'email', message: 'Invalid email format.' }]);
    });
    app.use(errorHandler);

    const response = await supertest(app).get('/invalid');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual([
      { field: 'email', message: 'Invalid email format.' },
    ]);
  });
});
