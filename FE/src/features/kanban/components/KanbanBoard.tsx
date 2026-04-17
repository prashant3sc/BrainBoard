import { useState, useEffect, useRef } from 'react';
import Sortable from 'sortablejs';
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
  projectId: string;
  searchQuery: string;
  onAddOpen:   (col: IssueStatus) => void;
  onIssueClick:(issue: Issue) => void;
}

export function KanbanBoard({ projectId, searchQuery, onAddOpen, onIssueClick }: Props) {
  const { data: serverIssues = [], isLoading } = useIssues(projectId);
  const { mutate: updateIssue } = useUpdateIssue();

  /* Local state for optimistic drag updates */
  const [localIssues, setLocalIssues] = useState<Issue[]>([]);
  useEffect(() => { setLocalIssues(serverIssues); }, [serverIssues]);

  /* Always-current move handler — avoids stale closure in Sortable.onEnd */
  const handleMoveRef = useRef<(id: string, status: IssueStatus) => void>(() => {});
  handleMoveRef.current = (cardId: string, newStatus: IssueStatus) => {
    setLocalIssues((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, status: newStatus } : c)),
    );
    updateIssue({ id: cardId, dto: { status: newStatus }, projectId });
  };

  /* Initialise SortableJS once per data load */
  useEffect(() => {
    if (isLoading) return;

    const instances: Sortable[] = [];

    KANBAN_COLUMNS.forEach((col) => {
      const el = document.getElementById(`kb-list-${col.id}`);
      if (!el) return;

      const instance = Sortable.create(el, {
        group:      'kanban',
        animation:  180,
        ghostClass: 'kb-ghost',
        dragClass:  'kb-drag',
        onEnd(evt) {
          const cardId   = evt.item.dataset.id;
          const newStatus = evt.to.dataset.col  as IssueStatus;
          const oldStatus = evt.from.dataset.col as IssueStatus;

          if (!cardId || newStatus === oldStatus) return;

          /* Revert SortableJS DOM move so React reconciles cleanly */
          const refNode = evt.from.children[evt.oldDraggableIndex ?? 0] ?? null;
          evt.from.insertBefore(evt.item, refNode);

          handleMoveRef.current(cardId, newStatus);
        },
      });

      instances.push(instance);
    });

    return () => instances.forEach((s) => s.destroy());
  }, [isLoading]); // re-initialise only when loading state flips

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
    <div className="kb-board-area">
      {KANBAN_COLUMNS.map((col) => (
        <KanbanColumn
          key={col.id}
          col={col}
          issues={visible.filter((i) => i.status === col.id)}
          isLoading={isLoading}
          onAddClick={() => onAddOpen(col.id)}
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
  );
}
