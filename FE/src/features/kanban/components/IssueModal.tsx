import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import { useRBAC } from '@/hooks/useRBAC';
import { useProjectMembers } from '@/features/projects/useProjects';
import { useActiveSprint, useSprints } from '@/features/projects/useSprints';
import { useLabels } from '@/features/projects/useLabels';
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

const PRIORITY_COLOR: Record<Priority, { bg: string; text: string; dot: string }> = {
  critical: { bg: '#FFEBE6', text: '#DE350B', dot: '#DE350B' },
  high:     { bg: '#FFF0E6', text: '#FF5630', dot: '#FF5630' },
  medium:   { bg: '#FFFAE6', text: '#FF8B00', dot: '#FF8B00' },
  low:      { bg: '#E3FCEF', text: '#00875A', dot: '#00875A' },
};

const TYPE_COLOR: Record<IssueType, { bg: string; text: string }> = {
  task:    { bg: '#DEEBFF', text: '#0052CC' },
  subtask: { bg: '#EAE6FF', text: '#6554C0' },
  bug:     { bg: '#FFEBE6', text: '#DE350B' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  todo:        { label: 'To Do',       bg: '#F4F5F7', text: '#42526E', border: '#C1C7D0' },
  in_progress: { label: 'In Progress', bg: '#DEEBFF', text: '#0052CC', border: '#4C9AFF' },
  in_review:   { label: 'In Review',   bg: '#EAE6FF', text: '#6554C0', border: '#8777D9' },
  done:        { label: 'Done',        bg: '#E3FCEF', text: '#006644', border: '#36B37E' },
  cancelled:   { label: 'Cancelled',   bg: '#FFEBE6', text: '#BF2600', border: '#FF5630' },
};

/* ── tiny SVG icons ─────────────────────────────── */
const IcoStatus = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoType = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="2" width="4" height="4" rx="1" fill="currentColor"/>
    <rect x="8" y="2" width="4" height="4" rx="1" fill="currentColor"/>
    <rect x="2" y="8" width="4" height="4" rx="1" fill="currentColor"/>
    <rect x="8" y="8" width="4" height="4" rx="1" fill="currentColor"/>
  </svg>
);
const IcoPriority = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path d="M7 2v6M7 10v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M4 4.5l3-2.5 3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoAssignee = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcoReporter = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="10.5" cy="10.5" r="2" fill="#00875A"/>
    <path d="M9.5 10.5l.7.7 1.3-1.2" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcoPoints = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path d="M7 2l1.5 3 3.5.5-2.5 2.5.5 3.5L7 10l-3 1.5.5-3.5L2 5.5l3.5-.5L7 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);
