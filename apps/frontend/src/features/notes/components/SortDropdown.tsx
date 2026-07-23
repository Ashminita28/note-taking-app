import type { NoteSortField } from '@note-app/shared';
import { Button } from '../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import type { SortOrder } from '../notes.types';

interface SortOption {
  sortBy: NoteSortField;
  sortOrder: SortOrder;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { sortBy: 'updatedAt', sortOrder: 'desc', label: 'Last updated' },
  { sortBy: 'updatedAt', sortOrder: 'asc', label: 'Oldest updated' },
  { sortBy: 'createdAt', sortOrder: 'desc', label: 'Newest created' },
  { sortBy: 'createdAt', sortOrder: 'asc', label: 'Oldest created' },
  { sortBy: 'title', sortOrder: 'asc', label: 'Title A–Z' },
  { sortBy: 'title', sortOrder: 'desc', label: 'Title Z–A' },
];

interface SortDropdownProps {
  sortBy: NoteSortField;
  sortOrder: SortOrder;
  onChange: (sortBy: NoteSortField, sortOrder: SortOrder) => void;
}

export function SortDropdown({ sortBy, sortOrder, onChange }: SortDropdownProps) {
  const active = SORT_OPTIONS.find((option) => option.sortBy === sortBy && option.sortOrder === sortOrder);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Sort notes">
          Sort: {active?.label ?? 'Last updated'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={`${option.sortBy}-${option.sortOrder}`}
            aria-current={option === active}
            onSelect={() => onChange(option.sortBy, option.sortOrder)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
