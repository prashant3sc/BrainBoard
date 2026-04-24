import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';

export function useWorkload(projectId: string) {
  return useQuery({
    queryKey: ['analytics', 'workload', projectId],
    queryFn: () => analyticsApi.getWorkload(projectId),
    enabled: !!projectId,
  });
}
