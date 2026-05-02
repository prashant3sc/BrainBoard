import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { VelocityChart } from '@/features/analytics/components/VelocityChart';
import { WorkloadChart } from '@/features/analytics/components/WorkloadChart';
import { BurndownChart } from '@/features/analytics/components/BurndownChart';
import { KBAnalyticsChart } from '@/features/analytics/components/KBAnalyticsChart';

/* ── Tab config ──────────────────────────────────────────────────────────── */
type TabId = 'velocity' | 'burndown' | 'workload' | 'kb';

interface Tab {
  id: TabId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: 'velocity',
    label: 'Velocity',
    description: 'Story points completed vs committed per sprint',
    icon: <VelocityIcon />,
  },
  {
    id: 'burndown',
    label: 'Burndown',
    description: 'Remaining work tracked against the ideal line',
    icon: <BurndownIcon />,
  },
  {
    id: 'workload',
    label: 'Workload',
    description: 'Issue distribution across team members',
    icon: <WorkloadIcon />,
  },
  {
    id: 'kb',
    label: 'KB Usage',
    description: 'Knowledge base activity and coverage metrics',
    icon: <KBIcon />,
  },
];

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('velocity');

  if (!projectId) return null;

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--bb-text-primary)', margin: 0 }}>
          Analytics
        </h1>
        <p style={{ fontSize: 13, color: 'var(--bb-text-muted)', marginTop: 4 }}>
          Sprint velocity, burndown, team workload, and KB usage insights
        </p>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', gap: 6,
        padding: '5px 6px',
        background: 'var(--bb-surface-raised, var(--bb-surface))',
        border: '1px solid var(--bb-border)',
        borderRadius: 12,
        marginBottom: 28,
        width: 'fit-content',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : 'var(--bb-text-secondary)',
                background: isActive ? '#E75026' : 'transparent',
                boxShadow: isActive ? '0 2px 8px rgba(231,80,38,.28)' : 'none',
                transition: 'all .17s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {/* Icon — tint white when active */}
              <span style={{ opacity: isActive ? 1 : 0.7, display: 'flex', alignItems: 'center' }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Active tab header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{
          fontSize: 16, fontWeight: 700, color: 'var(--bb-text-primary)',
          margin: 0, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>{activeTabMeta.icon}</span>
          {activeTabMeta.label} Chart
        </h2>
        <p style={{ fontSize: 12, color: 'var(--bb-text-muted)', marginTop: 4 }}>
          {activeTabMeta.description}
        </p>
      </div>

      {/* ── Chart panels — all mounted (API fires for all), only active is visible ── */}
      {/* Animated wrapper re-keyed on tab so the enter animation reruns on switch */}
      <div key={activeTab} className="bb-tab-content">
        <div style={{ display: activeTab === 'velocity'  ? 'block' : 'none' }}>
          <VelocityChart projectId={projectId} />
        </div>
        <div style={{ display: activeTab === 'burndown'  ? 'block' : 'none' }}>
          <BurndownChart projectId={projectId} />
        </div>
        <div style={{ display: activeTab === 'workload'  ? 'block' : 'none' }}>
          <WorkloadChart projectId={projectId} />
        </div>
        <div style={{ display: activeTab === 'kb'        ? 'block' : 'none' }}>
          <KBAnalyticsChart projectId={projectId} />
        </div>
      </div>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────────────────── */
function VelocityIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
      <rect x="1"  y="9" width="3" height="6" rx="1" fill="currentColor"/>
      <rect x="6"  y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.75"/>
      <rect x="11" y="1" width="3" height="14" rx="1" fill="currentColor" opacity="0.45"/>
    </svg>
  );
}

function BurndownIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
      <path d="M2 2L14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 2" opacity="0.5"/>
      <path d="M2 2L6 9L10 7L14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function WorkloadIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="5.5" r="3" fill="currentColor"/>
      <path d="M2 14c0-3.314 2.686-5.5 6-5.5s6 2.186 6 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
    </svg>
  );
}

function KBIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
