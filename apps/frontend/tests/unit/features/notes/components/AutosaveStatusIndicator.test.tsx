import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutosaveStatusIndicator } from '../../../../../src/features/notes/components/AutosaveStatusIndicator';

describe('AutosaveStatusIndicator', () => {
  it('renders nothing visible when idle', () => {
    render(<AutosaveStatusIndicator status="idle" />);
    expect(screen.queryByText(/Saving|Saved|Save failed/)).not.toBeInTheDocument();
  });

  it('shows "Saving..." while saving', () => {
    render(<AutosaveStatusIndicator status="saving" />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('shows "Saved ✓" once saved', () => {
    render(<AutosaveStatusIndicator status="saved" />);
    expect(screen.getByText('Saved ✓')).toBeInTheDocument();
  });

  it('shows "Save failed" on error', () => {
    render(<AutosaveStatusIndicator status="error" />);
    expect(screen.getByText('Save failed')).toBeInTheDocument();
  });

  it('shows the specific message instead of the generic label when one is provided', () => {
    render(<AutosaveStatusIndicator status="error" message="This note is too large to save." />);
    expect(screen.getByText('This note is too large to save.')).toBeInTheDocument();
    expect(screen.queryByText('Save failed')).not.toBeInTheDocument();
  });

  it('ignores a message when not in the error state', () => {
    render(<AutosaveStatusIndicator status="saved" message="should not show" />);
    expect(screen.getByText('Saved ✓')).toBeInTheDocument();
    expect(screen.queryByText('should not show')).not.toBeInTheDocument();
  });
});
