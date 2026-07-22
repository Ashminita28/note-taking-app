import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';

describe('app shell', () => {
  it('returns the standard 404 envelope for unmatched routes', async () => {
    const response = await supertest(createApp()).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
