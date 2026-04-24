import { useParams } from 'react-router-dom';
import { VelocityChart } from '@/features/analytics/components/VelocityChart';

export default function AnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) return null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--bb-text-primary)', margin: 0 }}>
          Analytics
        </h1>
        <p style={{ fontSize: 13, color: 'var(--bb-text-muted)', marginTop: 4 }}>
          Sprint velocity and team performance insights
        </p>
      </div>

      <section>
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--bb-text-primary)',
          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
            <rect x="1" y="9"  width="3" height="6" rx="1" fill="#E75026"/>
            <rect x="6" y="5"  width="3" height="10" rx="1" fill="#E75026" opacity="0.7"/>
            <rect x="11" y="1" width="3" height="14" rx="1" fill="#E75026" opacity="0.4"/>
          </svg>
          Velocity Chart
        </div>
        <VelocityChart projectId={projectId} />
      </section>
    </div>
  );
}
