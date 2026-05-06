import { apiClient } from './client';

// ---------------------------------------------------------------------------
// V2 response shape — context-aware analysis
// ---------------------------------------------------------------------------

export interface ConfidenceLevel {
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface StoryPointsSuggestion extends ConfidenceLevel {
  value: number;
}

export interface IssueTypeSuggestion extends ConfidenceLevel {
  value: string;
}

export interface LabelsSuggestion extends ConfidenceLevel {
  values: string[];
}

export interface RecommendedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AssigneeSuggestion extends ConfidenceLevel {
  user: RecommendedUser | null;
}

export interface DuplicateIssue {
  id: string;
  ticket_id: string;
  title: string;
}

export interface DuplicateSuggestion extends ConfidenceLevel {
  status: 'yes' | 'maybe' | 'no';
  issues: DuplicateIssue[];
}

export interface AnalyzeIssueResponse {
  issue_id: string | null;
  issue_title: string;
  story_points: StoryPointsSuggestion;
  issue_type: IssueTypeSuggestion;
  labels: LabelsSuggestion;
  assignee: AssigneeSuggestion;
  duplicate: DuplicateSuggestion;
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface AnalyzeDraftPayload {
  title: string;
  description: string;
  project_id: string;
}

// ---------------------------------------------------------------------------
// Chat / chatbot types (unchanged)
// ---------------------------------------------------------------------------

export interface ChatResponse {
  answer: string;
  sources: string[];
  out_of_scope?: boolean;
}

export interface ChatQueryPayload {
  query: string;
  project_id?: string | null;
  sprint_id?: string | null;
  page?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface WikiContext {
  id: string;
  title: string;
  text: string;
}

export interface SyncStatusData {
  in_sync: boolean;
  postgres: Record<string, number>;
  chroma: Record<string, number>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const aiApi = {
  analyzeIssue: (issueId: string): Promise<AnalyzeIssueResponse> =>
    apiClient.post(`/ai/analyze-issue/${issueId}`, undefined, { timeout: 60_000 }).then((r: { data: AnalyzeIssueResponse }) => r.data),

  analyzeDraft: (payload: AnalyzeDraftPayload): Promise<AnalyzeIssueResponse> =>
    apiClient.post('/ai/analyze-draft', payload, { timeout: 60_000 }).then((r: { data: AnalyzeIssueResponse }) => r.data),

  chat: (message: string, projectId?: string, wikiContext?: WikiContext): Promise<ChatResponse> =>
    apiClient.post('/ai/chat', {
      message,
      project_id: projectId,
      ...(wikiContext ? { wiki_context: { title: wikiContext.title, text: wikiContext.text } } : {}),
    }, { timeout: 60_000 }).then((r: { data: ChatResponse }) => r.data),

  chatQuery: (payload: ChatQueryPayload): Promise<ChatResponse> =>
    apiClient.post('/ai/chatbot/query', payload, { timeout: 60_000 })
      .then((r: { data: ChatResponse }) => r.data),

  sync: (projectId?: string) =>
    apiClient.post('/ai/sync', projectId ? { project_id: projectId } : {}).then((r: { data: unknown }) => r.data),

  syncStatus: (): Promise<SyncStatusData> =>
    apiClient.get('/ai/sync/status').then((r: { data: SyncStatusData }) => r.data),
};
