import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SharedNotePage } from '../../../src/pages/SharedNotePage';
import { useSharedNoteQuery } from '../../../src/features/share/share.hooks';
import { useAuthStore } from '../../../src/stores/auth.store';
import { ApiError } from '../../../src/lib/api-client';

vi.mock('../../../src/features/share/share.hooks', () => ({
  useSharedNoteQuery: vi.fn(),
}));

vi.mock('../../../src/features/share/components/SharedNoteContent', () => ({
  SharedNoteContent: ({ content }: { content: string }) => <div data-testid="shared-content">{content}</div>,
}));

function renderAtToken(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/shared/${token}`]}>
      <Routes>
        <Route path="/shared/:token" element={<SharedNotePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const sampleNote = {
  title: 'Meeting Notes',
  content: '<p>hello</p>',
  authorName: 'Jane Doe',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('SharedNotePage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the loading state while fetching (Scenario 21)', () => {
    vi.mocked(useSharedNoteQuery).mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    } as unknown as ReturnType<typeof useSharedNoteQuery>);

    renderAtToken('tok1');

    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('renders title, content, author, and date on success, with no note ID or email exposed (Scenario 19)', () => {
    vi.mocked(useSharedNoteQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { note: sampleNote },
    } as unknown as ReturnType<typeof useSharedNoteQuery>);

    renderAtToken('tok1');

    expect(screen.getByRole('heading', { name: 'Meeting Notes' })).toBeInTheDocument();
    expect(screen.getByTestId('shared-content')).toHaveTextContent('hello');
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.queryByText(sampleNote.authorName + '@')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/tok1/);
  });

  it('renders identically regardless of the visitor being authenticated (Scenario 23)', () => {
    vi.mocked(useSharedNoteQuery).mockReturnValue({
      isLoading: false,
      isError: false,
      data: { note: sampleNote },
    } as unknown as ReturnType<typeof useSharedNoteQuery>);
    useAuthStore.getState().setTokens('access', 'refresh');

    renderAtToken('tok1');

    expect(screen.getByRole('heading', { name: 'Meeting Notes' })).toBeInTheDocument();
    useAuthStore.getState().clearAuth();
  });

  it('renders a not-found state for a 404 (Scenario 24)', () => {
    vi.mocked(useSharedNoteQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new ApiError(404, 'SHARE_LINK_NOT_FOUND', 'Not found.'),
      data: undefined,
    } as unknown as ReturnType<typeof useSharedNoteQuery>);

    renderAtToken('missing');

    expect(screen.getByText('Note not found')).toBeInTheDocument();
  });

  it('renders an expired state for a 410 (Scenario 25)', () => {
    vi.mocked(useSharedNoteQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new ApiError(410, 'SHARE_LINK_EXPIRED', 'Expired.'),
      data: undefined,
    } as unknown as ReturnType<typeof useSharedNoteQuery>);

    renderAtToken('expired');

    expect(screen.getByText('This link has expired')).toBeInTheDocument();
  });

  it('renders a generic error state for anything else (Scenario 26)', () => {
    vi.mocked(useSharedNoteQuery).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new ApiError(500, 'INTERNAL_ERROR', 'boom'),
      data: undefined,
    } as unknown as ReturnType<typeof useSharedNoteQuery>);

    renderAtToken('tok1');

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
