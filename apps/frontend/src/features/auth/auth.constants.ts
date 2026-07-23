/**
 * Frontend-only display constants — not shared contracts, since the backend never returns these
 * values (see `openspec/tickets/AB-1010/plan.md` Decisions 2-3). Coupled by convention to the
 * backend's `OTP_EXPIRY_MINUTES` default (SDS §7); update both if that default ever changes.
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 600;

/** Cosmetic only — the enforced limit is the backend's `OTP_VERIFY_RATE_LIMIT` (5/hour). */
export const OTP_MAX_ATTEMPTS = 5;
