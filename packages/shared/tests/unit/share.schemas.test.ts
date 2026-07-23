import { describe, it, expect } from 'vitest';
import { CreateShareRequestSchema, ShareTokenParamSchema } from '../../src/schemas/share.schemas';
import { SHARE_EXPIRY_MIN_HOURS, SHARE_EXPIRY_MAX_HOURS } from '../../src/constants/limits';

describe('CreateShareRequestSchema', () => {
  it('accepts an empty body, leaving expiresInHours undefined', () => {
    const result = CreateShareRequestSchema.parse({});
    expect(result.expiresInHours).toBeUndefined();
  });

  it('accepts a valid expiresInHours', () => {
    const result = CreateShareRequestSchema.parse({ expiresInHours: 24 });
    expect(result.expiresInHours).toBe(24);
  });

  it('coerces a numeric string expiresInHours', () => {
    const result = CreateShareRequestSchema.parse({ expiresInHours: '24' });
    expect(result.expiresInHours).toBe(24);
  });

  it('accepts expiresInHours at the minimum bound', () => {
    const result = CreateShareRequestSchema.safeParse({ expiresInHours: SHARE_EXPIRY_MIN_HOURS });
    expect(result.success).toBe(true);
  });

  it('accepts expiresInHours at the maximum bound', () => {
    const result = CreateShareRequestSchema.safeParse({ expiresInHours: SHARE_EXPIRY_MAX_HOURS });
    expect(result.success).toBe(true);
  });

  it('rejects expiresInHours below the minimum', () => {
    const result = CreateShareRequestSchema.safeParse({
      expiresInHours: SHARE_EXPIRY_MIN_HOURS - 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects expiresInHours of 0', () => {
    expect(CreateShareRequestSchema.safeParse({ expiresInHours: 0 }).success).toBe(false);
  });

  it('rejects expiresInHours above the maximum', () => {
    const result = CreateShareRequestSchema.safeParse({
      expiresInHours: SHARE_EXPIRY_MAX_HOURS + 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer expiresInHours', () => {
    expect(CreateShareRequestSchema.safeParse({ expiresInHours: 12.5 }).success).toBe(false);
  });

  it('rejects a non-numeric expiresInHours', () => {
    expect(CreateShareRequestSchema.safeParse({ expiresInHours: 'soon' }).success).toBe(false);
  });
});

describe('ShareTokenParamSchema', () => {
  it('accepts a UUID-shaped token', () => {
    const result = ShareTokenParamSchema.safeParse({
      token: 'a92183a4-2b92-4cb1-8762-29a2aa3b971b',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a non-UUID-shaped string — format is irrelevant, only existence matters downstream', () => {
    const result = ShareTokenParamSchema.safeParse({ token: 'not-a-uuid-but-still-a-string' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty token', () => {
    expect(ShareTokenParamSchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('rejects a missing token', () => {
    expect(ShareTokenParamSchema.safeParse({}).success).toBe(false);
  });
});
