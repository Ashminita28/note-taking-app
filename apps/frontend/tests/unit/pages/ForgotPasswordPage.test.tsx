import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ForgotPasswordPage } from '../../../src/pages/ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  it('renders without throwing and shows the Forgot Password heading', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Forgot Password' })).toBeInTheDocument();
  });
});
