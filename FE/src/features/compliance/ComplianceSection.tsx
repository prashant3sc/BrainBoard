import { useState } from 'react';
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
  { label: string; dot: string; badge: string }
> = {
  pending:      { label: 'Pending',      dot: '#F79009', badge: 'cs-badge-pending' },
  complete:     { label: 'Complete',     dot: '#22C55E', badge: 'cs-badge-complete' },
  blocked:      { label: 'Blocked',      dot: '#EF4444', badge: 'cs-badge-blocked' },
  not_required: { label: 'N/A',          dot: '#94A3B8', badge: 'cs-badge-na' },
};

function CheckRow({
  check,
  onUpdate,
  canAct,
}: {
  check: ComplianceCheck;
  onUpdate: (checkId: string, status: ComplianceCheckStatus, note: string) => void;
  canAct: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(check.note ?? '');
  const cfg = STATUS_CONFIG[check.status];
  const blocks = check.blocksOn ? check.blocksOn.split(',').map((s) => s.trim()) : [];

  return (
    <div className="cs-check-row">
      <div className="cs-check-header" onClick={() => setExpanded((e) => !e)}>
        <span className="cs-check-dot" style={{ background: cfg.dot }} />
        <span className="cs-check-name">{check.templateName}</span>
        {blocks.length > 0 && (
          <span className="cs-check-blocks" title={`Blocks transition to: ${blocks.join(', ')}`}>
            gates {blocks.map((b) => <code key={b}>{b}</code>)}
          </span>
        )}
        <span className={`cs-badge ${cfg.badge}`}>{cfg.label}</span>
        <svg
          className={`cs-chevron${expanded ? ' cs-chevron-open' : ''}`}
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {expanded && (
        <div className="cs-check-body">
          {check.description && (
            <p className="cs-check-desc">{check.description}</p>
          )}
          {check.completedBy && (
            <p className="cs-check-meta">
              Completed by <strong>{check.completedBy.name}</strong>
              {check.completedAt && ` · ${new Date(check.completedAt).toLocaleDateString()}`}
            </p>
          )}
          <label className="cs-note-label">Note</label>
          <textarea
            className="cs-note-input"
            rows={2}
            value={note}
            disabled={!canAct}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note…"
          />
          {canAct && (
            <div className="cs-check-actions">
              {check.status !== 'complete' && (
                <button
                  className="cs-btn cs-btn-complete"
                  onClick={() => onUpdate(check.id, 'complete', note)}
                >
                  Mark Complete
                </button>
              )}
              {check.status !== 'not_required' && (
                <button
                  className="cs-btn cs-btn-na"
                  onClick={() => onUpdate(check.id, 'not_required', note)}
                >
                  Mark N/A
                </button>
              )}
              {check.status !== 'blocked' && (
                <button
                  className="cs-btn cs-btn-blocked"
                  onClick={() => onUpdate(check.id, 'blocked', note)}
                >
                  Mark Blocked
                </button>
              )}
              {check.status !== 'pending' && (
                <button
                  className="cs-btn cs-btn-reset"
                  onClick={() => onUpdate(check.id, 'pending', note)}
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ComplianceSection({ issueId, projectId, readOnly = false }: Props) {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: checks = [], isLoading } = useQuery<ComplianceCheck[]>({
    queryKey: ['compliance-checks', issueId],
    queryFn: () => complianceApi.listChecks(issueId),
  });

  const { mutate: updateCheck } = useMutation({
    mutationFn: ({ checkId, status, note }: { checkId: string; status: string; note: string }) =>
      complianceApi.updateCheck(issueId, checkId, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-checks', issueId] });
      if (projectId) {
        qc.invalidateQueries({ queryKey: ['issues', projectId] });
      }
    },
  });

  if (isLoading) {
    return <div className="cs-loading">Loading compliance checks…</div>;
  }

  if (checks.length === 0) {
    return (
      <div className="cs-empty">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2zm0 4v4m0 2.5v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        No compliance checks configured for this project.
      </div>
    );
  }

  const completeCount = checks.filter((c) => c.status === 'complete' || c.status === 'not_required').length;
  const totalCount    = checks.length;
  const pct           = Math.round((completeCount / totalCount) * 100);

  return (
    <div className="cs-root">
      <div className="cs-header">
        <span className="cs-title">Compliance</span>
        <span className="cs-summary">
          {completeCount}/{totalCount}
          <span className="cs-bar-wrap">
            <span className="cs-bar-fill" style={{ width: `${pct}%` }} />
          </span>
        </span>
      </div>

      <div className="cs-list">
        {checks.map((check) => {
          const canAct =
            !readOnly &&
            !!user &&
            roleSufficient(user.role, check.requiredRole);
          return (
            <CheckRow
              key={check.id}
              check={check}
              canAct={canAct}
              onUpdate={(checkId, status, note) =>
                updateCheck({ checkId, status, note })
              }
            />
          );
        })}
      </div>
    </div>
  );
}
