import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionList } from '../../../../../src/features/versions/components/VersionList';

const versions = [
  { versionNumber: 3, title: 'v3', contentPreview: 'third', createdAt: '2026-01-03T00:00:00.000Z' },
  { versionNumber: 2, title: 'v2', contentPreview: 'second', createdAt: '2026-01-02T00:00:00.000Z' },
  { versionNumber: 1, title: 'v1', contentPreview: 'first', createdAt: '2026-01-01T00:00:00.000Z' },
];

describe('VersionList', () => {
  it('renders rows in the order given (newest-first, per FR-VER-002)', () => {
    render(<VersionList versions={versions} isLoading={false} onSelect={vi.fn()} />);

    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Version 3');
    expect(rows[1]).toHaveTextContent('Version 2');
    expect(rows[2]).toHaveTextContent('Version 1');
  });

  it('shows the skeleton while loading instead of the list', () => {
    render(<VersionList versions={undefined} isLoading onSelect={vi.fn()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
