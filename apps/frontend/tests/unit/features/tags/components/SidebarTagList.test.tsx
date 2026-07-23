import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarTagList } from '../../../../../src/features/tags/components/SidebarTagList';
import { useTagsQuery } from '../../../../../src/features/tags/tags.hooks';

vi.mock('../../../../../src/features/tags/tags.hooks', () => ({
  useTagsQuery: vi.fn(),
}));

describe('SidebarTagList', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading skeleton', () => {
    vi.mocked(useTagsQuery).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTagsQuery>);

    render(<SidebarTagList selectedTagIds={[]} disabled={false} onToggleTag={vi.fn()} />);

    expect(screen.getByLabelText('Loading tags')).toBeInTheDocument();
  });

  it('shows a retry affordance on error', () => {
    const refetch = vi.fn();
    vi.mocked(useTagsQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
      refetch,
    } as unknown as ReturnType<typeof useTagsQuery>);

    render(<SidebarTagList selectedTagIds={[]} disabled={false} onToggleTag={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('shows the empty state when there are no tags', () => {
    vi.mocked(useTagsQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { tags: [] },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTagsQuery>);

    render(<SidebarTagList selectedTagIds={[]} disabled={false} onToggleTag={vi.fn()} />);

    expect(screen.getByText('No tags yet')).toBeInTheDocument();
  });

  it('renders a chip per tag, marking selected ones and disabling all when trash is active', () => {
    const onToggleTag = vi.fn();
    vi.mocked(useTagsQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        tags: [
          { id: 't1', name: 'Work', color: '#111111', noteCount: 2 },
          { id: 't2', name: 'Personal', color: '#222222', noteCount: 0 },
        ],
      },
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTagsQuery>);

    render(<SidebarTagList selectedTagIds={['t1']} disabled onToggleTag={onToggleTag} />);

    const workButton = screen.getByRole('button', { name: /Work/ });
    expect(workButton).toHaveAttribute('aria-pressed', 'true');
    expect(workButton).toBeDisabled();
    expect(screen.getByRole('button', { name: /Personal/ })).toHaveAttribute('aria-pressed', 'false');
  });
});
