import { apiClient } from './client';
import type { Issue, CreateIssueDto, UpdateIssueDto } from '../types';
import { mockIssues } from '../mocks/issues';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/* Backend returns camelCase but uses `dueDate` — map to `due` for FE */
function normalise(raw: Record<string, unknown>): Issue {
  const issue = raw as unknown as Issue & { dueDate?: string | null };
  return { ...issue, due: issue.dueDate ?? issue.due ?? null };
}

/* FE uses `due` — map back to `dueDate` for the backend */
function toPayload(dto: Partial<CreateIssueDto & UpdateIssueDto>) {
  const out: Record<string, unknown> = { ...dto };
  if ('due' in dto) { out.dueDate = dto.due; delete out.due; }
  return out;
}

export const issuesApi = {
  getAll(projectId: string): Promise<Issue[]> {
    if (USE_MOCK) return Promise.resolve(mockIssues.filter((i) => i.projectId === projectId));
    return apiClient
      .get<Record<string, unknown>[]>(`/projects/${projectId}/issues`)
      .then((r) => r.data.map(normalise));
  },

  getById(id: string): Promise<Issue> {
    if (USE_MOCK) {
      const found = mockIssues.find((i) => i.id === id);
      if (!found) return Promise.reject(new Error(`Issue ${id} not found`));
      return Promise.resolve(found);
    }
    return apiClient
      .get<Record<string, unknown>>(`/issues/${id}`)
      .then((r) => normalise(r.data));
  },

  create(dto: CreateIssueDto): Promise<Issue> {
    if (USE_MOCK) {
      const data: Issue = { ...dto, id: `issue-${Date.now()}`, createdAt: new Date().toISOString() };
      mockIssues.push(data);
      return Promise.resolve({ ...data });
    }
    return apiClient
      .post<Record<string, unknown>>('/issues', toPayload(dto))
      .then((r) => normalise(r.data));
  },

  update(id: string, dto: UpdateIssueDto): Promise<Issue> {
    if (USE_MOCK) {
      const index = mockIssues.findIndex((i) => i.id === id);
      if (index === -1) return Promise.reject(new Error(`Issue ${id} not found`));
      mockIssues[index] = { ...mockIssues[index], ...dto };
      return Promise.resolve({ ...mockIssues[index] });
    }
    return apiClient
      .patch<Record<string, unknown>>(`/issues/${id}`, toPayload(dto))
      .then((r) => normalise(r.data));
  },

  remove(id: string): Promise<void> {
    if (USE_MOCK) {
      const index = mockIssues.findIndex((i) => i.id === id);
      if (index !== -1) mockIssues.splice(index, 1);
      return Promise.resolve();
    }
    return apiClient.delete(`/issues/${id}`).then(() => undefined);
  },
};
