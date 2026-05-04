import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { analyticsApi } from '@/api/analytics';

export function useBurndown(projectId: string, sprintId?: string) {
  return useQuery({
    queryKey: ['analytics', 'burndown', projectId, sprintId ?? 'default'],
    queryFn: () => analyticsApi.getBurndown(projectId, sprintId),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  });
}
