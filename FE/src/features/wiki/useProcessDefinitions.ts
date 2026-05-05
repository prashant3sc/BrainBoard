import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { processDefinitionsApi } from '@/api/processDefinitions';
import type {
  ProcessDefinition,
  CreateProcessDefinitionDto,
  UpdateProcessDefinitionDto,
  TriggerContext,
  IssueType,
} from '@/types';

export function useProcessDefinitions(projectId: string, activeOnly = false) {
  return useQuery<ProcessDefinition[]>({
    queryKey: ['process-definitions', projectId, activeOnly],
    queryFn: () => processDefinitionsApi.list(projectId, activeOnly),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useMatchedProcessDefinitions(
  projectId: string,
  context: TriggerContext | null,
  issueType?: IssueType | null,
) {
  return useQuery<ProcessDefinition[]>({
    queryKey: ['process-definitions-match', projectId, context, issueType ?? null],
    queryFn: () => processDefinitionsApi.match(projectId, context!, issueType),
    enabled: !!projectId && !!context,
    staleTime: 30_000,
  });
}

export function useCreateProcessDefinition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProcessDefinitionDto) =>
      processDefinitionsApi.create(projectId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['process-definitions', projectId] });
    },
  });
}

export function useUpdateProcessDefinition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProcessDefinitionDto }) =>
      processDefinitionsApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['process-definitions', projectId] });
    },
  });
}

export function useDeleteProcessDefinition(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => processDefinitionsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['process-definitions', projectId] });
    },
  });
}
