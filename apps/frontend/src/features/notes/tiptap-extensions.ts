import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import CharacterCount from '@tiptap/extension-character-count';
import { createLowlight, common } from 'lowlight';
import type { AnyExtension } from '@tiptap/react';

const lowlight = createLowlight(common);

/**
 * Canonical source: SDS Section 23.1 — this exact extension set, no substitutions or additions (CON-001).
 */
export function buildEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({ codeBlock: false }),
    Placeholder.configure({ placeholder: 'Start writing...' }),
    Typography,
    Highlight,
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    CodeBlockLowlight.configure({ lowlight }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    CharacterCount,
  ];
}
