import { X } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { TagCombobox } from './TagCombobox';
import type { NoteTagRef } from '@note-app/shared';

interface TagBarProps {
  tags: NoteTagRef[];
  onChange: (tags: NoteTagRef[]) => void;
}

/** Removable tag chips + add/create control (FR-NOTE-003, FR-TAG-001, BR-004 zero-tags case). */
export function TagBar({ tags, onChange }: TagBarProps) {
  function removeTag(tagId: string): void {
    onChange(tags.filter((tag) => tag.id !== tagId));
  }

  function addTag(tag: NoteTagRef): void {
    if (tags.some((existing) => existing.id === tag.id)) {
      return;
    }
    onChange([...tags, tag]);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b p-4">
      {tags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
          {tag.name}
          <button
            type="button"
            aria-label={`Remove tag ${tag.name}`}
            className="rounded-full hover:text-destructive"
            onClick={() => removeTag(tag.id)}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </Badge>
      ))}
      <TagCombobox excludeTagIds={tags.map((tag) => tag.id)} onSelect={addTag} />
    </div>
  );
}
