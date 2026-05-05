import { apiClient } from './client';
import type { WorkflowTemplate, TemplateType } from '../types';

export const templatesApi = {
  /** List system + project-scoped templates, optionally filtered by type. */
  list(type?: TemplateType, projectId?: string): Promise<WorkflowTemplate[]> {
    const params: Record<string, string> = {};
    if (type)      params.type       = type;
    if (projectId) params.project_id = projectId;
    return apiClient.get<WorkflowTemplate[]>('/templates', { params }).then((r) => r.data);
  },

  /** List templates scoped to a project (system + project-custom combined). */
  listForProject(projectId: string, type?: TemplateType): Promise<WorkflowTemplate[]> {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    return apiClient
      .get<WorkflowTemplate[]>(`/projects/${projectId}/templates`, { params })
      .then((r) => r.data);
  },

  /** Create a custom template scoped to a project. */
  create(projectId: string, data: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> {
    return apiClient
      .post<WorkflowTemplate>(`/projects/${projectId}/templates`, data)
      .then((r) => r.data);
  },

  /** Update a custom (non-system) template. */
  update(templateId: string, data: Partial<WorkflowTemplate>): Promise<WorkflowTemplate> {
    return apiClient
      .patch<WorkflowTemplate>(`/templates/${templateId}`, data)
      .then((r) => r.data);
  },

  /** Delete a custom (non-system) template. */
  delete(templateId: string): Promise<void> {
    return apiClient.delete(`/templates/${templateId}`).then(() => undefined);
  },

  /** Apply a project template to an existing project (seeds labels, wiki, compliance). */
  applyToProject(projectId: string, templateId: string): Promise<{ applied: Record<string, string[]> }> {
    return apiClient
      .post(`/projects/${projectId}/apply-template`, { templateId })
      .then((r) => r.data);
  },
};
