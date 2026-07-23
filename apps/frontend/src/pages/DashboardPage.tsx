import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '../components/layout/DashboardHeader';
import { SkipLink } from '../components/layout/SkipLink';
import { Sidebar } from '../components/layout/Sidebar';
import { NotesList } from '../features/notes/components/NotesList';
import { PaginationControls } from '../features/notes/components/PaginationControls';
import { SortDropdown } from '../features/notes/components/SortDropdown';
import { TrashToggle } from '../features/notes/components/TrashToggle';
import { useNotesQuery } from '../features/notes/notes.hooks';
import { useNotesListParams } from '../features/notes/useNotesListParams';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { params, setPage, setSort, toggleTag, setTrash } = useNotesListParams();
  const { data } = useNotesQuery(params);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && event.key.toLowerCase() === 'n' && !isTypingTarget(event.target)) {
        event.preventDefault();
        navigate('/notes/new');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <DashboardHeader />
      <div className="flex flex-1">
        <Sidebar selectedTagIds={params.tagIds} trashActive={params.trash} onToggleTag={toggleTag} />
        <main id="main-content" className="flex-1 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <TrashToggle trash={params.trash} onChange={setTrash} />
            {!params.trash && <SortDropdown sortBy={params.sortBy} sortOrder={params.sortOrder} onChange={setSort} />}
          </div>
          <NotesList params={params} />
          {data && <PaginationControls pagination={data.pagination} onPageChange={setPage} />}
        </main>
      </div>
    </div>
  );
}
