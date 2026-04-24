import { apiClient } from './client';

export interface AIAnalysisResult {
  story_points: number;
  justification: string;
  required_roles: string[];
  capacity_analysis: string;
  recommended_team: { 'Assigned To': string };
}

export interface RecommendedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AnalyzeIssueResponse {
  issue_id: string;
  issue_title: string;
  labels: string[];
  analysis: AIAnalysisResult;
  recommended_user: RecommendedUser | null;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  out_of_scope: boolean;
}

export interface AnalyzeDraftPayload {
  title: string;
  description: string;
  labels: string[];
  project_id: string;
}

export const aiApi = {
  analyzeIssue: (issueId: string): Promise<AnalyzeIssueResponse> =>
    apiClient.post(`/ai/analyze-issue/${issueId}`, undefined, { timeout: 60_000 }).then((r: { data: AnalyzeIssueResponse }) => r.data),

  analyzeDraft: (payload: AnalyzeDraftPayload): Promise<AnalyzeIssueResponse> =>
    apiClient.post('/ai/analyze-draft', payload, { timeout: 60_000 }).then((r: { data: AnalyzeIssueResponse }) => r.data),

  chat: (message: string, projectId?: string): Promise<ChatResponse> =>
    apiClient.post('/ai/chat', { message, project_id: projectId }, { timeout: 60_000 })
      .then((r: { data: ChatResponse }) => r.data),

  sync: (projectId?: string) =>
    apiClient.post('/ai/sync', projectId ? { project_id: projectId } : {}).then((r: { data: unknown }) => r.data),

  syncStatus: () =>
    apiClient.get('/ai/sync/status').then((r: { data: unknown }) => r.data),
};
