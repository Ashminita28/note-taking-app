import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Code2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { LinkPopover } from './LinkPopover';

interface ToolbarButtonConfig {
  label: string;
  icon: typeof Bold;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const BUTTONS: ToolbarButtonConfig[] = [
  {
    label: 'Bold',
    icon: Bold,
    isActive: (editor) => editor.isActive('bold'),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    label: 'Italic',
    icon: Italic,
    isActive: (editor) => editor.isActive('italic'),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    label: 'Underline',
    icon: UnderlineIcon,
    isActive: (editor) => editor.isActive('underline'),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    label: 'Strikethrough',
    icon: Strikethrough,
    isActive: (editor) => editor.isActive('strike'),
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    label: 'Highlight',
    icon: Highlighter,
    isActive: (editor) => editor.isActive('highlight'),
    run: (editor) => editor.chain().focus().toggleHighlight().run(),
  },
  {
    label: 'Bullet list',
    icon: List,
    isActive: (editor) => editor.isActive('bulletList'),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Ordered list',
    icon: ListOrdered,
    isActive: (editor) => editor.isActive('orderedList'),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    label: 'Task list',
    icon: ListChecks,
    isActive: (editor) => editor.isActive('taskList'),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    label: 'Blockquote',
    icon: Quote,
    isActive: (editor) => editor.isActive('blockquote'),
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    label: 'Inline code',
    icon: Code,
    isActive: (editor) => editor.isActive('code'),
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    label: 'Code block',
    icon: Code2,
    isActive: (editor) => editor.isActive('codeBlock'),
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: 'Align left',
    icon: AlignLeft,
    isActive: (editor) => editor.isActive({ textAlign: 'left' }),
    run: (editor) => editor.chain().focus().setTextAlign('left').run(),
  },
  {
    label: 'Align center',
    icon: AlignCenter,
    isActive: (editor) => editor.isActive({ textAlign: 'center' }),
    run: (editor) => editor.chain().focus().setTextAlign('center').run(),
  },
  {
    label: 'Align right',
    icon: AlignRight,
    isActive: (editor) => editor.isActive({ textAlign: 'right' }),
    run: (editor) => editor.chain().focus().setTextAlign('right').run(),
  },
];

interface TipTapToolbarProps {
  editor: Editor;
  linkPopoverOpen: boolean;
  onLinkPopoverOpenChange: (open: boolean) => void;
}

/** UX §8.7: sticky single-row on desktop, horizontally scrollable on tablet/mobile. */
export function TipTapToolbar({ editor, linkPopoverOpen, onLinkPopoverOpenChange }: TipTapToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b bg-card p-2"
    >
      {BUTTONS.map(({ label, icon: Icon, isActive, run }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="sm"
          aria-label={label}
          aria-pressed={isActive(editor)}
          onClick={() => run(editor)}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </Button>
      ))}
      <LinkPopover editor={editor} open={linkPopoverOpen} onOpenChange={onLinkPopoverOpenChange} />
    </div>
  );
}
