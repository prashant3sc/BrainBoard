import { Command } from 'cmdk';
import type { SearchResult } from '@/types';

interface Props {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onSelect: (result: SearchResult) => void;
}

const TYPE_BADGE: Record<SearchResult['type'], string> = {
  issue: 'bg-orange-100 text-orange-700',
  wiki:  'bg-blue-100 text-blue-700',
};

export function SearchResults({ results, isLoading, query, onSelect }: Props) {
  if (isLoading) {
    return <p className="py-6 text-center text-sm text-gray-400">Searching…</p>;
  }

  if (query.length >= 2 && results.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">No results for "{query}"</p>;
  }

  const issues = results.filter((r) => r.type === 'issue');
  const wikis  = results.filter((r) => r.type === 'wiki');

  function renderItem(result: SearchResult) {
    return (
      <Command.Item
        key={result.id}
        value={`${result.type}-${result.id}`}
        onSelect={() => onSelect(result)}
        className="flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-sm aria-selected:bg-[#FFF3F0] dark:aria-selected:bg-[#E75026]/10"
      >
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE[result.type]}`}>
            {result.type}
          </span>
          <span className="font-medium text-gray-800 truncate dark:text-[#CDD9E5]">{result.title}</span>
        </div>
        {result.excerpt && (
          <span className="truncate text-xs text-gray-400 pl-10">{result.excerpt}</span>
        )}
      </Command.Item>
    );
  }

  return (
    <>
      {issues.length > 0 && (
        <Command.Group heading="Issues" className="px-2 py-1">
          {issues.map(renderItem)}
        </Command.Group>
      )}
      {wikis.length > 0 && (
        <Command.Group heading="Wiki" className="px-2 py-1">
          {wikis.map(renderItem)}
        </Command.Group>
      )}
    </>
  );
}
