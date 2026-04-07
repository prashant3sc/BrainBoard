import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { KanbanBoard } from '@/features/kanban/components/KanbanBoard';
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
      {/* IssueModal will be added in prompt 10 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm text-gray-600">
              {selectedIssue ? `Editing: ${selectedIssue.title}` : 'Creating new issue'}
            </p>
            <button
              onClick={handleModalClose}
              className="mt-4 rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanPage;
