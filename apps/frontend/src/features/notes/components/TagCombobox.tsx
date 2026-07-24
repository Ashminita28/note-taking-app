import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { DEFAULT_TAG_COLOR } from '@note-app/shared';
import type { NoteTagRef } from '@note-app/shared';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useTagsQuery, useCreateTagMutation } from '../../tags/tags.hooks';

interface TagComboboxProps {
  excludeTagIds: string[];
  onSelect: (tag: NoteTagRef) => void;
}

/** UX-TAG-03: add an existing tag or create a new one inline, without opening the Tag Management Modal. */
export function TagCombobox({ excludeTagIds, onSelect }: TagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data } = useTagsQuery();
  const createTagMutation = useCreateTagMutation();

  const availableTags = useMemo(() => {
    const all = data?.tags ?? [];
    return all
      .filter((tag) => !excludeTagIds.includes(tag.id))
      .filter((tag) => tag.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [data, excludeTagIds, query]);

  const exactMatchExists = availableTags.some(
    (tag) => tag.name.toLowerCase() === query.trim().toLowerCase(),
  );

  function selectTag(tag: NoteTagRef): void {
    onSelect(tag);
    setQuery('');
    setOpen(false);
  }

  function createAndSelect(): void {
    const name = query.trim();
    if (!name) {
      return;
    }
    createTagMutation.mutate(
      { name, color: DEFAULT_TAG_COLOR },
      {
        onSuccess: (tag) => selectTag(tag),
      },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label="Add tag">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add tag
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <Input
          autoFocus
          aria-label="Search or create tag"
          placeholder="Search or create tag..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && query.trim() && !exactMatchExists) {
              event.preventDefault();
              createAndSelect();
            }
          }}
        />
        <ul className="mt-2 max-h-48 overflow-y-auto">
          {availableTags.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => selectTag({ id: tag.id, name: tag.name, color: tag.color })}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: tag.color }}
                  aria-hidden="true"
                />
                {tag.name}
              </button>
            </li>
          ))}
          {query.trim() && !exactMatchExists && (
            <li>
              <button
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
                onClick={createAndSelect}
                disabled={createTagMutation.isPending}
              >
                Create &quot;{query.trim()}&quot;
              </button>
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
