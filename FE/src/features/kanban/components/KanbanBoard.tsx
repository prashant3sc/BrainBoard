import { useState, useEffect, useRef } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import type { AxiosError } from 'axios';
import { useUpdateIssue } from '../useKanban';
import { useActiveSprint } from '@/features/projects/useSprints';
import { KanbanColumn } from './KanbanColumn';
import { KanbanEmptyState } from './KanbanEmptyState';
import { useProjectMembers } from '@/features/projects/useProjects';
import { useRBAC } from '@/hooks/useRBAC';
import type { Issue, IssueStatus } from '@/types';

export const KANBAN_COLUMNS: { id: IssueStatus; label: string; cls: string }[] = [
  { id: 'todo',        label: 'To Do',       cls: 'kb-col-todo'   },
  { id: 'in_progress', label: 'In Progress',  cls: 'kb-col-inprog' },
  { id: 'review',      label: 'In Review',    cls: 'kb-col-review' },
  { id: 'done',        label: 'Done',         cls: 'kb-col-done'   },
];

interface Props {
  projectId:      string;
  searchQuery:    string;
  assigneeFilter: string[];
  onIssueClick:   (issue: Issue) => void;
}

export function KanbanBoard({ projectId, searchQuery, assigneeFilter, onIssueClick }: Props) {
  const { data: activeSprintData, isLoading, isError } = useActiveSprint(projectId);
  const { mutate: updateIssue } = useUpdateIssue();
  const { data: members = [] } = useProjectMembers(projectId);
  const { can } = useRBAC();

  /* Toast */
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({ msg: '', visible: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, visible: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4000);
  }

  /* Local state for optimistic drag updates */
  const [localIssues, setLocalIssues] = useState<Issue[]>([]);
  // Depend on activeSprintData (stable object ref from react-query), NOT on
  // `activeSprintData?.issues ?? []` which creates a new array reference on
  // every render when there is no sprint, causing an infinite setState loop.
  useEffect(() => {
    setLocalIssues(activeSprintData?.issues ?? []);
  }, [activeSprintData]);

  function onDragEnd(result: DropResult) {
    if (!can('moveIssue')) return;

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
      updateIssue(
        { id: draggableId, dto: { status: newStatus }, projectId },
        {
          onError: (err) => {
            const ax = err as AxiosError<{ status?: string; detail?: string }>;
            const msg =
              ax?.response?.data?.status ??
              ax?.response?.data?.detail ??
              'Failed to update status';
            showToast(msg);
          },
        },
      );
    }
  }

  /* Filter by search query then by selected assignees */
  const q = searchQuery.trim().toLowerCase();
  const afterSearch = q
    ? localIssues.filter(
        (i) => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q),
      )
    : localIssues;
  const visible = assigneeFilter.length > 0
    ? afterSearch.filter((i) => i.assigneeId && assigneeFilter.includes(i.assigneeId))
    : afterSearch;

  /* No active sprint — show empty state */
  if (!isLoading && (isError || !activeSprintData)) {
    return <KanbanEmptyState projectId={projectId} />;
  }

  return (
    <>
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

    {/* Kanban error toast */}
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: '#FFF0EE', border: '1px solid #FFBDAD', borderRadius: 10,
      padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 300,
      fontSize: 13, fontWeight: 500, color: '#DE350B',
      transition: 'opacity 0.2s, transform 0.2s',
      opacity: toast.visible ? 1 : 0,
      pointerEvents: toast.visible ? 'auto' : 'none',
      whiteSpace: 'nowrap',
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="#DE350B" strokeWidth="1.4"/>
        <path d="M7 4v3M7 9.5v.5" stroke="#DE350B" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      {toast.msg}
    </div>
    </>
  );
}
