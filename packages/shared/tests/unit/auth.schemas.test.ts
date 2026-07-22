import { describe, it, expect } from 'vitest';
import {
  UserProfileSchema,
  RegisterRequestSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  LogoutRequestSchema,
  AccessTokenPayloadSchema,
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
