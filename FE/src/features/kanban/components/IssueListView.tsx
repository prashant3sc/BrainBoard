import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import useAuthStore from '@/store/useAuthStore';
import type { Issue, IssueStatus, ProjectMember } from '@/types';
import { KANBAN_COLUMNS } from './KanbanBoard';

interface Props {
  issues:         Issue[];
  members:        ProjectMember[];
  isLoading:      boolean;
  searchQuery:    string;
  assigneeFilter: string[];
  projectId:      string;
  onIssueClick:   (issue: Issue) => void;
}

/* ── Helpers ── */
const PALETTE: { bg: string; text: string }[] = [
  { bg: '#E3FCEF', text: '#006644' }, { bg: '#FFAB8F', text: '#7A1F08' },
  { bg: '#B3D4FF', text: '#0747A6' }, { bg: '#ABF5D1', text: '#006644' },
  { bg: '#EAE6FF', text: '#403294' }, { bg: '#FFF0B3', text: '#7A5200' },
  { bg: '#FFE2E2', text: '#8B0000' }, { bg: '#D3F1FF', text: '#003566' },
];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function isOverdue(iso: string) {
  return new Date(iso) < new Date();
}

const STATUS_STYLE: Record<IssueStatus, { bg: string; text: string; dot: string; label: string }> = {
  todo:        { bg: '#F4F5F7', text: '#42526E', dot: '#97A0AF', label: 'To Do'        },
  in_progress: { bg: '#DEEBFF', text: '#0747A6', dot: '#0065FF', label: 'In Progress'  },
  review:      { bg: '#FFF0B3', text: '#7A5200', dot: '#FF8B00', label: 'In Review'    },
  done:        { bg: '#E3FCEF', text: '#006644', dot: '#00875A', label: 'Done'         },
};

const PRIORITY_STYLE: Record<string, { dot: string; label: string }> = {
  critical: { dot: '#DE350B', label: 'Critical' },
  high:     { dot: '#FF8B00', label: 'High'     },
  medium:   { dot: '#0065FF', label: 'Medium'   },
  low:      { dot: '#97A0AF', label: 'Low'      },
};

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  task:    { bg: '#E3FCEF', text: '#006644' },
  subtask: { bg: '#EAE6FF', text: '#403294' },
  bug:     { bg: '#FFEBE6', text: '#DE350B' },
};

