import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../../../src/pages/RegisterPage';

describe('RegisterPage', () => {
  it('renders without throwing and shows the Register heading', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
  });
});
