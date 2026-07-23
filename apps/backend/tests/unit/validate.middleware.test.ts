import { describe, it, expect } from 'vitest';
import express from 'express';
import { z } from 'zod';
import supertest from 'supertest';
import { validateBody, validateParams, validateQuery } from '../../src/middleware/validate';
import { errorHandler } from '../../src/middleware/error-handler';

const schema = z.object({ email: z.string().trim().toLowerCase().email() });
const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  sortBy: z.enum(['createdAt', 'title']).optional().default('createdAt'),
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/test', validateBody(schema), (req, res) => {
    res.status(200).json({ received: req.body });
  });
  app.use(errorHandler);
  return app;
}

function buildParamsApp() {
  const app = express();
  app.get('/test/:id', validateParams(paramsSchema), (req, res) => {
    res.status(200).json({ received: req.params });
  });
  app.use(errorHandler);
  return app;
}

function buildQueryApp() {
  const app = express();
  app.get('/test', validateQuery(querySchema), (req, res) => {
    res.status(200).json({ validatedQuery: req.validatedQuery, rawQuery: req.query });
  });
  app.use(errorHandler);
  return app;
}

describe('validateBody', () => {
  it('passes through and replaces req.body with the parsed/transformed value', async () => {
    const response = await supertest(buildApp())
      .post('/test')
      .send({ email: '  Ada@Example.COM  ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: { email: 'ada@example.com' } });
  });

  it('forwards a ValidationError with field details on invalid input', async () => {
    const response = await supertest(buildApp()).post('/test').send({ email: 'not-an-email' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toHaveLength(1);
    expect(response.body.error.details[0].field).toBe('email');
  });
});

describe('validateParams', () => {
  it('passes through and replaces req.params with the parsed value', async () => {
    const response = await supertest(buildParamsApp()).get(
      '/test/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: { id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' } });
  });

  it('forwards a ValidationError for a non-UUID param', async () => {
    const response = await supertest(buildParamsApp()).get('/test/not-a-uuid');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('id');
  });
});

describe('validateQuery', () => {
  it('populates req.validatedQuery with defaults applied, leaving req.query untouched', async () => {
    const response = await supertest(buildQueryApp()).get('/test');

    expect(response.status).toBe(200);
    expect(response.body.validatedQuery).toEqual({ page: 1, sortBy: 'createdAt' });
    expect(response.body.rawQuery).toEqual({});
  });

  it('coerces and overrides query values, still leaving req.query untouched', async () => {
    const response = await supertest(buildQueryApp()).get('/test?page=3&sortBy=title');

    expect(response.status).toBe(200);
    expect(response.body.validatedQuery).toEqual({ page: 3, sortBy: 'title' });
    expect(response.body.rawQuery).toEqual({ page: '3', sortBy: 'title' });
  });

  it('forwards a ValidationError for an out-of-enum sortBy', async () => {
    const response = await supertest(buildQueryApp()).get('/test?sortBy=bogus');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('sortBy');
  });

  it('forwards a ValidationError for page below the minimum', async () => {
    const response = await supertest(buildQueryApp()).get('/test?page=0');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].field).toBe('page');
  });
});
