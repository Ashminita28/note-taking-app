import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardHeader } from '../../../../src/components/layout/DashboardHeader';

describe('DashboardHeader', () => {
  it('renders the search bar alongside the existing header controls', () => {
    render(
      <MemoryRouter>
        <DashboardHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ New Note' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
  });
});
