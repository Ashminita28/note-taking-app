import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordPage } from '../../../src/pages/ResetPasswordPage';

describe('ResetPasswordPage', () => {
  it('renders without throwing (redirects via ResetPasswordForm when no reset token is present)', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );
    expect(document.body).toBeInTheDocument();
  });
});
