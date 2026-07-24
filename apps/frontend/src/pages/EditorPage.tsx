import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { NoteResponse, NoteTagRef } from '@note-app/shared';
import { ActionHeader } from '../features/notes/components/ActionHeader';
import { TagBar } from '../features/notes/components/TagBar';
import { NoteEditor } from '../features/notes/components/NoteEditor';
import { EditorSkeleton } from '../features/notes/components/EditorSkeleton';
import { NoteNotFoundState } from '../features/notes/components/NoteNotFoundState';
import { ShareModal } from '../features/share/components/ShareModal';
import { useNoteQuery } from '../features/notes/notes.hooks';
import { useAutosave } from '../features/notes/useAutosave';
import { NEW_NOTE_ID } from '../features/notes/notes.constants';
import { useUIStore } from '../stores/ui.store';
import type { EditorDraft } from '../features/notes/notes.types';

export function EditorPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const id = routeId ?? NEW_NOTE_ID;
  const isNew = id === NEW_NOTE_ID;
  const navigate = useNavigate();
  const setEditorDirty = useUIStore((state) => state.setEditorDirty);

  const noteQuery = useNoteQuery(id, { enabled: !isNew });

  const [draft, setDraft] = useState<EditorDraft>({ title: '', content: '', tagIds: [] });
  const [tags, setTags] = useState<NoteTagRef[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const seededRef = useRef(false);
  const moreMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Seeds local draft/tags exactly once — from a blank slate for a new note, or from the loaded
  // note for an existing one. Guarded by `seededRef` so a later background refetch (e.g. once
  // `isNew` flips false post-creation) never clobbers in-progress edits.
  useEffect(() => {
    if (seededRef.current) {
      return;
    }
    if (isNew) {
      seededRef.current = true;
      return;
    }
    if (noteQuery.data) {
      const { note } = noteQuery.data;
      setDraft({ title: note.title, content: note.content, tagIds: note.tags.map((tag) => tag.id) });
      setTags(note.tags);
      seededRef.current = true;
    }
  }, [isNew, noteQuery.data]);

  const handleTitleChange = useCallback((title: string) => {
    setDraft((prev) => ({ ...prev, title }));
  }, []);

  const handleContentChange = useCallback((content: string) => {
    setDraft((prev) => ({ ...prev, content }));
  }, []);

  const handleTagsChange = useCallback((nextTags: NoteTagRef[]) => {
    setTags(nextTags);
    setDraft((prev) => ({ ...prev, tagIds: nextTags.map((tag) => tag.id) }));
  }, []);

  const handleCreated = useCallback(
    (note: NoteResponse) => {
      navigate(`/notes/${note.id}`, { replace: true });
    },
    [navigate],
  );

  const ready = isNew || seededRef.current;
  const { status, errorMessage, forceSave } = useAutosave({ id, isNew, draft, ready, onCreated: handleCreated });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        forceSave();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [forceSave]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      if (useUIStore.getState().editorDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Leaving the editor clears the dirty flag so it doesn't wrongly trigger `beforeunload` from
  // some other page (e.g. the Dashboard) afterward.
  useEffect(() => {
    return () => setEditorDirty(false);
  }, [setEditorDirty]);

  if (!isNew && noteQuery.isLoading) {
    return <EditorSkeleton />;
  }

  if (!isNew && noteQuery.isError) {
    return <NoteNotFoundState />;
  }

  if (!isNew && !seededRef.current) {
    return <EditorSkeleton />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ActionHeader
        noteId={id}
        title={draft.title}
        onTitleChange={handleTitleChange}
        status={status}
        errorMessage={errorMessage}
        canDelete={!isNew}
        autoFocusTitle={isNew}
        onShare={isNew ? undefined : () => setShareModalOpen(true)}
        onMoreMenuTriggerRef={(element) => {
          moreMenuTriggerRef.current = element;
        }}
      />
      <TagBar tags={tags} onChange={handleTagsChange} />
      <NoteEditor initialContent={draft.content} onContentChange={handleContentChange} />
      {!isNew && (
        <ShareModal
          noteId={id}
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          returnFocusRef={moreMenuTriggerRef}
        />
      )}
    </div>
  );
}
