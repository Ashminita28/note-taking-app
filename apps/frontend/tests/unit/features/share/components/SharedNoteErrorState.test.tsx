import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SharedNoteErrorState } from '../../../../../src/features/share/components/SharedNoteErrorState';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('SharedNoteErrorState', () => {
  it('renders the not-found copy with a register CTA', () => {
    renderWithRouter(<SharedNoteErrorState variant="not-found" />);

    expect(screen.getByText('Note not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create your account' })).toBeInTheDocument();
  });

  it('renders the expired copy with a register CTA', () => {
    renderWithRouter(<SharedNoteErrorState variant="expired" />);

    expect(screen.getByText('This link has expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create your account' })).toBeInTheDocument();
  });

  it('renders the generic error copy without a register CTA', () => {
    renderWithRouter(<SharedNoteErrorState variant="error" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create your account' })).not.toBeInTheDocument();
  });
});
