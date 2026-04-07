import { Droppable, Draggable } from '@hello-pangea/dnd';
import type { Issue, IssueStatus } from '@/types';
import { STATUS_LABELS } from '@/lib/constants';
import { IssueCard } from './IssueCard';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';

interface Props {
  status: IssueStatus;
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onAddClick: () => void;
  canAdd: boolean;
  canDrag: boolean;
  isLoading?: boolean;
}

export function KanbanColumn({
  status,
  issues,
  onIssueClick,
  onAddClick,
  canAdd,
  canDrag,
  isLoading = false,
}: Props) {
  const COLUMN_ACCENT: Record<IssueStatus, string> = {
    todo:        'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    done:        'bg-green-100 text-green-700',
  };

  function handleAddClick() {
    onAddClick();
  }

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">{STATUS_LABELS[status]}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLUMN_ACCENT[status]}`}>
            {issues.length}
          </span>
        </div>
        {canAdd && (
          <button
            onClick={handleAddClick}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {/* Cards */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-24 rounded-xl p-2 space-y-2 transition-colors ${
              snapshot.isDraggingOver ? 'bg-indigo-50' : 'bg-gray-50'
            }`}
          >
            {isLoading ? (
              <LoadingSkeleton rows={3} className="p-1" />
            ) : (
              issues.map((issue, index) =>
                canDrag ? (
                  <Draggable key={issue.id} draggableId={issue.id} index={index}>
                    {(drag, dragSnapshot) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        {...drag.dragHandleProps}
                      >
                        <IssueCard
                          issue={issue}
                          onClick={onIssueClick}
                          isDragging={dragSnapshot.isDragging}
                        />
                      </div>
                    )}
                  </Draggable>
                ) : (
                  <IssueCard key={issue.id} issue={issue} onClick={onIssueClick} />
                ),
              )
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
