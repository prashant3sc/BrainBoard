import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import { useSprints, useStartSprint, useCompleteSprint, useCreateSprint } from '@/features/projects/useSprints';
import { useProjectMembers } from '@/features/projects/useProjects';
import { useRBAC } from '@/hooks/useRBAC';
import { useArchivedProject } from '@/hooks/useArchivedProject';
import { ArchivedBanner } from '@/components/common/ArchivedBanner';
import { IssueModal } from '@/features/kanban/components/IssueModal';
import { SprintSummaryModal } from '@/features/sprints/SprintSummaryModal';
import { SprintRetroPanel } from '@/features/sprints/SprintRetroPanel';
import { SprintDatePicker } from '@/components/SprintDatePicker';
import { CustomSelect } from '@/components/common/CustomSelect';
import { ProcessDefinitionPanel } from '@/features/process-definitions/ProcessDefinitionPanel';
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
  projectId: string;
  onConfirm: (action: 'backlog' | 'next_sprint', nextSprintId?: string) => void;
  onClose: () => void;
  isPending: boolean;
}

function CompleteSprintModal({ sprint, unfinishedIssues, plannedSprints, projectId, onConfirm, onClose, isPending }: CompleteModalProps) {
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', color: 'var(--bb-text-primary)' }}>
                  <input type="radio" name="action" value="backlog" checked={action === 'backlog'} onChange={() => setAction('backlog')} />
                  Move to <strong>Backlog</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', color: 'var(--bb-text-primary)', opacity: plannedSprints.length === 0 ? 0.4 : 1 }}>
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
                  <div style={{ marginLeft: 24 }}>
                    <CustomSelect
                      value={nextSprintId}
                      onChange={setNextSprintId}
                      options={plannedSprints.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <ProcessDefinitionPanel
          projectId={projectId}
          context="sprint_completion"
          compact={false}
        />

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
  serverError?: string | null;
  onClearError?: () => void;
  existingSprints: Sprint[];
}

function CreateSprintModal({ onConfirm, onClose, isPending, serverError, onClearError, existingSprints }: CreateSprintModalProps) {
  const [name,        setName]        = useState('');
  const [goal,        setGoal]        = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [showCal,     setShowCal]     = useState(false);

  function handleConfirm() {
    onConfirm(name.trim(), goal.trim(), startDate, endDate);
  }

  function handleClear() {
    setStartDate(''); setEndDate(''); onClearError?.();
  }

  const CalIcon = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1 7h14" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="kb-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="kb-modal-wide bb-modal-animate" style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="kb-modal-header">
          <span className="kb-modal-title">Create Sprint</span>
          <button className="kb-modal-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div className="kb-field">
            <label className="kb-label">Sprint name <span className="kb-required">*</span></label>
            <input className="kb-input" placeholder="e.g. Sprint 14" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="kb-field">
            <label className="kb-label">Goal</label>
            <input className="kb-input" placeholder="What is the sprint goal?" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>

          {/* Date trigger row */}
          <div>
            <label className="kb-label">Sprint dates</label>
            <div
              onClick={() => setShowCal((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
                border: `1px solid ${showCal ? '#E75026' : 'var(--bb-border)'}`,
                background: 'var(--kb-input-bg, var(--bb-surface))',
                fontSize: 13, color: 'var(--bb-text-primary)',
                userSelect: 'none', transition: 'border-color .15s',
              }}
            >
              <CalIcon />
              {startDate ? (
                <span>
                  {startDate}
                  {endDate
                    ? <> &rarr; {endDate}</>
                    : <span style={{ color: 'var(--bb-text-muted)' }}> → pick end date</span>}
                </span>
              ) : (
                <span style={{ color: 'var(--bb-text-muted)' }}>Select date range…</span>
              )}
              {(startDate || endDate) ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleClear(); }}
                  style={{ marginLeft: 'auto', fontSize: 11, color: '#E75026', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Clear
                </button>
              ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 'auto', color: 'var(--bb-text-muted)' }}>
                  <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>

          {/* Calendar — inline, no fixed positioning */}
          {showCal && (
            <div style={{
              background: 'var(--kb-modal-bg, var(--bb-surface))',
              border: '1px solid var(--bb-border)',
              borderRadius: 12,
              padding: '16px 20px 14px',
            }}>
              <SprintDatePicker
                startDate={startDate}
                endDate={endDate}
                onStartChange={(v) => { setStartDate(v); onClearError?.(); }}
                onEndChange={(v) => { setEndDate(v); onClearError?.(); }}
                existingSprints={existingSprints}
              />
              {startDate && endDate && (
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowCal(false)}
                    style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#E75026', border: 'none', borderRadius: 6, padding: '5px 16px', cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}

          {serverError && (
            <span style={{ fontSize: 12, color: '#DE350B', marginTop: -6 }}>
              {serverError}
            </span>
          )}
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

function IssueRow({
  issue, onClick, selectable, selected, onSelect,
}: {
  issue: Issue;
  onClick?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  const subtaskTotal = issue.subtaskCount ?? 0;
  const subtaskDone  = subtaskTotal > 0 ? Math.round((issue.progress ?? 0) / 100 * subtaskTotal) : 0;

  return (
    <div
      className="bb-issue-row"
      onClick={selectable ? undefined : onClick}
      style={{ cursor: selectable ? 'default' : onClick ? 'pointer' : undefined, background: selected ? 'var(--bb-bg-input)' : undefined }}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => { e.stopPropagation(); onSelect?.(issue.id, e.target.checked); }}
          style={{ marginRight: 6, cursor: 'pointer', flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <span
        className="bb-issue-key"
        onClick={selectable ? onClick : undefined}
        style={{ cursor: selectable ? 'pointer' : undefined }}
      >
        {issue.ticketId ?? issue.id.slice(0, 8).toUpperCase()}
      </span>
      <span
        className="bb-issue-summary"
        onClick={selectable ? onClick : undefined}
        style={{ cursor: selectable ? 'pointer' : undefined }}
      >
        {issue.title}
      </span>

      {/* Subtask progress bar */}
      {subtaskTotal > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{
            width: 56, height: 4, borderRadius: 2,
            background: 'var(--bb-border)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${issue.progress ?? 0}%`,
              background: (issue.progress ?? 0) === 100 ? '#36B37E' : '#E75026',
            }} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--bb-text-muted)', whiteSpace: 'nowrap' }}>
            {subtaskDone}/{subtaskTotal}
          </span>
        </div>
      )}

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
   Bulk Move Action Bar
───────────────────────────────────────────── */
function BulkActionBar({
  selectedCount, sprints, onMove, onCancel, isMoving,
}: {
  selectedCount: number;
  sprints: Sprint[];
  onMove: (sprintId: string | null) => void;
  onCancel: () => void;
  isMoving: boolean;
}) {
  const [targetSprintId, setTargetSprintId] = useState<string>('__backlog__');
  const activeSprints = sprints.filter((s) => s.status === 'active' || s.status === 'planned');

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--bb-bg-card)', border: '1.5px solid var(--bb-border)',
      borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14,
      zIndex: 200, minWidth: 440,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', whiteSpace: 'nowrap' }}>
        {selectedCount} issue{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <span style={{ color: 'var(--bb-border)', fontSize: 18 }}>|</span>
      <span style={{ fontSize: 12, color: 'var(--bb-text-muted)', whiteSpace: 'nowrap' }}>Move to:</span>
      <div style={{ flex: 1, minWidth: 160 }}>
        <CustomSelect
          value={targetSprintId}
          onChange={setTargetSprintId}
          options={[
            { value: '__backlog__', label: 'Backlog' },
            ...activeSprints.map((s) => ({
              value: s.id,
              label: s.name,
              hint: s.status === 'active' ? 'Active' : 'Planned',
            })),
          ]}
        />
      </div>
      <button
        onClick={() => onMove(targetSprintId === '__backlog__' ? null : targetSprintId)}
        disabled={isMoving || selectedCount === 0}
        style={{
          background: '#E75026', color: '#fff', border: 'none', borderRadius: 7,
          padding: '7px 16px', fontSize: 13, fontWeight: 600,
          cursor: isMoving || selectedCount === 0 ? 'not-allowed' : 'pointer',
          opacity: isMoving || selectedCount === 0 ? 0.6 : 1, whiteSpace: 'nowrap',
        }}
      >
        {isMoving ? 'Moving…' : 'Move'}
      </button>
      <button
        onClick={onCancel}
        style={{
          background: 'none', border: '1px solid var(--bb-border)', borderRadius: 7,
          padding: '7px 14px', fontSize: 13, fontWeight: 500,
          color: 'var(--bb-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Cancel
      </button>
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
  onViewSummary: (sprint: Sprint, issues: Issue[]) => void;
  onViewRetro: (sprint: Sprint, issues: Issue[]) => void;
}

function SprintBlock({ sprint, issues, search, collapsed, onToggle, canManage, onStart, onComplete, onIssueClick, onViewSummary, onViewRetro }: SprintBlockProps) {
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
        {isCompleted && (
          <>
            <button className="bb-sprint-action" onClick={(e) => { e.stopPropagation(); onViewSummary(sprint, issues); }}>
              View Summary
            </button>
            <button
              className="bb-sprint-action"
              style={{ color: '#0052CC', borderColor: '#0052CC' }}
              onClick={(e) => { e.stopPropagation(); onViewRetro(sprint, issues); }}
            >
              AI Retro
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="bb-sprint-issues-animate">
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
   Backlog Block
───────────────────────────────────────────── */
function BacklogBlock({
  issues, search, collapsed, onToggle, canManage,
  onIssueClick,
  selectionMode, selectedIds, onToggleSelect, onSelectAll, onEnterSelection,
}: {
  issues: Issue[]; search: string; collapsed: boolean; onToggle: () => void;
  canManage: boolean;
  onIssueClick: (issue: Issue) => void;
  selectionMode: boolean; selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEnterSelection: () => void;
}) {
  const q = search.toLowerCase();
  const filtered = search.trim() ? issues.filter((i) => i.title.toLowerCase().includes(q)) : issues;
  const allSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));

  return (
    <div className="bb-sprint-block">
      <div className="bb-sprint-header" onClick={onToggle}>
        {selectionMode && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => { e.stopPropagation(); onSelectAll(e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            style={{ marginRight: 4, cursor: 'pointer' }}
            title="Select all"
          />
        )}
        <span className={`bb-sprint-chevron${collapsed ? '' : ' open'}`}>▶</span>
        <span className="bb-sprint-name">Backlog</span>
        <span className="bb-sprint-count">{issues.length} issues</span>
        <span style={{ flex: 1 }} />
        {canManage && !selectionMode && issues.length > 0 && (
          <button
            className="bb-sprint-action"
            onClick={(e) => { e.stopPropagation(); onEnterSelection(); }}
            style={{ marginRight: 6 }}
          >
            Move to Sprint
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="bb-issue-list bb-sprint-issues-animate">
          {filtered.length === 0
            ? <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--bb-bl-count)', fontStyle: 'italic' }}>No backlog issues.</div>
            : filtered.map((i) => (
              <IssueRow
                key={i.id}
                issue={i}
                onClick={() => onIssueClick(i)}
                selectable={selectionMode}
                selected={selectedIds.has(i.id)}
                onSelect={onToggleSelect}
              />
            ))
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
  const { isArchived, isWriteLocked } = useArchivedProject(projectId);
  const canManageSprints = can('manageProjectMembers') && !isWriteLocked;
  const canMoveIssue     = can('moveIssue')            && !isWriteLocked;
  const canEditIssue     = can('editIssue')            && !isWriteLocked;
  const qc = useQueryClient();

  const { data: sprints = [], isLoading: sprintsLoading } = useSprints(projectId);
  const { data: allIssues = [], isLoading: issuesLoading } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => issuesApi.getAll(projectId),
    enabled: !!projectId,
  });

  const startSprint    = useStartSprint();
  const completeSprint = useCompleteSprint();
  const createSprint   = useCreateSprint();

  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const pm of projectMembers) map[pm.user.id] = pm.user.name;
    return map;
  }, [projectMembers]);

  const { toastMsg, toastVisible, toastIsError, showToast } = useToast();

  const [collapsed,       setCollapsed]       = useState<Record<string, boolean>>({});
  const [search,          setSearch]          = useState('');
  const [completeModal,   setCompleteModal]   = useState<{ sprint: Sprint; unfinished: Issue[] } | null>(null);
  const [summaryModal,    setSummaryModal]    = useState<{ sprint: Sprint; issues: Issue[]; movedInfo?: { action: 'backlog' | 'next_sprint'; nextSprintName?: string; count: number } } | null>(null);
  const [retroPanel,      setRetroPanel]      = useState<{ sprint: Sprint; issues: Issue[] } | null>(null);
  const [showCreateModal,    setShowCreateModal]    = useState(false);
  const [createSprintError,  setCreateSprintError]  = useState<string | null>(null);
  const [issueModalOpen,  setIssueModalOpen]  = useState(false);
  const [selectedIssue,   setSelectedIssue]   = useState<Issue | null>(null);

  // Bulk move state
  const [selectionMode,   setSelectionMode]   = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [isMoving,        setIsMoving]        = useState(false);

  const issuesBySprint = useMemo(() => {
    const map: Record<string, Issue[]> = {};
    for (const issue of allIssues) {
      const key = issue.sprintId ?? '__backlog__';
      if (!map[key]) map[key] = [];
      map[key].push(issue);
    }
    return map;
  }, [allIssues]);

  const backlogIssues  = issuesBySprint['__backlog__'] ?? [];
  const plannedSprints = sprints.filter((s) => s.status === 'planned');
  const statusOrder: Record<SprintStatus, number> = { active: 0, planned: 1, completed: 2 };
  const visibleSprints = [...sprints].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  const totalIssues    = allIssues.length;

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
    const { sprint, unfinished } = completeModal;
    const sprintIssues = issuesBySprint[sprint.id] ?? [];
    const nextSprintName = nextSprintId ? sprints.find((s) => s.id === nextSprintId)?.name : undefined;
    completeSprint.mutate(
      { sprintId: sprint.id, projectId, dto: { unfinishedAction: action, nextSprintId } },
      {
        onSuccess: () => {
          setCompleteModal(null);
          setSummaryModal({
            sprint,
            issues: sprintIssues,
            movedInfo: unfinished.length > 0
              ? { action, nextSprintName, count: unfinished.length }
              : undefined,
          });
        },
        onError: (err) => { setCompleteModal(null); showToast(beError(err), true); },
      },
    );
  }

  function handleCreateSprint(name: string, goal: string, startDate: string, endDate: string) {
    setCreateSprintError(null);
    createSprint.mutate(
      { projectId, name, goal, startDate: startDate || undefined, endDate: endDate || undefined },
      {
        onSuccess: () => { setShowCreateModal(false); setCreateSprintError(null); showToast(`${name} created`); },
        onError: (err) => {
          const ax = err as import('axios').AxiosError<Record<string, string[]>>;
          const data = ax?.response?.data;
          // Extract first field error (startDate / endDate / non_field_errors)
          const msg = data
            ? Object.values(data).flat()[0]
            : 'Failed to create sprint';
          setCreateSprintError(msg ?? 'Failed to create sprint');
        },
      },
    );
  }

  // Bulk move
  function handleToggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    const q = search.toLowerCase();
    const visible = search.trim() ? backlogIssues.filter((i) => i.title.toLowerCase().includes(q)) : backlogIssues;
    setSelectedIds(checked ? new Set(visible.map((i) => i.id)) : new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkMove(sprintId: string | null) {
    if (selectedIds.size === 0) return;
    setIsMoving(true);
    try {
      await issuesApi.bulkUpdate(Array.from(selectedIds), { sprintId } as any);
      qc.invalidateQueries({ queryKey: ['issues', projectId] });
      showToast(`${selectedIds.size} issue${selectedIds.size !== 1 ? 's' : ''} moved`);
      exitSelectionMode();
    } catch {
      showToast('Failed to move some issues', true);
    } finally {
      setIsMoving(false);
    }
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

      {/* Archived banner */}
      {isArchived && <ArchivedBanner viewOnly={isWriteLocked} />}

      {/* Topbar */}
      <div style={{ height: 53, background: 'var(--bb-topbar-bg)', borderBottom: '1px solid var(--bb-topbar-border)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 10, flexShrink: 0, position: 'sticky', top: 0, zIndex: 20 }}>
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
        {canManageSprints && (
          <button
            className="bb-bl-tb-btn bb-bl-tb-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + New sprint
          </button>
        )}
        {canEditIssue && (
          <button
            className="bb-bl-tb-btn bb-bl-tb-btn-primary"
            onClick={() => { setSelectedIssue(null); setIssueModalOpen(true); }}
          >
            + Create issue
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 80px' }}>

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
            canManage={canManageSprints}
            plannedSprints={plannedSprints}
            onStart={() => handleStartSprint(sprint)}
            onComplete={handleOpenCompleteModal}
            onIssueClick={(issue) => { setSelectedIssue(issue); setIssueModalOpen(true); }}
            onViewSummary={(s, issues) => setSummaryModal({ sprint: s, issues })}
            onViewRetro={(s, issues) => setRetroPanel({ sprint: s, issues })}
          />
        ))}

        {/* Backlog block */}
        <BacklogBlock
          issues={backlogIssues}
          search={search}
          collapsed={!!collapsed['__backlog__']}
          onToggle={() => setCollapsed((p) => ({ ...p, __backlog__: !p.__backlog__ }))}
          canManage={canMoveIssue}
          onIssueClick={(issue) => { setSelectedIssue(issue); setIssueModalOpen(true); }}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onEnterSelection={() => setSelectionMode(true)}
        />
      </div>

      {/* Bulk action bar */}
      {selectionMode && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          sprints={sprints}
          onMove={handleBulkMove}
          onCancel={exitSelectionMode}
          isMoving={isMoving}
        />
      )}

      {/* Create / Edit Issue Modal */}
      <IssueModal
        issue={selectedIssue}
        isOpen={issueModalOpen}
        projectId={projectId}
        onClose={() => { setIssueModalOpen(false); setSelectedIssue(null); }}
        onNavigate={(issue) => { setSelectedIssue(issue); setIssueModalOpen(true); }}
        readOnly={isWriteLocked}
      />

      {/* Sprint Summary Modal */}
      {summaryModal && (
        <SprintSummaryModal
          sprint={summaryModal.sprint}
          issues={summaryModal.issues}
          movedInfo={summaryModal.movedInfo}
          memberNames={memberNames}
          onClose={() => setSummaryModal(null)}
          onGenerateRetro={() => {
            const { sprint, issues } = summaryModal;
            setSummaryModal(null);
            setRetroPanel({ sprint, issues });
          }}
        />
      )}

      {/* AI Sprint Retro Panel */}
      {retroPanel && (
        <SprintRetroPanel
          sprint={retroPanel.sprint}
          issues={retroPanel.issues}
          projectId={projectId}
          memberNames={memberNames}
          onClose={() => setRetroPanel(null)}
        />
      )}

      {/* Complete Sprint Modal */}
      {completeModal && (
        <CompleteSprintModal
          sprint={completeModal.sprint}
          unfinishedIssues={completeModal.unfinished}
          plannedSprints={plannedSprints}
          projectId={projectId}
          onConfirm={handleConfirmComplete}
          onClose={() => setCompleteModal(null)}
          isPending={completeSprint.isPending}
        />
      )}

      {/* Create Sprint Modal */}
      {showCreateModal && (
        <CreateSprintModal
          onConfirm={handleCreateSprint}
          onClose={() => { setShowCreateModal(false); setCreateSprintError(null); }}
          isPending={createSprint.isPending}
          serverError={createSprintError}
          onClearError={() => setCreateSprintError(null)}
          existingSprints={sprints}
        />
      )}

      {/* Toast */}
      <div
        className={`bb-toast${toastVisible ? ' bb-toast-show bb-toast-enter' : ' bb-toast-exit'}`}
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
