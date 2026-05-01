import { useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import { PageTransition } from './PageTransition';
import { SearchBar } from '@/features/ai/components/SearchBar';
import { ChatPanel } from '@/features/ai/components/ChatPanel';
import { useProject } from '@/features/projects/useProjects';

function ChatPanelWrapper() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId ?? '');
  return <ChatPanel projectId={projectId} projectName={project?.name} />;
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
