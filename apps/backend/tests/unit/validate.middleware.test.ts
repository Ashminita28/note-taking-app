import { describe, it, expect } from 'vitest';
import express from 'express';
import { z } from 'zod';
import supertest from 'supertest';
import { validateBody } from '../../src/middleware/validate';
import { errorHandler } from '../../src/middleware/error-handler';

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/test', validateBody(schema), (req, res) => {
    res.status(200).json({ received: req.body });
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
