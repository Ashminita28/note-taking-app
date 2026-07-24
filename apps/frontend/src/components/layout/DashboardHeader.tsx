import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { UserMenu } from '../../features/auth/components/UserMenu';
import { SearchBar } from '../../features/search/components/SearchBar';
import { useUIStore } from '../../stores/ui.store';

export function DashboardHeader() {
  const navigate = useNavigate();
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Toggle sidebar" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Notes</h1>
      </div>
      <SearchBar />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => navigate('/notes/new')}>
          + New Note
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
