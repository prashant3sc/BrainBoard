import { apiClient } from './client';
import type {
  ProcessDefinition,
  CreateProcessDefinitionDto,
  UpdateProcessDefinitionDto,
  TriggerContext,
  IssueType,
} from '../types';

export const processDefinitionsApi = {
  list(projectId: string, activeOnly = false): Promise<ProcessDefinition[]> {
    const params = activeOnly ? '?active_only=true' : '';
    return apiClient
      .get<ProcessDefinition[]>(`/projects/${projectId}/process-definitions${params}`)
      .then((r) => r.data);
  },

  match(
    projectId: string,
    context: TriggerContext,
    issueType?: IssueType | null,
  ): Promise<ProcessDefinition[]> {
    const params = new URLSearchParams({ context });
    if (issueType) params.set('issue_type', issueType);
    return apiClient
      .get<ProcessDefinition[]>(
        `/projects/${projectId}/process-definitions/match?${params.toString()}`,
      )
      .then((r) => r.data);
  },

  create(projectId: string, dto: CreateProcessDefinitionDto): Promise<ProcessDefinition> {
    return apiClient
      .post<ProcessDefinition>(`/projects/${projectId}/process-definitions`, dto)
      .then((r) => r.data);
  },

  update(id: string, dto: UpdateProcessDefinitionDto): Promise<ProcessDefinition> {
    return apiClient
      .patch<ProcessDefinition>(`/process-definitions/${id}`, dto)
      .then((r) => r.data);
  },

  remove(id: string): Promise<void> {
    return apiClient.delete(`/process-definitions/${id}`).then(() => undefined);
  },
};
