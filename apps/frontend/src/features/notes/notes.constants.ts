/** Display-only formatting constant — not a data contract, so it does not belong in `@note-app/shared`. */
export const NOTE_PREVIEW_LENGTH = 150;

/** Autosave debounce period — canonical source: SDS Section 23.3. */
export const NOTE_AUTOSAVE_DEBOUNCE_MS = 2000;

/** Reserved route id for the "create note" flow — never collides with a real UUID (plan.md Decision 1). */
export const NEW_NOTE_ID = 'new';

/** Shown by AutosaveStatusIndicator when the client-side size pre-check short-circuits a save (Scenario 12). */
export const NOTE_CONTENT_TOO_LARGE_MESSAGE = 'This note is too large to save. Trim some content and try again.';
