import { LoginRequestSchema } from '@note-app/shared';
import { PASSWORD_RULES } from './password-rules';

/** UX §14.1/14.2 copy — reuses the shared `emailSchema` (via any request schema's `email` field, they
 * all reference the same instance) for the actual validity check so the message text and the pass/fail
 * decision never drift apart. */
export function getEmailError(email: string): string | undefined {
  if (!email.trim()) return 'Email is required';
  return LoginRequestSchema.shape.email.safeParse(email).success
    ? undefined
    : 'Please enter a valid email address';
}

/** First failing rule's UX §14.1 message, or `undefined` if the password satisfies every rule. */
export function getPasswordRuleError(password: string): string | undefined {
  if (!password) return 'Password is required';
  return PASSWORD_RULES.find((rule) => !rule.test(password))?.message;
}
