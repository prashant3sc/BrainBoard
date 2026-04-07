import { apiClient } from './client';
import type { WikiPage } from '../types';
import { mockWikiPages } from '../mocks/wiki';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

type CreateWikiPageDto = Omit<WikiPage, 'id' | 'updatedAt'>;
type UpdateWikiPageDto = Partial<CreateWikiPageDto>;

export const wikiApi = {
  // Fetch all wiki pages belonging to a project
  getAll(projectId: string): Promise<WikiPage[]> {
    if (USE_MOCK) {
      const data = mockWikiPages.filter((p) => p.projectId === projectId);
      return Promise.resolve(data);
    }
    return apiClient.get<WikiPage[]>(`/projects/${projectId}/wiki`).then((r) => r.data);
  },

  // Fetch a single wiki page by its id
  getById(id: string): Promise<WikiPage> {
    if (USE_MOCK) {
      const found = mockWikiPages.find((p) => p.id === id);
      if (!found) return Promise.reject(new Error(`WikiPage ${id} not found`));
      return Promise.resolve(found);
    }
    return apiClient.get<WikiPage>(`/wiki/${id}`).then((r) => r.data);
  },

  // Create a new wiki page and return the persisted record
  create(dto: CreateWikiPageDto): Promise<WikiPage> {
    if (USE_MOCK) {
      const data: WikiPage = {
        ...dto,
        id: `wiki-${Date.now()}`,
        updatedAt: new Date().toISOString(),
      };
      return Promise.resolve(data);
    }
    return apiClient.post<WikiPage>('/wiki', dto).then((r) => r.data);
  },

  // Apply a partial update to an existing wiki page
  update(id: string, dto: UpdateWikiPageDto): Promise<WikiPage> {
    if (USE_MOCK) {
      const found = mockWikiPages.find((p) => p.id === id);
      if (!found) return Promise.reject(new Error(`WikiPage ${id} not found`));
      const data: WikiPage = { ...found, ...dto, updatedAt: new Date().toISOString() };
      return Promise.resolve(data);
    }
    return apiClient.patch<WikiPage>(`/wiki/${id}`, dto).then((r) => r.data);
  },

  // Delete a wiki page by id
  remove(id: string): Promise<void> {
    if (USE_MOCK) return Promise.resolve();
    return apiClient.delete(`/wiki/${id}`).then(() => undefined);
  },
};
