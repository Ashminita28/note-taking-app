/** Shared validation helpers — canonical source: FRS Section 13 (Validation Rules). */

const UPPERCASE_RE = /[A-Z]/;
const LOWERCASE_RE = /[a-z]/;
const DIGIT_RE = /\d/;
const SPECIAL_CHAR_RE = /[!@#$%^&*]/;

/** Password must contain at least one uppercase, lowercase, digit, and special character (FRS §13.1). */
export function isStrongPassword(password: string): boolean {
  return (
    UPPERCASE_RE.test(password) &&
    LOWERCASE_RE.test(password) &&
    DIGIT_RE.test(password) &&
    SPECIAL_CHAR_RE.test(password)
  );
}
