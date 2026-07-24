import { DEFAULT_SHARE_EXPIRY_HOURS } from '@note-app/shared';

export interface ShareExpiryOption {
  label: string;
  hours: number;
}

/** Canonical source: plan.md Decision 2 — presets within SHARE_EXPIRY_MIN_HOURS–SHARE_EXPIRY_MAX_HOURS (1–720). */
export const SHARE_EXPIRY_OPTIONS: ShareExpiryOption[] = [
  { label: '1 hour', hours: 1 },
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: DEFAULT_SHARE_EXPIRY_HOURS },
  { label: '30 days', hours: 720 },
];

export const COPIED_FEEDBACK_MS = 2000;
