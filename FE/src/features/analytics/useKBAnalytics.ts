import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';

export function useKBAnalytics(projectId: string) {
  return useQuery({
    queryKey: ['analytics', 'kb', projectId],
    queryFn: () => analyticsApi.getKBAnalytics(projectId),
    enabled: !!projectId,
  });
}
