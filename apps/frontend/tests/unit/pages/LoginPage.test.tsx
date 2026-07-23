import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../../../src/pages/LoginPage';

describe('LoginPage', () => {
  it('renders without throwing and shows the Login heading', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
  });
});
