import type { Sprint, Issue } from '@/types';

interface MovedInfo {
  action: 'backlog' | 'next_sprint';
  nextSprintName?: string;
  count: number;
}

interface Props {
  sprint: Sprint;
  issues: Issue[];           // all issues that were in this sprint
  movedInfo?: MovedInfo;     // only available right after completion
  memberNames: Record<string, string>; // assigneeId → name
  onClose: () => void;
  onGenerateRetro?: () => void;   // open the AI retro panel
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#DE350B',
  high:     '#FF5630',
  medium:   '#FF991F',
  low:      '#36B37E',
};
const PRIORITY_BG: Record<string, string> = {
  critical: '#FFEBE6',
  high:     '#FFF0E6',
  medium:   '#FFFAE6',
  low:      '#E3FCEF',
};

export function SprintSummaryModal({ sprint, issues, movedInfo, memberNames, onClose, onGenerateRetro }: Props) {
  const total      = issues.length;
  const done       = issues.filter((i) => i.status === 'done');
  const notDone    = issues.filter((i) => i.status !== 'done');
  const ptsTotal   = issues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const ptsDone    = done.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
  const pct        = total > 0 ? Math.round((done.length / total) * 100) : 0;

  // Duration
  const duration = (() => {
    if (!sprint.startDate || !sprint.endDate) return null;
    const ms = new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime();
    return Math.round(ms / 86_400_000) + 1;
  })();

  // By status
  const byStatus = ['done', 'in_progress', 'review', 'todo'].map((s) => ({
    label: s === 'in_progress' ? 'In Progress' : s === 'todo' ? 'To Do' : s === 'review' ? 'In Review' : 'Done',
    count: issues.filter((i) => i.status === s).length,
    color: s === 'done' ? '#1D9E75' : s === 'in_progress' ? '#D85A30' : s === 'review' ? '#378ADD' : '#888780',
  }));

  // By priority
  const priorities = ['critical', 'high', 'medium', 'low'];
  const byPriority = priorities.map((p) => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    count: issues.filter((i) => i.priority === p).length,
    color: PRIORITY_COLOR[p],
    bg:    PRIORITY_BG[p],
  })).filter((p) => p.count > 0);

  // By type
  const byType = ['task', 'bug', 'subtask'].map((t) => ({
    label: t.charAt(0).toUpperCase() + t.slice(1),
    count: issues.filter((i) => (i.issueType ?? 'task') === t).length,
    color: t === 'bug' ? '#DE350B' : t === 'subtask' ? '#6554C0' : '#0052CC',
    bg:    t === 'bug' ? '#FFEBE6' : t === 'subtask' ? '#EAE6FF' : '#DEEBFF',
  })).filter((t) => t.count > 0);

  // By assignee
  const assigneeMap: Record<string, { name: string; total: number; done: number; pts: number }> = {};
  for (const issue of issues) {
    const id   = issue.assigneeId ?? '__unassigned__';
    const name = id === '__unassigned__' ? 'Unassigned' : (memberNames[id] ?? 'Unknown');
    if (!assigneeMap[id]) assigneeMap[id] = { name, total: 0, done: 0, pts: 0 };
    assigneeMap[id].total++;
    if (issue.status === 'done') assigneeMap[id].done++;
    assigneeMap[id].pts += issue.storyPoints ?? 0;
  }
  const byAssignee = Object.values(assigneeMap).sort((a, b) => b.done - a.done);

  return (
    <div
      className="kb-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bb-modal-animate"
        style={{
          width: '100%', maxWidth: 680,
          maxHeight: '90vh',
          background: 'var(--bb-modal-bg, var(--bb-surface))',
          border: '1px solid var(--bb-modal-border, var(--bb-border))',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(23,43,77,.22)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '22px 28px 18px',
          borderBottom: '1px solid var(--bb-modal-border, var(--bb-border))',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
                color: '#1D9E75', background: '#E3FCEF',
                borderRadius: 20, padding: '2px 10px',
                textTransform: 'uppercase',
              }}>
                Sprint Complete
              </span>
              {duration && (
                <span style={{ fontSize: 12, color: 'var(--bb-text-muted)' }}>
                  {duration} day{duration !== 1 ? 's' : ''}
                  {sprint.startDate && sprint.endDate && ` · ${sprint.startDate} → ${sprint.endDate}`}
                </span>
              )}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--bb-text-primary)', letterSpacing: '-0.3px' }}>
              {sprint.name}
            </div>
            {sprint.goal && (
              <div style={{ fontSize: 13, color: 'var(--bb-text-secondary)', marginTop: 3 }}>
                Goal: {sprint.goal}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--bb-text-muted)', padding: 4, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-hover-bg, #F4F5F7)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '22px 28px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── KPI cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Completed',     value: `${done.length} / ${total}`, sub: 'issues',        color: '#1D9E75' },
              { label: 'Completion',    value: `${pct}%`,                   sub: 'of issues done', color: pct >= 80 ? '#1D9E75' : pct >= 50 ? '#FF991F' : '#DE350B' },
              { label: 'Story Points',  value: `${ptsDone} / ${ptsTotal}`,  sub: 'pts completed',  color: '#0052CC' },
              { label: 'Not Completed', value: String(notDone.length),      sub: 'issues remaining', color: notDone.length === 0 ? '#1D9E75' : '#FF5630' },
            ].map((card) => (
              <div key={card.label} style={{
                background: 'var(--bb-tbl-wrap-bg)',
                border: '1px solid var(--bb-tbl-wrap-border)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color, letterSpacing: '-0.5px' }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', marginTop: 2 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Progress bar ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-secondary)' }}>Issue completion</span>
              <span style={{ fontSize: 12, color: 'var(--bb-text-muted)' }}>{pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'var(--bb-tbl-wrap-border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#1D9E75' : pct >= 50 ? '#FF991F' : '#DE350B', borderRadius: 99, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* ── Status breakdown ── */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', marginBottom: 10 }}>By Status</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {byStatus.filter((s) => s.count > 0).map((s) => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bb-tbl-wrap-bg)',
                  border: '1px solid var(--bb-tbl-wrap-border)',
                  borderRadius: 20, padding: '5px 12px',
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--bb-text-primary)' }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Priority + Type ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', marginBottom: 10 }}>By Priority</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {byPriority.map((p) => (
                  <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: p.color, background: p.bg, borderRadius: 20, padding: '2px 10px', minWidth: 64, textAlign: 'center' }}>
                      {p.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', marginBottom: 10 }}>By Type</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {byType.map((t) => (
                  <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.color, background: t.bg, borderRadius: 20, padding: '2px 10px', minWidth: 64, textAlign: 'center' }}>
                      {t.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>{t.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Moved issues info (only right after close) ── */}
          {movedInfo && movedInfo.count > 0 && (
            <div style={{
              background: '#FFFAE6',
              border: '1px solid #FFE380',
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" stroke="#FF991F" strokeWidth="1.4"/>
                <path d="M8 5v3M8 10.5v.5" stroke="#FF991F" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 13, color: '#7A5800' }}>
                <strong>{movedInfo.count} unfinished issue{movedInfo.count !== 1 ? 's' : ''}</strong> moved to{' '}
                {movedInfo.action === 'backlog'
                  ? <strong>Backlog</strong>
                  : <><strong>Sprint</strong>{movedInfo.nextSprintName ? ` "${movedInfo.nextSprintName}"` : ''}</>
                }
              </span>
            </div>
          )}

          {/* ── Per-assignee breakdown ── */}
          {byAssignee.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', marginBottom: 10 }}>By Assignee</div>
              <div style={{
                background: 'var(--bb-tbl-wrap-bg)',
                border: '1px solid var(--bb-tbl-wrap-border)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Assignee', 'Assigned', 'Done', 'Story Pts'].map((h, i) => (
                        <th key={h} style={{
                          padding: '9px 16px', fontSize: 11, fontWeight: 600,
                          letterSpacing: '0.07em', textTransform: 'uppercase',
                          color: 'var(--bb-text-muted)',
                          textAlign: i === 0 ? 'left' : 'center',
                          background: 'var(--bb-tbl-head-bg)',
                          borderBottom: '1px solid var(--bb-tbl-wrap-border)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byAssignee.map((a, idx) => (
                      <tr key={a.name} style={{ borderBottom: idx < byAssignee.length - 1 ? '1px solid var(--bb-tbl-row-border)' : 'none' }}>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--bb-text-primary)', fontWeight: 500 }}>{a.name}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--bb-text-secondary)', textAlign: 'center' }}>{a.total}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: a.done === a.total ? '#1D9E75' : 'var(--bb-text-primary)' }}>
                            {a.done}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--bb-text-muted)' }}>/{a.total}</span>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#0052CC', textAlign: 'center' }}>{a.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Unfinished issues list ── */}
          {notDone.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', marginBottom: 10 }}>
                Unfinished Issues <span style={{ color: '#FF5630', fontWeight: 700 }}>({notDone.length})</span>
              </div>
              <div style={{
                background: 'var(--bb-tbl-wrap-bg)',
                border: '1px solid var(--bb-tbl-wrap-border)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                {notDone.map((issue, idx) => (
                  <div key={issue.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                    borderBottom: idx < notDone.length - 1 ? '1px solid var(--bb-tbl-row-border)' : 'none',
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[issue.priority] ?? '#888',
                      background: PRIORITY_BG[issue.priority] ?? '#F4F5F7',
                      borderRadius: 4, padding: '2px 6px', flexShrink: 0,
                    }}>
                      {issue.priority.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--bb-text-muted)', flexShrink: 0 }}>
                      {issue.ticketId ?? ''}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--bb-text-primary)', flex: 1 }}>{issue.title}</span>
                    {issue.assigneeId && memberNames[issue.assigneeId] && (
                      <span style={{ fontSize: 11, color: 'var(--bb-text-muted)', flexShrink: 0 }}>
                        {memberNames[issue.assigneeId]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AI Retro CTA ── */}
          {onGenerateRetro && (
            <div style={{
              paddingTop: 8,
              borderTop: '1px solid var(--bb-tbl-wrap-border)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <button
                onClick={() => { onClose(); onGenerateRetro(); }}
                style={{
                  width: '100%', padding: '11px 20px',
                  background: '#0052CC', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', letterSpacing: '-0.1px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#0747A6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#0052CC')}
              >
                Generate AI Retro
              </button>
              <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', textAlign: 'center' }}>
                AI will analyse this sprint and generate wins, bottlenecks, and action items
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
