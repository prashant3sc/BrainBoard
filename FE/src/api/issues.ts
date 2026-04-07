import { apiClient } from './client';
import type { Issue, CreateIssueDto, UpdateIssueDto } from '../types';
import { mockIssues } from '../mocks/issues';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export const issuesApi = {
  // Fetch all issues belonging to a project
  getAll(projectId: string): Promise<Issue[]> {
    if (USE_MOCK) {
      const data = mockIssues.filter((i) => i.projectId === projectId);
      return Promise.resolve(data);
    }
    return apiClient.get<Issue[]>(`/projects/${projectId}/issues`).then((r) => r.data);
  },

  // Fetch a single issue by its id
  getById(id: string): Promise<Issue> {
    if (USE_MOCK) {
      const found = mockIssues.find((i) => i.id === id);
      if (!found) return Promise.reject(new Error(`Issue ${id} not found`));
      return Promise.resolve(found);
    }
    return apiClient.get<Issue>(`/issues/${id}`).then((r) => r.data);
  },

  // Create a new issue and return the persisted record
  create(dto: CreateIssueDto): Promise<Issue> {
    if (USE_MOCK) {
      const data: Issue = {
        ...dto,
        id: `issue-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      return Promise.resolve(data);
    }
    return apiClient.post<Issue>('/issues', dto).then((r) => r.data);
  },

  // Apply a partial update to an existing issue
  update(id: string, dto: UpdateIssueDto): Promise<Issue> {
    if (USE_MOCK) {
      const found = mockIssues.find((i) => i.id === id);
      if (!found) return Promise.reject(new Error(`Issue ${id} not found`));
      const data: Issue = { ...found, ...dto };
      return Promise.resolve(data);
    }
    return apiClient.patch<Issue>(`/issues/${id}`, dto).then((r) => r.data);
  },

  // Delete an issue by id
  remove(id: string): Promise<void> {
    if (USE_MOCK) return Promise.resolve();
    return apiClient.delete(`/issues/${id}`).then(() => undefined);
  },
};
