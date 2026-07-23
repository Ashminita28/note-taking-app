import { describe, it, expect } from 'vitest';
import { VersionNumberParamSchema } from '../../src/schemas/version.schemas';

const VALID_ID = 'a92183a4-2b92-4cb1-8762-29a2aa3b971b';

describe('VersionNumberParamSchema', () => {
  it('accepts a valid UUID id with a positive integer versionNumber', () => {
    const result = VersionNumberParamSchema.safeParse({ id: VALID_ID, versionNumber: 2 });
    expect(result.success).toBe(true);
  });

  it('coerces a numeric-string versionNumber', () => {
    const result = VersionNumberParamSchema.parse({ id: VALID_ID, versionNumber: '2' });
    expect(result.versionNumber).toBe(2);
  });

  it('accepts versionNumber at the minimum bound (1)', () => {
    const result = VersionNumberParamSchema.safeParse({ id: VALID_ID, versionNumber: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID id', () => {
    const result = VersionNumberParamSchema.safeParse({ id: 'not-a-uuid', versionNumber: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric versionNumber', () => {
    const result = VersionNumberParamSchema.safeParse({ id: VALID_ID, versionNumber: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects versionNumber of 0', () => {
    const result = VersionNumberParamSchema.safeParse({ id: VALID_ID, versionNumber: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a negative versionNumber', () => {
    const result = VersionNumberParamSchema.safeParse({ id: VALID_ID, versionNumber: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer versionNumber', () => {
    const result = VersionNumberParamSchema.safeParse({ id: VALID_ID, versionNumber: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects a missing versionNumber', () => {
    const result = VersionNumberParamSchema.safeParse({ id: VALID_ID });
    expect(result.success).toBe(false);
  });
});
