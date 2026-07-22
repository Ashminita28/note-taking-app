import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPage } from '../../src/pages/DashboardPage';

describe('DashboardPage', () => {
  it('renders the notes heading', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument();
  });
});
