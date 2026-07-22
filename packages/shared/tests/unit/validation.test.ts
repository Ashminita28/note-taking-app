import { describe, it, expect } from 'vitest';
import { isStrongPassword } from '../../src/utils/validation';

describe('isStrongPassword', () => {
  it('accepts a password with uppercase, lowercase, digit, and special character', () => {
    expect(isStrongPassword('Str0ng!Pass')).toBe(true);
  });

  it('rejects a password missing an uppercase letter', () => {
    expect(isStrongPassword('str0ng!pass')).toBe(false);
  });

  it('rejects a password missing a lowercase letter', () => {
    expect(isStrongPassword('STR0NG!PASS')).toBe(false);
  });

  it('rejects a password missing a digit', () => {
    expect(isStrongPassword('Strong!Pass')).toBe(false);
  });

  it('rejects a password missing a special character', () => {
    expect(isStrongPassword('Str0ngPass')).toBe(false);
  });
});
