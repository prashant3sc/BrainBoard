import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sprintsApi, type CompleteSprinthDto } from '@/api/sprints';
import type { SprintStatus } from '@/types';

export function useSprints(projectId: string, status?: SprintStatus) {
  return useQuery({
    queryKey: ['sprints', projectId, status],
    queryFn: () => sprintsApi.getAll(projectId, status),
    enabled: !!projectId,
  });
}

export function useActiveSprint(projectId: string) {
  return useQuery({
    queryKey: ['sprints', projectId, 'active'],
    queryFn: () => sprintsApi.getActive(projectId),
    enabled: !!projectId,
    // 404 means no active sprint — treat as null instead of error
    retry: false,
  });
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name, goal, startDate, endDate }: {
      projectId: string;
      name: string;
      goal?: string;
      startDate?: string;
      endDate?: string;
    }) => sprintsApi.create(projectId, { name, goal, startDate, endDate }),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });
}

export function useStartSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId }: { sprintId: string; projectId: string }) =>
      sprintsApi.start(sprintId),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
    },
  });
}

export function useCompleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, dto }: { sprintId: string; projectId: string; dto: CompleteSprinthDto }) =>
      sprintsApi.complete(sprintId, dto),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
    },
  });
}