const IcoDue = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 2v2M9 2v2M2 6h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const IcoLabel = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path d="M2 2h5l5 5-5 5-5-5V2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <circle cx="5" cy="5" r="1" fill="currentColor"/>
  </svg>
);
const IcoParent = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
    <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

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
  const [labelIds,      setLabelIds]      = useState<string[]>([]);
  const [titleErr,      setTitleErr]      = useState(false);
  const [parentErr,     setParentErr]     = useState(false);
  const [destination,   setDestination]   = useState<Destination>('backlog');
  const [assigneeOpen,  setAssigneeOpen]  = useState(false);
  const [parentSearch,  setParentSearch]  = useState('');
  const assigneeRef    = useRef<HTMLDivElement>(null);
  const { data: projectLabels = [] }  = useLabels(projectId);

  /* Close dropdowns on outside click */
  useEffect(() => {
    if (!assigneeOpen) return;
    function handleClick(e: MouseEvent) {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setAssigneeOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [assigneeOpen]);


  useEffect(() => { clearAI(); }, [issue?.id, isOpen]);

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
    setLabelIds(issue?.labelIds ?? []);
    setTitleErr(false);
    setParentErr(false);
    setParentSearch('');
    if (issue?.sprintId) setDestination('sprint');
    else setDestination('backlog');
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
        labelIds,
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
        labelIds,
      }),
    onSuccess: invalidateAndClose,
  });

  const deleteMut = useMutation({
    mutationFn: () => issuesApi.remove(issue!.id),
    onSuccess: invalidateAndClose,
  });

  const isPending = createMut.isPending || updateMut.isPending;

  /* Dirty check — compare every field against the original issue */
  const isDirty = isEdit ? (() => {
    if (!issue) return false;
    const origDestination = issue.sprintId ? 'sprint' : 'backlog';
    const origLabels = [...(issue.labelIds ?? [])].sort().join(',');
    const currLabels  = [...labelIds].sort().join(',');
    return (
      title       !== (issue.title        ?? '')        ||
      desc        !== (issue.description  ?? '')        ||
      status      !== (issue.status       ?? 'todo')    ||
      priority    !== (issue.priority     ?? 'medium')  ||
      issueType   !== (issue.issueType    ?? 'task')    ||
      assigneeId  !== (issue.assigneeId   ?? '')        ||
      parentId    !== (issue.parentId     ?? '')        ||
      due         !== (issue.due          ?? '')        ||
      points      !== (issue.storyPoints  ?? 3)         ||
      destination !== origDestination                   ||
      currLabels  !== origLabels
    );
  })() : true; // create mode is always "dirty"

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setTitleErr(true); return; }
    if (issueType === 'subtask' && !parentId) { setParentErr(true); return; }
    isEdit ? updateMut.mutate() : createMut.mutate();
  }

  function handleOverlay(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) close();
  }

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

  const issueKey = isEdit
    ? issue!.id.slice(0, 8).toUpperCase()
    : null;

  const pColor = PRIORITY_COLOR[priority];
  const tColor = TYPE_COLOR[issueType];

  /* helper: initials avatar */
  function Initials({ name }: { name: string }) {
    const parts = name.trim().split(' ');
    const ini = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return (
      <span className="im-avatar" title={name}>
        {ini.toUpperCase() || '?'}
      </span>
    );
  }

  return (
    <div className="kb-modal-overlay" onClick={handleOverlay}>
      <div className="kb-modal-wide bb-modal-animate im-modal">

        {/* ── Header ── */}
        <div className="im-header">
          <div className="im-header-left">
            {/* Type badge */}
            <span className="im-type-badge" style={{ background: tColor.bg, color: tColor.text }}>
              {issueType === 'bug' && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M4 4.5c.5-.8 1.2-1.5 2-1.5s1.5.7 2 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                </svg>
              )}
              {issueType === 'task' && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {issueType === 'subtask' && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2h4l4 4-4 4-4-4V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
              )}
              {TYPE_LABELS[issueType]}
            </span>
            {issueKey && <span className="im-issue-key">{issueKey}</span>}
            <span className="im-header-title">{isEdit ? 'View / Edit Issue' : 'Create New Issue'}</span>
          </div>
          <button className="kb-modal-close" onClick={close}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Read-only banners ── */}
        {isInPlannedSprint && (
          <div className="im-banner im-banner-warn">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="#F5A623" strokeWidth="1.4"/>
              <path d="M8 5v4M8 11v.5" stroke="#F5A623" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            This issue is in a <strong>planned sprint</strong> that hasn't started yet. Editing is disabled.
          </div>
        )}
        {isInCompletedSprint && (
          <div className="im-banner im-banner-neutral">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="#6B778C" strokeWidth="1.4"/>
              <path d="M5 8l2 2 4-4" stroke="#6B778C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            This issue belongs to a <strong>completed sprint</strong> and is read-only.
          </div>
        )}

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} className="im-form">
          <div className="im-body">

            {/* ═══ LEFT — content ═══ */}
            <div className="im-col-main">

              {/* Title */}
              <div className="im-title-wrap">
                <textarea
                  className={`im-title-input${titleErr ? ' kb-input-error' : ''}`}
                  placeholder="Issue title…"
                  rows={2}
                  value={title}
                  disabled={!canEdit || isReadOnly}
                  onChange={(e) => { setTitle(e.target.value); setTitleErr(false); }}
                />
                {titleErr && <span className="im-field-err">Title is required.</span>}
              </div>

              {/* Description */}
              <div className="im-section">
                <div className="im-section-label">Description</div>
                <textarea
                  className="kb-input im-desc"
                  placeholder="Add details, steps to reproduce, acceptance criteria…"
                  value={desc}
                  disabled={!canEdit || isReadOnly}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              {/* AI analyze */}
              {isEdit && canAI && !isReadOnly && (
                <div className="im-section">
                  {!aiResult && (
                    <button
                      type="button"
                      disabled={aiLoading}
                      className="im-ai-btn"
                    onClick={() => analyze(issue!.id)}
                    >
                      {aiLoading ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                            <circle cx="8" cy="8" r="6" stroke="#6366F1" strokeWidth="2" strokeDasharray="20 18"/>
                          </svg>
                          Analyzing…
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1L2 5.6l4.2-.9L8 1z" fill="#6366F1" strokeLinejoin="round"/>
                          </svg>
                          Analyze with AI
                        </>
                      )}
                    </button>
                  )}
                  {aiError && (
                    <div className="im-ai-error">
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5.5" stroke="#DC2626" strokeWidth="1.3"/>
                        <path d="M7 4.5v3M7 9.5v.5" stroke="#DC2626" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      {aiError}
                      <button type="button" className="im-ai-retry" onClick={() => analyze(issue!.id)}>Retry</button>
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

              {/* Location / Destination */}
              {(!isEdit || (isEdit && !isReadOnly)) && (
                <div className="im-section">
                  <div className="im-section-label">{isEdit ? 'Location' : 'Add to'}</div>
                  <div className="im-dest-row">
                    <label className={`im-dest-pill${destination === 'backlog' ? ' im-dest-active' : ''}`}>
                      <input type="radio" name="destination" value="backlog" checked={destination === 'backlog'} disabled={isReadOnly} onChange={() => setDestination('backlog')} />
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="3" width="12" height="2" rx="1" fill="currentColor"/>
                        <rect x="1" y="7" width="12" height="2" rx="1" fill="currentColor"/>
                        <rect x="1" y="11" width="7" height="2" rx="1" fill="currentColor"/>
                      </svg>
                      Backlog
                    </label>
                    <label className={`im-dest-pill${destination === 'sprint' ? ' im-dest-active' : ''}${!activeSprintId ? ' im-dest-disabled' : ''}`}>
                      <input type="radio" name="destination" value="sprint" checked={destination === 'sprint'} disabled={!activeSprintId || isReadOnly} onChange={() => setDestination('sprint')} />
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7a5 5 0 0 1 9.5-2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M12 7a5 5 0 0 1-9.5 2.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M11.5 2.5l.5 2.3-2.3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Current Sprint
                      {!activeSprintId && <span className="im-dest-note">(none active)</span>}
                    </label>
                  </div>
                </div>
              )}

            </div>

            {/* ═══ DIVIDER ═══ */}
            <div className="im-col-divider" />

            {/* ═══ RIGHT — properties ═══ */}
            <div className="im-col-props">

              {/* STATUS */}
              {isEdit && (
                <div className="im-props-section">
                  <div className="im-field-heading">
                    <IcoStatus /> Status
                  </div>
                  <div className="im-status-pills">
                    {KANBAN_COLUMNS.map((col) => {
                      const cfg = STATUS_CONFIG[col.id] ?? STATUS_CONFIG['todo'];
                      const active = status === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          disabled={!canEdit || isReadOnly}
                          onClick={() => setStatus(col.id as IssueStatus)}
                          className="im-status-pill"
                          style={{
                            background: active ? cfg.bg : 'transparent',
                            color:      active ? cfg.text : 'var(--kb-field-label)',
                            border:     active ? `1.5px solid ${cfg.border}` : '1.5px solid transparent',
                            fontWeight: active ? 600 : 400,
                            opacity: (!canEdit || isReadOnly) ? 0.55 : 1,
                            cursor: (!canEdit || isReadOnly) ? 'default' : 'pointer',
                          }}
                        >
                          {active && (
                            <span className="im-status-dot" style={{ background: cfg.border }} />
                          )}
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TYPE */}
              <div className="im-props-section">
                <div className="im-field-heading">
                  <IcoType /> Issue Type
                </div>
                <div className="im-pill-group">
                  {ISSUE_TYPES.map((t) => {
                    const tc = TYPE_COLOR[t];
                    const active = issueType === t;
                    const disabled = !canEdit || isReadOnly;
                    return (
                      <button
                        key={t} type="button"
                        disabled={disabled}
                        className={`im-option-pill${active ? ' im-option-pill-active' : ''}`}
                        style={active ? { background: tc.bg, color: tc.text, borderColor: tc.text } : {}}
                        onClick={() => {
                          if (disabled) return;
                          setIssueType(t);
                          setParentErr(false);
                          if (t !== 'subtask') setParentId('');
                        }}
                      >
                        {t === 'task' && (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                            <path d="M3.5 6l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {t === 'subtask' && (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.5 1.5"/>
                            <path d="M4 6h4M6 4v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          </svg>
                        )}
                        {t === 'bug' && (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                            <circle cx="6" cy="6.5" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
                            <path d="M4.5 3.5C4.5 2.67 5.17 2 6 2s1.5.67 1.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            <path d="M2.5 5.5h1M8.5 5.5h1M2.5 8h1M8.5 8h1M6 10v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          </svg>
                        )}
                        <span>{TYPE_LABELS[t]}</span>
                        {t === 'subtask' && <span className="im-pill-hint">child issue</span>}
                        {t === 'bug' && <span className="im-pill-hint">defect</span>}
                        {t === 'task' && <span className="im-pill-hint">work item</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PRIORITY */}
              <div className="im-props-section">
                <div className="im-field-heading">
                  <IcoPriority /> Priority
                </div>
                <div className="im-pill-group">
                  {PRIORITIES.map((p) => {
                    const pc = PRIORITY_COLOR[p];
                    const active = priority === p;
                    const disabled = !canEdit || isReadOnly;
                    return (
                      <button
                        key={p} type="button"
                        disabled={disabled}
                        className={`im-option-pill${active ? ' im-option-pill-active' : ''}`}
                        style={active ? { background: pc.bg, color: pc.text, borderColor: pc.dot } : {}}
                        onClick={() => { if (!disabled) setPriority(p); }}
                      >
                        <span className="im-prio-dot" style={{ background: pc.dot }} />
                        <span>{PRIORITY_LABELS[p]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PEOPLE */}
              <div className="im-props-section">
                <div className="im-field-heading"><IcoAssignee /> People</div>

                {/* Assignee — custom picker */}
                <div className="im-prop-row">
                  <span className="im-prop-label"><IcoAssignee /> Assignee</span>
                  <div className="im-assignee-picker" ref={assigneeRef}>
                    <button
                      type="button"
                      className={`im-assignee-trigger${assigneeOpen ? ' im-assignee-trigger-open' : ''}`}
                      disabled={!canEdit || isReadOnly}
                      onClick={() => setAssigneeOpen((v) => !v)}
                    >
                      {assigneeId ? (() => {
                        const member = members.find((m) => m.user.id === assigneeId);
                        return member ? (
                          <>
                            <Initials name={member.user.name} />
                            <span className="im-assignee-name">{member.user.name}</span>
                          </>
                        ) : null;
                      })() : (
                        <>
                          <span className="im-assignee-empty-avatar">
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                              <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                          </span>
                          <span className="im-assignee-placeholder">Unassigned</span>
                        </>
                      )}
                      <svg className="im-assignee-chevron" width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {assigneeOpen && (
                      <div className="im-assignee-dropdown">
                        {/* Unassign option */}
                        <button
                          type="button"
                          className={`im-assignee-option${!assigneeId ? ' im-assignee-option-active' : ''}`}
                          onClick={() => { setAssigneeId(''); setAssigneeOpen(false); }}
                        >
                          <span className="im-assignee-empty-avatar">
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                              <path d="M2 12c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                          </span>
                          <div className="im-assignee-info">
                            <span className="im-assignee-opt-name">Unassigned</span>
                          </div>
                          {!assigneeId && (
                            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, color: '#E75026' }}>
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>

                        {members.length > 0 && <div className="im-assignee-sep" />}

                        {members.map((m) => {
                          const active = assigneeId === m.user.id;
                          const nameParts = m.user.name.trim().split(' ');
                          const role = (m as any).role ?? '';
                          return (
                            <button
                              key={m.user.id}
                              type="button"
                              className={`im-assignee-option${active ? ' im-assignee-option-active' : ''}`}
                              onClick={() => { setAssigneeId(m.user.id); setAssigneeOpen(false); }}
                            >
                              <Initials name={m.user.name} />
                              <div className="im-assignee-info">
                                <span className="im-assignee-opt-name">{m.user.name}</span>
                                {role && <span className="im-assignee-opt-role">{role}</span>}
                              </div>
                              {active && (
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, color: '#E75026' }}>
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reporter */}
                <div className="im-prop-row">
                  <span className="im-prop-label"><IcoReporter /> Reporter</span>
                  <div className="im-reporter-val">
                    <Initials name={reporterName} />
                    <span>{reporterName}</span>
                  </div>
                </div>
              </div>

              {/* STORY POINTS + DUE DATE */}
              <div className="im-props-section">
                <div className="im-field-heading"><IcoPoints /> Details</div>
                <div className="im-prop-row">
                  <span className="im-prop-label"><IcoPoints /> Story pts</span>
                  <input
                    type="number" min={1} max={13}
                    className="im-prop-input"
                    value={points}
                    disabled={!canEdit || isReadOnly}
                    onChange={(e) => setPoints(Number(e.target.value))}
                  />
                </div>
                <div className="im-prop-row">
                  <span className="im-prop-label"><IcoDue /> Due date</span>
                  <input
                    type="date"
                    className="im-prop-input"
                    value={due}
                    disabled={!canEdit || isReadOnly}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </div>
              </div>

              {/* LABELS */}
              {projectLabels.length > 0 && (
                <div className="im-props-section">
                  <div className="im-field-heading">
                    <IcoLabel /> Labels
                  </div>
                  <div className="im-labels-wrap">
                    {projectLabels.map((lbl) => {
                      const selected = labelIds.includes(lbl.id);
                      return (
                        <button
                          key={lbl.id}
                          type="button"
                          disabled={isReadOnly || !canEdit}
                          onClick={() => {
                            if (isReadOnly || !canEdit) return;
                            setLabelIds((prev) =>
                              selected ? prev.filter((id) => id !== lbl.id) : [...prev, lbl.id]
                            );
                          }}
                          className="im-label-chip"
                          style={{
                            border: `1.5px solid ${lbl.color}`,
                            background: selected ? lbl.color : 'transparent',
                            color: selected ? '#fff' : lbl.color,
                            opacity: isReadOnly || !canEdit ? 0.55 : 1,
                            cursor: isReadOnly || !canEdit ? 'default' : 'pointer',
                          }}
                        >
                          {selected && (
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                          {lbl.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PARENT ISSUE — subtask only */}
              {issueType === 'subtask' && (
                <div className="im-props-section">
                  <div className="im-field-heading">
                    <IcoParent /> Parent Issue <span className="kb-required" style={{ marginLeft: 2 }}>*</span>
                  </div>

                  {/* Selected parent display */}
                  {parentId && (() => {
                    const p = allIssues.find((i) => i.id === parentId);
                    if (!p) return null;
                    const tc = TYPE_COLOR[p.issueType as IssueType] ?? TYPE_COLOR.task;
                    return (
                      <div className="im-parent-selected-card">
                        <span className="im-parent-type-dot" style={{ background: tc.text }} />
                        <div className="im-parent-selected-info">
                          <span className="im-parent-key">{p.id.slice(0, 8).toUpperCase()}</span>
                          <span className="im-parent-title">{p.title}</span>
                        </div>
                        <span className="im-parent-opt-type" style={{ background: tc.bg, color: tc.text }}>
                          {TYPE_LABELS[p.issueType as IssueType]}
                        </span>
                        {(!isReadOnly && canEdit) && (
                          <button
                            type="button"
                            className="im-parent-clear"
                            onClick={() => setParentId('')}
                            title="Clear parent"
                          >
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                            </svg>
                          </button>
                        )}
                        {isEdit && onNavigate && (
                          <button
                            type="button"
                            className="im-goto-parent"
                            onClick={() => { close(); onNavigate(p); }}
                            title="Open parent"
                          >
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Open
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Inline search + list — always visible when no parent selected or editing */}
                  {(!parentId || !isReadOnly) && canEdit && !isReadOnly && (
                    <div className={`im-parent-panel${parentErr ? ' im-parent-panel-err' : ''}`}>
                      {/* Search */}
                      <div className="im-parent-search-wrap">
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                          <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
                          <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        <input
                          className="im-parent-search"
                          placeholder="Search issues…"
                          value={parentSearch}
                          onChange={(e) => setParentSearch(e.target.value)}
                        />
                      </div>

                      {/* Issue list */}
                      <div className="im-parent-list">
                        {parentCandidates
                          .filter((i) =>
                            !parentSearch ||
                            i.title.toLowerCase().includes(parentSearch.toLowerCase()) ||
                            i.id.toLowerCase().includes(parentSearch.toLowerCase())
                          )
                          .map((i) => {
                            const tc = TYPE_COLOR[i.issueType as IssueType] ?? TYPE_COLOR.task;
                            const active = parentId === i.id;
                            return (
                              <button
                                key={i.id}
                                type="button"
                                className={`im-parent-option${active ? ' im-parent-option-active' : ''}`}
                                onClick={() => { setParentId(i.id); setParentErr(false); setParentSearch(''); }}
                              >
                                <span className="im-parent-opt-dot" style={{ background: tc.text }} />
                                <div className="im-parent-opt-info">
                                  <span className="im-parent-opt-key">{i.id.slice(0, 8).toUpperCase()}</span>
                                  <span className="im-parent-opt-title">{i.title}</span>
                                </div>
                                <span className="im-parent-opt-type" style={{ background: tc.bg, color: tc.text }}>
                                  {TYPE_LABELS[i.issueType as IssueType]}
                                </span>
                                {active && (
                                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: '#E75026' }}>
                                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </button>
                            );
                          })}
                        {parentCandidates.filter((i) =>
                          !parentSearch ||
                          i.title.toLowerCase().includes(parentSearch.toLowerCase()) ||
                          i.id.toLowerCase().includes(parentSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="im-parent-empty">No matching issues</div>
                        )}
                      </div>
                    </div>
                  )}

                  {parentErr && <span className="im-field-err">Parent issue is required.</span>}
                </div>
              )}

              {/* SUBTASKS */}
              {subtasks.length > 0 && (
                <div className="im-props-section">
                  <div className="im-field-heading">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3h8M3 7h6M3 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    Subtasks
                    <span className="im-subtask-progress">
                      {subtasks.filter((s) => s.status === 'done').length}/{subtasks.length} done
                    </span>
                  </div>
                  <div className="im-subtask-list">
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
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.35 }}>
                          <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── Footer ── */}
          <div className="im-footer">
            {isEdit ? (
              <>
                <div>
                  {canDel && (
                    <button type="button" className="kb-btn-danger" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate()}>
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <path d="M2 3.5h10M5.5 3.5V2.5h3v1M11 3.5l-.75 8.5H3.75L3 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
                <div className="kb-modal-footer-right">
                  <button type="button" className="kb-btn-ghost" onClick={close}>Cancel</button>
                  {canEdit && !isReadOnly && (
                    <button
                      type="submit"
                      className={`kb-btn-create${!isDirty ? ' kb-btn-create-idle' : ''}`}
                      disabled={isPending || !isDirty}
                      title={!isDirty ? 'No changes to save' : undefined}
                    >
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
                      {isPending ? 'Creating…' : 'Create issue'}
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
