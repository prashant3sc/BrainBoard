import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import type { Issue, UpdateIssueDto } from '@/types';

export function useIssues(projectId: string) {
  return useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => issuesApi.getAll(projectId),
  });
}

interface UpdateVars { id: string; dto: UpdateIssueDto; projectId: string }

export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation<Issue, Error, UpdateVars, { previous: Issue[] | undefined }>({
    mutationFn: ({ id, dto }) => issuesApi.update(id, dto),

    onMutate: async ({ id, dto, projectId }) => {
      await queryClient.cancelQueries({ queryKey: ['issues', projectId] });
      const previous = queryClient.getQueryData<Issue[]>(['issues', projectId]);
      queryClient.setQueryData<Issue[]>(['issues', projectId], (old = []) =>
        old.map((issue) => (issue.id === id ? { ...issue, ...dto } : issue)),
      );
      return { previous };
    },

    onError: (_err, { projectId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['issues', projectId], context.previous);
      }
      // TODO: toast({ title: 'Failed to update issue', variant: 'destructive' })
    },

    onSettled: (_data, _err, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      // TODO: toast({ title: 'Issue updated' })
    },
  });
}
