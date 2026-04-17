import Sidebar from './Sidebar';
import { SearchBar } from '@/features/ai/components/SearchBar';

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bb-content-bg)' }}>
      <SearchBar />
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
