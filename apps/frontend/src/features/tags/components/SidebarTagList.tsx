import { Button } from '../../../components/ui/button';
import { useTagsQuery } from '../tags.hooks';
import { TagChip } from './TagChip';
import { TagListSkeleton } from './TagListSkeleton';

interface SidebarTagListProps {
  selectedTagIds: string[];
  disabled: boolean;
  onToggleTag: (tagId: string) => void;
}

export function SidebarTagList({ selectedTagIds, disabled, onToggleTag }: SidebarTagListProps) {
  const { data, isLoading, isError, refetch } = useTagsQuery();

  if (isLoading) {
    return <TagListSkeleton />;
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 text-sm">
        <p className="text-muted-foreground">Unable to load tags.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  const tags = data?.tags ?? [];

  if (tags.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No tags yet</p>
        <p>Create tags to organize your notes.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1" aria-label="Filter by tag">
      {tags.map((tag) => (
        <li key={tag.id}>
          <TagChip tag={tag} selected={selectedTagIds.includes(tag.id)} disabled={disabled} onToggle={onToggleTag} />
        </li>
      ))}
    </ul>
  );
}
