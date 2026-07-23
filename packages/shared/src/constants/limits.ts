/** Validation limits — canonical source: FRS Section 13 (Validation Rules). */

export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 100;

export const EMAIL_MAX_LENGTH = 255;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const OTP_LENGTH = 6;

export const NOTE_TITLE_MAX_LENGTH = 255;
export const NOTE_CONTENT_MAX_SIZE_BYTES = 500 * 1024;

export const TAG_NAME_MIN_LENGTH = 1;
export const TAG_NAME_MAX_LENGTH = 50;

export const SEARCH_QUERY_MIN_LENGTH = 1;
export const SEARCH_QUERY_MAX_LENGTH = 200;

export const SHARE_EXPIRY_MIN_HOURS = 1;
export const SHARE_EXPIRY_MAX_HOURS = 720;

export const PAGE_MIN = 1;
export const PAGE_SIZE_MIN = 1;
export const PAGE_SIZE_MAX = 100;

export const RECOVERY_WINDOW_DAYS = 30;
