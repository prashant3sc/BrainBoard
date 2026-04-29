import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useBurndown } from '../useBurndown';
import type { BurndownSprintMeta } from '@/api/analytics';

interface Props {
  projectId: string;
}

/* ── Helpers ── */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Custom tooltip ── */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bb-bg-card)',
      border: '1.5px solid var(--bb-border)',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 4px 16px rgba(9,30,66,0.1)',
      minWidth: 176,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bb-text-primary)', marginBottom: 8 }}>
        {fmtDate(label)}
      </div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: p.stroke, fontWeight: 600 }}>{p.name}</span>
          <span style={{ color: 'var(--bb-text-primary)', fontWeight: 700 }}>{p.value} pts</span>
        </div>
      ))}
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
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
      {sub && <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ── Sprint selector ── */
function SprintSelector({
  sprints,
  selected,
  onChange,
}: {
  sprints: BurndownSprintMeta[];
  selected: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontSize: 12, padding: '5px 10px', borderRadius: 8,
        border: '1.5px solid var(--bb-border)',
        background: 'var(--bb-bg-input)',
        color: 'var(--bb-text-primary)',
        cursor: 'pointer', outline: 'none',
      }}
    >
      {sprints.map((s) => (
        <option key={s.sprint_id} value={s.sprint_id}>
          {s.sprint_name} {s.status === 'active' ? '(active)' : ''}
        </option>
      ))}
    </select>
  );
}

export function BurndownChart({ projectId }: Props) {
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(undefined);
  const { data, isLoading, isError } = useBurndown(projectId, selectedSprintId);

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--bb-text-muted)', fontSize: 13 }}>
      Loading burndown data…
    </div>
  );

  if (isError || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--bb-text-muted)', fontSize: 13 }}>
      Failed to load burndown data.
    </div>
  );

  if (data.all_sprints.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity={0.25}>
        <path d="M4 4 L36 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M4 36 L36 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 13, color: 'var(--bb-text-muted)', margin: 0 }}>No active or completed sprints yet</p>
    </div>
  );

  const noDateData = data.days.length === 0;
  const remaining = data.total_points - data.completed_points;
  const pctDone = data.total_points > 0
    ? Math.round((data.completed_points / data.total_points) * 100)
    : 0;

  const activeSprint = selectedSprintId
    ? data.all_sprints.find((s) => s.sprint_id === selectedSprintId) ?? data.all_sprints[0]
    : data.all_sprints.find((s) => s.status === 'active') ?? data.all_sprints[data.all_sprints.length - 1];

  const resolvedSprintId = activeSprint?.sprint_id ?? '';

  const chartData = data.days.map((d) => ({
    date: d.date,
    'Ideal Remaining': d.ideal_remaining,
    'Actual Remaining': d.actual_remaining,
    'Completed': d.completed,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header row: stat cards + sprint selector */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <StatCard label="Total Points" value={data.total_points} sub="sprint scope" />
        <StatCard label="Completed" value={`${data.completed_points} pts`} sub={`${pctDone}% done`} color="#E75026" />
        <StatCard
          label="Remaining"
          value={`${remaining} pts`}
          sub={data.status === 'active' ? 'still in sprint' : 'at sprint end'}
          color={remaining === 0 ? '#006644' : remaining > data.total_points * 0.5 ? '#DE350B' : '#FF8B00'}
        />
        <div style={{
          flex: 1, background: 'var(--bb-bg-input)',
          border: '1.5px solid var(--bb-border)',
          borderRadius: 12, padding: '14px 16px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Sprint
          </div>
          <SprintSelector
            sprints={data.all_sprints}
            selected={resolvedSprintId}
            onChange={(id) => setSelectedSprintId(id)}
          />
        </div>
      </div>

      {/* Chart */}
      <div style={{
        background: 'var(--bb-bg-card)',
        border: '1.5px solid var(--bb-border)',
        borderRadius: 14, padding: '20px 16px 12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Burndown / Burnup — {data.sprint_name}
          </div>
          {data.start_date && data.end_date && (
            <div style={{ fontSize: 11, color: 'var(--bb-text-muted)' }}>
              {fmtDate(data.start_date)} → {fmtDate(data.end_date)}
            </div>
          )}
        </div>

        {noDateData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, color: 'var(--bb-text-muted)', fontSize: 13 }}>
            Sprint has no start / end dates — set them to see the chart.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bb-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDate}
                tick={{ fontSize: 10, fill: 'var(--bb-text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--bb-text-muted)' }}
                axisLine={false}
                tickLine={false}
                unit=" pts"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, color: 'var(--bb-text-secondary)', paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
              {data.total_points > 0 && (
                <ReferenceLine
                  y={0}
                  stroke="var(--bb-border)"
                  strokeWidth={1}
                />
              )}
              {/* Ideal burndown — dashed grey */}
              <Line
                type="linear"
                dataKey="Ideal Remaining"
                stroke="#94A3B8"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4 }}
              />
              {/* Actual remaining — burndown in red */}
              <Line
                type="monotone"
                dataKey="Actual Remaining"
                stroke="#E75026"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
              {/* Burnup — completed in green */}
              <Line
                type="monotone"
                dataKey="Completed"
                stroke="#36B37E"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend note */}
      <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', lineHeight: 1.5, padding: '0 4px' }}>
        <strong style={{ color: '#94A3B8' }}>Ideal</strong> — linear target &nbsp;·&nbsp;
        <strong style={{ color: '#E75026' }}>Actual Remaining</strong> — story points left &nbsp;·&nbsp;
        <strong style={{ color: '#36B37E' }}>Completed</strong> — burnup (points done)
        {data.status === 'active' && (
          <span style={{ marginLeft: 8, opacity: 0.75 }}>
            · Completion dates are approximated from last issue update time.
          </span>
        )}
      </div>
    </div>
  );
}
