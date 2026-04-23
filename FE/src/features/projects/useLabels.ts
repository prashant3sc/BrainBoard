import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labelsApi, type Label } from '@/api/labels';

export function useLabels(projectId: string) {
  return useQuery<Label[]>({
    queryKey: ['labels', projectId],
    queryFn:  () => labelsApi.getAll(projectId),
    enabled:  !!projectId,
  });
}

export function useCreateLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, name, color }: { projectId: string; name: string; color: string }) =>
      labelsApi.create(projectId, { name, color }),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['labels', projectId] });
    },
  });
}

export function useDeleteLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, labelId }: { projectId: string; labelId: string }) =>
      labelsApi.remove(projectId, labelId),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['labels', projectId] });
      qc.invalidateQueries({ queryKey: ['issues',  projectId] }); // issues may reference deleted label
    },
  });
}
