import type { Project } from '@/types';

interface Props {
  project: Project;
  onClick: (project: Project) => void;
}

export function ProjectCard({ project, onClick }: Props) {
  const date = new Date(project.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(project)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(project)}
      className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <p className="truncate text-base font-semibold text-gray-900">{project.name}</p>
      <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">{project.description}</p>
      <p className="mt-4 text-xs text-gray-400">Created {date}</p>
    </div>
  );
}
