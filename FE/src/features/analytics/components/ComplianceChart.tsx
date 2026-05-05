import { useQuery } from '@tanstack/react-query';
import { complianceApi } from '@/api/compliance';
import type { ComplianceAnalytics } from '@/types';

interface Props {
  projectId: string;
  sprintId?: string;
}

function BarRow({ label, complete, pending, blocked, notRequired, total }: {
  label: string;
  complete: number;
  pending: number;
  blocked: number;
  notRequired: number;
  total: number;
}) {
  if (total === 0) return null;
  const pctComplete    = (complete / total) * 100;
  const pctPending     = (pending / total) * 100;
  const pctBlocked     = (blocked / total) * 100;
  const pctNotRequired = (notRequired / total) * 100;
  const rate = Math.round(pctComplete);

  return (
    <div className="cc-chart-row">
      <div className="cc-chart-label" title={label}>{label}</div>
      <div className="cc-chart-bar-wrap">
        <div className="cc-chart-bar">
          {pctComplete > 0    && <div className="cc-bar-seg cc-seg-complete"    style={{ width: `${pctComplete}%` }}    title={`Complete: ${complete}`} />}
          {pctPending > 0     && <div className="cc-bar-seg cc-seg-pending"     style={{ width: `${pctPending}%` }}     title={`Pending: ${pending}`} />}
          {pctBlocked > 0     && <div className="cc-bar-seg cc-seg-blocked"     style={{ width: `${pctBlocked}%` }}     title={`Blocked: ${blocked}`} />}
          {pctNotRequired > 0 && <div className="cc-bar-seg cc-seg-na"          style={{ width: `${pctNotRequired}%` }} title={`N/A: ${notRequired}`} />}
        </div>
        <span className="cc-chart-rate">{rate}%</span>
      </div>
    </div>
  );
}

export function ComplianceChart({ projectId, sprintId }: Props) {
  const { data, isLoading, isError } = useQuery<ComplianceAnalytics>({
    queryKey: ['compliance-analytics', projectId, sprintId],
    queryFn:  () => complianceApi.getAnalytics(projectId, sprintId),
  });

  if (isLoading) return <div className="an-loading">Loading compliance data…</div>;
  if (isError)   return <div className="an-error">Failed to load compliance analytics.</div>;
  if (!data)     return null;

  const { perTemplate, totalIssues, fullyCompliant, hasBlockers } = data;

  return (
    <div className="cc-chart-root">
      {/* Summary tiles */}
      <div className="cc-tiles">
        <div className="cc-tile">
          <span className="cc-tile-val">{totalIssues}</span>
          <span className="cc-tile-label">Total Issues</span>
        </div>
        <div className="cc-tile cc-tile-green">
          <span className="cc-tile-val">{fullyCompliant}</span>
          <span className="cc-tile-label">Fully Compliant</span>
        </div>
        <div className="cc-tile cc-tile-red">
          <span className="cc-tile-val">{hasBlockers}</span>
          <span className="cc-tile-label">Has Blockers</span>
        </div>
        {totalIssues > 0 && (
          <div className="cc-tile cc-tile-blue">
            <span className="cc-tile-val">{Math.round((fullyCompliant / totalIssues) * 100)}%</span>
            <span className="cc-tile-label">Compliance Rate</span>
          </div>
        )}
      </div>

      {/* Per-template breakdown */}
      {perTemplate.length === 0 ? (
        <div className="cc-empty-state">
          No compliance templates configured for this project.
        </div>
      ) : (
        <>
          <div className="cc-chart-legend">
            <span className="cc-legend-item cc-seg-complete">Complete</span>
            <span className="cc-legend-item cc-seg-pending">Pending</span>
            <span className="cc-legend-item cc-seg-blocked">Blocked</span>
            <span className="cc-legend-item cc-seg-na">N/A</span>
          </div>
          <div className="cc-chart-rows">
            {perTemplate.map((row) => (
              <BarRow
                key={row.templateId}
                label={row.templateName}
                complete={row.complete}
                pending={row.pending}
                blocked={row.blocked}
                notRequired={row.notRequired}
                total={row.total}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
