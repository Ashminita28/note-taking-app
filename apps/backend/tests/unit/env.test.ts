import { describe, it, expect, vi, afterEach } from 'vitest';

describe('env config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws a descriptive error when a required variable is missing', async () => {
    vi.resetModules();
    delete process.env.JWT_SECRET;

    await expect(import('../../src/config/env')).rejects.toThrow(
      'Invalid environment configuration',
    );
  });

  it('applies documented defaults when optional variables are omitted', async () => {
    vi.resetModules();
    delete process.env.PORT;
    delete process.env.BCRYPT_ROUNDS;

    const { config } = await import('../../src/config/env');

    expect(config.PORT).toBe(3000);
    expect(config.BCRYPT_ROUNDS).toBe(12);
  });
});
