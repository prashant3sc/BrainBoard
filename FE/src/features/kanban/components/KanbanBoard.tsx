import { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useUpdateIssue } from '../useKanban';
import { useActiveSprint } from '@/features/projects/useSprints';
import { KanbanColumn } from './KanbanColumn';
import { useProjectMembers } from '@/features/projects/useProjects';
import type { Issue, IssueStatus, ProjectMember } from '@/types';

export const KANBAN_COLUMNS: { id: IssueStatus; label: string; cls: string }[] = [
  { id: 'todo',        label: 'To Do',       cls: 'kb-col-todo'   },
  { id: 'in_progress', label: 'In Progress',  cls: 'kb-col-inprog' },
  { id: 'review',      label: 'In Review',    cls: 'kb-col-review' },
  { id: 'done',        label: 'Done',         cls: 'kb-col-done'   },
];

interface Props {
  projectId:    string;
  searchQuery:  string;
  onIssueClick: (issue: Issue) => void;
}

export function KanbanBoard({ projectId, searchQuery, onIssueClick }: Props) {
  const { data: activeSprintData, isLoading, isError } = useActiveSprint(projectId);
  const { mutate: updateIssue } = useUpdateIssue();
  const { data: members = [] } = useProjectMembers(projectId);

  const serverIssues = activeSprintData?.issues ?? [];

  /* Local state for optimistic drag updates */
  const [localIssues, setLocalIssues] = useState<Issue[]>([]);
  useEffect(() => { setLocalIssues(serverIssues); }, [serverIssues]);

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;

    // Dropped outside any column
    if (!destination) return;

    // No movement
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    const newStatus = destination.droppableId as IssueStatus;
    const oldStatus = source.droppableId  as IssueStatus;

    // Optimistic UI update
    setLocalIssues((prev) =>
      prev.map((issue) =>
        issue.id === draggableId ? { ...issue, status: newStatus } : issue,
      ),
    );

    // Only persist when the column actually changed
    if (newStatus !== oldStatus) {
      updateIssue({ id: draggableId, dto: { status: newStatus }, projectId });
    }
  }

  /* Filter by search query */
  const q = searchQuery.trim().toLowerCase();
  const visible = q
    ? localIssues.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q),
      )
    : localIssues;

  /* No active sprint — show empty state */
  if (!isLoading && (isError || !activeSprintData)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: 'var(--bb-bl-count)' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity={0.35}>
          <rect x="4" y="4" width="16" height="40" rx="3" fill="currentColor"/>
          <rect x="24" y="12" width="16" height="32" rx="3" fill="currentColor"/>
        </svg>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>No active sprint</p>
        <p style={{ fontSize: 12, margin: 0, opacity: 0.7 }}>Go to Backlog to start a sprint.</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="kb-board-area">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            issues={visible.filter((i) => i.status === col.id)}
            isLoading={isLoading}
            members={members}
            onIssueClick={onIssueClick}
          />
        ))}

        {/* Add column placeholder */}
        <button
          className="kb-add-col-btn"
          onClick={() => {/* coming soon */}}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Add column
        </button>
      </div>
    </DragDropContext>
  );
}
