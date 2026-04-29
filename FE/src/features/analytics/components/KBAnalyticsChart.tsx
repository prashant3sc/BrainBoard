import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useKBAnalytics } from '../useKBAnalytics';

interface Props {
  projectId: string;
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

const SPACE_COLORS = ['#E75026', '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#06B6D4'];

export function KBAnalyticsChart({ projectId }: Props) {
  const { data, isLoading, isError } = useKBAnalytics(projectId);

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--bb-text-muted)', fontSize: 13 }}>
      Loading KB analytics…
    </div>
  );

  if (isError || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--bb-text-muted)', fontSize: 13 }}>
      Failed to load KB analytics.
    </div>
  );

  if (data.total_pages === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 8 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" opacity={0.25}>
        <rect x="6" y="4" width="28" height="32" rx="3" stroke="currentColor" strokeWidth="2.5" />
        <path d="M12 14h16M12 20h16M12 26h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p style={{ fontSize: 13, color: 'var(--bb-text-muted)', margin: 0 }}>No wiki pages yet</p>
      <p style={{ fontSize: 12, color: 'var(--bb-text-muted)', margin: 0, opacity: 0.7 }}>Create pages in the Wiki tab to see analytics</p>
    </div>
  );

  const spaceChartData = data.spaces.map((s) => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    fullName: s.name,
    Pages: s.page_count,
    Edits: s.edit_count,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Stat row */}
      <div style={{ display: 'flex', gap: 12 }}>
        <StatCard label="Total Pages" value={data.total_pages} sub="wiki articles" color="#3B82F6" />
        <StatCard label="Total Edits" value={data.total_edits} sub="across all pages" color="#E75026" />
        <StatCard label="Ticket Links" value={data.total_links} sub="issues linked to pages" color="#8B5CF6" />
        <StatCard
          label="Avg Edits / Page"
          value={data.total_pages > 0 ? (data.total_edits / data.total_pages).toFixed(1) : '0'}
          sub="edit intensity"
        />
      </div>

      {/* Space activity chart */}
      {spaceChartData.length > 0 && (
        <div style={{
          background: 'var(--bb-bg-card)',
          border: '1.5px solid var(--bb-border)',
          borderRadius: 14, padding: '20px 16px 12px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Activity by Space
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={spaceChartData} barCategoryGap="35%" barGap={4}>
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
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bb-bg-card)',
                  border: '1.5px solid var(--bb-border)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                cursor={{ fill: 'var(--bb-bg-input)', radius: 4 }}
              />
              <Bar dataKey="Pages" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Edits" fill="#E75026" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom row: top pages + top contributors */}
      <div style={{ display: 'flex', gap: 16 }}>

        {/* Top pages */}
        <div style={{
          flex: 3,
          background: 'var(--bb-bg-card)',
          border: '1.5px solid var(--bb-border)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 10px', fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Most Edited Pages
          </div>
          {data.top_pages.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--bb-text-muted)' }}>No edits recorded yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderTop: '1px solid var(--bb-border)' }}>
                  {['Page', 'Edits', 'Linked Issues', 'Last Updated'].map((h) => (
                    <th key={h} style={{
                      padding: '7px 14px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: 'var(--bb-text-muted)',
                      background: 'var(--bb-bg-input)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.top_pages.map((p, i) => (
                  <tr key={p.page_id} style={{ borderTop: '1px solid var(--bb-border)', background: i % 2 === 0 ? 'transparent' : 'var(--bb-bg-input)' }}>
                    <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)', maxWidth: 200 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.title}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 28, padding: '2px 8px', borderRadius: 99,
                        background: '#FEE2E2', color: '#DC2626',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {p.edit_count}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--bb-text-secondary)' }}>
                      {p.link_count > 0 ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          minWidth: 28, padding: '2px 8px', borderRadius: 99,
                          background: '#EDE9FE', color: '#7C3AED',
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {p.link_count}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--bb-text-muted)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--bb-text-muted)' }}>
                      {p.updated_at}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top contributors */}
        <div style={{
          flex: 2,
          background: 'var(--bb-bg-card)',
          border: '1.5px solid var(--bb-border)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 10px', fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Top Contributors
          </div>
          {data.top_contributors.length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--bb-text-muted)' }}>No contributors yet.</div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {data.top_contributors.map((c, i) => {
                const maxEdits = data.top_contributors[0]?.edit_count ?? 1;
                const pct = Math.round((c.edit_count / maxEdits) * 100);
                return (
                  <div key={c.user_id} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      background: SPACE_COLORS[i % SPACE_COLORS.length],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff',
                    }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--bb-border)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${pct}%`,
                            background: SPACE_COLORS[i % SPACE_COLORS.length],
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--bb-text-muted)', minWidth: 24, textAlign: 'right' }}>
                          {c.edit_count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      {data.recent_activity.length > 0 && (
        <div style={{
          background: 'var(--bb-bg-card)',
          border: '1.5px solid var(--bb-border)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 10px', fontSize: 12, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Recent Edit Activity
          </div>
          <div>
            {data.recent_activity.map((a, i) => (
              <div key={`${a.page_id}-${a.version_number}`} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '9px 16px',
                borderTop: i === 0 ? '1px solid var(--bb-border)' : '1px solid var(--bb-border)',
                background: i % 2 === 0 ? 'transparent' : 'var(--bb-bg-input)',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: '#3B82F6',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-text-primary)' }}>
                    {a.title}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--bb-text-muted)', marginLeft: 6 }}>
                    v{a.version_number}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--bb-text-secondary)', flexShrink: 0 }}>
                  {a.user}
                </div>
                <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
                  {a.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
