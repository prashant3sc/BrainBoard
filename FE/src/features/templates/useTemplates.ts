import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '@/api/templates';
import type { TemplateType, WorkflowTemplate } from '@/types';

export function useTemplates(type?: TemplateType, projectId?: string) {
  return useQuery<WorkflowTemplate[]>({
    queryKey: ['templates', type, projectId],
    queryFn: () => templatesApi.list(type, projectId),
  });
}

export function useProjectTemplates(projectId: string, type?: TemplateType) {
  return useQuery<WorkflowTemplate[]>({
    queryKey: ['project-templates', projectId, type],
    queryFn:  () => templatesApi.listForProject(projectId, type),
    enabled:  !!projectId,
  });
}

export function useCreateTemplate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WorkflowTemplate>) => templatesApi.create(projectId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['project-templates', projectId] }),
  });
}

export function useUpdateTemplate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkflowTemplate> }) =>
      templatesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-templates', projectId] }),
  });
}

export function useDeleteTemplate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['project-templates', projectId] }),
  });
}

export function useApplyProjectTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, templateId }: { projectId: string; templateId: string }) =>
      templatesApi.applyToProject(projectId, templateId),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['labels',           projectId] });
      qc.invalidateQueries({ queryKey: ['wiki',             projectId] });
      qc.invalidateQueries({ queryKey: ['compliance-templates', projectId] });
    },
  });
}
