import { useState, useEffect } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useIssues, useUpdateIssue } from '../useKanban';
import { KanbanColumn } from './KanbanColumn';
import type { Issue, IssueStatus } from '@/types';

export const KANBAN_COLUMNS: { id: IssueStatus; label: string; cls: string }[] = [
  { id: 'todo',        label: 'To Do',       cls: 'kb-col-todo'    },
  { id: 'in_progress', label: 'In Progress',  cls: 'kb-col-inprog'  },
  { id: 'review',      label: 'In Review',    cls: 'kb-col-review'  },
  { id: 'blocked',     label: 'Blocked',      cls: 'kb-col-blocked' },
  { id: 'done',        label: 'Done',         cls: 'kb-col-done'    },
];

interface Props {
  projectId:    string;
  searchQuery:  string;
  onIssueClick: (issue: Issue) => void;
}

export function KanbanBoard({ projectId, searchQuery, onIssueClick }: Props) {
  const { data: serverIssues = [], isLoading } = useIssues(projectId);
  const { mutate: updateIssue } = useUpdateIssue();

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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="kb-board-area">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            issues={visible.filter((i) => i.status === col.id)}
            isLoading={isLoading}
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
