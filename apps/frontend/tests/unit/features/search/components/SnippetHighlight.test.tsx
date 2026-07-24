import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SnippetHighlight } from '../../../../../src/features/search/components/SnippetHighlight';

describe('SnippetHighlight', () => {
  it('renders highlighted terms inside a <mark> element', () => {
    render(<SnippetHighlight snippet="the <mark>budget</mark> review" />);

    const mark = screen.getByText('budget');
    expect(mark.tagName).toBe('MARK');
  });

  it('renders literal < and > characters as visible text, not markup', () => {
    render(<SnippetHighlight snippet="cost < revenue and <mark>margin</mark> > 0" />);

    expect(screen.getByText(/cost < revenue and/)).toBeInTheDocument();
    expect(screen.getByText(/> 0/)).toBeInTheDocument();
    expect(document.querySelectorAll('mark')).toHaveLength(1);
  });

  it('renders plain text with no <mark> elements when there is no match', () => {
    const { container } = render(<SnippetHighlight snippet="no matches here" />);

    expect(screen.getByText('no matches here')).toBeInTheDocument();
    expect(container.querySelector('mark')).toBeNull();
  });
});
