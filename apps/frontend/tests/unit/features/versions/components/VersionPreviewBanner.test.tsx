import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VersionPreviewBanner } from '../../../../../src/features/versions/components/VersionPreviewBanner';

describe('VersionPreviewBanner', () => {
  it('renders "Viewing version {N} from {date}" (UX §8.12 Success States)', () => {
    render(<VersionPreviewBanner versionNumber={2} createdAt="2026-01-01T00:00:00.000Z" />);

    expect(screen.getByText(/Viewing version 2 from/)).toBeInTheDocument();
  });
});
