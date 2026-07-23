import { SidebarTagList } from '../../features/tags/components/SidebarTagList';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/ui.store';

interface SidebarProps {
  selectedTagIds: string[];
  trashActive: boolean;
  onToggleTag: (tagId: string) => void;
}

export function Sidebar({ selectedTagIds, trashActive, onToggleTag }: SidebarProps) {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={toggleSidebar}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}
      <nav
        aria-label="Tag filters"
        className={cn(
          'z-40 w-[280px] shrink-0 flex-col gap-4 border-r bg-card p-4',
          'lg:static lg:flex',
          sidebarOpen ? 'fixed inset-y-0 left-0 flex' : 'hidden lg:flex',
        )}
      >
        <p className="text-sm font-semibold text-foreground">Tags</p>
        <SidebarTagList selectedTagIds={selectedTagIds} disabled={trashActive} onToggleTag={onToggleTag} />
      </nav>
    </>
  );
}
