import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordChecklist } from '../../../../../src/features/auth/components/PasswordChecklist';

describe('PasswordChecklist', () => {
  it('shows every rule as failing for an empty password', () => {
    render(<PasswordChecklist password="" />);
    expect(screen.getByText('At least 8 characters')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('At least one uppercase letter')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('At least one lowercase letter')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('At least one number')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('At least one special character (!@#$%^&*)')).toHaveClass('text-muted-foreground');
  });

  it('marks each rule as passing independently', () => {
    render(<PasswordChecklist password="Abcdefg1!" />);
    expect(screen.getByText('At least 8 characters')).toHaveClass('text-green-600');
    expect(screen.getByText('At least one uppercase letter')).toHaveClass('text-green-600');
    expect(screen.getByText('At least one lowercase letter')).toHaveClass('text-green-600');
    expect(screen.getByText('At least one number')).toHaveClass('text-green-600');
    expect(screen.getByText('At least one special character (!@#$%^&*)')).toHaveClass('text-green-600');
  });

  it('marks only the satisfied rules when partially valid', () => {
    render(<PasswordChecklist password="abcdefgh" />);
    expect(screen.getByText('At least 8 characters')).toHaveClass('text-green-600');
    expect(screen.getByText('At least one lowercase letter')).toHaveClass('text-green-600');
    expect(screen.getByText('At least one uppercase letter')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('At least one number')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('At least one special character (!@#$%^&*)')).toHaveClass('text-muted-foreground');
  });
});
