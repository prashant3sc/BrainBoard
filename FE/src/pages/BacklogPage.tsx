import { useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import { useSprints, useStartSprint, useCompleteSprint, useCreateSprint } from '@/features/projects/useSprints';
import { useRBAC } from '@/hooks/useRBAC';
import { IssueModal } from '@/features/kanban/components/IssueModal';
import type { Sprint, Issue, SprintStatus } from '@/types';
import type { AxiosError } from 'axios';

/* ─────────────────────────────────────────────
   Toast
───────────────────────────────────────────── */
function useToast() {
  const [state, setState] = useState({ msg: '', visible: false, isError: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function show(msg: string, isError = false) {
    if (timer.current) clearTimeout(timer.current);
    setState({ msg, visible: true, isError });
    timer.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), 3500);
  }
  return { toastMsg: state.msg, toastVisible: state.visible, toastIsError: state.isError, showToast: show };
}

function beError(err: unknown): string {
  const ax = err as AxiosError<{ detail?: string }>;
  return ax?.response?.data?.detail ?? 'Something went wrong';
}

/* ─────────────────────────────────────────────
   Complete Sprint Modal
───────────────────────────────────────────── */
interface CompleteModalProps {
  sprint: Sprint;
  unfinishedIssues: Issue[];
  plannedSprints: Sprint[];
  onConfirm: (action: 'backlog' | 'next_sprint', nextSprintId?: string) => void;
  onClose: () => void;
  isPending: boolean;
}

function CompleteSprintModal({ sprint, unfinishedIssues, plannedSprints, onConfirm, onClose, isPending }: CompleteModalProps) {
  const [action, setAction] = useState<'backlog' | 'next_sprint'>('backlog');
  const [nextSprintId, setNextSprintId] = useState(plannedSprints[0]?.id ?? '');

  function handleConfirm() {
    if (action === 'next_sprint' && !nextSprintId) return;
    onConfirm(action, action === 'next_sprint' ? nextSprintId : undefined);
  }

  return (
    <div className="kb-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kb-modal-wide bb-modal-animate" style={{ maxWidth: 480 }}>
        <div className="kb-modal-header">
          <span className="kb-modal-title">Complete "{sprint.name}"</span>
          <button className="kb-modal-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {unfinishedIssues.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--bb-bl-count)', margin: 0 }}>
              All issues are done. Sprint will be closed.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--bb-bl-count)', margin: 0 }}>
                <strong>{unfinishedIssues.length}</strong> unfinished {unfinishedIssues.length === 1 ? 'issue' : 'issues'} remaining. Where should they go?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" name="action" value="backlog" checked={action === 'backlog'} onChange={() => setAction('backlog')} />
                  Move to <strong>Backlog</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', opacity: plannedSprints.length === 0 ? 0.4 : 1 }}>
                  <input
                    type="radio"
                    name="action"
                    value="next_sprint"
                    checked={action === 'next_sprint'}
                    disabled={plannedSprints.length === 0}
                    onChange={() => setAction('next_sprint')}
                  />
                  Move to <strong>Sprint</strong>
                  {plannedSprints.length === 0 && <span style={{ fontSize: 11, opacity: 0.6 }}>(no planned sprints)</span>}
                </label>

                {action === 'next_sprint' && plannedSprints.length > 0 && (
                  <select
                    className="kb-input kb-select"
                    value={nextSprintId}
                    onChange={(e) => setNextSprintId(e.target.value)}
                    style={{ marginLeft: 24 }}
                  >
                    {plannedSprints.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}
        </div>

        <div className="kb-modal-footer">
          <div />
          <div className="kb-modal-footer-right">
            <button className="kb-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="kb-btn-create" onClick={handleConfirm} disabled={isPending}>
              {isPending ? 'Completing…' : 'Complete Sprint'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Create Sprint Modal
───────────────────────────────────────────── */
interface CreateSprintModalProps {
  onConfirm: (name: string, goal: string, startDate: string, endDate: string) => void;
  onClose: () => void;
  isPending: boolean;
}

function CreateSprintModal({ onConfirm, onClose, isPending }: CreateSprintModalProps) {
  const [name,      setName]      = useState('');
  const [goal,      setGoal]      = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [dateErr,   setDateErr]   = useState('');

  function handleConfirm() {
    if (startDate && endDate && endDate < startDate) {
      setDateErr('End date must be after start date.');
      return;
    }
    setDateErr('');
    onConfirm(name.trim(), goal.trim(), startDate, endDate);
  }

  return (
    <div className="kb-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kb-modal-wide bb-modal-animate" style={{ maxWidth: 420 }}>
        <div className="kb-modal-header">
          <span className="kb-modal-title">Create Sprint</span>
          <button className="kb-modal-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="kb-field">
            <label className="kb-label">Sprint name <span className="kb-required">*</span></label>
            <input className="kb-input" placeholder="e.g. Sprint 14" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="kb-field">
            <label className="kb-label">Goal</label>
            <input className="kb-input" placeholder="What is the sprint goal?" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="kb-row2">
            <div className="kb-field">
              <label className="kb-label">Start date</label>
              <input type="date" className="kb-input" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDateErr(''); }} />
            </div>
            <div className="kb-field">
              <label className="kb-label">End date</label>
              <input type="date" className="kb-input" value={endDate} min={startDate || undefined} onChange={(e) => { setEndDate(e.target.value); setDateErr(''); }} />
            </div>
          </div>
          {dateErr && <span style={{ fontSize: 12, color: '#DE350B', marginTop: -6 }}>{dateErr}</span>}
        </div>
        <div className="kb-modal-footer">
          <div />
          <div className="kb-modal-footer-right">
            <button className="kb-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="kb-btn-create" disabled={!name.trim() || isPending} onClick={handleConfirm}>
              {isPending ? 'Creating…' : 'Create Sprint'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Issue Row
───────────────────────────────────────────── */
const STATUS_LABEL: Record<string, string> = {
  todo: 'To do', in_progress: 'In progress', done: 'Done', review: 'In review',
};
const STATUS_CLASS: Record<string, string> = {
  todo: 'bb-status-badge bb-st-todo', in_progress: 'bb-status-badge bb-st-prog',
  done: 'bb-status-badge bb-st-done', review: 'bb-status-badge bb-st-review',
};
const PRIORITY_CLASS: Record<string, string> = {
  critical: 'bb-badge bb-badge-critical', high: 'bb-badge bb-badge-high',
  medium: 'bb-badge bb-badge-medium',    low:  'bb-badge bb-badge-low',
};

function IssueRow({ issue, onClick }: { issue: Issue; onClick?: () => void }) {
  return (
    <div className="bb-issue-row" onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <span className="bb-issue-key">{issue.ticketId ?? issue.id.slice(0, 8).toUpperCase()}</span>
      <span className="bb-issue-summary">{issue.title}</span>
      <div className="bb-issue-labels">
        <span className={PRIORITY_CLASS[issue.priority] ?? 'bb-badge'}>{issue.priority}</span>
        {issue.issueType && <span className="bb-badge">{issue.issueType}</span>}
      </div>
      <span className={STATUS_CLASS[issue.status] ?? 'bb-status-badge'}>{STATUS_LABEL[issue.status] ?? issue.status}</span>
      <span className="bb-story-pts">{issue.storyPoints ?? '—'}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Sprint Block
───────────────────────────────────────────── */
interface SprintBlockProps {
  sprint: Sprint;
  issues: Issue[];
  search: string;
  collapsed: boolean;
  onToggle: () => void;
  canManage: boolean;
  plannedSprints: Sprint[];
  onStart: () => void;
  onComplete: (sprint: Sprint, unfinished: Issue[]) => void;
  onIssueClick: (issue: Issue) => void;
}

function SprintBlock({ sprint, issues, search, collapsed, onToggle, canManage, onStart, onComplete, onIssueClick }: SprintBlockProps) {
  const q = search.toLowerCase();
  const filtered = search.trim()
    ? issues.filter((i) => i.title.toLowerCase().includes(q))
    : issues;

  const done       = issues.filter((i) => i.status === 'done').length;
  const storyPts   = issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const progress   = issues.length > 0 ? Math.round((done / issues.length) * 100) : 0;
  const unfinished = issues.filter((i) => i.status !== 'done');

  const isActive    = sprint.status === 'active';
  const isPlanned   = sprint.status === 'planned';
  const isCompleted = sprint.status === 'completed';

  return (
    <div className="bb-sprint-block">
      <div className="bb-sprint-header" onClick={onToggle}>
        <span className={`bb-sprint-chevron${collapsed ? '' : ' open'}`}>▶</span>
        <span className="bb-sprint-name">{sprint.name}</span>

        {isActive    && <span className="bb-sprint-tag bb-sprint-tag-active">Active</span>}
        {isPlanned   && <span className="bb-sprint-tag bb-sprint-tag-upcoming">Planned</span>}
        {isCompleted && <span className="bb-sprint-tag bb-sprint-tag-completed">Completed</span>}

        {(sprint.startDate || sprint.endDate) && (
          <span className="bb-sprint-dates">
            {sprint.startDate ?? '?'} – {sprint.endDate ?? '?'}
          </span>
        )}

        <span className="bb-sprint-count">
          {issues.length} issues · {storyPts} pts
        </span>

        <span style={{ flex: 1 }} />

        {canManage && isPlanned && (
          <button className="bb-sprint-action" onClick={(e) => { e.stopPropagation(); onStart(); }}>
            Start sprint
          </button>
        )}
        {canManage && isActive && (
          <button className="bb-sprint-action" onClick={(e) => { e.stopPropagation(); onComplete(sprint, unfinished); }}>
            Complete sprint
          </button>
        )}
      </div>

      {!collapsed && (
        <div>
          {isActive && issues.length > 0 && (
            <>
              <div className="bb-stats-strip">
                <div className="bb-stat-item"><div className="bb-stat-dot bb-dot-done" />{done} done</div>
                <div className="bb-stat-item"><div className="bb-stat-dot bb-dot-prog" />{issues.filter(i => i.status === 'in_progress').length} in progress</div>
                <div className="bb-stat-item"><div className="bb-stat-dot bb-dot-review" />{issues.filter(i => i.status === 'review').length} in review</div>
                <div className="bb-stat-item"><div className="bb-stat-dot bb-dot-todo" />{issues.filter(i => i.status === 'todo').length} to do</div>
              </div>
              <div className="bb-sprint-progress">
                <span className="bb-progress-label">{done} / {issues.length}</span>
                <div className="bb-progress-bar">
                  <div className="bb-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="bb-progress-label">{progress}% complete</span>
              </div>
            </>
          )}
          <div className="bb-issue-list">
            {filtered.length === 0
              ? <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--bb-bl-count)', fontStyle: 'italic' }}>No issues.</div>
              : filtered.map((i) => <IssueRow key={i.id} issue={i} onClick={() => onIssueClick(i)} />)
            }
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Backlog Block (issues with no sprint)
───────────────────────────────────────────── */
function BacklogBlock({ issues, search, collapsed, onToggle, canManage, onCreateSprint, onIssueClick }: {
  issues: Issue[]; search: string; collapsed: boolean; onToggle: () => void; canManage: boolean; onCreateSprint: () => void; onIssueClick: (issue: Issue) => void;
}) {
  const q = search.toLowerCase();
  const filtered = search.trim() ? issues.filter((i) => i.title.toLowerCase().includes(q)) : issues;

  return (
    <div className="bb-sprint-block">
      <div className="bb-sprint-header" onClick={onToggle}>
        <span className={`bb-sprint-chevron${collapsed ? '' : ' open'}`}>▶</span>
        <span className="bb-sprint-name">Backlog</span>
        <span className="bb-sprint-count">{issues.length} issues</span>
        <span style={{ flex: 1 }} />
        {canManage && (
          <button className="bb-sprint-action" onClick={(e) => { e.stopPropagation(); onCreateSprint(); }}>
            + Create sprint
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="bb-issue-list">
          {filtered.length === 0
            ? <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--bb-bl-count)', fontStyle: 'italic' }}>No backlog issues.</div>
            : filtered.map((i) => <IssueRow key={i.id} issue={i} onClick={() => onIssueClick(i)} />)
          }
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function BacklogPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { can } = useRBAC();
  const canManage = can('createProject'); // admin + pm

  const { data: sprints = [], isLoading: sprintsLoading } = useSprints(projectId);
  const { data: allIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => issuesApi.getAll(projectId),
    enabled: !!projectId,
  });

  const startSprint    = useStartSprint();
  const completeSprint = useCompleteSprint();
  const createSprint   = useCreateSprint();

  const { toastMsg, toastVisible, toastIsError, showToast } = useToast();

  const [collapsed,          setCollapsed]          = useState<Record<string, boolean>>({});
  const [search,             setSearch]             = useState('');
  const [completeModal,      setCompleteModal]      = useState<{ sprint: Sprint; unfinished: Issue[] } | null>(null);
  const [showCreateModal,    setShowCreateModal]    = useState(false);
  const [issueModalOpen,     setIssueModalOpen]     = useState(false);
  const [selectedIssue,      setSelectedIssue]      = useState<Issue | null>(null);

  // Group issues by sprintId
  const issuesBySprint = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    for (const issue of allIssues) {
      const key = issue.sprintId ?? '__backlog__';
      if (!map[key]) map[key] = [];
      map[key].push(issue);
    }
    return map;
  }, [allIssues]);

  const backlogIssues = issuesBySprint['__backlog__'] ?? [];

  // Planned sprints for the complete modal dropdown
  const plannedSprints = sprints.filter((s) => s.status === 'planned');

  // Sort: active first, then planned, then completed
  const statusOrder: Record<SprintStatus, number> = { active: 0, planned: 1, completed: 2 };
  const visibleSprints = [...sprints].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const totalIssues = allIssues.length;

  function handleStartSprint(sprint: Sprint) {
    startSprint.mutate(
      { sprintId: sprint.id, projectId },
      {
        onSuccess: () => showToast(`${sprint.name} is now active`),
        onError:   (err) => showToast(beError(err), true),
      },
    );
  }

  function handleOpenCompleteModal(sprint: Sprint, unfinished: Issue[]) {
    setCompleteModal({ sprint, unfinished });
  }

  function handleConfirmComplete(action: 'backlog' | 'next_sprint', nextSprintId?: string) {
    if (!completeModal) return;
    completeSprint.mutate(
      { sprintId: completeModal.sprint.id, projectId, dto: { unfinishedAction: action, nextSprintId } },
      {
        onSuccess: () => { setCompleteModal(null); showToast(`${completeModal.sprint.name} completed`); },
        onError:   (err) => { setCompleteModal(null); showToast(beError(err), true); },
      },
    );
  }

  function handleCreateSprint(name: string, goal: string, startDate: string, endDate: string) {
    createSprint.mutate(
      { projectId, name, goal, startDate: startDate || undefined, endDate: endDate || undefined },
      {
        onSuccess: () => { setShowCreateModal(false); showToast(`${name} created`); },
        onError:   (err) => showToast(beError(err), true),
      },
    );
  }

  if (sprintsLoading || issuesLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--bb-bl-count)', fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bb-content-bg)' }}>

      {/* Topbar */}
      <div style={{ height: 52, background: 'var(--bb-topbar-bg)', borderBottom: '1px solid var(--bb-topbar-border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-page-title)' }}>Backlog</div>
          <div style={{ fontSize: 11, color: 'var(--bb-bc-root)', marginTop: 2 }}>
            BrainBoard <span style={{ color: 'var(--bb-bc-sep)' }}>›</span>{' '}
            <span style={{ color: '#E75026' }}>BB</span>{' '}
            <span style={{ color: 'var(--bb-bc-sep)' }}>›</span>{' '}
            <span style={{ color: 'var(--bb-bc-current)' }}>Backlog</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="bb-bl-tb-btn bb-bl-tb-btn-primary" onClick={() => { setSelectedIssue(null); setIssueModalOpen(true); }}>+ Create issue</button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="bb-bl-search-box">
            <span style={{ color: 'var(--bb-bl-count)', fontSize: 13 }}>🔍</span>
            <input
              className="bb-bl-search-input"
              placeholder="Search issues…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--bb-bl-count)' }}>
            {totalIssues} issues total
          </span>
        </div>

        {/* Sprint blocks */}
        {visibleSprints.map((sprint) => (
          <SprintBlock
            key={sprint.id}
            sprint={sprint}
            issues={issuesBySprint[sprint.id] ?? []}
            search={search}
            collapsed={sprint.id in collapsed ? !!collapsed[sprint.id] : sprint.status === 'completed'}
            onToggle={() => setCollapsed((p) => ({ ...p, [sprint.id]: !p[sprint.id] }))}
            canManage={canManage}
            plannedSprints={plannedSprints}
            onStart={() => handleStartSprint(sprint)}
            onComplete={handleOpenCompleteModal}
            onIssueClick={(issue) => { setSelectedIssue(issue); setIssueModalOpen(true); }}
          />
        ))}

        {/* Backlog block */}
        <BacklogBlock
          issues={backlogIssues}
          search={search}
          collapsed={!!collapsed['__backlog__']}
          onToggle={() => setCollapsed((p) => ({ ...p, __backlog__: !p.__backlog__ }))}
          canManage={canManage}
          onCreateSprint={() => setShowCreateModal(true)}
          onIssueClick={(issue) => { setSelectedIssue(issue); setIssueModalOpen(true); }}
        />
      </div>

      {/* Create / Edit Issue Modal */}
      <IssueModal
        issue={selectedIssue}
        isOpen={issueModalOpen}
        projectId={projectId}
        onClose={() => { setIssueModalOpen(false); setSelectedIssue(null); }}
        onNavigate={(issue) => { setSelectedIssue(issue); setIssueModalOpen(true); }}
      />

      {/* Complete Sprint Modal */}
      {completeModal && (
        <CompleteSprintModal
          sprint={completeModal.sprint}
          unfinishedIssues={completeModal.unfinished}
          plannedSprints={plannedSprints}
          onConfirm={handleConfirmComplete}
          onClose={() => setCompleteModal(null)}
          isPending={completeSprint.isPending}
        />
      )}

      {/* Create Sprint Modal */}
      {showCreateModal && (
        <CreateSprintModal
          onConfirm={handleCreateSprint}
          onClose={() => setShowCreateModal(false)}
          isPending={createSprint.isPending}
        />
      )}

      {/* Toast */}
      <div
        className={`bb-toast${toastVisible ? ' bb-toast-show' : ''}`}
        style={toastIsError ? { background: '#FFF0EE', borderColor: '#FFBDAD' } : {}}
      >
        {toastIsError ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#DE350B" strokeWidth="1.4"/>
            <path d="M7 4v3M7 9.5v.5" stroke="#DE350B" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#00875A" strokeWidth="1.4"/>
            <path d="M4 7l2 2 4-4" stroke="#00875A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        <span style={toastIsError ? { color: '#DE350B' } : {}}>{toastMsg}</span>
      </div>
    </div>
  );
}
