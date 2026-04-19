import { Draggable } from '@hello-pangea/dnd';
import type { Issue, ProjectMember } from '@/types';

interface Props {
  issue:   Issue;
  index:   number;
  members: ProjectMember[];
  onClick: (issue: Issue) => void;
}

/* Deterministic color from any user id string */
const PALETTE: { bg: string; text: string }[] = [
  { bg: '#E3FCEF', text: '#006644' },
  { bg: '#FFAB8F', text: '#7A1F08' },
  { bg: '#B3D4FF', text: '#0747A6' },
  { bg: '#ABF5D1', text: '#006644' },
  { bg: '#EAE6FF', text: '#403294' },
  { bg: '#FFF0B3', text: '#7A5200' },
  { bg: '#FFE2E2', text: '#8B0000' },
  { bg: '#D3F1FF', text: '#003566' },
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

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
    task:    'kb-badge-feat',
    subtask: 'kb-badge-chore',
    bug:     'kb-badge-bug',
  };
  return map[t] ?? '';
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    task:    'Task',
    subtask: 'Subtask',
    bug:     'Bug',
  };
  return map[t] ?? t;
}

export function IssueCard({ issue, index, members, onClick }: Props) {
  const findUser = (id: string | null | undefined) =>
    id ? (members.find((m) => m.user.id === id)?.user ?? null) : null;

  const assignee = findUser(issue.assigneeId);
  const reporter = findUser(issue.reporterId);
  const ac = assignee ? avatarColor(assignee.id) : null;
  const rc = reporter ? avatarColor(reporter.id) : null;

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

          {/* Progress bar — shown for tasks with subtasks (even at 0%) */}
          {(issue.subtaskCount ?? 0) > 0 && (
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
              {issue.id.startsWith('issue-')
                ? `BB-${issue.id.replace('issue-', '')}`
                : issue.id.slice(0, 8).toUpperCase()}
            </span>

            <div className="kb-card-footer-right">
              {/* Story points */}
              {issue.storyPoints > 0 && (
                <span className="kb-story-points" title="Story points">
                  {issue.storyPoints}
                </span>
              )}

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

              {/* Reporter avatar */}
              {rc && reporter && (
                <div
                  className="kb-card-avatar kb-card-avatar-reporter"
                  style={{ background: rc.bg, color: rc.text }}
                  title={`Reporter: ${reporter.name}`}
                >
                  {getInitials(reporter.name)}
                </div>
              )}

              {/* Assignee avatar */}
              {ac && assignee && (
                <div
                  className="kb-card-avatar"
                  style={{ background: ac.bg, color: ac.text }}
                  title={`Assignee: ${assignee.name}`}
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
