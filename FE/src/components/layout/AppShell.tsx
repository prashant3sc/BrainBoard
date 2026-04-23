import { useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
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
      <main className="flex-1 overflow-y-auto">{children}</main>
      <ChatPanelWrapper />
    </div>
  );
}
