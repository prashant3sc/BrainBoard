import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { useWorkload } from '../useWorkload';
import type { WorkloadMember } from '@/api/analytics';

interface Props {
  projectId: string;
}

const STATUS_COLORS: Record<string, string> = {
  todo:        '#BFDBFE',
  in_progress: '#FDE68A',
  review:      '#C4B5FD',
  done:        '#6EE7B7',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#DE350B',
  high:     '#FF8B00',
  medium:   '#0065FF',
  low:      '#36B37E',
};

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bb-bg-card)',
      border: '1.5px solid var(--bb-border)',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(9,30,66,0.12)',
      minWidth: 170,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bb-text-primary)', marginBottom: 8 }}>
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: p.fill, fontWeight: 600 }}>{p.name}</span>
          <span style={{ color: 'var(--bb-text-primary)', fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function MemberCard({ member, maxTotal }: { member: WorkloadMember; maxTotal: number }) {
  const pct = maxTotal > 0 ? Math.round((member.total / maxTotal) * 100) : 0;

  const statusSegments = [
    { key: 'done',        label: 'Done',        color: STATUS_COLORS.done },
    { key: 'review',      label: 'Review',      color: STATUS_COLORS.review },
    { key: 'in_progress', label: 'In Progress', color: STATUS_COLORS.in_progress },
    { key: 'todo',        label: 'To Do',       color: STATUS_COLORS.todo },
  ] as const;

  return (
    <div style={{
      background: 'var(--bb-bg-card)',
      border: '1.5px solid var(--bb-border)',
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: member.user_id ? '#E75026' : 'var(--bb-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: member.user_id ? '#fff' : 'var(--bb-text-muted)',
          flexShrink: 0,
        }}>
          {getInitials(member.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bb-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {member.name}
          </div>
          {member.role && (
            <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', textTransform: 'capitalize' }}>{member.role}</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--bb-text-primary)', lineHeight: 1 }}>{member.total}</div>
          <div style={{ fontSize: 10, color: 'var(--bb-text-muted)' }}>issues</div>
        </div>
      </div>

      {/* Stacked progress bar */}
      <div style={{ height: 6, borderRadius: 99, background: 'var(--bb-border)', overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
        {statusSegments.map(({ key, color }) => {
          const count = member[key] as number;
          if (!count || !member.total) return null;
          return (
            <div key={key} style={{
              width: `${(count / member.total) * 100}%`,
              background: color,
              transition: 'width 0.4s ease',
            }} title={`${key}: ${count}`} />
          );
        })}
      </div>

      {/* Status breakdown */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {statusSegments.map(({ key, label, color }) => {
          const count = member[key] as number;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ color: 'var(--bb-text-muted)' }}>{label}</span>
              <span style={{ fontWeight: 700, color: 'var(--bb-text-primary)' }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Footer: story points + workload % */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--bb-border)' }}>
        <span style={{ fontSize: 11, color: 'var(--bb-text-muted)' }}>
          {member.story_points} story pts
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
          background: pct >= 80 ? '#FFEBE6' : pct >= 50 ? '#FFFAE6' : '#E3FCEF',
          color:      pct >= 80 ? '#DE350B' : pct >= 50 ? '#FF8B00' : '#006644',
        }}>
          {pct}% of max
        </span>
      </div>
    </div>
  );
}

export function WorkloadChart({ projectId }: Props) {
  const { data, isLoading, isError } = useWorkload(projectId);

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--bb-text-muted)', fontSize: 13 }}>
      Loading workload data…
    </div>
  );

  if (isError || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--bb-text-muted)', fontSize: 13 }}>
      Failed to load workload data.
    </div>
  );

  if (data.members.length === 0 || data.total_issues === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity={0.25}>
        <circle cx="20" cy="14" r="7" fill="currentColor" />
        <path d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 13, color: 'var(--bb-text-muted)', margin: 0 }}>No issues assigned yet</p>
    </div>
  );

  const chartData = data.members.map((m) => ({
    name: m.name.split(' ')[0],
    'To Do':      m.todo,
    'In Progress': m.in_progress,
    'Review':     m.review,
    'Done':       m.done,
  }));

  const maxTotal = Math.max(...data.members.map((m) => m.total), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary stat row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'Total Issues',    value: data.total_issues,                                      color: undefined },
          { label: 'Team Members',    value: data.members.filter((m) => m.user_id).length,           color: undefined },
          { label: 'Unassigned',      value: data.members.find((m) => !m.user_id)?.total ?? 0,       color: '#FF8B00' },
          { label: 'Avg per Member',  value: data.members.filter((m) => m.user_id).length > 0
              ? Math.round(data.total_issues / data.members.filter((m) => m.user_id).length)
              : 0,                                                                                     color: '#E75026' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1, background: 'var(--bb-bg-input)',
            border: '1.5px solid var(--bb-border)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: color ?? 'var(--bb-text-primary)', lineHeight: 1 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div style={{
        background: 'var(--bb-bg-card)',
        border: '1.5px solid var(--bb-border)',
        borderRadius: 14, padding: '20px 16px 12px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Issues by Member &amp; Status
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bb-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--bb-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--bb-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bb-bg-input)', radius: 4 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--bb-text-secondary)', paddingTop: 12 }} iconType="circle" iconSize={8} />
            <Bar dataKey="To Do"       stackId="a" fill={STATUS_COLORS.todo}        radius={[0, 0, 0, 0]} maxBarSize={48} />
            <Bar dataKey="In Progress" stackId="a" fill={STATUS_COLORS.in_progress} radius={[0, 0, 0, 0]} maxBarSize={48} />
            <Bar dataKey="Review"      stackId="a" fill={STATUS_COLORS.review}      radius={[0, 0, 0, 0]} maxBarSize={48} />
            <Bar dataKey="Done"        stackId="a" fill={STATUS_COLORS.done}        radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Priority distribution bar */}
      <div style={{
        background: 'var(--bb-bg-card)',
        border: '1.5px solid var(--bb-border)',
        borderRadius: 14, padding: '16px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Priority Distribution
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
            const total = data.members.reduce((s, m) => s + m[p], 0);
            const pct   = data.total_issues > 0 ? Math.round((total / data.total_issues) * 100) : 0;
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 64, fontSize: 12, fontWeight: 600, color: PRIORITY_COLORS[p], textTransform: 'capitalize' }}>{p}</div>
                <div style={{ flex: 1, height: 8, background: 'var(--bb-border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: PRIORITY_COLORS[p], borderRadius: 99, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ width: 40, fontSize: 12, fontWeight: 700, color: 'var(--bb-text-primary)', textAlign: 'right' }}>{total}</div>
                <div style={{ width: 32, fontSize: 11, color: 'var(--bb-text-muted)', textAlign: 'right' }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {data.members.map((m) => (
          <MemberCard key={m.user_id ?? 'unassigned'} member={m} maxTotal={maxTotal} />
        ))}
      </div>
    </div>
  );
}
