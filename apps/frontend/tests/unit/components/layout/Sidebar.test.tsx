import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../../../../src/components/layout/Sidebar';
import { useTagsQuery } from '../../../../src/features/tags/tags.hooks';
import { useUIStore } from '../../../../src/stores/ui.store';

vi.mock('../../../../src/features/tags/tags.hooks', () => ({
  useTagsQuery: vi.fn(),
}));

describe('Sidebar', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ sidebarOpen: false });
  });

  it('hides the overlay backdrop when the sidebar is closed', () => {
    vi.mocked(useTagsQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { tags: [] },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTagsQuery>);

    render(<Sidebar selectedTagIds={[]} trashActive={false} onToggleTag={vi.fn()} />);

    expect(screen.queryByLabelText('Close sidebar')).not.toBeInTheDocument();
  });

  it('shows a backdrop that closes the sidebar when open', () => {
    vi.mocked(useTagsQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { tags: [] },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTagsQuery>);
    useUIStore.setState({ sidebarOpen: true });

    render(<Sidebar selectedTagIds={[]} trashActive={false} onToggleTag={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Close sidebar'));

    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });
});
