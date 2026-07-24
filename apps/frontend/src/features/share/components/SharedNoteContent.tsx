import { useEditor, EditorContent } from '@tiptap/react';
import { buildEditorExtensions } from '../../notes/tiptap-extensions';

interface SharedNoteContentProps {
  content: string;
}

/** Read-only TipTap render (plan.md Decision 3) — same extension set as the authoring editor (CON-001), no toolbar. */
export function SharedNoteContent({ content }: SharedNoteContentProps) {
  const editor = useEditor(
    {
      extensions: buildEditorExtensions(),
      content,
      editable: false,
    },
    [content],
  );

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} className="[&_.ProseMirror]:outline-none" />;
}
