import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareModal } from '../../../../../src/features/share/components/ShareModal';
import { useSharesQuery, useCreateShareMutation, useRevokeShareMutation } from '../../../../../src/features/share/share.hooks';

vi.mock('../../../../../src/features/share/share.hooks', () => ({
  useSharesQuery: vi.fn(),
  useCreateShareMutation: vi.fn(),
  useRevokeShareMutation: vi.fn(),
}));

const noopMutation = { mutate: vi.fn(), isPending: false, isError: false, data: undefined };

function mockHooks({
  sharesQuery,
  createMutation = noopMutation,
  revokeMutation = noopMutation,
}: {
  sharesQuery: Partial<ReturnType<typeof useSharesQuery>>;
  createMutation?: Partial<ReturnType<typeof useCreateShareMutation>>;
  revokeMutation?: Partial<ReturnType<typeof useRevokeShareMutation>>;
}) {
  vi.mocked(useSharesQuery).mockReturnValue(sharesQuery as ReturnType<typeof useSharesQuery>);
  vi.mocked(useCreateShareMutation).mockReturnValue(createMutation as ReturnType<typeof useCreateShareMutation>);
  vi.mocked(useRevokeShareMutation).mockReturnValue(revokeMutation as ReturnType<typeof useRevokeShareMutation>);
}

describe('ShareModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading indicator while checking for an existing link (Scenario 4)', () => {
    mockHooks({ sharesQuery: { isLoading: true, isError: false, data: undefined } });

    render(<ShareModal noteId="n1" open onOpenChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Generate Link' })).not.toBeInTheDocument();
  });

  it('shows an inline error when the existing-link check fails (Scenario 5)', () => {
    mockHooks({ sharesQuery: { isLoading: false, isError: true, data: undefined } });

    render(<ShareModal noteId="n1" open onOpenChange={vi.fn()} />);

    expect(screen.getByText('Failed to generate share link.')).toBeInTheDocument();
  });

  it('shows the generate form and empty state when no active link exists (Scenario 2)', () => {
    mockHooks({ sharesQuery: { isLoading: false, isError: false, data: { shares: [] } } });

    render(<ShareModal noteId="n1" open onOpenChange={vi.fn()} />);

    expect(screen.getByText('No active share link for this note.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Link expiry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Link' })).toBeInTheDocument();
  });

  it('shows the link display directly when an active link already exists (Scenario 3)', () => {
    mockHooks({
      sharesQuery: {
        isLoading: false,
        isError: false,
        data: {
          shares: [
            { noteId: 'n1', noteTitle: 'A', url: 'https://x/shared/tok1', expiresAt: '2026-08-01T00:00:00.000Z', viewCount: 3, createdAt: '2026-07-01T00:00:00.000Z' },
          ],
        },
      },
    });

    render(<ShareModal noteId="n1" open onOpenChange={vi.fn()} />);

    expect(screen.queryByRole('combobox', { name: 'Link expiry' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Share link')).toHaveValue('https://x/shared/tok1');
  });

  it('generates a link with the selected expiry (Scenario 7)', () => {
    const mutate = vi.fn();
    mockHooks({
      sharesQuery: { isLoading: false, isError: false, data: { shares: [] } },
      createMutation: { mutate, isPending: false, isError: false, data: undefined },
    });

    render(<ShareModal noteId="n1" open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Link expiry' }), { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Link' }));

    expect(mutate).toHaveBeenCalledWith({ expiresInHours: 24 });
  });

  it('shows the generated link immediately from the mutation result (Scenario 6)', () => {
    mockHooks({
      sharesQuery: { isLoading: false, isError: false, data: { shares: [] } },
      createMutation: {
        mutate: vi.fn(),
        isPending: false,
        isError: false,
        data: {
          shareLink: {
            token: 'tok1',
            url: 'https://x/shared/tok1',
            expiresAt: '2026-08-01T00:00:00.000Z',
            viewCount: 0,
            createdAt: '2026-07-24T00:00:00.000Z',
          },
        },
      },
    });

    render(<ShareModal noteId="n1" open onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText('Share link')).toHaveValue('https://x/shared/tok1');
  });

  it('resets the create-mutation cache on revoke so the stale link is not shown again (regression)', () => {
    const revokeMutate = vi.fn((_arg: unknown, options: { onSuccess: () => void }) => options.onSuccess());
    const createReset = vi.fn();
    mockHooks({
      sharesQuery: { isLoading: false, isError: false, data: { shares: [] } },
      createMutation: {
        mutate: vi.fn(),
        isPending: false,
        isError: false,
        data: {
          shareLink: {
            token: 'tok1',
            url: 'https://x/shared/tok1',
            expiresAt: '2026-08-01T00:00:00.000Z',
            viewCount: 0,
            createdAt: '2026-07-24T00:00:00.000Z',
          },
        },
        reset: createReset,
      },
      revokeMutation: { mutate: revokeMutate, isPending: false },
    });

    render(<ShareModal noteId="n1" open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, revoke' }));

    expect(revokeMutate).toHaveBeenCalled();
    expect(createReset).toHaveBeenCalled();
  });

  it('shows an inline error when generation fails (Scenario 9)', () => {
    mockHooks({
      sharesQuery: { isLoading: false, isError: false, data: { shares: [] } },
      createMutation: { mutate: vi.fn(), isPending: false, isError: true, data: undefined },
    });

    render(<ShareModal noteId="n1" open onOpenChange={vi.fn()} />);

    expect(screen.getByText('Failed to generate share link.')).toBeInTheDocument();
  });

  it('Escape closes the modal and returns focus to the trigger (Scenario 17)', async () => {
    mockHooks({ sharesQuery: { isLoading: false, isError: false, data: { shares: [] } } });
    const onOpenChange = vi.fn();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    render(<ShareModal noteId="n1" open onOpenChange={onOpenChange} returnFocusRef={{ current: trigger }} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    document.body.removeChild(trigger);
  });
});
