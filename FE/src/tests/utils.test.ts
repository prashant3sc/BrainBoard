import { describe, it, expect } from 'vitest';
import { formatDate, getInitials, truncate, groupBy } from '@/lib/utils';

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    // en-IN locale: "7 Apr 2026"
    const result = formatDate('2026-04-07T00:00:00.000Z');
    expect(result).toMatch(/7/);
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/2026/);
  });

  it('handles a date-only string', () => {
    const result = formatDate('2026-01-01');
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/Jan/);
  });
});

describe('getInitials', () => {
  it('returns first and last initials for two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns two identical letters for a single word name', () => {
    expect(getInitials('Alice')).toBe('AA');
  });

  it('uses first and last word for multi-word names', () => {
    expect(getInitials('Mary Jane Watson')).toBe('MW');
  });

  it('uppercases the result', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('trims leading/trailing whitespace', () => {
    expect(getInitials('  Jane Doe  ')).toBe('JD');
  });
});

describe('truncate', () => {
  it('returns the string as-is when within limit', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('returns string unchanged when exactly at limit', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
  });

  it('truncates and appends ellipsis when over limit', () => {
    const result = truncate('Hello World', 5);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(6); // 5 chars + ellipsis
  });

  it('trims trailing spaces before appending ellipsis', () => {
    const result = truncate('Hello  World', 6);
    expect(result).not.toMatch(/ …$/);
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});

describe('groupBy', () => {
  const items = [
    { id: 1, status: 'todo' },
    { id: 2, status: 'done' },
    { id: 3, status: 'todo' },
    { id: 4, status: 'done' },
    { id: 5, status: 'in_progress' },
  ];

  it('groups items by the given key', () => {
    const result = groupBy(items, 'status');
    expect(result['todo']).toHaveLength(2);
    expect(result['done']).toHaveLength(2);
    expect(result['in_progress']).toHaveLength(1);
  });

  it('returns an empty object for an empty array', () => {
    expect(groupBy([], 'status')).toEqual({});
  });

  it('groups correctly when all items share the same key value', () => {
    const all = [{ id: 1, status: 'todo' }, { id: 2, status: 'todo' }];
    const result = groupBy(all, 'status');
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['todo']).toHaveLength(2);
  });
});
