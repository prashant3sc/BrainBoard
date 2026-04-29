import { useParams } from 'react-router-dom';
import { VelocityChart } from '@/features/analytics/components/VelocityChart';
import { WorkloadChart } from '@/features/analytics/components/WorkloadChart';
import { BurndownChart } from '@/features/analytics/components/BurndownChart';
import { KBAnalyticsChart } from '@/features/analytics/components/KBAnalyticsChart';

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
          Sprint velocity, burndown, team workload, and KB usage insights
        </p>
      </div>

      <section style={{ marginBottom: 36 }}>
        <SectionHeader icon={<VelocityIcon />} title="Velocity Chart" />
        <VelocityChart projectId={projectId} />
      </section>

      <section style={{ marginBottom: 36 }}>
        <SectionHeader icon={<BurndownIcon />} title="Burndown / Burnup" />
        <BurndownChart projectId={projectId} />
      </section>

      <section style={{ marginBottom: 36 }}>
        <SectionHeader icon={<WorkloadIcon />} title="Workload Distribution" />
        <WorkloadChart projectId={projectId} />
      </section>

      <section>
        <SectionHeader icon={<KBIcon />} title="KB Usage Analytics" />
        <KBAnalyticsChart projectId={projectId} />
      </section>
    </div>
  );
}

/* ── Section header ── */
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: 'var(--bb-text-primary)',
      marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {icon}
      {title}
    </div>
  );
}

/* ── Icons ── */
function VelocityIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
      <rect x="1" y="9"  width="3" height="6" rx="1" fill="#E75026"/>
      <rect x="6" y="5"  width="3" height="10" rx="1" fill="#E75026" opacity="0.7"/>
      <rect x="11" y="1" width="3" height="14" rx="1" fill="#E75026" opacity="0.4"/>
    </svg>
  );
}

function BurndownIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
      <path d="M2 2 L14 14" stroke="#E75026" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 2"/>
      <path d="M2 2 L6 10 L10 8 L14 14" stroke="#36B37E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function WorkloadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="6" r="3.5" fill="#E75026" />
      <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#E75026" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function KBIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke="#3B82F6" strokeWidth="1.5"/>
      <path d="M5 5h6M5 8h6M5 11h4" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
