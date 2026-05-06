import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriorityBadge } from '@/components/common/PriorityBadge';
import { PRIORITY_COLORS } from '@/lib/constants';
import type { Priority } from '@/types';

const priorities: Priority[] = ['critical', 'high', 'medium', 'low'];

describe('PriorityBadge', () => {
  it.each(priorities)('renders the "%s" label', (priority) => {
    render(<PriorityBadge priority={priority} />);
    expect(screen.getByText(priority)).toBeInTheDocument();
  });

  it.each(priorities)('applies the correct color classes for "%s"', (priority) => {
    const { container } = render(<PriorityBadge priority={priority} />);
    const badge = container.firstChild as HTMLElement;
    const classes = PRIORITY_COLORS[priority].split(' ');
    classes.forEach((cls) => expect(badge).toHaveClass(cls));
  });

  it('renders a <span> element', () => {
    const { container } = render(<PriorityBadge priority="high" />);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('has capitalize class so text is auto-capitalized by CSS', () => {
    const { container } = render(<PriorityBadge priority="critical" />);
    expect(container.firstChild).toHaveClass('capitalize');
  });
});
