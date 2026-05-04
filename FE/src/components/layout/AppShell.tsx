import { useParams, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { PageTransition } from './PageTransition';
import { SearchBar } from '@/features/ai/components/SearchBar';
import { ChatPanel } from '@/features/ai/components/ChatPanel';
import { useProject } from '@/features/projects/useProjects';
import { useActiveSprint } from '@/features/projects/useSprints';

function ChatPanelWrapper() {
  const { projectId } = useParams<{ projectId: string }>();
  const { pathname } = useLocation();
  const { data: project } = useProject(projectId ?? '');
  const { data: activeSprintData } = useActiveSprint(projectId ?? '');

  const page = pathname.includes('/kanban')
    ? 'kanban'
    : pathname.includes('/backlog')
      ? 'backlog'
      : pathname.includes('/wiki')
        ? 'wiki'
        : pathname.includes('/analytics')
          ? 'analytics'
          : 'dashboard';

  return (
    <ChatPanel
      projectId={projectId}
      projectName={project?.name}
      sprintId={activeSprintData?.sprint?.id}
      sprintName={activeSprintData?.sprint?.name}
      page={page}
      context={page === 'wiki' ? 'wiki' : 'default'}
    />
  );
}

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bb-content-bg)' }}>
      <SearchBar />
      <Sidebar />
      <main className="flex-1 overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
        <PageTransition>{children}</PageTransition>
      </main>
      <ChatPanelWrapper />
    </div>
  );
}
