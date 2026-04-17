import type { Issue, IssueStatus } from '@/types';
import { IssueCard } from './IssueCard';

interface ColConfig {
  id: IssueStatus;
  label: string;
  cls: string;
}

interface Props {
  col: ColConfig;
  issues: Issue[];
  isLoading: boolean;
  onAddClick: () => void;
  onIssueClick: (issue: Issue) => void;
}

export function KanbanColumn({ col, issues, isLoading, onAddClick, onIssueClick }: Props) {
  return (
    <div className={`kb-col ${col.cls}`}>
      {/* Header */}
      <div className="kb-col-header">
        <div className="kb-col-header-left">
          <div className="kb-col-dot" />
          <span className="kb-col-name">{col.label}</span>
          <span className="kb-col-count">{isLoading ? '–' : issues.length}</span>
        </div>
        <button className="kb-col-add-btn" onClick={onAddClick} title={`Add to ${col.label}`}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Card list (SortableJS attaches here) */}
      <div
        className="kb-card-list"
        id={`kb-list-${col.id}`}
        data-col={col.id}
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
          : issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onClick={onIssueClick}
              />
            ))
        }
      </div>

      {/* Inline add button */}
      <button className="kb-add-card-btn" onClick={onAddClick}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        Add card
      </button>
    </div>
  );
}
