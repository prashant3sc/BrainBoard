import { apiClient } from './client';
import type { Sprint, SprintStatus, Issue } from '../types';

export interface ActiveSprintResponse {
  sprint: Sprint;
  issues: Issue[];
}

export interface CompleteSprinthDto {
  unfinishedAction: 'backlog' | 'next_sprint';
  nextSprintId?: string;
}

export const sprintsApi = {
  // List sprints for a project, optionally filtered by status
  getAll(projectId: string, status?: SprintStatus): Promise<Sprint[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    return apiClient
      .get<Sprint[]>(`/projects/${projectId}/sprints`, { params })
      .then((r) => r.data);
  },

  // Get the active sprint + its issues
  getActive(projectId: string): Promise<ActiveSprintResponse> {
    return apiClient
      .get<ActiveSprintResponse>(`/projects/${projectId}/active-sprint`)
      .then((r) => r.data);
  },

  // Create a new sprint (planned status by default)
  create(projectId: string, dto: { name: string; goal?: string; startDate?: string; endDate?: string }): Promise<Sprint> {
    return apiClient
      .post<Sprint>(`/projects/${projectId}/sprints`, dto)
      .then((r) => r.data);
  },

  // Start a planned sprint → active
  start(sprintId: string): Promise<Sprint> {
    return apiClient
      .patch<Sprint>(`/sprints/${sprintId}`, { status: 'active' })
      .then((r) => r.data);
  },

  // Complete an active sprint with unfinished issue handling
  complete(sprintId: string, dto: CompleteSprinthDto): Promise<Sprint> {
    return apiClient
      .patch<Sprint>(`/sprints/${sprintId}`, { status: 'completed', ...dto })
      .then((r) => r.data);
  },
};
