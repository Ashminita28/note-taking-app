import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  generateOtp,
  signResetToken,
  verifyResetToken,
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

describe('generateOtp', () => {
  it('generates a 6-digit numeric OTP with a matching SHA-256 hash', () => {
    const { otp, otpHash } = generateOtp();

    expect(otp).toMatch(/^\d{6}$/);
    expect(otpHash).toBe(hashToken(otp));
  });

  it('sets expiresAt roughly OTP_EXPIRY_MINUTES out', () => {
    const { expiresAt } = generateOtp();
    const expectedMs = config.OTP_EXPIRY_MINUTES * 60_000;
    const deltaMs = expiresAt.getTime() - Date.now();

    expect(deltaMs).toBeGreaterThan(expectedMs - 5000);
    expect(deltaMs).toBeLessThanOrEqual(expectedMs);
  });

  it('uses the crypto CSPRNG, not Math.random', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    generateOtp();

    expect(randomSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('produces different OTPs across calls (overwhelmingly likely)', () => {
    const otps = new Set(Array.from({ length: 20 }, () => generateOtp().otp));
    expect(otps.size).toBeGreaterThan(1);
  });
});

describe('signResetToken / verifyResetToken', () => {
  const claims = {
    userId: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01',
    otpId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
  };

  it('round-trips a valid reset token', () => {
    const token = signResetToken(claims);
    const payload = verifyResetToken(token);

    expect(payload.userId).toBe(claims.userId);
    expect(payload.otpId).toBe(claims.otpId);
    expect(payload.purpose).toBe('password_reset');
  });

  it('throws jsonwebtoken.TokenExpiredError for an expired token', () => {
    const expired = jwt.sign(
      { ...claims, purpose: 'password_reset' },
      config.JWT_SECRET,
      { expiresIn: -10 },
    );

    expect(() => verifyResetToken(expired)).toThrow(jwt.TokenExpiredError);
  });

  it('throws for a token signed with the wrong secret', () => {
    const wrongSecret = jwt.sign(
      { ...claims, purpose: 'password_reset' },
      'a-completely-different-secret-key',
    );

    expect(() => verifyResetToken(wrongSecret)).toThrow(jwt.JsonWebTokenError);
  });

  it('rejects a token with the wrong purpose claim (e.g. an access token)', () => {
    const wrongPurpose = jwt.sign({ ...claims, purpose: 'access_token' }, config.JWT_SECRET);

    expect(() => verifyResetToken(wrongPurpose)).toThrow();
  });
});