/* ── Inline Status Dropdown ── */
function StatusPill({ issue, onStatusChange }: { issue: Issue; onStatusChange: (s: IssueStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const st  = STATUS_STYLE[issue.status];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="kbl-status-wrap" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
      <span className="kbl-status-pill" style={{ background: st.bg, color: st.text }}>
        <span className="kbl-status-dot" style={{ background: st.dot }} />
        {st.label}
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none" style={{ opacity: .6 }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      {open && (
        <div className="kbl-status-dropdown">
          {KANBAN_COLUMNS.map((col) => {
            const s = STATUS_STYLE[col.id];
            return (
              <div
                key={col.id}
                className={`kbl-status-option${issue.status === col.id ? ' kbl-status-option-active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onStatusChange(col.id); setOpen(false); }}
              >
                <span className="kbl-status-dot" style={{ background: s.dot }} />
                <span style={{ color: s.text }}>{s.label}</span>
                {issue.status === col.id && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto' }}>
                    <path d="M2 6l3 3 5-5" stroke="#00875A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── User Cell ── */
function UserCell({ userId, members, fallback }: { userId: string | null | undefined; members: ProjectMember[]; fallback?: { id: string; name: string } | null }) {
  if (!userId) return <span className="kbl-empty-cell">—</span>;
  const user = members.find((m) => m.user.id === userId)?.user ?? (fallback?.id === userId ? fallback : null);
  if (!user) return <span className="kbl-empty-cell">—</span>;
  const { bg, text } = avatarColor(user.id);
  return (
    <div className="kbl-user-cell">
      <div className="kbl-avatar" style={{ background: bg, color: text }} title={user.name}>
        {getInitials(user.name)}
      </div>
    </div>
  );
}

/* ── Main Component ── */
export function IssueListView({ issues, members, isLoading, searchQuery, assigneeFilter, projectId, onIssueClick }: Props) {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  function handleStatusChange(issue: Issue, newStatus: IssueStatus) {
    if (newStatus === issue.status) return;
    qc.setQueryData<Issue[]>(['issues', projectId], (old = []) =>
      old.map((i) => i.id === issue.id ? { ...i, status: newStatus } : i),
    );
    issuesApi.update(issue.id, { status: newStatus })
      .catch(() => qc.invalidateQueries({ queryKey: ['issues', projectId] }));
  }

  const q           = searchQuery.trim().toLowerCase();
  const afterSearch = q
    ? issues.filter((i) => i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    : issues;
  const filtered = assigneeFilter.length > 0
    ? afterSearch.filter((i) => i.assigneeId && assigneeFilter.includes(i.assigneeId))
    : afterSearch;

  if (isLoading) {
    return (
      <div className="kbl-wrap">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="kbl-skeleton" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="kbl-wrap">
        <div className="kbl-empty">No issues found.</div>
      </div>
    );
  }

  return (
    <div className="kbl-wrap">
      {/* Header */}
      <div className="kbl-header-row">
        <span className="kbl-hcell kbl-hcell-title">Issue</span>
        <span className="kbl-hcell kbl-hcell-status">Status</span>
        <span className="kbl-hcell kbl-hcell-priority">Priority</span>
        <span className="kbl-hcell kbl-hcell-type">Type</span>
        <span className="kbl-hcell kbl-hcell-user">Assignee</span>
        <span className="kbl-hcell kbl-hcell-user">Reporter</span>
        <span className="kbl-hcell kbl-hcell-pts">Pts</span>
        <span className="kbl-hcell kbl-hcell-due">Due</span>
        <span className="kbl-hcell kbl-hcell-progress">Progress</span>
      </div>

      {/* Groups */}
      {KANBAN_COLUMNS.map((col) => {
        const group = filtered.filter((i) => i.status === col.id);
        if (group.length === 0) return null;
        const st = STATUS_STYLE[col.id];

        return (
          <div key={col.id} className="kbl-group">
            {/* Group label */}
            <div className="kbl-group-header">
              <span className="kbl-group-dot" style={{ background: st.dot }} />
              <span className="kbl-group-name" style={{ color: st.text }}>{st.label}</span>
              <span className="kbl-group-count">{group.length}</span>
            </div>

            {/* Rows */}
            {group.map((issue) => {
              const prio    = PRIORITY_STYLE[issue.priority];
              const typeS   = issue.issueType ? TYPE_STYLE[issue.issueType] : null;
              const overdue = issue.due && issue.status !== 'done' && isOverdue(issue.due);
              const shortId = issue.id.startsWith('issue-')
                ? `BB-${issue.id.replace('issue-', '')}`
                : issue.id.slice(0, 8).toUpperCase();

              return (
                <div key={issue.id} className="kbl-row" onClick={() => onIssueClick(issue)}>

                  {/* Title */}
                  <div className="kbl-cell kbl-cell-title">
                    <span className="kbl-id">{shortId}</span>
                    <span className="kbl-title">{issue.title}</span>
                    {(issue.subtaskCount ?? 0) > 0 && (
                      <span className="kbl-sub-badge">{issue.subtaskCount} sub</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="kbl-cell kbl-cell-status">
                    <StatusPill issue={issue} onStatusChange={(s) => handleStatusChange(issue, s)} />
                  </div>

                  {/* Priority */}
                  <div className="kbl-cell kbl-cell-priority">
                    <span className="kbl-prio-dot" style={{ background: prio?.dot }} />
                    <span className="kbl-prio-label">{prio?.label ?? issue.priority}</span>
                  </div>

                  {/* Type */}
                  <div className="kbl-cell kbl-cell-type">
                    {typeS && issue.issueType && (
                      <span className="kbl-type-pill" style={{ background: typeS.bg, color: typeS.text }}>
                        {issue.issueType.charAt(0).toUpperCase() + issue.issueType.slice(1)}
                      </span>
                    )}
                  </div>

                  {/* Assignee */}
                  <div className="kbl-cell kbl-cell-user">
                    <UserCell userId={issue.assigneeId} members={members} />
                  </div>

                  {/* Reporter */}
                  <div className="kbl-cell kbl-cell-user">
                    <UserCell userId={issue.reporterId} members={members} fallback={currentUser} />
                  </div>

                  {/* Story points */}
                  <div className="kbl-cell kbl-cell-pts">
                    {issue.storyPoints > 0 && (
                      <span className="kbl-pts">{issue.storyPoints}</span>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="kbl-cell kbl-cell-due">
                    {issue.due ? (
                      <span className={`kbl-due${overdue ? ' kbl-due-overdue' : ''}`}>
                        {formatDate(issue.due)}
                      </span>
                    ) : <span className="kbl-empty-cell">—</span>}
                  </div>

                  {/* Progress */}
                  <div className="kbl-cell kbl-cell-progress">
                    {(issue.subtaskCount ?? 0) > 0 ? (
                      <div className="kbl-prog-wrap">
                        <div className="kbl-prog-bar">
                          <div className="kbl-prog-fill" style={{ width: `${issue.progress ?? 0}%` }} />
                        </div>
                        <span className="kbl-prog-pct">{issue.progress ?? 0}%</span>
                      </div>
                    ) : <span className="kbl-empty-cell">—</span>}
                  </div>

                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
