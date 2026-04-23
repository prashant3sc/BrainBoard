import { apiClient } from './client';

export interface Label {
  id: string;
  name: string;
  color: string;
  project: string;
}

export const labelsApi = {
  getAll(projectId: string): Promise<Label[]> {
    return apiClient.get<Label[]>(`/projects/${projectId}/labels`).then((r) => r.data);
  },

  create(projectId: string, dto: { name: string; color: string }): Promise<Label> {
    return apiClient
      .post<Label>(`/projects/${projectId}/labels`, { ...dto, project: projectId })
      .then((r) => r.data);
  },

  remove(projectId: string, labelId: string): Promise<void> {
    return apiClient.delete(`/projects/${projectId}/labels/${labelId}`).then(() => undefined);
  },
};
