import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import { useRBAC } from '@/hooks/useRBAC';
import { useProjectMembers } from '@/features/projects/useProjects';
import { useActiveSprint, useSprints } from '@/features/projects/useSprints';
import useAuthStore from '@/store/useAuthStore';
import type { Issue, IssueStatus, Priority, IssueType } from '@/types';
import { KANBAN_COLUMNS } from './KanbanBoard';
import { useAIAnalysis } from '@/features/ai/useAIAnalysis';
import { AIAnalysisPanel } from '@/features/ai/components/AIAnalysisPanel';
import type { RecommendedUser } from '@/api/ai';

type Destination = 'backlog' | 'sprint';

interface Props {
  issue: Issue | null;   // null → create mode
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onNavigate?: (issue: Issue) => void;
}

const PRIORITIES: Priority[]   = ['critical', 'high', 'medium', 'low'];
const ISSUE_TYPES: IssueType[] = ['task', 'subtask', 'bug'];

const TYPE_LABELS: Record<IssueType, string> = {
  task:    'Task',
  subtask: 'Subtask',
  bug:     'Bug',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
  low:      'Low',
};

export function IssueModal({ issue, isOpen, projectId, onClose, onNavigate }: Props) {
  const isEdit  = issue !== null;
  const { can } = useRBAC();
  const qc      = useQueryClient();
  const canEdit = can('editIssue');
  const canDel  = can('deleteIssue');
  const canAI   = can('analyzeIssue');
  const { analysis: aiResult, isLoading: aiLoading, error: aiError, analyze, clear: clearAI } = useAIAnalysis();
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: activeSprintData } = useActiveSprint(projectId);
  const activeSprintId = activeSprintData?.sprint?.id ?? null;
  const { data: sprints = [] } = useSprints(projectId);
  const isInPlannedSprint = isEdit && !!issue?.sprintId &&
    sprints.some((s) => s.id === issue.sprintId && s.status === 'planned');
  const isInCompletedSprint = isEdit && !!issue?.sprintId &&
    sprints.some((s) => s.id === issue.sprintId && s.status === 'completed');
  const isReadOnly = isInPlannedSprint || isInCompletedSprint;
  const currentUser = useAuthStore((s) => s.user);

  /* All non-subtask issues in this project — used as parent candidates */
  const { data: allIssues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn:  () => issuesApi.getAll(projectId),
    enabled:  !!projectId,
  });
  const parentCandidates = allIssues.filter(
    (i) => i.issueType !== 'subtask' && (!isEdit || i.id !== issue?.id),
  );
  const subtasks = isEdit && issue?.issueType !== 'subtask'
    ? allIssues.filter((i) => i.parentId === issue?.id)
    : [];

  const [title,       setTitle]       = useState('');
  const [desc,        setDesc]        = useState('');
  const [status,      setStatus]      = useState<IssueStatus>('todo');
  const [priority,    setPriority]    = useState<Priority>('medium');
  const [issueType,   setIssueType]   = useState<IssueType>('task');
  const [assigneeId,  setAssigneeId]  = useState('');
  const [reporterId,  setReporterId]  = useState('');
  const [parentId,    setParentId]    = useState('');
  const [due,         setDue]         = useState('');
  const [points,      setPoints]      = useState(3);
  const [titleErr,    setTitleErr]    = useState(false);
  const [parentErr,   setParentErr]   = useState(false);
  const [destination, setDestination] = useState<Destination>('backlog');

  /* Clear AI state when modal closes or switches issue */
  useEffect(() => { clearAI(); }, [issue?.id, isOpen]);

  /* Sync form when opening */
  useEffect(() => {
    if (!isOpen) return;
    setTitle(issue?.title       ?? '');
    setDesc(issue?.description  ?? '');
    setStatus(issue?.status     ?? 'todo');
    setPriority(issue?.priority ?? 'medium');
    setIssueType(issue?.issueType ?? 'task');
    setAssigneeId(issue?.assigneeId ?? '');
    setReporterId(issue?.reporterId ?? currentUser?.id ?? '');
    setParentId(issue?.parentId ?? '');
    setDue(issue?.due ?? '');
    setPoints(issue?.storyPoints ?? 3);
    setTitleErr(false);
    setParentErr(false);
    // In edit mode, pre-select based on issue's current sprint
    if (issue?.sprintId) {
      setDestination('sprint');
    } else {
      setDestination('backlog');
    }
  }, [issue, isOpen]);

  function close() { onClose(); }

  function invalidateAndClose() {
    qc.invalidateQueries({ queryKey: ['issues', projectId] });
    close();
  }

  const createMut = useMutation({
    mutationFn: () =>
      issuesApi.create({
        title,
        description: desc,
        status:      'todo',
        priority,
        storyPoints: points,
        assigneeId:  assigneeId || null,
        reporterId:  reporterId || null,
        parentId:    issueType === 'subtask' ? (parentId || null) : null,
        projectId,
        issueType,
        due: due || null,
        sprintId: destination === 'sprint' ? activeSprintId : null,
      }),
    onSuccess: invalidateAndClose,
  });

  const updateMut = useMutation({
    mutationFn: () =>
      issuesApi.update(issue!.id, {
        title,
        description: desc,
        priority,
        status,
        storyPoints: points,
        assigneeId:  assigneeId || null,
        reporterId:  reporterId || null,
        parentId:    issueType === 'subtask' ? (parentId || null) : null,
        issueType,
        due: due || null,
        sprintId: destination === 'sprint' ? activeSprintId : null,
      }),
    onSuccess: invalidateAndClose,
  });

  const deleteMut = useMutation({
    mutationFn: () => issuesApi.remove(issue!.id),
    onSuccess: invalidateAndClose,
  });

  const isPending = createMut.isPending || updateMut.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setTitleErr(true); return; }
    if (issueType === 'subtask' && !parentId) { setParentErr(true); return; }
    isEdit ? updateMut.mutate() : createMut.mutate();
  }

  /* Overlay click → close */
  function handleOverlay(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) close();
  }

  /* Escape key → close */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  if (!isOpen) return null;

  const reporterName = isEdit
    ? (members.find((m) => m.user.id === reporterId)?.user.name ?? currentUser?.name ?? '—')
    : (currentUser?.name ?? '—');

  return (
    <div className="kb-modal-overlay" onClick={handleOverlay}>
      <div className="kb-modal-wide bb-modal-animate">

        {/* Header */}
        <div className="kb-modal-header">
          <div className="kb-modal-header-left">
            <div className="kb-modal-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="4" height="14" rx="1" fill="#E75026"/>
                <rect x="7" y="4" width="4" height="11" rx="1" fill="#E75026"/>
                <rect x="13" y="7" width="2" height="8"  rx="1" fill="#E75026"/>
              </svg>
            </div>
            <span className="kb-modal-title">
              {isEdit ? 'Edit issue' : 'Create new card'}
            </span>
          </div>
          <button className="kb-modal-close" onClick={close}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Read-only banners */}
        {isInPlannedSprint && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: '#FFF9E6', borderBottom: '1px solid #FFE58F', fontSize: 12, color: '#7A5200' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="#F5A623" strokeWidth="1.4"/>
              <path d="M8 5v4M8 11v.5" stroke="#F5A623" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            This issue is in a planned sprint that hasn't started yet. Editing is disabled.
          </div>
        )}
        {isInCompletedSprint && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: '#F4F5F7', borderBottom: '1px solid #DFE1E6', fontSize: 12, color: '#6B778C' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="#6B778C" strokeWidth="1.4"/>
              <path d="M5 8l2 2 4-4" stroke="#6B778C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            This issue belongs to a completed sprint and is read-only.
          </div>
        )}

        {/* Two-column body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="kb-modal-cols">

            {/* ── Left: Title + Description ── */}
            <div className="kb-modal-col-main">
              <div className="kb-field">
                <label className="kb-label">Title <span className="kb-required">*</span></label>
                <input
                  className={`kb-input${titleErr ? ' kb-input-error' : ''}`}
                  placeholder="e.g. Fix login timeout on Safari"
                  value={title}
                  disabled={!canEdit || isReadOnly}
                  onChange={(e) => { setTitle(e.target.value); setTitleErr(false); }}
                />
              </div>

              <div className="kb-field" style={{ flex: 1 }}>
                <label className="kb-label">Description</label>
                <textarea
                  className="kb-input kb-textarea-tall"
                  placeholder="What needs to be done? Add context, steps to reproduce, acceptance criteria…"
                  value={desc}
                  disabled={!canEdit || isReadOnly}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              {/* AI Analyze — edit mode only, for users who can edit */}
              {isEdit && canAI && !isReadOnly && (
                <div className="kb-field">
                  {!aiResult && (
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => analyze(issue!.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '7px 14px', borderRadius: 7,
                        border: '1.5px solid #6366F1',
                        background: aiLoading ? '#EEF2FF' : 'white',
                        color: '#4F46E5', fontSize: 12, fontWeight: 600,
                        cursor: aiLoading ? 'not-allowed' : 'pointer',
                        width: 'fit-content', transition: 'background 0.15s',
                      }}
                    >
                      {aiLoading ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                            <circle cx="8" cy="8" r="6" stroke="#6366F1" strokeWidth="2" strokeDasharray="20 18"/>
                          </svg>
                          Analyzing…
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z"
                              fill="#6366F1" strokeLinejoin="round"/>
                          </svg>
                          Analyze with AI
                        </>
                      )}
                    </button>
                  )}
                  {aiError && (
                    <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5.5" stroke="#DC2626" strokeWidth="1.3"/>
                        <path d="M7 4.5v3M7 9.5v.5" stroke="#DC2626" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      {aiError}
                      <button type="button" onClick={() => analyze(issue!.id)}
                        style={{ background: 'none', border: 'none', color: '#4F46E5', fontSize: 12, cursor: 'pointer', padding: 0, marginLeft: 4 }}>
                        Retry
                      </button>
                    </div>
                  )}
                  {aiResult && (
                    <AIAnalysisPanel
                      result={aiResult}
                      onApplyPoints={(pts) => setPoints(pts)}
                      onApplyAssignee={(user: RecommendedUser) => setAssigneeId(user.id)}
                      onClose={clearAI}
                    />
                  )}
                </div>
              )}

              {/* Destination — create mode; Location — edit mode */}
              {(!isEdit || (isEdit && !isReadOnly)) && (
                <div className="kb-field">
                  <label className="kb-label">{isEdit ? 'Location' : 'Add to'} {!isEdit && <span className="kb-required">*</span>}</label>
                  <div className="kb-destination-group">
                    <label className={`kb-dest-option${destination === 'backlog' ? ' kb-dest-active' : ''}${isReadOnly ? ' kb-dest-disabled' : ''}`}>
                      <input type="radio" name="destination" value="backlog" checked={destination === 'backlog'} disabled={isReadOnly} onChange={() => setDestination('backlog')} />
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="3" width="12" height="2" rx="1" fill="currentColor"/>
                        <rect x="1" y="7" width="12" height="2" rx="1" fill="currentColor"/>
                        <rect x="1" y="11" width="7" height="2" rx="1" fill="currentColor"/>
                      </svg>
                      Backlog
                    </label>
                    <label className={`kb-dest-option${destination === 'sprint' ? ' kb-dest-active' : ''}${(!activeSprintId || isReadOnly) ? ' kb-dest-disabled' : ''}`}>
                      <input type="radio" name="destination" value="sprint" checked={destination === 'sprint'} disabled={!activeSprintId || isReadOnly} onChange={() => setDestination('sprint')} />
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7a5 5 0 0 1 9.5-2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        <path d="M12 7a5 5 0 0 1-9.5 2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        <path d="M11.5 2.5l.5 2.3-2.3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Current Sprint{!activeSprintId && <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>(none active)</span>}
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* ── Divider ── */}
            <div className="kb-modal-col-divider" />

            {/* ── Right: All metadata ── */}
            <div className="kb-modal-col-meta">

              {isEdit && (
                <div className="kb-field">
                  <label className="kb-label">Status</label>
                  <select className="kb-input kb-select" value={status} disabled={!canEdit || isReadOnly} onChange={(e) => setStatus(e.target.value as IssueStatus)}>
                    {KANBAN_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              )}

              <div className="kb-field">
                <label className="kb-label">Type</label>
                <select
                  className="kb-input kb-select"
                  value={issueType}
                  disabled={!canEdit || isReadOnly}
                  onChange={(e) => {
                    setIssueType(e.target.value as IssueType);
                    setParentErr(false);
                    if (e.target.value !== 'subtask') setParentId('');
                  }}
                >
                  {ISSUE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>

              <div className="kb-field">
                <label className="kb-label">Priority</label>
                <select className="kb-input kb-select" value={priority} disabled={!canEdit || isReadOnly} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                </select>
              </div>

              <div className="kb-field">
                <label className="kb-label">Assignee</label>
                <select className="kb-input kb-select" value={assigneeId} disabled={!canEdit || isReadOnly} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
                </select>
              </div>

              <div className="kb-field">
                <label className="kb-label">Reporter</label>
                <div className="kb-reporter-display">{reporterName}</div>
              </div>

              <div className="kb-row2">
                <div className="kb-field">
                  <label className="kb-label">Story points</label>
                  <input type="number" min={1} max={13} className="kb-input" value={points} disabled={!canEdit || isReadOnly} onChange={(e) => setPoints(Number(e.target.value))} />
                </div>
                <div className="kb-field">
                  <label className="kb-label">Due date</label>
                  <input type="date" className="kb-input" value={due} disabled={!canEdit || isReadOnly} onChange={(e) => setDue(e.target.value)} />
                </div>
              </div>

              {/* Parent issue — subtask only */}
              {issueType === 'subtask' && (
                <div className="kb-field">
                  <label className="kb-label">Parent issue <span className="kb-required">*</span></label>
                  <select
                    className={`kb-input kb-select${parentErr ? ' kb-input-error' : ''}`}
                    value={parentId}
                    disabled={!canEdit || isReadOnly}
                    onChange={(e) => { setParentId(e.target.value); setParentErr(false); }}
                  >
                    <option value="">— Select parent issue —</option>
                    {parentCandidates.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.id.startsWith('issue-') ? `BB-${i.id.replace('issue-', '')}` : i.id.slice(0, 8).toUpperCase()} — {i.title}
                      </option>
                    ))}
                  </select>
                  {parentErr && <span style={{ fontSize: 12, color: '#DE350B', marginTop: 2 }}>Parent issue is required for subtasks.</span>}
                  {isEdit && parentId && onNavigate && (() => {
                    const parent = allIssues.find((i) => i.id === parentId);
                    return parent ? (
                      <button type="button" className="kb-parent-link" onClick={() => { close(); onNavigate(parent); }}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Go to parent issue
                      </button>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Subtasks — shown on parent issues in edit mode */}
              {subtasks.length > 0 && (
                <div className="kb-field">
                  <label className="kb-label">
                    Subtasks
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: 'var(--bb-bl-count)' }}>
                      {subtasks.filter((s) => s.status === 'done').length}/{subtasks.length} done
                    </span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                    {subtasks.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="kb-subtask-row"
                        onClick={() => onNavigate && (close(), onNavigate(s))}
                      >
                        <span className={`kb-subtask-dot kb-subtask-dot-${s.status}`} />
                        <span className="kb-subtask-key">{s.id.slice(0, 8).toUpperCase()}</span>
                        <span className="kb-subtask-title">{s.title}</span>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.4 }}>
                          <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Footer */}
          <div className="kb-modal-footer">
            {isEdit ? (
              <>
                <div>
                  {canDel && (
                    <button type="button" className="kb-btn-danger" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate()}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {deleteMut.isPending ? 'Deleting…' : 'Delete issue'}
                    </button>
                  )}
                </div>
                <div className="kb-modal-footer-right">
                  <button type="button" className="kb-btn-ghost" onClick={close}>Cancel</button>
                  {canEdit && !isReadOnly && (
                    <button type="submit" className="kb-btn-create" disabled={isPending}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l3.5 3.5L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {isPending ? 'Saving…' : 'Save changes'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="kb-modal-hint">Fields marked <span style={{ color: '#DE350B' }}>*</span> are required</span>
                </div>
                <div className="kb-modal-footer-right">
                  <button type="button" className="kb-btn-ghost" onClick={close}>Cancel</button>
                  {canEdit && (
                    <button type="submit" className="kb-btn-create" disabled={isPending}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      {isPending ? 'Creating…' : 'Create card'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </form>

      </div>
    </div>
  );
}
