import { useEffect } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import useAppStore from '@/store/useAppStore';
import { useAISearch } from '../useAISearch';
import { SearchResults } from './SearchResults';
import type { SearchResult } from '@/types';

export function SearchBar() {
  const { paletteOpen, togglePalette, closePalette } = useAppStore();
  const { query, setQuery, results, isLoading } = useAISearch();
  const navigate = useNavigate();

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePalette();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePalette]);

  function handleSelect(result: SearchResult) {
    if (result.type === 'issue') navigate(`/projects/${result.projectId}/kanban`);
    if (result.type === 'wiki')  navigate(`/projects/${result.projectId}/wiki`);
    closePalette();
    setQuery('');
  }

  function handleOpenChange(open: boolean) {
    if (!open) { closePalette(); setQuery(''); }
  }

  if (!paletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={() => handleOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-[#30363D] dark:bg-[#161B22]"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="flex flex-col">
          <div className="flex items-center border-b border-gray-100 px-3 dark:border-[#21262D]">
            <span className="mr-2 text-gray-400 dark:text-[#6E7681]">⌕</span>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search issues and wiki pages…"
              className="flex-1 bg-transparent py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none dark:text-[#E6EDF3] dark:placeholder:text-[#6E7681]"
              autoFocus
            />
            <kbd className="hidden rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-400 sm:block dark:border-[#30363D] dark:text-[#6E7681]">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto py-2">
            <SearchResults
              results={results}
              isLoading={isLoading}
              query={query}
              onSelect={handleSelect}
            />
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
