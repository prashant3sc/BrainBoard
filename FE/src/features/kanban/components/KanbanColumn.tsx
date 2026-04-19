import { Droppable } from '@hello-pangea/dnd';
import type { Issue, IssueStatus, ProjectMember } from '@/types';
import { IssueCard } from './IssueCard';

interface ColConfig {
  id:    IssueStatus;
  label: string;
  cls:   string;
}

interface Props {
  col:          ColConfig;
  issues:       Issue[];
  isLoading:    boolean;
  members:      ProjectMember[];
  onIssueClick: (issue: Issue) => void;
}

export function KanbanColumn({ col, issues, isLoading, members, onIssueClick }: Props) {
  return (
    <div className={`kb-col ${col.cls}`}>
      {/* Header */}
      <div className="kb-col-header">
        <div className="kb-col-header-left">
          <div className="kb-col-dot" />
          <span className="kb-col-name">{col.label}</span>
          <span className="kb-col-count">{isLoading ? '–' : issues.length}</span>
        </div>
      </div>

      {/* Card list — Droppable target for @hello-pangea/dnd */}
      <Droppable droppableId={col.id} isDropDisabled={isLoading}>
        {(provided, snapshot) => (
          <div
            className="kb-card-list"
            id={`kb-list-${col.id}`}
            data-col={col.id}
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              background: snapshot.isDraggingOver
                ? 'var(--kb-drop-active, rgba(231,80,38,0.07))'
                : undefined,
              outline: snapshot.isDraggingOver
                ? '2px dashed rgba(231,80,38,0.35)'
                : '2px solid transparent',
              outlineOffset: '-4px',
              borderRadius: '0 0 8px 8px',
              transition: 'background 120ms ease, outline 120ms ease',
            }}
          >
            {isLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 80,
                      borderRadius: 8,
                      background: 'var(--kb-card-bg)',
                      border: '1px solid var(--kb-card-border)',
                      animation: 'pulse 1.5s ease-in-out infinite',
                      opacity: 1 - i * 0.25,
                    }}
                  />
                ))
              : issues.map((issue, index) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    index={index}
                    members={members}
                    onClick={onIssueClick}
                  />
                ))
            }
            {provided.placeholder}
          </div>
        )}
      </Droppable>

    </div>
  );
}
