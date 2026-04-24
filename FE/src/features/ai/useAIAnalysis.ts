import { useState } from 'react';
import { aiApi, type AnalyzeIssueResponse, type AnalyzeDraftPayload } from '@/api/ai';

interface UseAIAnalysisResult {
  analysis: AnalyzeIssueResponse | null;
  isLoading: boolean;
  error: string | null;
  analyze: (issueId: string) => Promise<void>;
  analyzeDraft: (payload: AnalyzeDraftPayload) => Promise<void>;
  clear: () => void;
}

export function useAIAnalysis(): UseAIAnalysisResult {
  const [analysis, setAnalysis] = useState<AnalyzeIssueResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function analyze(issueId: string) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await aiApi.analyzeIssue(issueId);
      setAnalysis(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI analysis failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzeDraft(payload: AnalyzeDraftPayload) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await aiApi.analyzeDraft(payload);
      setAnalysis(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI analysis failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function clear() {
    setAnalysis(null);
    setError(null);
  }

  return { analysis, isLoading, error, analyze, analyzeDraft, clear };
}
