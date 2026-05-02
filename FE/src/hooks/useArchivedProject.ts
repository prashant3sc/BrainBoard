import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/api/projects';
import { useRBAC } from '@/hooks/useRBAC';

/**
 * Returns archive state for a project.
 *
 * `isWriteLocked` — true when the project is archived AND the current user
 * is NOT an admin. In this state all write actions should be hidden/disabled.
 * Admin always retains full access even on archived projects.
 */
export function useArchivedProject(projectId: string | undefined) {
  const { role } = useRBAC();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => projectsApi.getById(projectId!),
    enabled:  !!projectId,
    staleTime: 30_000,
  });

  const isArchived    = project?.isArchived ?? false;
  const isWriteLocked = isArchived && role !== 'admin';

  return { isArchived, isWriteLocked, project };
}
