import { useState, useEffect } from 'react';
import { searchApi } from '@/api/search';
import useAppStore from '@/store/useAppStore';
import type { SearchResult } from '@/types';

export function useAISearch() {
  const semanticEnabled = useAppStore((s) => s.semanticEnabled);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Semantic search has higher latency — use a slightly longer debounce
    const debounce = semanticEnabled ? 500 : 300;
    const timer = setTimeout(() => {
      const searchFn = semanticEnabled ? searchApi.semanticSearch : searchApi.search;
      searchFn(query)
        .then((data) => setResults(data))
        .finally(() => setLoading(false));
    }, debounce);

    return () => clearTimeout(timer);
  }, [query, semanticEnabled]);

  return { query, setQuery, results, isLoading };
}
