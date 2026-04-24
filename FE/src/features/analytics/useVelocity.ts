import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';

export function useVelocity(projectId: string) {
  return useQuery({
    queryKey: ['analytics', 'velocity', projectId],
    queryFn: () => analyticsApi.getVelocity(projectId),
    enabled: !!projectId,
  });
}
