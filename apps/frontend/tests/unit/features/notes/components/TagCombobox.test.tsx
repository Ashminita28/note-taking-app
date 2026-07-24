import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagCombobox } from '../../../../../src/features/notes/components/TagCombobox';
import { useTagsQuery, useCreateTagMutation } from '../../../../../src/features/tags/tags.hooks';

vi.mock('../../../../../src/features/tags/tags.hooks', () => ({
  useTagsQuery: vi.fn(),
  useCreateTagMutation: vi.fn(),
}));

function openCombobox() {
  fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
}

describe('TagCombobox', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists existing tags excluding ones already on the note', () => {
    vi.mocked(useTagsQuery).mockReturnValue({
      data: {
        tags: [
          { id: 't1', name: 'Work', color: '#111111', noteCount: 1 },
          { id: 't2', name: 'Personal', color: '#222222', noteCount: 0 },
        ],
      },
    } as unknown as ReturnType<typeof useTagsQuery>);
    vi.mocked(useCreateTagMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateTagMutation>);

    render(<TagCombobox excludeTagIds={['t1']} onSelect={vi.fn()} />);
    openCombobox();

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
  });

  it('selecting an existing tag calls onSelect', () => {
    vi.mocked(useTagsQuery).mockReturnValue({
      data: { tags: [{ id: 't2', name: 'Personal', color: '#222222', noteCount: 0 }] },
    } as unknown as ReturnType<typeof useTagsQuery>);
    vi.mocked(useCreateTagMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateTagMutation>);
    const onSelect = vi.fn();

    render(<TagCombobox excludeTagIds={[]} onSelect={onSelect} />);
    openCombobox();
    fireEvent.click(screen.getByText('Personal'));

    expect(onSelect).toHaveBeenCalledWith({ id: 't2', name: 'Personal', color: '#222222' });
  });

  it('offers inline creation for a name with no exact match, and calls onSelect on success', () => {
    vi.mocked(useTagsQuery).mockReturnValue({
      data: { tags: [] },
    } as unknown as ReturnType<typeof useTagsQuery>);
    const mutate = vi.fn((_input: unknown, options: { onSuccess: (tag: unknown) => void }) => {
      options.onSuccess({ id: 't3', name: 'Urgent', color: '#6B7280' });
    });
    vi.mocked(useCreateTagMutation).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateTagMutation>);
    const onSelect = vi.fn();

    render(<TagCombobox excludeTagIds={[]} onSelect={onSelect} />);
    openCombobox();
    fireEvent.change(screen.getByLabelText('Search or create tag'), { target: { value: 'Urgent' } });
    fireEvent.click(screen.getByText('Create "Urgent"'));

    expect(mutate).toHaveBeenCalledWith({ name: 'Urgent', color: '#6B7280' }, expect.any(Object));
    expect(onSelect).toHaveBeenCalledWith({ id: 't3', name: 'Urgent', color: '#6B7280' });
  });

  it('does not offer "Create" when the typed name exactly matches an existing tag', () => {
    vi.mocked(useTagsQuery).mockReturnValue({
      data: { tags: [{ id: 't1', name: 'Work', color: '#111111', noteCount: 1 }] },
    } as unknown as ReturnType<typeof useTagsQuery>);
    vi.mocked(useCreateTagMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateTagMutation>);

    render(<TagCombobox excludeTagIds={[]} onSelect={vi.fn()} />);
    openCombobox();
    fireEvent.change(screen.getByLabelText('Search or create tag'), { target: { value: 'Work' } });

    expect(screen.queryByText('Create "Work"')).not.toBeInTheDocument();
  });
});
