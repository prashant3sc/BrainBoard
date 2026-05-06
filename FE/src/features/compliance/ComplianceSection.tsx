import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/api/compliance';
import type { ComplianceCheck, ComplianceCheckStatus } from '@/types';
import useAuthStore from '@/store/useAuthStore';

interface Props {
  issueId: string;
  projectId?: string;
  readOnly?: boolean;
}

const ROLE_ORDER: Record<string, number> = { admin: 0, pm: 1, developer: 2, viewer: 3 };

function roleSufficient(userRole: string, required: string) {
  return (ROLE_ORDER[userRole] ?? 99) <= (ROLE_ORDER[required] ?? 99);
}

const STATUS_CONFIG: Record<
  ComplianceCheckStatus,
  { label: string; dotColor: string; bg: string; color: string }
> = {
  pending:      { label: 'Pending',  dotColor: '#F59E0B', bg: '#FFF7ED', color: '#C2410C' },
  complete:     { label: 'Complete', dotColor: '#E75026', bg: '#FFF3F0', color: '#E75026' },
  blocked:      { label: 'Blocked',  dotColor: '#EF4444', bg: '#FEF2F2', color: '#B91C1C' },
  not_required: { label: 'N/A',      dotColor: '#94A3B8', bg: '#F4F5F7', color: '#64748B' },
};

/* ── Three-dot menu ── */
function StatusMenu({
  check,
  onUpdate,
  onClose,
}: {
  check: ComplianceCheck;
  onUpdate: (status: ComplianceCheckStatus) => void;
  onClose: () => void;
}) {
  const options: { status: ComplianceCheckStatus; label: string }[] = [
    { status: 'complete',     label: '✅  Mark Complete' },
    { status: 'blocked',      label: '🚫  Mark Blocked' },
    { status: 'not_required', label: '—  Mark N/A' },
    { status: 'pending',      label: '↺  Reset to Pending' },
  ].filter((o) => o.status !== check.status);

  return (
    <div className="cs-menu">
      {options.map((o) => (
        <button
          key={o.status}
          className="cs-menu-item"
          onClick={() => { onUpdate(o.status); onClose(); }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CheckCard({
  check,
  onUpdate,
  canAct,
}: {
  check: ComplianceCheck;
  onUpdate: (checkId: string, status: ComplianceCheckStatus, note: string) => void;
  canAct: boolean;
}) {
  const [note, setNote]         = useState(check.note ?? '');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cfg     = STATUS_CONFIG[check.status];
  const gates   = check.blocksOn ? check.blocksOn.split(',').map((s) => s.trim()) : [];
  const isDone  = check.status === 'complete' || check.status === 'not_required';

  const notePlaceholder = check.templateName
    ? `Add a note for ${check.templateName.toLowerCase()} (optional)…`
    : 'Add a note (optional)…';

  function handleCircleClick() {
    if (!canAct) return;
    const next: ComplianceCheckStatus = isDone ? 'pending' : 'complete';
    onUpdate(check.id, next, note);
  }

  return (
    <div className="cs-card">
      {/* ── Left: circle toggle + info ── */}
      <div className="cs-card-left">
        <button
          className={`cs-circle${isDone ? ' cs-circle-done' : ''}`}
          onClick={handleCircleClick}
          disabled={!canAct}
          title={isDone ? 'Mark as pending' : 'Mark as complete'}
        >
          {isDone && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        <div className="cs-card-info">
          <span className={`cs-card-name${isDone ? ' cs-card-name-done' : ''}`}>
            {check.templateName}
          </span>
          {gates.length > 0 && (
            <span className="cs-card-gates">
              gates: {gates.join(', ')}
            </span>
          )}
          {check.completedBy && (
            <span className="cs-card-completed-by">
              ✓ {check.completedBy.name}
              {check.completedAt && ` · ${new Date(check.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
            </span>
          )}
        </div>
      </div>

      {/* ── Center: badge + menu ── */}
      <div className="cs-card-center">
        <span
          className="cs-badge-new"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          <span className="cs-badge-dot" style={{ background: cfg.dotColor }} />
          {cfg.label}
        </span>

        {canAct && (
          <div className="cs-menu-wrap" ref={menuRef}>
            <button
              className="cs-dots-btn"
              onClick={() => setMenuOpen((v) => !v)}
              title="Change status"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="2.5" cy="7" r="1.2" fill="currentColor"/>
                <circle cx="7"   cy="7" r="1.2" fill="currentColor"/>
                <circle cx="11.5" cy="7" r="1.2" fill="currentColor"/>
              </svg>
            </button>
            {menuOpen && (
              <StatusMenu
                check={check}
                onUpdate={(status) => onUpdate(check.id, status, note)}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Right: note textarea ── */}
      <textarea
        className="cs-note-textarea"
        value={note}
        disabled={!canAct}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => {
          if (canAct && note !== (check.note ?? '')) {
            onUpdate(check.id, check.status, note);
          }
        }}
        placeholder={notePlaceholder}
        rows={2}
      />
    </div>
  );
}

export function ComplianceSection({ issueId, projectId, readOnly = false }: Props) {
  const user = useAuthStore((s) => s.user);
  const qc   = useQueryClient();

  const { data: checks = [], isLoading, isError, refetch } = useQuery<ComplianceCheck[]>({
    queryKey: ['compliance-checks', issueId],
    queryFn:  () => complianceApi.listChecks(issueId),
  });

  const { mutate: updateCheck } = useMutation({
    mutationFn: ({ checkId, status, note }: { checkId: string; status: string; note: string }) =>
      complianceApi.updateCheck(issueId, checkId, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-checks', issueId] });
      if (projectId) qc.invalidateQueries({ queryKey: ['issues', projectId] });
    },
  });

  if (isLoading) return <div className="cs-loading">Loading compliance checks…</div>;
  if (isError) return (
    <div className="cs-error">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2zm0 4v4m0 2.5v1" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <span>Failed to load compliance checks.</span>
      <button className="cs-retry-btn" onClick={() => refetch()}>Retry</button>
    </div>
  );
  if (checks.length === 0) return null;

  const completeCount = checks.filter((c) => c.status === 'complete' || c.status === 'not_required').length;
  const totalCount    = checks.length;
  const pct           = totalCount > 0 ? Math.round((completeCount / totalCount) * 100) : 0;

  return (
    <div className="cs-root">
      {/* ── Header ── */}
      <div className="cs-header">
        <span className="cs-header-label">Compliance</span>
        <div className="cs-header-right">
          <div className="cs-header-bar">
            <div className="cs-header-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="cs-header-count">{completeCount} of {totalCount}</span>
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="cs-cards">
        {checks.map((check) => {
          const canAct = !readOnly && !!user && roleSufficient(user.role, check.requiredRole);
          return (
            <CheckCard
              key={check.id}
              check={check}
              canAct={canAct}
              onUpdate={(checkId, status, note) => updateCheck({ checkId, status, note })}
            />
          );
        })}
      </div>
    </div>
  );
}
