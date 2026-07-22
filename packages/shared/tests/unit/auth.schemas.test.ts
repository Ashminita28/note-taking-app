import { describe, it, expect } from 'vitest';
import {
  UserProfileSchema,
  RegisterRequestSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  LogoutRequestSchema,
  AccessTokenPayloadSchema,
  ForgotPasswordRequestSchema,
  VerifyOtpRequestSchema,
  ResetPasswordRequestSchema,
  ResetTokenPayloadSchema,
} from '../../src/schemas/auth.schemas';

describe('RegisterRequestSchema', () => {
  const valid = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'Str0ng!Pass' };

  it('accepts a valid registration payload', () => {
    const result = RegisterRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('trims the name and trims/lowercases the email', () => {
    const result = RegisterRequestSchema.parse({
      ...valid,
      name: '  Ada Lovelace  ',
      email: '  Ada@Example.COM  ',
    });
    expect(result.name).toBe('Ada Lovelace');
    expect(result.email).toBe('ada@example.com');
  });

  it('rejects a missing name', () => {
    const { name: _name, ...rest } = valid;
    expect(RegisterRequestSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a name over 100 characters', () => {
    expect(
      RegisterRequestSchema.safeParse({ ...valid, name: 'a'.repeat(101) }).success,
    ).toBe(false);
  });

  it('rejects an invalid email format', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('rejects a password missing complexity requirements', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, password: 'weakpass' }).success).toBe(
      false,
    );
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, password: 'Sh0rt!' }).success).toBe(false);
  });
});

describe('LoginRequestSchema', () => {
  it('accepts a valid login payload', () => {
    expect(
      LoginRequestSchema.safeParse({ email: 'ada@example.com', password: 'anything' }).success,
    ).toBe(true);
  });

  it('normalizes email to lowercase', () => {
    const result = LoginRequestSchema.parse({ email: 'Ada@Example.com', password: 'x' });
    expect(result.email).toBe('ada@example.com');
  });

  it('rejects a missing password', () => {
    expect(LoginRequestSchema.safeParse({ email: 'ada@example.com' }).success).toBe(false);
  });

  it('rejects a missing email', () => {
    expect(LoginRequestSchema.safeParse({ password: 'anything' }).success).toBe(false);
  });
});

describe('RefreshRequestSchema', () => {
  it('accepts a non-empty refresh token', () => {
    expect(RefreshRequestSchema.safeParse({ refreshToken: 'abc123' }).success).toBe(true);
  });

  it('rejects an empty refresh token', () => {
    expect(RefreshRequestSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });

  it('rejects a missing refresh token', () => {
    expect(RefreshRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('LogoutRequestSchema', () => {
  it('accepts a non-empty refresh token', () => {
    expect(LogoutRequestSchema.safeParse({ refreshToken: 'abc123' }).success).toBe(true);
  });

  it('rejects a missing refresh token', () => {
    expect(LogoutRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('UserProfileSchema', () => {
  it('accepts a valid user profile', () => {
    expect(
      UserProfileSchema.safeParse({
        id: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
      }).success,
    ).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    expect(
      UserProfileSchema.safeParse({ id: 'not-a-uuid', name: 'Ada', email: 'ada@example.com' })
        .success,
    ).toBe(false);
  });
});

describe('AccessTokenPayloadSchema', () => {
  it('accepts a valid decoded JWT payload', () => {
    expect(
      AccessTokenPayloadSchema.safeParse({
        userId: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01',
        email: 'ada@example.com',
        iat: 1_700_000_000,
        exp: 1_700_000_900,
      }).success,
    ).toBe(true);
  });

  it('rejects a payload missing userId', () => {
    expect(
      AccessTokenPayloadSchema.safeParse({
        email: 'ada@example.com',
        iat: 1_700_000_000,
        exp: 1_700_000_900,
      }).success,
    ).toBe(false);
  });
});

describe('ForgotPasswordRequestSchema', () => {
  it('accepts a valid email', () => {
    expect(ForgotPasswordRequestSchema.safeParse({ email: 'ada@example.com' }).success).toBe(
      true,
    );
  });

  it('normalizes email to lowercase', () => {
    const result = ForgotPasswordRequestSchema.parse({ email: 'Ada@Example.COM' });
    expect(result.email).toBe('ada@example.com');
  });

  it('rejects an invalid email format', () => {
    expect(ForgotPasswordRequestSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects a missing email', () => {
    expect(ForgotPasswordRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('VerifyOtpRequestSchema', () => {
  const valid = { email: 'ada@example.com', otp: '123456' };

  it('accepts a valid 6-digit OTP', () => {
    expect(VerifyOtpRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an OTP with fewer than 6 digits', () => {
    expect(VerifyOtpRequestSchema.safeParse({ ...valid, otp: '1234' }).success).toBe(false);
  });

  it('rejects an OTP with more than 6 digits', () => {
    expect(VerifyOtpRequestSchema.safeParse({ ...valid, otp: '1234567' }).success).toBe(false);
  });

  it('rejects a non-numeric OTP', () => {
    expect(VerifyOtpRequestSchema.safeParse({ ...valid, otp: 'abcdef' }).success).toBe(false);
  });

  it('rejects a missing otp', () => {
    expect(VerifyOtpRequestSchema.safeParse({ email: valid.email }).success).toBe(false);
  });
});

describe('ResetPasswordRequestSchema', () => {
  const valid = { resetToken: 'a-reset-token', newPassword: 'Str0ng!Pass' };

  it('accepts a valid reset payload', () => {
    expect(ResetPasswordRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty reset token', () => {
    expect(ResetPasswordRequestSchema.safeParse({ ...valid, resetToken: '' }).success).toBe(
      false,
    );
  });

  it('rejects a weak new password', () => {
    expect(ResetPasswordRequestSchema.safeParse({ ...valid, newPassword: 'weak' }).success).toBe(
      false,
    );
  });

  it('rejects a missing resetToken', () => {
    expect(
      ResetPasswordRequestSchema.safeParse({ newPassword: valid.newPassword }).success,
    ).toBe(false);
  });
});

describe('ResetTokenPayloadSchema', () => {
  const valid = {
    userId: '9d2a13e0-4a2e-4b1a-9c3e-2f6f6b5e1a01',
    otpId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    purpose: 'password_reset' as const,
    iat: 1_700_000_000,
    exp: 1_700_000_900,
  };

  it('accepts a valid decoded reset-token payload', () => {
    expect(ResetTokenPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a payload with the wrong purpose', () => {
    expect(
      ResetTokenPayloadSchema.safeParse({ ...valid, purpose: 'access_token' }).success,
    ).toBe(false);
  });

  it('rejects a payload missing otpId', () => {
    const { otpId: _otpId, ...rest } = valid;
    expect(ResetTokenPayloadSchema.safeParse(rest).success).toBe(false);
  });
});
