import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects';
import type { Project } from '@/types';

type CreateProjectDto = Omit<Project, 'id' | 'createdAt'>;

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll(),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProjectDto) => projectsApi.create(dto),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // TODO: toast({ title: `Project "${project.name}" created` })
      void project;
    },
  });
}
