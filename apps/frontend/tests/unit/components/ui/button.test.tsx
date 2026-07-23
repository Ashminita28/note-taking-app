import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../../../../src/components/ui/button';

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>Create account</Button>);
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('disables and marks aria-busy when isLoading', () => {
    render(<Button isLoading>Create account</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('is not disabled when not loading', () => {
    render(<Button>Create account</Button>);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('stays disabled when explicitly disabled even without loading', () => {
    render(<Button disabled>Create account</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
