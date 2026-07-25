import { forwardRef, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { buildEditorExtensions } from '../tiptap-extensions';
import { TipTapToolbar } from './TipTapToolbar';

interface NoteEditorProps {
  /** Initial HTML only — used once at mount. Later prop changes are intentionally ignored so that
   *  navigating `/notes/new` → `/notes/:id` (plan.md Decision 1) never disturbs the live document,
   *  cursor position, or undo stack. */
  initialContent: string;
  onContentChange: (html: string) => void;
}

/** Imperative escape hatch for deliberate full-content replacement (e.g. AB-1015 version restore)
 *  that must bypass the `initialContent`-ignored-after-mount rule above without remounting the
 *  editor or disturbing cursor/undo state for normal typing. */
export interface NoteEditorHandle {
  setContent: (html: string) => void;
}

/** Hosts the TipTap instance (SDS §23.1). Never keyed by note id — see plan.md Decision 1. */
export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  { initialContent, onContentChange },
  ref,
) {
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

  const editor = useEditor(
    {
      extensions: buildEditorExtensions(),
      content: initialContent,
      onUpdate: ({ editor: updatedEditor }) => {
        onContentChange(updatedEditor.getHTML());
      },
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      setContent: (html: string) => {
        editor?.commands.setContent(html);
      },
    }),
    [editor],
  );

  if (!editor) {
    return null;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const isMod = event.ctrlKey || event.metaKey;
    if (!isMod || !editor) {
      return;
    }
    if (event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setLinkPopoverOpen(true);
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      editor.chain().focus().toggleCodeBlock().run();
      return;
    }
    if (event.shiftKey && event.key.toLowerCase() === 'x') {
      event.preventDefault();
      editor.chain().focus().toggleStrike().run();
      return;
    }
    // `event.code` (not `.key`) so this fires on `Digit9` regardless of what shift+9 produces
    // for the active keyboard layout (e.g. "(" on US layouts).
    if (event.shiftKey && event.code === 'Digit9') {
      event.preventDefault();
      editor.chain().focus().toggleOrderedList().run();
    }
  }

  return (
    <div className="flex flex-1 flex-col" onKeyDown={handleKeyDown}>
      <TipTapToolbar editor={editor} linkPopoverOpen={linkPopoverOpen} onLinkPopoverOpenChange={setLinkPopoverOpen} />
      <EditorContent editor={editor} className="flex-1 p-4 focus:outline-none [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none" />
    </div>
  );
});
