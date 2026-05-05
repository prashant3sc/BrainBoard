import { apiClient } from './client';
import type { ComplianceAnalytics, ComplianceCheck, ComplianceTemplate } from '../types';

export const complianceApi = {
  // ── Templates (project settings) ──────────────────────────────────────────

  listTemplates(projectId: string): Promise<ComplianceTemplate[]> {
    return apiClient
      .get<ComplianceTemplate[]>(`/projects/${projectId}/compliance/templates`)
      .then((r) => r.data);
  },

  createTemplate(
    projectId: string,
    data: Partial<ComplianceTemplate>,
  ): Promise<ComplianceTemplate> {
    return apiClient
      .post<ComplianceTemplate>(`/projects/${projectId}/compliance/templates`, data)
      .then((r) => r.data);
  },

  updateTemplate(
    projectId: string,
    templateId: string,
    data: Partial<ComplianceTemplate>,
  ): Promise<ComplianceTemplate> {
    return apiClient
      .patch<ComplianceTemplate>(`/projects/${projectId}/compliance/templates/${templateId}`, data)
      .then((r) => r.data);
  },

  deleteTemplate(projectId: string, templateId: string): Promise<void> {
    return apiClient
      .delete(`/projects/${projectId}/compliance/templates/${templateId}`)
      .then(() => undefined);
  },

  // ── Issue-level checks ─────────────────────────────────────────────────────

  listChecks(issueId: string): Promise<ComplianceCheck[]> {
    return apiClient
      .get<ComplianceCheck[]>(`/issues/${issueId}/compliance`)
      .then((r) => r.data);
  },

  updateCheck(
    issueId: string,
    checkId: string,
    data: { status: string; note?: string },
  ): Promise<ComplianceCheck> {
    return apiClient
      .patch<ComplianceCheck>(`/issues/${issueId}/compliance/${checkId}`, data)
      .then((r) => r.data);
  },

  // ── Analytics ─────────────────────────────────────────────────────────────

  getAnalytics(projectId: string, sprintId?: string): Promise<ComplianceAnalytics> {
    const params = sprintId ? `?sprint_id=${sprintId}` : '';
    return apiClient
      .get<ComplianceAnalytics>(`/projects/${projectId}/compliance/analytics${params}`)
      .then((r) => r.data);
  },
};
