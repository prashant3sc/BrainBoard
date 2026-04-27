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

const TYPE_COLOR: Record<IssueType, { bg: string; text: string }> = {
  task:    { bg: '#DEEBFF', text: '#0052CC' },
  subtask: { bg: '#EAE6FF', text: '#6554C0' },
  bug:     { bg: '#FFEBE6', text: '#DE350B' },
};

/* key fixed to 'review' to match KANBAN_COLUMNS */
const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  todo:        { label: 'To Do',       dot: '#888780' },
  in_progress: { label: 'In Progress', dot: '#D85A30' },
  review:      { label: 'In Review',   dot: '#378ADD' },
  done:        { label: 'Done',        dot: '#1D9E75' },
  cancelled:   { label: 'Cancelled',   dot: '#888780' },
};

/* ── Mock AI data (replace with real API response later) ── */
const MOCK_TITLE_SUGGESTION =
  'Bulk-sync PostgreSQL user capacity to ChromaDB via AI ingestion layer';

const MOCK_DESC_SUGGESTION = `BE endpoint to read all users and workloads from DB, compute capacity, and bulk-upload to ChromaDB via AI layer.

Acceptance criteria:
- Fetch all active users from PostgreSQL
- Compute capacity as (workload / max_capacity) × 100
- Upsert vectors with user_id as namespace key
- Idempotent: re-runs must not duplicate records

Edge cases:
- Handle zero-workload users gracefully
- Rate-limit ChromaDB calls to avoid 429s
- Log individual failures without halting the batch`;

const MOCK_LABELS_ADD    = ['ai engineer', 'devops'];
const MOCK_LABELS_REMOVE = ['tester'];

/* ── Icon helpers ─────────────────────────────── */
function StatusDot({ status }: { status: string }) {
  const c = STATUS_CONFIG[status]?.dot ?? '#888780';
  return <span className="im-sdot" style={{ background: c }} />;
}

function TypeIcon({ type, active = false }: { type: IssueType; active?: boolean }) {
  const col = active ? '#993C1D' : '#5F5E5A';
  if (type === 'task') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={col} strokeWidth="1.5"/>
      <polyline points="8,12 11,15 16,9" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === 'subtask') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke={col} strokeWidth="1.5"/>
      <rect x="8" y="8" width="8" height="8" rx="1.5" stroke={col} strokeWidth="1.5"/>
    </svg>
  );
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <polygon points="12,3 22,21 2,21" stroke="#E24B4A" strokeWidth="1.5" strokeLinejoin="round"/>
      <line x1="12" y1="10" x2="12" y2="15" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="18.5" r="0.8" fill="#E24B4A"/>
    </svg>
  );
}

