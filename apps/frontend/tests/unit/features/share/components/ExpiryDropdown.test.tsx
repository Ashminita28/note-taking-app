import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpiryDropdown } from '../../../../../src/features/share/components/ExpiryDropdown';

describe('ExpiryDropdown', () => {
  it('renders all four expiry presets', () => {
    render(<ExpiryDropdown value={168} onChange={vi.fn()} />);

    expect(screen.getByRole('option', { name: '1 hour' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '24 hours' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '7 days' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '30 days' })).toBeInTheDocument();
  });

  it('reflects the selected value', () => {
    render(<ExpiryDropdown value={24} onChange={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Link expiry' })).toHaveValue('24');
  });

  it('calls onChange with the numeric hours value', () => {
    const onChange = vi.fn();
    render(<ExpiryDropdown value={168} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Link expiry' }), { target: { value: '720' } });

    expect(onChange).toHaveBeenCalledWith(720);
  });
});
