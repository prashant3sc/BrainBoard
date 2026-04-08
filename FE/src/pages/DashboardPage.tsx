import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/features/projects/useProjects';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { CreateProjectModal } from '@/features/projects/components/CreateProjectModal';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useRBAC } from '@/hooks/useRBAC';
import type { Project } from '@/types';

export function DashboardPage() {
  const { data: projects, isLoading, isError } = useProjects();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { can } = useRBAC();
  const navigate = useNavigate();

  function handleProjectClick(project: Project) {
    navigate(`/projects/${project.id}/kanban`);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        {can('createProject') && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            + New Project
          </button>
        )}
      </div>

      {isLoading && <LoadingSkeleton rows={3} />}

      {isError && (
        <p className="text-sm text-red-500">Failed to load projects.</p>
      )}

      {!isLoading && !isError && projects?.length === 0 && (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start tracking issues and documentation."
          action={
            can('createProject')
              ? { label: '+ New Project', onClick: () => setIsCreateModalOpen(true) }
              : undefined
          }
        />
      )}

      {!isLoading && !isError && projects && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={handleProjectClick} />
          ))}
        </div>
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}

export default DashboardPage;
