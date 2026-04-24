import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useVelocity } from '../useVelocity';

interface Props {
  projectId: string;
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
      minWidth: 160,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bb-text-primary)', marginBottom: 8 }}>
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: p.fill, fontWeight: 600 }}>{p.name}</span>
          <span style={{ color: 'var(--bb-text-primary)', fontWeight: 700 }}>{p.value} pts</span>
        </div>
      ))}
      {payload[0] && payload[1] && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--bb-border)', fontSize: 11, color: 'var(--bb-text-muted)' }}>
          Completion: {payload[0].payload.completion_rate}%
        </div>
      )}
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

export function VelocityChart({ projectId }: Props) {
  const { data, isLoading, isError } = useVelocity(projectId);

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--bb-text-muted)', fontSize: 13 }}>
      Loading velocity data…
    </div>
  );

  if (isError || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--bb-text-muted)', fontSize: 13 }}>
      Failed to load velocity data.
    </div>
  );

  if (data.sprints.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity={0.25}>
        <rect x="4" y="20" width="8" height="16" rx="2" fill="currentColor"/>
        <rect x="16" y="12" width="8" height="24" rx="2" fill="currentColor"/>
        <rect x="28" y="6" width="8" height="30" rx="2" fill="currentColor"/>
      </svg>
      <p style={{ fontSize: 13, color: 'var(--bb-text-muted)', margin: 0 }}>No completed sprints yet</p>
      <p style={{ fontSize: 12, color: 'var(--bb-text-muted)', margin: 0, opacity: 0.7 }}>Complete a sprint to see velocity data</p>
    </div>
  );

  const chartData = data.sprints.map((s) => ({
    name: s.sprint_name.length > 14 ? s.sprint_name.slice(0, 14) + '…' : s.sprint_name,
    fullName: s.sprint_name,
    Committed: s.committed,
    Completed: s.completed,
    completion_rate: s.completion_rate,
    status: s.status,
  }));

  const totalCommitted = data.sprints.reduce((s, d) => s + d.committed, 0);
  const totalCompleted = data.sprints.reduce((s, d) => s + d.completed, 0);
  const avgRate = data.sprints.length > 0
    ? Math.round(data.sprints.reduce((s, d) => s + d.completion_rate, 0) / data.sprints.length)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stat row */}
      <div style={{ display: 'flex', gap: 12 }}>
        <StatCard
          label="Avg Velocity"
          value={`${data.avg_velocity} pts`}
          sub="per sprint"
          color="#E75026"
        />
        <StatCard
          label="Total Committed"
          value={`${totalCommitted} pts`}
          sub={`across ${data.sprints.length} sprint${data.sprints.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          label="Total Completed"
          value={`${totalCompleted} pts`}
          sub="story points done"
          color="#006644"
        />
        <StatCard
          label="Avg Completion"
          value={`${avgRate}%`}
          sub="committed → done"
          color={avgRate >= 70 ? '#006644' : avgRate >= 40 ? '#FF8B00' : '#DE350B'}
        />
      </div>

      {/* Bar chart */}
      <div style={{
        background: 'var(--bb-bg-card)',
        border: '1.5px solid var(--bb-border)',
        borderRadius: 14, padding: '20px 16px 12px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Sprint-by-Sprint Velocity
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bb-border)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--bb-text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--bb-text-muted)' }}
              axisLine={false}
              tickLine={false}
              unit=" pts"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bb-bg-input)', radius: 4 }} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: 'var(--bb-text-secondary)', paddingTop: 12 }}
              iconType="circle"
              iconSize={8}
            />
            {data.avg_velocity > 0 && (
              <ReferenceLine
                y={data.avg_velocity}
                stroke="#E75026"
                strokeDasharray="5 4"
                strokeWidth={1.5}
                label={{ value: `Avg ${data.avg_velocity}pts`, fill: '#E75026', fontSize: 10, position: 'insideTopRight' }}
              />
            )}
            <Bar dataKey="Committed" fill="#BFDBFE" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="Completed" fill="#E75026" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sprint breakdown table */}
      <div style={{
        background: 'var(--bb-bg-card)',
        border: '1.5px solid var(--bb-border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Sprint Breakdown
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderTop: '1px solid var(--bb-border)' }}>
              {['Sprint', 'Status', 'Committed', 'Completed', 'Completion'].map((h) => (
                <th key={h} style={{
                  padding: '8px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: 'var(--bb-text-muted)',
                  background: 'var(--bb-bg-input)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sprints.map((s, i) => (
              <tr key={s.sprint_id} style={{ borderTop: '1px solid var(--bb-border)', background: i % 2 === 0 ? 'transparent' : 'var(--bb-bg-input)' }}>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>
                  {s.sprint_name}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: s.status === 'active' ? '#E3FCEF' : 'var(--bb-bg-input)',
                    color: s.status === 'active' ? '#006644' : 'var(--bb-text-muted)',
                    border: `1px solid ${s.status === 'active' ? '#ABF5D1' : 'var(--bb-border)'}`,
                    textTransform: 'capitalize',
                  }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--bb-text-secondary)' }}>
                  {s.committed} pts
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#E75026' }}>
                  {s.completed} pts
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bb-border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        width: `${Math.min(s.completion_rate, 100)}%`,
                        background: s.completion_rate >= 70 ? '#36B37E' : s.completion_rate >= 40 ? '#FF8B00' : '#DE350B',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--bb-text-secondary)', minWidth: 32 }}>
                      {s.completion_rate}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
