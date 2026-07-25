import { useCallback, useEffect, useRef, useState } from 'react';
import { NOTE_CONTENT_MAX_SIZE_BYTES } from '@note-app/shared';
import type { NoteResponse } from '@note-app/shared';
import { ApiError } from '../../lib/api-client';
import { useUIStore } from '../../stores/ui.store';
import { useCreateNoteMutation, useUpdateNoteMutation } from './notes.hooks';
import { NOTE_AUTOSAVE_DEBOUNCE_MS, NOTE_CONTENT_TOO_LARGE_MESSAGE } from './notes.constants';
import type { EditorDraft, SaveStatus } from './notes.types';

export interface UseAutosaveOptions {
  id: string;
  isNew: boolean;
  draft: EditorDraft;
  /** False while an existing note's data hasn't arrived yet (`draft` is still the blank placeholder).
   *  Prevents the dirty-check from comparing the real note against that placeholder once it loads. */
  ready: boolean;
  onCreated: (note: NoteResponse) => void;
}

export interface UseAutosaveResult {
  status: SaveStatus;
  /** Set alongside `status === 'error'` when there's a specific reason to surface (size limit, server message). */
  errorMessage?: string;
  forceSave: () => void;
  /** Escape hatch for a deliberate external content replacement (AB-1015 version restore) that
   *  isn't itself a fresh edit to autosave — resyncs the dirty-check baseline so it doesn't read
   *  as a pending change and schedule a redundant, duplicate-version-creating autosave `PATCH`. */
  syncBaseline: (next: EditorDraft) => void;
}

function sameDraft(a: EditorDraft, b: EditorDraft): boolean {
  if (a.title !== b.title || a.content !== b.content) {
    return false;
  }
  const aTags = [...a.tagIds].sort();
  const bTags = [...b.tagIds].sort();
  return aTags.length === bTags.length && aTags.every((tagId, index) => tagId === bTags[index]);
}

function contentExceedsSizeLimit(content: string): boolean {
  return new Blob([content]).size > NOTE_CONTENT_MAX_SIZE_BYTES;
}

/**
 * Encapsulates SDS §23.3's autosave design: 2s debounce, dirty-check, and the create-then-update
 * transition for a brand-new note (plan.md Decision 1/5). Mounted once by `EditorPage` and never
 * remounted across the `/notes/new` → `/notes/:id` URL swap, so the debounce timer and dirty
 * baseline survive that transition untouched.
 */
export function useAutosave({ id, isNew, draft, ready, onCreated }: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const lastSavedRef = useRef<EditorDraft>(draft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const adoptedBaselineRef = useRef(false);
  const setEditorDirty = useUIStore((state) => state.setEditorDirty);

  const createMutation = useCreateNoteMutation();
  const updateMutation = useUpdateNoteMutation(id);
  // Mutation objects are re-created every render by TanStack Query, so they're read via a ref
  // (updated on each render) rather than a `useCallback` dependency — otherwise `performSave`
  // would change identity every render and reset the pending debounce timer below on unrelated
  // re-renders, defeating the debounce entirely.
  const mutationsRef = useRef({ createMutation, updateMutation });
  mutationsRef.current = { createMutation, updateMutation };

  // Always-current snapshot of the latest props. A save that finishes after further edits have
  // arrived needs to read the freshest draft, not the one closed over when it was scheduled.
  const latestRef = useRef({ draft, isNew, onCreated });
  latestRef.current = { draft, isNew, onCreated };

  const runSave = useCallback(async () => {
    const { draft: currentDraft, isNew: currentIsNew, onCreated: currentOnCreated } = latestRef.current;

    if (contentExceedsSizeLimit(currentDraft.content)) {
      setStatus('error');
      setErrorMessage(NOTE_CONTENT_TOO_LARGE_MESSAGE);
      return;
    }

    inFlightRef.current = true;
    setStatus('saving');
    let succeeded = false;
    try {
      if (currentIsNew) {
        const result = await mutationsRef.current.createMutation.mutateAsync({
          title: currentDraft.title,
          content: currentDraft.content,
          tagIds: currentDraft.tagIds,
        });
        lastSavedRef.current = currentDraft;
        setStatus('saved');
        setErrorMessage(undefined);
        setEditorDirty(false);
        currentOnCreated(result.note);
      } else {
        await mutationsRef.current.updateMutation.mutateAsync({
          title: currentDraft.title,
          content: currentDraft.content,
          tagIds: currentDraft.tagIds,
        });
        lastSavedRef.current = currentDraft;
        setStatus('saved');
        setErrorMessage(undefined);
        setEditorDirty(false);
      }
      succeeded = true;
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiError ? err.message : undefined);
    } finally {
      inFlightRef.current = false;
    }

    // Further edits may have arrived while this request was in flight — their own
    // debounce-triggered save was dropped by the in-flight guard in `performSave` below. Chain
    // straight into them now instead of silently losing them (and instead of "Saved ✓"/
    // `editorDirty=false` above ever reflecting a draft that was never actually sent). Only do
    // this after a *successful* save; a failed save still waits for the next edit's own debounce
    // cycle rather than auto-retrying (SDS §23.3 Rule 5).
    if (succeeded && !sameDraft(latestRef.current.draft, lastSavedRef.current)) {
      await runSave();
    }
  }, [setEditorDirty]);

  const performSave = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    await runSave();
  }, [runSave]);

  useEffect(() => {
    if (!ready) {
      // Existing note hasn't loaded yet — `draft` is still the blank placeholder. Keep the
      // baseline in lock-step with it so there's nothing to diff against once real data arrives.
      lastSavedRef.current = draft;
      return;
    }

    if (!adoptedBaselineRef.current) {
      // First render where real data is available (or the very first render for a new note).
      // Adopt it as the saved baseline rather than diffing against the stale placeholder —
      // otherwise loading an unmodified note would look "dirty" and trigger a spurious save.
      adoptedBaselineRef.current = true;
      lastSavedRef.current = draft;
      if (!isNew) {
        // Spec Scenario 1 / UX §8.7: an existing note that just loaded with no pending edits
        // shows "Saved ✓", not a blank indicator. A brand-new note (isNew) has nothing saved
        // yet, so it stays idle/blank until the first autosave completes.
        setStatus('saved');
      }
      return;
    }

    if (sameDraft(draft, lastSavedRef.current)) {
      return;
    }

    setEditorDirty(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      void performSave();
    }, NOTE_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [draft, ready, isNew, performSave, setEditorDirty]);

  const forceSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!sameDraft(draft, lastSavedRef.current)) {
      void performSave();
    }
  }, [draft, performSave]);

  const syncBaseline = useCallback((next: EditorDraft) => {
    lastSavedRef.current = next;
  }, []);

  return { status, errorMessage, forceSave, syncBaseline };
}
