import { PASSWORD_MIN_LENGTH } from '@note-app/shared';

export interface PasswordRule {
  label: string;
  message: string;
  test: (password: string) => boolean;
}

/** Mirrors `isStrongPassword` (packages/shared/src/utils/validation.ts) — canonical source FRS §13.1. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    test: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: 'At least one uppercase letter',
    message: 'Must contain at least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: 'At least one lowercase letter',
    message: 'Must contain at least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: 'At least one number',
    message: 'Must contain at least one number',
    test: (password) => /\d/.test(password),
  },
  {
    label: 'At least one special character (!@#$%^&*)',
    message: 'Must contain at least one special character (!@#$%^&*)',
    test: (password) => /[!@#$%^&*]/.test(password),
  },
];
