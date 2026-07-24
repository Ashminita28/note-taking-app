import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Link2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface LinkPopoverProps {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** SDS §15.2 `Ctrl+K` / toolbar Link button — resolves spec.md Scenario 17 (plan.md Decision 3). */
export function LinkPopover({ editor, open, onOpenChange }: LinkPopoverProps) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (open) {
      setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
    }
  }, [open, editor]);

  function applyLink(): void {
    const trimmed = url.trim();
    if (trimmed) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    }
    onOpenChange(false);
  }

  function removeLink(): void {
    editor.chain().focus().unsetLink().run();
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Insert link"
          aria-pressed={editor.isActive('link')}
          onClick={() => onOpenChange(true)}
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyLink();
          }}
        >
          <Input
            autoFocus
            aria-label="Link URL"
            placeholder="https://example.com"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            {editor.isActive('link') && (
              <Button type="button" variant="outline" size="sm" onClick={removeLink}>
                Remove link
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
