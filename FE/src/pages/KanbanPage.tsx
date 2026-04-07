import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { KanbanBoard } from '@/features/kanban/components/KanbanBoard';
import { IssueModal } from '@/features/kanban/components/IssueModal';
import type { Issue } from '@/types';

export function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [isModalOpen, setIsModalOpen]     = useState(false);

  function handleIssueClick(issue: Issue) {
    setSelectedIssue(issue);
    setIsModalOpen(true);
  }

  function handleAddClick() {
    setSelectedIssue(null);
    setIsModalOpen(true);
  }

  function handleModalClose() {
    setIsModalOpen(false);
  }

  if (!projectId) return <p className="p-8 text-sm text-red-500">No project selected.</p>;

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Kanban Board</h1>
      <KanbanBoard
        projectId={projectId}
        onIssueClick={handleIssueClick}
        onAddClick={handleAddClick}
      />
      <IssueModal
        issue={selectedIssue}
        isOpen={isModalOpen}
        projectId={projectId}
        onClose={handleModalClose}
      />
    </div>
  );
}

export default KanbanPage;
