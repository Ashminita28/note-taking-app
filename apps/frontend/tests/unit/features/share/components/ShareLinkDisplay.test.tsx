import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ShareLinkDisplay } from '../../../../../src/features/share/components/ShareLinkDisplay';
import { toast } from '../../../../../src/components/ui/use-toast';

vi.mock('../../../../../src/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

const shareLink = {
  url: 'https://app.test/shared/tok1',
  viewCount: 5,
  expiresAt: '2026-08-01T00:00:00.000Z',
};

describe('ShareLinkDisplay', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders the share URL and view count', () => {
    render(<ShareLinkDisplay shareLink={shareLink} onRevoke={vi.fn()} revokePending={false} />);

    expect(screen.getByLabelText('Share link')).toHaveValue(shareLink.url);
    expect(screen.getByText('5 views')).toBeInTheDocument();
  });

  it('copies the link and shows "Copied! ✓" for 2 seconds, then reverts (Scenario 10)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ShareLinkDisplay shareLink={shareLink} onRevoke={vi.fn()} revokePending={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(shareLink.url);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied! ✓' })).toBeInTheDocument());

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
  });

  it('shows a destructive toast when clipboard write fails (Scenario 11)', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<ShareLinkDisplay shareLink={shareLink} onRevoke={vi.fn()} revokePending={false} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    });

    expect(toast).toHaveBeenCalledWith({
      description: 'Failed to copy link. Please copy manually.',
      variant: 'destructive',
    });
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument();
  });

  it('shows an inline confirmation before revoking, sends no request until confirmed (Scenario 12)', () => {
    const onRevoke = vi.fn();
    render(<ShareLinkDisplay shareLink={shareLink} onRevoke={onRevoke} revokePending={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Link' }));

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(onRevoke).not.toHaveBeenCalled();
  });

  it('confirming revoke calls onRevoke (Scenario 13)', () => {
    const onRevoke = vi.fn();
    render(<ShareLinkDisplay shareLink={shareLink} onRevoke={onRevoke} revokePending={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, revoke' }));

    expect(onRevoke).toHaveBeenCalled();
  });

  it('canceling the confirmation sends no request and keeps the link shown (Scenario 14)', () => {
    const onRevoke = vi.fn();
    render(<ShareLinkDisplay shareLink={shareLink} onRevoke={onRevoke} revokePending={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Revoke Link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onRevoke).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Share link')).toHaveValue(shareLink.url);
    expect(screen.getByRole('button', { name: 'Revoke Link' })).toBeInTheDocument();
  });
});
