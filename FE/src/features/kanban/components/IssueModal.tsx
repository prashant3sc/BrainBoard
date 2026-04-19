import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import { useRBAC } from '@/hooks/useRBAC';
import { useProjectMembers } from '@/features/projects/useProjects';
import useAuthStore from '@/store/useAuthStore';
import type { Issue, IssueStatus, Priority, IssueType } from '@/types';
import { KANBAN_COLUMNS } from './KanbanBoard';

type Destination = 'backlog' | 'sprint';

/** The active sprint ID — tickets sent to "Current Sprint" get this sprintId. */
const ACTIVE_SPRINT_ID = 'sprint-12';

interface Props {
  issue: Issue | null;   // null → create mode
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
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

export function IssueModal({ issue, isOpen, projectId, onClose }: Props) {
  const isEdit  = issue !== null;
  const { can } = useRBAC();
  const qc      = useQueryClient();
  const canEdit = can('editIssue');
  const canDel  = can('deleteIssue');
  const { data: members = [] } = useProjectMembers(projectId);
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
    setDestination('backlog');
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
        priority,
        storyPoints: points,
        assigneeId:  assigneeId || null,
        reporterId:  reporterId || null,
        parentId:    issueType === 'subtask' ? (parentId || null) : null,
        projectId,
        issueType,
        due: due || null,
        sprintId: destination === 'sprint' ? ACTIVE_SPRINT_ID : null,
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

  return (
    <div className="kb-modal-overlay" onClick={handleOverlay}>
      <div className="kb-modal bb-modal-animate">

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
              {isEdit ? 'Edit issue' : 'Add new card'}
            </span>
          </div>
          <button className="kb-modal-close" onClick={close}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="kb-modal-body">

            {/* Title */}
            <div className="kb-field">
              <label className="kb-label">Title <span className="kb-required">*</span></label>
              <input
                className={`kb-input${titleErr ? ' kb-input-error' : ''}`}
                placeholder="e.g. Fix login timeout on Safari"
                value={title}
                disabled={!canEdit}
                onChange={(e) => { setTitle(e.target.value); setTitleErr(false); }}
              />
            </div>

            {/* Description */}
            <div className="kb-field">
              <label className="kb-label">Description</label>
              <textarea
                className="kb-input kb-textarea"
                placeholder="What needs to be done?"
                value={desc}
                disabled={!canEdit}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

            {/* Column (edit only) + Priority */}
            <div className="kb-row2">
              {isEdit && (
                <div className="kb-field">
                  <label className="kb-label">Status</label>
                  <select
                    className="kb-input kb-select"
                    value={status}
                    disabled={!canEdit}
                    onChange={(e) => setStatus(e.target.value as IssueStatus)}
                  >
                    {KANBAN_COLUMNS.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="kb-field">
                <label className="kb-label">Priority</label>
                <select
                  className="kb-input kb-select"
                  value={priority}
                  disabled={!canEdit}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Destination — create mode only */}
            {!isEdit && (
              <div className="kb-field">
                <label className="kb-label">Add to <span className="kb-required">*</span></label>
                <div className="kb-destination-group">
                  <label className={`kb-dest-option${destination === 'backlog' ? ' kb-dest-active' : ''}`}>
                    <input
                      type="radio"
                      name="destination"
                      value="backlog"
                      checked={destination === 'backlog'}
                      onChange={() => setDestination('backlog')}
                    />
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="3" width="12" height="2" rx="1" fill="currentColor"/>
                      <rect x="1" y="7" width="12" height="2" rx="1" fill="currentColor"/>
                      <rect x="1" y="11" width="7" height="2" rx="1" fill="currentColor"/>
                    </svg>
                    Backlog
                  </label>
                  <label className={`kb-dest-option${destination === 'sprint' ? ' kb-dest-active' : ''}`}>
                    <input
                      type="radio"
                      name="destination"
                      value="sprint"
                      checked={destination === 'sprint'}
                      onChange={() => setDestination('sprint')}
                    />
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7a5 5 0 0 1 9.5-2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      <path d="M12 7a5 5 0 0 1-9.5 2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      <path d="M11.5 2.5l.5 2.3-2.3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Current Sprint
                  </label>
                </div>
              </div>
            )}

            {/* Type + Assignee */}
            <div className="kb-row2">
              <div className="kb-field">
                <label className="kb-label">Type</label>
                <select
                  className="kb-input kb-select"
                  value={issueType}
                  disabled={!canEdit}
                  onChange={(e) => {
                    setIssueType(e.target.value as IssueType);
                    setParentErr(false);
                    if (e.target.value !== 'subtask') setParentId('');
                  }}
                >
                  {ISSUE_TYPES.map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="kb-field">
                <label className="kb-label">Assignee</label>
                <select
                  className="kb-input kb-select"
                  value={assigneeId}
                  disabled={!canEdit}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parent issue — required when type is subtask */}
            {issueType === 'subtask' && (
              <div className="kb-field">
                <label className="kb-label">
                  Parent issue <span className="kb-required">*</span>
                </label>
                <select
                  className={`kb-input kb-select${parentErr ? ' kb-input-error' : ''}`}
                  value={parentId}
                  disabled={!canEdit}
                  onChange={(e) => { setParentId(e.target.value); setParentErr(false); }}
                >
                  <option value="">— Select parent issue —</option>
                  {parentCandidates.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.id.startsWith('issue-')
                        ? `BB-${i.id.replace('issue-', '')}`
                        : i.id.slice(0, 8).toUpperCase()}{' '}
                      — {i.title}
                    </option>
                  ))}
                </select>
                {parentErr && (
                  <span style={{ fontSize: 12, color: '#DE350B', marginTop: 2 }}>
                    Parent issue is required for subtasks.
                  </span>
                )}
              </div>
            )}

            {/* Reporter + Story points */}
            <div className="kb-row2">
              <div className="kb-field">
                <label className="kb-label">Reporter</label>
                <div className="kb-reporter-display">
                  {/* Always the logged-in user on create; stored value on edit */}
                  {isEdit
                    ? (members.find((m) => m.user.id === reporterId)?.user.name ?? currentUser?.name ?? '—')
                    : (currentUser?.name ?? '—')}
                </div>
              </div>
              <div className="kb-field">
                <label className="kb-label">Story points</label>
                <input
                  type="number"
                  min={1}
                  max={13}
                  className="kb-input"
                  value={points}
                  disabled={!canEdit}
                  onChange={(e) => setPoints(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Due date */}
            <div className="kb-field">
              <label className="kb-label">Due date</label>
              <input
                type="date"
                className="kb-input"
                value={due}
                disabled={!canEdit}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="kb-modal-footer">
            {isEdit ? (
              /* ── Edit footer: Delete (left) | Cancel + Save (right) ── */
              <>
                <div>
                  {canDel && (
                    <button
                      type="button"
                      className="kb-btn-danger"
                      disabled={deleteMut.isPending}
                      onClick={() => deleteMut.mutate()}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {deleteMut.isPending ? 'Deleting…' : 'Delete issue'}
                    </button>
                  )}
                </div>
                <div className="kb-modal-footer-right">
                  <button type="button" className="kb-btn-ghost" onClick={close}>Cancel</button>
                  {canEdit && (
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
              /* ── Create footer: hint (left) | Cancel + Create (right) ── */
              <>
                <div>
                  <span className="kb-modal-hint">
                    Fields marked <span style={{ color: '#DE350B' }}>*</span> are required
                  </span>
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
