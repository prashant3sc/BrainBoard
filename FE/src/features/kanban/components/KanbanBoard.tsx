import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import type { Issue, IssueStatus } from '@/types';
import { useIssues, useUpdateIssue } from '../useKanban';
import { useRBAC } from '@/hooks/useRBAC';
import { KanbanColumn } from './KanbanColumn';

const STATUSES: IssueStatus[] = ['todo', 'in_progress', 'review', 'done'];

interface Props {
  projectId: string;
  onIssueClick: (issue: Issue) => void;
  onAddClick: () => void;
}

export function KanbanBoard({ projectId, onIssueClick, onAddClick }: Props) {
  const { data: issues = [], isLoading } = useIssues(projectId);
  const { mutate: updateIssue } = useUpdateIssue();
  const { can } = useRBAC();

  const canDrag = can('moveIssue');
  const canAdd  = can('editIssue');

  function groupByStatus(status: IssueStatus) {
    return issues.filter((i) => i.status === status);
  }

  function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId as IssueStatus;
    updateIssue({ id: draggableId, dto: { status: newStatus }, projectId });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((status) => {
          const columnIssues = groupByStatus(status);
          const totalPoints  = columnIssues.reduce((sum, i) => sum + i.storyPoints, 0);
          return (
            <KanbanColumn
              key={status}
              status={status}
              issues={columnIssues}
              totalPoints={totalPoints}
              onIssueClick={onIssueClick}
              onAddClick={onAddClick}
              canAdd={canAdd}
              canDrag={canDrag}
              isLoading={isLoading}
            />
          );
        })}
      </div>
    </DragDropContext>
  );
}
