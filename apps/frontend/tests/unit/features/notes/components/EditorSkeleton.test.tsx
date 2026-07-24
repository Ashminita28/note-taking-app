import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditorSkeleton } from '../../../../../src/features/notes/components/EditorSkeleton';

describe('EditorSkeleton', () => {
  it('renders the skeleton container', () => {
    render(<EditorSkeleton />);
    expect(screen.getByTestId('editor-skeleton')).toBeInTheDocument();
  });
});
