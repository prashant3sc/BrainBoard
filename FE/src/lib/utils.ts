/** Returns a human-readable date string, e.g. "Apr 7, 2026" */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Returns the first letter of the first and last word of a name, uppercased */
export function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

/** Truncates text to maxLength characters, appending "…" if trimmed */
export function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : text.slice(0, maxLength).trimEnd() + '…';
}

/** Groups an array of objects by the value of a given key */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce<Record<string, T[]>>((acc, item) => {
    const group = String(item[key]);
    (acc[group] ??= []).push(item);
    return acc;
  }, {});
}