function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === 'critical') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <line x1="12" y1="19" x2="12" y2="6" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/>
      <polyline points="8,10 12,6 16,10" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="8" y1="19" x2="16" y2="19" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  if (priority === 'high') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <line x1="5" y1="8" x2="19" y2="8" stroke="#D85A30" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5" y1="13" x2="19" y2="13" stroke="#D85A30" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5" y1="18" x2="13" y2="18" stroke="#D85A30" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  if (priority === 'medium') return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <line x1="5" y1="10" x2="19" y2="10" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="5" y1="16" x2="19" y2="16" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <line x1="5" y1="13" x2="19" y2="13" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      style={{ transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : '', flexShrink: 0, color: 'var(--kb-field-label)' }}>
      <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function IssueModal({ issue, isOpen, projectId, onClose, onNavigate }: Props) {
  const isEdit  = issue !== null;
  const { can } = useRBAC();
  const qc      = useQueryClient();
  const canEdit = can('editIssue');
  const canDel  = can('deleteIssue');
  const canAI   = can('analyzeIssue');
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

  /* ── Form state ── */
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
  const [labelIds,    setLabelIds]    = useState<string[]>([]);
  const [titleErr,    setTitleErr]    = useState(false);
  const [parentErr,   setParentErr]   = useState(false);
  const [destination, setDestination] = useState<Destination>('backlog');
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [openDD,       setOpenDD]       = useState<string | null>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);
  const { data: projectLabels = [] } = useLabels(projectId);

  /* ── Mock AI state ── */
  const [mockAiLoading,  setMockAiLoading]  = useState(false);
  const [mockAiShown,    setMockAiShown]    = useState(false);
  const [expandedCards,  setExpandedCards]  = useState<Set<number>>(new Set());
  const [appliedCards,   setAppliedCards]   = useState<Set<number>>(new Set());
  const [dismissedCards, setDismissedCards] = useState<Set<number>>(new Set());

  const mockActiveCount = 4 - appliedCards.size - dismissedCards.size;

  function resetMockAI() {
    setMockAiShown(false);
    setMockAiLoading(false);
    setExpandedCards(new Set());
    setAppliedCards(new Set());
    setDismissedCards(new Set());
  }

  function handleMockAnalyze() {
    setMockAiLoading(true);
    setMockAiShown(false);
    setExpandedCards(new Set());
    setAppliedCards(new Set());
    setDismissedCards(new Set());
    setTimeout(() => {
      setMockAiLoading(false);
      setMockAiShown(true);
    }, 2000);
  }

  function toggleCard(idx: number) {
    if (appliedCards.has(idx)) return;
    setExpandedCards(prev => {
      const n = new Set(prev);
      n.has(idx) ? n.delete(idx) : n.add(idx);
      return n;
    });
  }

  function applyMockCard(idx: number) {
    if (idx === 0) setTitle(MOCK_TITLE_SUGGESTION);
    if (idx === 1) setDesc(MOCK_DESC_SUGGESTION);
    if (idx === 2) {
      const toAdd    = projectLabels.filter(l => MOCK_LABELS_ADD.some(n => l.name.toLowerCase() === n)).map(l => l.id);
      const toRemove = projectLabels.filter(l => MOCK_LABELS_REMOVE.some(n => l.name.toLowerCase() === n)).map(l => l.id);
      setLabelIds(prev => [...new Set([...prev.filter(id => !toRemove.includes(id)), ...toAdd])]);
    }
    if (idx === 3) {
      const harsh = members.find(m => m.user.name.toLowerCase().includes('harsh'));
      if (harsh) setAssigneeId(harsh.user.id);
    }
    setAppliedCards(prev => new Set([...prev, idx]));
    setExpandedCards(prev => { const n = new Set(prev); n.delete(idx); return n; });
  }

  function dismissMockCard(idx: number) {
    setDismissedCards(prev => new Set([...prev, idx]));
    setExpandedCards(prev => { const n = new Set(prev); n.delete(idx); return n; });
  }

  function applyAllMockCards() {
    const remaining = [0, 1, 2, 3].filter(i => !appliedCards.has(i) && !dismissedCards.has(i));
    if (remaining.includes(0)) setTitle(MOCK_TITLE_SUGGESTION);
    if (remaining.includes(1)) setDesc(MOCK_DESC_SUGGESTION);
    if (remaining.includes(2)) {
      const toAdd    = projectLabels.filter(l => MOCK_LABELS_ADD.some(n => l.name.toLowerCase() === n)).map(l => l.id);
      const toRemove = projectLabels.filter(l => MOCK_LABELS_REMOVE.some(n => l.name.toLowerCase() === n)).map(l => l.id);
      setLabelIds(prev => [...new Set([...prev.filter(id => !toRemove.includes(id)), ...toAdd])]);
    }
    if (remaining.includes(3)) {
      const harsh = members.find(m => m.user.name.toLowerCase().includes('harsh'));
      if (harsh) setAssigneeId(harsh.user.id);
    }
    setAppliedCards(new Set([0, 1, 2, 3].filter(i => !dismissedCards.has(i))));
    setExpandedCards(new Set());
  }

  function toggleDD(id: string) {
    setOpenDD(prev => prev === id ? null : id);
    if (assigneeOpen) setAssigneeOpen(false);
  }

  /* Close assignee dropdown on outside click */
  useEffect(() => {
    if (!assigneeOpen) return;
    function handleClick(e: MouseEvent) {
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) setAssigneeOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [assigneeOpen]);

  /* Close right-column dropdowns on outside click */
  useEffect(() => {
    if (!openDD) return;
    function handleClick(e: MouseEvent) {
      if (!(e.target as Element).closest('.im-dd-wrap')) setOpenDD(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDD]);

  useEffect(() => { resetMockAI(); }, [issue?.id, isOpen]);

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
    setOpenDD(null);
    if (issue?.sprintId) setDestination('sprint');
    else setDestination('backlog');
  }, [issue, isOpen]);

  function close() { onClose(); }

  function invalidateAndClose() {
    qc.invalidateQueries({ queryKey: ['issues',  projectId] });
    qc.invalidateQueries({ queryKey: ['sprints', projectId] });
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

  const isDirty = isEdit ? (() => {
    if (!issue) return false;
    const origDestination = issue.sprintId ? 'sprint' : 'backlog';
    const origLabels = [...(issue.labelIds ?? [])].sort().join(',');
    const currLabels  = [...labelIds].sort().join(',');
    return (
      title       !== (issue.title        ?? '')       ||
      desc        !== (issue.description  ?? '')       ||
      status      !== (issue.status       ?? 'todo')   ||
      priority    !== (issue.priority     ?? 'medium') ||
      issueType   !== (issue.issueType    ?? 'task')   ||
      assigneeId  !== (issue.assigneeId   ?? '')       ||
      parentId    !== (issue.parentId     ?? '')       ||
      due         !== (issue.due          ?? '')       ||
      points      !== (issue.storyPoints  ?? 3)        ||
      destination !== origDestination                  ||
      currLabels  !== origLabels
    );
  })() : true;

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

  function Initials({ name }: { name: string }) {
    const parts = name.trim().split(' ');
    const ini = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return (
      <span className="im-avatar" title={name}>
        {ini.toUpperCase() || '?'}
      </span>
    );
  }

  /* ── Suggestion card helper ── */
  function SuggCard({
    idx, iconBg, icon, cardTitle, preview, body, applyLabel, dismissLabel,
  }: {
    idx: number;
    iconBg: string;
    icon: React.ReactNode;
    cardTitle: string;
    preview: string;
    body: React.ReactNode;
    applyLabel: string;
    dismissLabel: string;
  }) {
    const applied   = appliedCards.has(idx);
    const expanded  = expandedCards.has(idx);
    return (
      <div className="im-sugg-card">
        <div
          className={`im-sugg-card-hdr${applied ? ' im-sugg-card-applied' : ''}`}
          onClick={() => toggleCard(idx)}
        >
          <div className="im-sugg-icon" style={{ background: iconBg }}>{icon}</div>
          <div className="im-sugg-info">
            <div className="im-sugg-title">{cardTitle}</div>
            <div className="im-sugg-preview">{preview}</div>
          </div>
          {applied
            ? <span className="im-sugg-applied-badge">✓ Applied</span>
            : <ChevronIcon open={expanded} />
          }
        </div>
        {expanded && !applied && (
          <div className="im-sugg-body">
            {body}
            <div className="im-sugg-footer">
              <button className="im-sugg-dismiss-btn" onClick={() => dismissMockCard(idx)}>{dismissLabel}</button>
              <button className="im-sugg-apply-btn"   onClick={() => applyMockCard(idx)}>{applyLabel}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Current labels for display ── */
  const currentLabelNames = projectLabels.filter(l => labelIds.includes(l.id)).map(l => l.name);

  return (
    <div className="kb-modal-overlay" onClick={handleOverlay}>
      <div className="kb-modal-wide bb-modal-animate im-modal">

        {/* ── Header ── */}
        <div className="im-header">
          <div className="im-header-left">
            <span className="im-type-badge">
              <TypeIcon type={issueType} active />
              {TYPE_LABELS[issueType]}
            </span>
            {issueKey && <span className="im-issue-key">{issueKey}</span>}
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
              <div className="im-section">
                <span className="im-fl">Title <span style={{ color: '#DE350B' }}>*</span></span>
                <div className="im-title-wrap">
                  <textarea
                    className={`im-title-input${titleErr ? ' kb-input-error' : ''}`}
                    placeholder="Enter issue title…"
                    rows={1}
                    value={title}
                    disabled={!canEdit || isReadOnly}
                    onChange={(e) => { setTitle(e.target.value); setTitleErr(false); }}
                  />
                  {titleErr && <span className="im-field-err">Title is required.</span>}
                </div>
              </div>

              {/* Description + AI suggestions panel */}
              <div className="im-section">
                <span className="im-fl">Description</span>
                <textarea
                  className="kb-input im-desc"
                  placeholder="Add details, steps to reproduce, acceptance criteria…"
                  value={desc}
                  disabled={!canEdit || isReadOnly}
                  onChange={(e) => setDesc(e.target.value)}
                />

                {/* ── AI Suggestions Panel ── */}
                {mockAiShown && (
                  <div className="im-sugg-container">
                    {/* Header */}
                    <div className="im-sugg-hdr">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span className="im-sugg-hdr-title">AI suggestions</span>
                        <span className="im-sugg-count-badge">{mockActiveCount} suggestion{mockActiveCount !== 1 ? 's' : ''}</span>
                      </div>
                      <button
                        type="button"
                        className="im-sugg-apply-all-btn"
                        disabled={mockActiveCount === 0}
                        onClick={applyAllMockCards}
                      >
                        Apply all →
                      </button>
                    </div>

                    {/* Cards */}
                    <div className="im-sugg-cards">

                      {/* Card 0 — Title */}
                      {!dismissedCards.has(0) && (
                        <SuggCard
                          idx={0}
                          iconBg="#FAECE7"
                          cardTitle="Sharpen the title"
                          preview={MOCK_TITLE_SUGGESTION}
                          applyLabel="Apply →"
                          dismissLabel="Dismiss"
                          icon={
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#D85A30" strokeWidth="2" strokeLinecap="round"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#D85A30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          }
                          body={
                            <div className="im-sugg-diff">
                              <div className="im-diff-row im-diff-was">
                                <span className="im-diff-pill im-diff-pill-was">Was</span>
                                <span className="im-diff-was-text">{title || '(empty)'}</span>
                              </div>
                              <div className="im-diff-row im-diff-now">
                                <span className="im-diff-pill im-diff-pill-now">Now</span>
                                <span className="im-diff-now-text">{MOCK_TITLE_SUGGESTION}</span>
                              </div>
                            </div>
                          }
                        />
                      )}

                      {/* Card 1 — Description */}
                      {!dismissedCards.has(1) && (
                        <SuggCard
                          idx={1}
                          iconBg="#E6F1FB"
                          cardTitle="Expand description"
                          preview="Add acceptance criteria, edge cases and expected behaviour"
                          applyLabel="Apply →"
                          dismissLabel="Keep mine"
                          icon={
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" stroke="#185FA5" strokeWidth="2" strokeLinejoin="round"/>
                              <polyline points="14,2 14,8 20,8" stroke="#185FA5" strokeWidth="2" strokeLinejoin="round"/>
                            </svg>
                          }
                          body={
                            <div className="im-sugg-diff">
                              <div className="im-diff-pane im-diff-pane-was">
                                <span className="im-diff-pane-label">Your version</span>
                                <p className="im-diff-pane-text im-diff-was-text">{desc || '(empty)'}</p>
                              </div>
                              <div className="im-diff-pane im-diff-pane-now">
                                <span className="im-diff-pane-label">AI expanded</span>
                                <p className="im-diff-pane-text" style={{ whiteSpace: 'pre-line' }}>{MOCK_DESC_SUGGESTION}</p>
                              </div>
                            </div>
                          }
                        />
                      )}

                      {/* Card 2 — Labels */}
                      {!dismissedCards.has(2) && (
                        <SuggCard
                          idx={2}
                          iconBg="#FAEEDA"
                          cardTitle="Label suggestions"
                          preview={`Add ${MOCK_LABELS_ADD.join(', ')} · Remove ${MOCK_LABELS_REMOVE.join(', ')}`}
                          applyLabel="Apply labels"
                          dismissLabel="Dismiss"
                          icon={
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="#854F0B" strokeWidth="2" strokeLinejoin="round"/>
                              <line x1="7" y1="7" x2="7.01" y2="7" stroke="#854F0B" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                          }
                          body={
                            <div className="im-sugg-diff">
                              <div className="im-diff-label-table">
                                <div className="im-diff-label-row">
                                  <span className="im-diff-label-key">Currently</span>
                                  <div className="im-diff-chips">
                                    {currentLabelNames.length > 0
                                      ? currentLabelNames.map(n => <span key={n} className="im-diff-chip">{n}</span>)
                                      : <span style={{ fontSize: 11, color: 'var(--kb-field-label)' }}>No labels</span>
                                    }
                                  </div>
                                </div>
                                <div className="im-diff-label-row">
                                  <span className="im-diff-label-key">After AI</span>
                                  <div className="im-diff-chips">
                                    {currentLabelNames
                                      .filter(n => !MOCK_LABELS_REMOVE.includes(n.toLowerCase()))
                                      .map(n => <span key={n} className="im-diff-chip">{n}</span>)
                                    }
                                    {MOCK_LABELS_ADD.map(n => (
                                      <span key={n} className="im-diff-chip im-diff-chip-add">+ {n}</span>
                                    ))}
                                    {currentLabelNames
                                      .filter(n => MOCK_LABELS_REMOVE.includes(n.toLowerCase()))
                                      .map(n => <span key={n} className="im-diff-chip im-diff-chip-remove">− {n}</span>)
                                    }
                                  </div>
                                </div>
                              </div>
                            </div>
                          }
                        />
                      )}

                      {/* Card 3 — Assignee */}
                      {!dismissedCards.has(3) && (
                        <SuggCard
                          idx={3}
                          iconBg="#E1F5EE"
                          cardTitle="Assignee suggestion"
                          preview="Suggest Harsh Malik — 1 open ticket, available"
                          applyLabel="Assign to Harsh"
                          dismissLabel="Dismiss"
                          icon={
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round"/>
                              <circle cx="9" cy="7" r="4" stroke="#0F6E56" strokeWidth="2"/>
                            </svg>
                          }
                          body={
                            <div className="im-sugg-diff">
                              <div className="im-diff-assignee-table">
                                {/* Not recommended — current assignee */}
                                <div className="im-diff-assignee-row">
                                  <span className="im-diff-person-av" style={{ background: '#D85A30' }}>PP</span>
                                  <div className="im-diff-person-info">
                                    <div className="im-diff-person-top">
                                      <span className="im-diff-person-name">Prashant Poonia</span>
                                      <span className="im-diff-badge im-diff-badge-warn">2 high priority open</span>
                                    </div>
                                    <span className="im-diff-person-reason">Not recommended — already at capacity this sprint</span>
                                  </div>
                                </div>
                                {/* Recommended */}
                                <div className="im-diff-assignee-row im-diff-assignee-rec">
                                  <span className="im-diff-person-av" style={{ background: '#378ADD' }}>HM</span>
                                  <div className="im-diff-person-info">
                                    <div className="im-diff-person-top">
                                      <span className="im-diff-person-name">Harsh Malik</span>
                                      <span className="im-diff-badge im-diff-badge-ok">1 open, available</span>
                                    </div>
                                    <span className="im-diff-person-reason">✓ Recommended — has bandwidth, familiar with this module</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          }
                        />
                      )}

                    </div>
                  </div>
                )}
              </div>

              {/* Analyze with AI button */}
              {canAI && !isReadOnly && (
                <div className="im-section">
                  <button
                    type="button"
                    disabled={mockAiLoading || (!isEdit && (!title.trim() || !desc.trim()))}
                    className="im-ai-btn"
                    onClick={handleMockAnalyze}
                  >
                    {mockAiLoading ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="8" cy="8" r="6" stroke="#A32E0E" strokeWidth="2" strokeDasharray="20 18"/>
                        </svg>
                        Analyzing<span className="im-ai-dots"><span>.</span><span>.</span><span>.</span></span>
                      </>
                    ) : mockAiShown ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <circle cx="6.5" cy="6.5" r="5.5" stroke="#A32E0E" strokeWidth="1.3"/>
                          <path d="M4 7l2 2 3-3" stroke="#A32E0E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Re-analyze
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <circle cx="6.5" cy="6.5" r="5.5" stroke="#A32E0E" strokeWidth="1.3"/>
                          <path d="M4 7l2 2 3-3" stroke="#A32E0E" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Analyze with AI
                      </>
                    )}
                  </button>
                  {!isEdit && (!title.trim() || !desc.trim()) && !mockAiShown && !mockAiLoading && (
                    <p style={{ fontSize: 11, color: 'var(--kb-field-label)', marginTop: 2 }}>
                      {!title.trim() ? 'Add a title and description to enable AI analysis' : 'Add a description for better AI results'}
                    </p>
                  )}
                </div>
              )}

              {/* Location / Destination */}
              {(!isEdit || (isEdit && !isReadOnly)) && (
                <div className="im-section">
                  <span className="im-fl">{isEdit ? 'Location' : 'Add to'}</span>
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

            {/* ═══ RIGHT — properties ═══ */}
            <div className="im-col-props">

              {/* STATUS — edit only */}
              {isEdit && (
                <div className="im-srow">
                  <div className="im-sl">Status</div>
                  <div className="im-dd-wrap">
                    <button className="im-ddt" type="button" onClick={() => toggleDD('status')} disabled={!canEdit || isReadOnly}>
                      <div className="im-ddl">
                        <StatusDot status={status} />
                        <span>{STATUS_CONFIG[status]?.label ?? 'To Do'}</span>
                      </div>
                      <ChevronIcon open={openDD === 'status'} />
                    </button>
                    {openDD === 'status' && (
                      <div className="im-ddm">
                        {KANBAN_COLUMNS.map(col => (
                          <div
                            key={col.id}
                            className={`im-ddi${status === col.id ? ' im-ddi-sel' : ''}`}
                            onClick={() => { setStatus(col.id as IssueStatus); setOpenDD(null); }}
                          >
                            <StatusDot status={col.id} />
                            {STATUS_CONFIG[col.id]?.label ?? col.label}
                          </div>
                        ))}
                        <div className="im-ddi-sep" />
                        <div
                          className={`im-ddi${status === 'cancelled' ? ' im-ddi-sel' : ''}`}
                          onClick={() => { setStatus('cancelled' as IssueStatus); setOpenDD(null); }}
                        >
                          <StatusDot status="cancelled" />
                          Cancelled
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ISSUE TYPE */}
              <div className="im-srow">
                <div className="im-sl">Issue type</div>
                <div className="im-dd-wrap">
                  <button className="im-ddt" type="button" onClick={() => toggleDD('type')} disabled={!canEdit || isReadOnly}>
                    <div className="im-ddl">
                      <TypeIcon type={issueType} active />
                      <span>{TYPE_LABELS[issueType]}</span>
                    </div>
                    <ChevronIcon open={openDD === 'type'} />
                  </button>
                  {openDD === 'type' && (
                    <div className="im-ddm">
                      {ISSUE_TYPES.map(t => (
                        <div
                          key={t}
                          className={`im-ddi${issueType === t ? ' im-ddi-sel' : ''}`}
                          onClick={() => {
                            setIssueType(t);
                            setParentErr(false);
                            if (t !== 'subtask') setParentId('');
                            setOpenDD(null);
                          }}
                        >
                          <TypeIcon type={t} active={issueType === t} />
                          {TYPE_LABELS[t]}
                          <span className="im-ddi-sub">
                            {t === 'task' ? 'work item' : t === 'subtask' ? 'child issue' : 'defect'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* PRIORITY */}
              <div className="im-srow">
                <div className="im-sl">Priority</div>
                <div className="im-dd-wrap">
                  <button className="im-ddt" type="button" onClick={() => toggleDD('priority')} disabled={!canEdit || isReadOnly}>
                    <div className="im-ddl">
                      <PriorityIcon priority={priority} />
                      <span>{PRIORITY_LABELS[priority]}</span>
                    </div>
                    <ChevronIcon open={openDD === 'priority'} />
                  </button>
                  {openDD === 'priority' && (
                    <div className="im-ddm">
                      {PRIORITIES.map(p => (
                        <div
                          key={p}
                          className={`im-ddi${priority === p ? ' im-ddi-sel' : ''}`}
                          onClick={() => { setPriority(p); setOpenDD(null); }}
                        >
                          <PriorityIcon priority={p} />
                          {PRIORITY_LABELS[p]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* PEOPLE */}
              <div className="im-srow">
                <div className="im-sl">People</div>
                <div className="im-prow">
                  <span className="im-plbl">Assignee</span>
                  <div className="im-assignee-picker" ref={assigneeRef} style={{ flex: 1, minWidth: 0 }}>
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
                <div className="im-prow" style={{ marginTop: 5 }}>
                  <span className="im-plbl">Reporter</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <Initials name={reporterName} />
                    <span className="im-pname">{reporterName}</span>
                  </div>
                </div>
              </div>

              {/* LABELS */}
              {projectLabels.length > 0 && (
                <div className="im-srow">
                  <div className="im-sl">Labels</div>
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
                          className={`im-label-chip${selected ? ' im-label-chip-active' : ''}`}
                          style={{
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

              {/* STORY POINTS */}
              <div className="im-srow">
                <div className="im-sl">Story points</div>
                <input
                  type="number" min={1} max={13}
                  className="im-pts-inp"
                  value={points}
                  disabled={!canEdit || isReadOnly}
                  onChange={(e) => setPoints(Number(e.target.value))}
                />
                <div className="im-pts-note">Set by team during sprint planning</div>
              </div>

              {/* PARENT ISSUE — subtask only */}
              {issueType === 'subtask' && (
                <div className="im-srow">
                  <div className="im-sl">
                    Parent issue <span style={{ color: '#DE350B', textTransform: 'none', letterSpacing: 0 }}>*</span>
                  </div>

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
                          <button type="button" className="im-parent-clear" onClick={() => setParentId('')} title="Clear parent">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                            </svg>
                          </button>
                        )}
                        {isEdit && onNavigate && (
                          <button type="button" className="im-goto-parent" onClick={() => { close(); onNavigate(p); }} title="Open parent">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Open
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {(!parentId || !isReadOnly) && canEdit && !isReadOnly && (
                    <div className={`im-parent-panel${parentErr ? ' im-parent-panel-err' : ''}`}>
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
                <div className="im-srow">
                  <div className="im-sl">
                    Subtasks
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 10, color: 'var(--kb-field-label)' }}>
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
