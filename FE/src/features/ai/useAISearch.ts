import { useState, useEffect } from 'react';
import { searchApi } from '@/api/search';
import type { SearchResult } from '@/types';

export function useAISearch() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      searchApi.search(query)
        .then((data) => setResults(data))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { query, setQuery, results, isLoading };
}
