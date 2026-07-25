import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VersionHistoryDrawer } from '../../../../../src/features/versions/components/VersionHistoryDrawer';
import {
  useVersionsQuery,
  useVersionQuery,
  useRestoreVersionMutation,
} from '../../../../../src/features/versions/versions.hooks';
import { toast } from '../../../../../src/components/ui/use-toast';

vi.mock('../../../../../src/features/versions/versions.hooks', () => ({
  useVersionsQuery: vi.fn(),
  useVersionQuery: vi.fn(),
  useRestoreVersionMutation: vi.fn(),
}));

vi.mock('../../../../../src/features/versions/components/VersionContent', () => ({
  VersionContent: ({ content }: { content: string }) => <div data-testid="version-content">{content}</div>,
}));

vi.mock('../../../../../src/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

const noopVersionsQuery = { isLoading: false, isError: false, data: undefined };
const noopVersionQuery = { isLoading: false, isError: false, data: undefined };
const noopRestoreMutation = { mutate: vi.fn(), isPending: false };

function mockHooks({
  versionsQuery = noopVersionsQuery,
  versionQuery = noopVersionQuery,
  restoreMutation = noopRestoreMutation,
}: {
  versionsQuery?: Partial<ReturnType<typeof useVersionsQuery>>;
  versionQuery?: Partial<ReturnType<typeof useVersionQuery>>;
  restoreMutation?: Partial<ReturnType<typeof useRestoreVersionMutation>>;
}) {
  vi.mocked(useVersionsQuery).mockReturnValue(versionsQuery as ReturnType<typeof useVersionsQuery>);
  vi.mocked(useVersionQuery).mockReturnValue(versionQuery as ReturnType<typeof useVersionQuery>);
  vi.mocked(useRestoreVersionMutation).mockReturnValue(restoreMutation as ReturnType<typeof useRestoreVersionMutation>);
}

const versions = [
  { versionNumber: 2, title: 'v2', contentPreview: 'second', createdAt: '2026-01-02T00:00:00.000Z' },
  { versionNumber: 1, title: 'v1', contentPreview: 'first', createdAt: '2026-01-01T00:00:00.000Z' },
];

describe('VersionHistoryDrawer', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the version list newest-first (Scenario 3)', () => {
    mockHooks({ versionsQuery: { isLoading: false, isError: false, data: { versions } } });

    render(<VersionHistoryDrawer noteId="n1" open onOpenChange={vi.fn()} onRestored={vi.fn()} />);

    const rows = screen.getAllByRole('button', { name: /Version \d/ });
    expect(rows[0]).toHaveTextContent('Version 2');
    expect(rows[1]).toHaveTextContent('Version 1');
  });

  it('shows a toast when the version list fails to load (Scenario 5)', () => {
    mockHooks({ versionsQuery: { isLoading: false, isError: true, data: undefined } });

    render(<VersionHistoryDrawer noteId="n1" open onOpenChange={vi.fn()} onRestored={vi.fn()} />);

    expect(toast).toHaveBeenCalledWith({ description: 'Unable to load version history.', variant: 'destructive' });
  });

  it('clicking a version shows the preview banner and content, without touching the note (Scenario 6/7)', () => {
    mockHooks({
      versionsQuery: { isLoading: false, isError: false, data: { versions } },
      versionQuery: {
        isLoading: false,
        isError: false,
        data: { version: { versionNumber: 1, title: 'v1', content: '<p>first full</p>', createdAt: '2026-01-01T00:00:00.000Z' } },
      },
    });

    render(<VersionHistoryDrawer noteId="n1" open onOpenChange={vi.fn()} onRestored={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Version 1/ }));

    expect(screen.getByText(/Viewing version 1 from/)).toBeInTheDocument();
    expect(screen.getByTestId('version-content')).toHaveTextContent('first full');
  });

  it('shows a toast and returns to the list when the version preview fails to load (Scenario 9)', () => {
    mockHooks({
      versionsQuery: { isLoading: false, isError: false, data: { versions } },
      versionQuery: { isLoading: false, isError: true, data: undefined },
    });

    render(<VersionHistoryDrawer noteId="n1" open onOpenChange={vi.fn()} onRestored={vi.fn()} />);

    expect(toast).toHaveBeenCalledWith({ description: 'Unable to load that version.', variant: 'destructive' });
  });

  it('"Back to current" returns to the list view (Scenario 10)', () => {
    mockHooks({
      versionsQuery: { isLoading: false, isError: false, data: { versions } },
      versionQuery: {
        isLoading: false,
        isError: false,
        data: { version: { versionNumber: 1, title: 'v1', content: '<p>first full</p>', createdAt: '2026-01-01T00:00:00.000Z' } },
      },
    });

    render(<VersionHistoryDrawer noteId="n1" open onOpenChange={vi.fn()} onRestored={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Version 1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to current' }));

    expect(screen.queryByText(/Viewing version/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Version \d/ })).toHaveLength(2);
  });

  it('restoring calls onRestored, shows a toast, and closes the drawer (Scenario 11)', () => {
    const restoredNote = { id: 'n1', title: 'v1', content: '<p>first full</p>', tags: [], createdAt: 'x', updatedAt: 'y' };
    const mutate = vi.fn((_versionNumber: number, options: { onSuccess: (result: { note: typeof restoredNote }) => void }) =>
      options.onSuccess({ note: restoredNote }),
    );
    const onRestored = vi.fn();
    const onOpenChange = vi.fn();
    mockHooks({
      versionsQuery: { isLoading: false, isError: false, data: { versions } },
      versionQuery: {
        isLoading: false,
        isError: false,
        data: { version: { versionNumber: 1, title: 'v1', content: '<p>first full</p>', createdAt: '2026-01-01T00:00:00.000Z' } },
      },
      restoreMutation: { mutate, isPending: false },
    });

    render(<VersionHistoryDrawer noteId="n1" open onOpenChange={onOpenChange} onRestored={onRestored} />);
    fireEvent.click(screen.getByRole('button', { name: /Version 1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }));

    expect(mutate).toHaveBeenCalledWith(1, expect.any(Object));
    expect(onRestored).toHaveBeenCalledWith(restoredNote);
    expect(toast).toHaveBeenCalledWith({ description: 'Version 1 restored.' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not call onRestored or close the drawer when restore fails', () => {
    const mutate = vi.fn();
    const onRestored = vi.fn();
    const onOpenChange = vi.fn();
    mockHooks({
      versionsQuery: { isLoading: false, isError: false, data: { versions } },
      versionQuery: {
        isLoading: false,
        isError: false,
        data: { version: { versionNumber: 1, title: 'v1', content: '<p>first full</p>', createdAt: '2026-01-01T00:00:00.000Z' } },
      },
      restoreMutation: { mutate, isPending: false },
    });

    render(<VersionHistoryDrawer noteId="n1" open onOpenChange={onOpenChange} onRestored={onRestored} />);
    fireEvent.click(screen.getByRole('button', { name: /Version 1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }));

    expect(onRestored).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Viewing version 1 from/)).toBeInTheDocument();
  });

  it('exposes an <aside aria-label="Version history"> landmark (UX §8.12)', () => {
    mockHooks({ versionsQuery: { isLoading: false, isError: false, data: { versions } } });

    render(<VersionHistoryDrawer noteId="n1" open onOpenChange={vi.fn()} onRestored={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Version history' }).tagName).toBe('ASIDE');
  });

  it('Escape closes the drawer and returns focus to the trigger (Scenario 15)', async () => {
    mockHooks({ versionsQuery: { isLoading: false, isError: false, data: { versions } } });
    const onOpenChange = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    render(
      <VersionHistoryDrawer
        noteId="n1"
        open
        onOpenChange={onOpenChange}
        onRestored={vi.fn()}
        returnFocusRef={{ current: trigger }}
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    document.body.removeChild(trigger);
  });
});
