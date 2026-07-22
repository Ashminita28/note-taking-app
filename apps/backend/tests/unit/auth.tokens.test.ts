import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../src/modules/auth/auth.tokens';
import { config } from '../../src/config/env';

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips a valid access token', () => {
    const token = signAccessToken({ userId: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01', email: 'ada@example.com' });
    const payload = verifyAccessToken(token);

    expect(payload.userId).toBe('9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01');
    expect(payload.email).toBe('ada@example.com');
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('throws jsonwebtoken.TokenExpiredError for an expired token', () => {
    const expired = jwt.sign(
      { userId: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01', email: 'ada@example.com' },
      config.JWT_SECRET,
      { expiresIn: -10 },
    );

    expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError);
  });

  it('throws for a token signed with the wrong secret', () => {
    const wrongSecret = jwt.sign(
      { userId: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01', email: 'ada@example.com' },
      'a-completely-different-secret-key',
    );

    expect(() => verifyAccessToken(wrongSecret)).toThrow(jwt.JsonWebTokenError);
  });
});

describe('generateRefreshToken / hashToken', () => {
  it('generates a 64-character hex token with a matching SHA-256 hash', () => {
    const { token, tokenHash } = generateRefreshToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashToken(token));
  });

  it('sets expiresAt roughly 7 days out (default JWT_REFRESH_EXPIRY)', () => {
    const { expiresAt } = generateRefreshToken();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const deltaMs = expiresAt.getTime() - Date.now();

    expect(deltaMs).toBeGreaterThan(sevenDaysMs - 5000);
    expect(deltaMs).toBeLessThanOrEqual(sevenDaysMs);
  });

  it('produces different tokens on each call', () => {
    const first = generateRefreshToken();
    const second = generateRefreshToken();

    expect(first.token).not.toBe(second.token);
  });

  it('hashToken is deterministic for the same input', () => {
    expect(hashToken('same-value')).toBe(hashToken('same-value'));
  });
});
