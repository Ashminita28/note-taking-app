import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toaster } from '../../../../src/components/ui/toaster';
import { toast } from '../../../../src/components/ui/use-toast';

describe('Toaster', () => {
  it('renders a toast title and description pushed via toast()', () => {
    render(<Toaster />);

    act(() => {
      toast({ title: 'Saved', description: 'Your changes were saved.' });
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your changes were saved.')).toBeInTheDocument();
  });
});
