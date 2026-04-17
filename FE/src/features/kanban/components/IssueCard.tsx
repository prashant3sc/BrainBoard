import { Draggable } from '@hello-pangea/dnd';
import type { Issue } from '@/types';
import { mockUsers } from '@/mocks/users';

interface Props {
  issue:   Issue;
  index:   number;
  onClick: (issue: Issue) => void;
}

/* ── Assignee colour map (per user-id) ── */
const ASSIGNEE_COLORS: Record<string, { bg: string; text: string }> = {
  'user-1': { bg: '#E3FCEF', text: '#006644' },
  'user-2': { bg: '#FFAB8F', text: '#7A1F08' },
  'user-3': { bg: '#B3D4FF', text: '#0747A6' },
  'user-4': { bg: '#ABF5D1', text: '#006644' },
  'user-5': { bg: '#EAE6FF', text: '#403294' },
};

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  const dt = new Date(iso);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isOverdue(iso: string) {
  return new Date(iso) < new Date();
}

function priorityClass(p: string) {
  const map: Record<string, string> = {
    critical: 'kb-badge-critical',
    high:     'kb-badge-high',
    medium:   'kb-badge-medium',
    low:      'kb-badge-low',
  };
  return map[p] ?? '';
}

function priorityLabel(p: string) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function typeClass(t: string) {
  const map: Record<string, string> = {
    feat:   'kb-badge-feat',
    bug:    'kb-badge-bug',
    chore:  'kb-badge-chore',
    design: 'kb-badge-design',
  };
  return map[t] ?? '';
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    feat:   'Feature',
    bug:    'Bug',
    chore:  'Chore',
    design: 'Design',
  };
  return map[t] ?? t;
}

export function IssueCard({ issue, index, onClick }: Props) {
  const assignee = issue.assigneeId ? mockUsers.find((u) => u.id === issue.assigneeId) ?? null : null;
  const ac = assignee ? (ASSIGNEE_COLORS[assignee.id] ?? { bg: '#F4F5F7', text: '#42526E' }) : null;

  const overdueDate = issue.due && issue.status !== 'done' && isOverdue(issue.due);
  const progress = issue.progress ?? 0;
  const isDone   = issue.status === 'done';

  return (
    <Draggable draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          className="kb-card"
          data-id={issue.id}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(issue)}
          style={{
            ...provided.draggableProps.style,
            opacity:   snapshot.isDragging ? 0.85 : 1,
            boxShadow: snapshot.isDragging
              ? '0 8px 24px rgba(0,0,0,0.18)'
              : undefined,
          }}
        >
          {/* Top row: badges + menu */}
          <div className="kb-card-top">
            <div className="kb-card-badges">
              <span className={`kb-badge ${priorityClass(issue.priority)}`}>
                {priorityLabel(issue.priority)}
              </span>
              {issue.issueType && (
                <span className={`kb-badge ${typeClass(issue.issueType)}`}>
                  {typeLabel(issue.issueType)}
                </span>
              )}
            </div>
            <button
              className="kb-card-menu-btn"
              onClick={(e) => e.stopPropagation()}
              title="Options"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="3"  r="1.2" fill="currentColor"/>
                <circle cx="8" cy="8"  r="1.2" fill="currentColor"/>
                <circle cx="8" cy="13" r="1.2" fill="currentColor"/>
              </svg>
            </button>
          </div>

          {/* Title */}
          <div className="kb-card-title">{issue.title}</div>

          {/* Progress bar (only when > 0) */}
          {progress > 0 && (
            <div className="kb-card-progress">
              <div className="kb-card-progress-label">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="kb-card-progress-bar">
                <div
                  className={`kb-card-progress-fill${isDone ? ' kb-card-progress-done' : ''}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer: id | subtasks + date + avatar */}
          <div className="kb-card-meta">
            <span className="kb-card-id">
              {issue.id.startsWith('issue-') ? `BB-${issue.id.replace('issue-', '')}` : issue.id}
            </span>

            <div className="kb-card-footer-right">
              {/* Subtask count */}
              {(issue.subtaskCount ?? 0) > 0 && (
                <span className="kb-subtask-count">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 3h8M2 6h5M2 9h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {issue.subtaskCount}
                </span>
              )}

              {/* Due date */}
              {issue.due && (
                <span className={`kb-card-date${overdueDate ? ' kb-card-date-overdue' : ''}`}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4 1v2M8 1v2M1 5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {formatDate(issue.due)}
                </span>
              )}

              {/* Assignee avatar */}
              {ac && assignee && (
                <div
                  className="kb-card-avatar"
                  style={{ background: ac.bg, color: ac.text }}
                  title={assignee.name}
                >
                  {getInitials(assignee.name)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
