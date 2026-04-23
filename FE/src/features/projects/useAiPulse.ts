import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects';

export function useAiPulse(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-pulse', projectId],
    queryFn: () => projectsApi.getAiPulse(projectId),
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}
