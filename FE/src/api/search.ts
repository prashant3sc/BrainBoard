import { apiClient } from './client';
import type { SearchResult } from '../types';
import { mockIssues } from '../mocks/issues';
import { mockWikiPages } from '../mocks/wiki';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const searchApi = {
  // Search issues and wiki pages by title, returning unified SearchResult records
  search(query: string): Promise<SearchResult[]> {
    if (USE_MOCK) {
      const lower = query.toLowerCase();

      const issueResults: SearchResult[] = mockIssues
        .filter((i) => i.title.toLowerCase().includes(lower))
        .map((i) => ({
          id: i.id,
          type: 'issue',
          title: i.title,
          excerpt: i.description.slice(0, 120),
          projectId: i.projectId,
        }));

      const wikiResults: SearchResult[] = mockWikiPages
        .filter((p) => p.title.toLowerCase().includes(lower))
        .map((p) => ({
          id: p.id,
          type: 'wiki',
          title: p.title,
          excerpt: p.content.replace(/^#+ .+\n+/, '').slice(0, 120),
          projectId: p.projectId,
        }));

      return Promise.resolve([...issueResults, ...wikiResults]);
    }
    return apiClient.post<SearchResult[]>('/search', { query }).then((r) => r.data);
  },

  semanticSearch(query: string): Promise<SearchResult[]> {
    if (USE_MOCK) {
      // No vector DB in mock mode — fall back to regular keyword search
      const lower = query.toLowerCase();
      const issueResults: SearchResult[] = mockIssues
        .filter((i) => i.title.toLowerCase().includes(lower))
        .map((i) => ({ id: i.id, type: 'issue', title: i.title, excerpt: i.description.slice(0, 120), projectId: i.projectId }));
      const wikiResults: SearchResult[] = mockWikiPages
        .filter((p) => p.title.toLowerCase().includes(lower))
        .map((p) => ({ id: p.id, type: 'wiki', title: p.title, excerpt: p.content.replace(/^#+ .+\n+/, '').slice(0, 120), projectId: p.projectId }));
      return Promise.resolve([...issueResults, ...wikiResults]);
    }
    return apiClient.post<SearchResult[]>('/search/semantic', { query }).then((r) => r.data);
  },
};
