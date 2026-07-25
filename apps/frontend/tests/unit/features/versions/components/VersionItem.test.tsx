import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionItem } from '../../../../../src/features/versions/components/VersionItem';

const sampleVersion = {
  versionNumber: 3,
  title: 'My note',
  contentPreview: 'Hello world, this is the preview',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('VersionItem', () => {
  it('renders the version number and preview', () => {
    render(<VersionItem version={sampleVersion} onSelect={vi.fn()} />);

    expect(screen.getByText('Version 3')).toBeInTheDocument();
    expect(screen.getByText('Hello world, this is the preview')).toBeInTheDocument();
  });

  it('calls onSelect with the version number on click', () => {
    const onSelect = vi.fn();
    render(<VersionItem version={sampleVersion} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
