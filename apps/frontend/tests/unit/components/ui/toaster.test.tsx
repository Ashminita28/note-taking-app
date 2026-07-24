import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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

  it('renders an action button and dismisses the toast when clicked (Undo, UX-NOTE-04)', () => {
    render(<Toaster />);
    const onClick = vi.fn();

    act(() => {
      toast({ description: 'Note moved to trash.', action: { label: 'Undo', onClick } });
    });

    expect(screen.getByText('Note moved to trash.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByText('Note moved to trash.')).not.toBeInTheDocument();
  });
});
