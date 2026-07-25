import { useEditor, EditorContent } from '@tiptap/react';
import { buildEditorExtensions } from '../../notes/tiptap-extensions';

interface VersionContentProps {
  content: string;
}

/** Read-only TipTap render (plan.md Decision 2) — same extension set as the authoring editor
 *  (CON-001), no toolbar. Never touches the live editor instance; FR-VER-003 AC-3. */
export function VersionContent({ content }: VersionContentProps) {
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
