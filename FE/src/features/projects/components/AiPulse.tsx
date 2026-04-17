import { useState, useEffect, useRef } from 'react';
import type { Project } from '@/types';

// ── Types ───────────────────────────────────────────────────────────────────

type Tab = 'sprint' | 'highlights' | 'team';

interface SprintData {
  name: string;
  start: string;
  end: string;
  done: number;
  inProgress: number;
  todo: number;
  pointsBurned: number;
  pointsTotal: number;
}

interface Highlight {
  text: string;
  tag: string;
  dotColor: string;
  tagBg: string;
  tagColor: string;
}

interface TeamMember {
  initials: string;
  name: string;
  role: string;
  taskCount: number;
  avatarBg: string;
  avatarColor: string;
}

interface PulseData {
  sprint: SprintData;
  highlights: Highlight[];
  team: TeamMember[];
}

// ── Mock data (two templates, cycled by index % 2) ──────────────────────────

const MOCK_A: PulseData = {
  sprint: {
    name: 'Sprint 7 — Dashboard refresh',
    start: 'Apr 7',
    end: 'Apr 21',
    done: 14,
    inProgress: 6,
    todo: 4,
    pointsBurned: 68,
    pointsTotal: 89,
  },
  highlights: [
    { dotColor: '#006644', tag: 'Shipped',   tagBg: '#E3FCEF', tagColor: '#006644', text: 'New analytics dashboard with date-range filter is live in staging' },
    { dotColor: '#0052CC', tag: 'In review', tagBg: '#DEEBFF', tagColor: '#0747A6', text: 'CSV export for order history — PR #214 under code review' },
    { dotColor: '#7A5800', tag: 'At risk',   tagBg: '#FFFAE6', tagColor: '#7A5800', text: 'SSO integration blocked on vendor API key — escalated to lead' },
    { dotColor: '#172B4D', tag: 'Planned',   tagBg: '#F4F5F7', tagColor: '#42526E', text: 'Mobile-responsive layout pass scoped for next sprint' },
  ],
  team: [
    { initials: 'RV', name: 'Rohan Verma', role: 'Frontend', taskCount: 6, avatarBg: '#DBEAFE', avatarColor: '#1D4ED8' },
    { initials: 'PK', name: 'Priya K.',    role: 'Backend',  taskCount: 5, avatarBg: '#FCE7F3', avatarColor: '#9D174D' },
    { initials: 'AM', name: 'Alex M.',     role: 'Design',   taskCount: 3, avatarBg: '#D1FAE5', avatarColor: '#065F46' },
    { initials: 'SJ', name: 'Sara J.',     role: 'QA',       taskCount: 4, avatarBg: '#FEF3C7', avatarColor: '#92400E' },
  ],
};

const MOCK_B: PulseData = {
  sprint: {
    name: 'Sprint 4 — Admin panel v2',
    start: 'Apr 10',
    end: 'Apr 24',
    done: 8,
    inProgress: 9,
    todo: 7,
    pointsBurned: 41,
    pointsTotal: 72,
  },
  highlights: [
    { dotColor: '#006644', tag: 'Shipped',     tagBg: '#E3FCEF', tagColor: '#006644', text: 'User role management UI redesigned and merged to main' },
    { dotColor: '#0052CC', tag: 'In progress', tagBg: '#DEEBFF', tagColor: '#0747A6', text: 'Automation workflow builder — 60% complete, on track' },
    { dotColor: '#BF2600', tag: 'Blocked',     tagBg: '#FFEBE6', tagColor: '#BF2600', text: 'Reporting scripts failing on staging DB — needs DevOps attention' },
  ],
  team: [
    { initials: 'NK', name: 'Neel K.',  role: 'Fullstack', taskCount: 8, avatarBg: '#EDE9FE', avatarColor: '#5B21B6' },
    { initials: 'DM', name: 'Dev M.',   role: 'Backend',   taskCount: 6, avatarBg: '#DBEAFE', avatarColor: '#1D4ED8' },
    { initials: 'TS', name: 'Tara S.',  role: 'QA',        taskCount: 3, avatarBg: '#FEF3C7', avatarColor: '#92400E' },
  ],
};

function getMockData(index: number): PulseData {
  return index % 2 === 0 ? MOCK_A : MOCK_B;
}

// ── Sub-renderers ────────────────────────────────────────────────────────────

function SprintTab({ data }: { data: PulseData }) {
  const s = data.sprint;
  const total = s.done + s.inProgress + s.todo;
  const pct = Math.round((s.done / total) * 100);
  const [health, healthColor] =
    pct >= 60 ? ['On track', 'var(--bb-pulse-health-green)']
    : pct >= 40 ? ['At risk',   'var(--bb-pulse-health-amber)']
    :             ['Behind',    'var(--bb-pulse-health-red)'];
  const ptPct = Math.round((s.pointsBurned / s.pointsTotal) * 100);
  const velocityNote = pct >= 60 ? 'healthy' : 'slightly below target';

  return (
    <div>
      {/* Sprint header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-pulse-title)' }}>{s.name}</span>
        <span style={{ fontSize: 11, color: 'var(--bb-pulse-muted)' }}>{s.start} – {s.end}</span>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Sprint health', value: health,       valueColor: healthColor },
          { label: 'Completed',     value: String(s.done),      valueColor: 'var(--bb-pulse-title)' },
          { label: 'In progress',   value: String(s.inProgress), valueColor: 'var(--bb-pulse-health-amber)' },
          { label: 'To do',         value: String(s.todo),      valueColor: 'var(--bb-pulse-title)' },
        ].map((m) => (
          <div key={m.label} style={{
            flex: 1, background: 'var(--bb-pulse-metric-bg)',
            border: '1px solid var(--bb-pulse-inner-border)',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.valueColor, marginBottom: 2 }}>{m.value}</div>
            <div style={{ fontSize: 10, color: 'var(--bb-pulse-muted)', fontWeight: 500 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--bb-pulse-muted)', marginBottom: 6 }}>
          <span>Story points burned</span>
          <span><strong style={{ color: 'var(--bb-pulse-title)' }}>{s.pointsBurned}</strong> / {s.pointsTotal} pts</span>
        </div>
        <div style={{ height: 6, background: 'var(--bb-pulse-inner-border)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${ptPct}%`, background: '#E75026', borderRadius: 20 }} />
        </div>
      </div>

      {/* AI summary */}
      <div style={{
        background: 'var(--bb-pulse-metric-bg)',
        border: '1px solid var(--bb-pulse-inner-border)',
        borderRadius: 8, padding: '10px 12px',
        fontSize: 11, color: 'var(--bb-pulse-text)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--bb-pulse-title)', display: 'block', marginBottom: 4 }}>AI summary</strong>
        Sprint is {health.toLowerCase()} with {pct}% of issues resolved.{' '}
        {s.inProgress} tasks are actively being worked on. Velocity is {velocityNote} —{' '}
        team should be able to close the sprint on time.
      </div>
    </div>
  );
}

function HighlightsTab({ data }: { data: PulseData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.highlights.map((h, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 12px',
          background: 'var(--bb-pulse-metric-bg)',
          border: '1px solid var(--bb-pulse-inner-border)',
          borderRadius: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: h.dotColor, flexShrink: 0, marginTop: 3,
          }} />
          <div style={{ fontSize: 12, color: 'var(--bb-pulse-text)', lineHeight: 1.5 }}>
            {h.text}
            <span style={{
              display: 'inline-block', fontSize: 10, fontWeight: 600,
              padding: '1px 7px', borderRadius: 10, marginLeft: 8,
              background: h.tagBg, color: h.tagColor,
              verticalAlign: 'middle',
            }}>
              {h.tag}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamTab({ data }: { data: PulseData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.team.map((m, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px',
          background: 'var(--bb-pulse-metric-bg)',
          border: '1px solid var(--bb-pulse-inner-border)',
          borderRadius: 8,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            background: m.avatarBg, color: m.avatarColor,
          }}>
            {m.initials}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-pulse-title)' }}>{m.name}</div>
            <div style={{ fontSize: 11, color: 'var(--bb-pulse-muted)' }}>{m.role}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--bb-pulse-muted)' }}>
            <strong style={{ color: 'var(--bb-pulse-title)' }}>{m.taskCount}</strong> tasks
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '28px 0' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bb-pulse-dot" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface AiPulseProps {
  project: Project;
  projectIndex: number;
  onClose: () => void;
}

export function AiPulse({ project, projectIndex, onClose }: AiPulseProps) {
  const [activeTab, setActiveTab] = useState<Tab>('sprint');
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const mockData = getMockData(projectIndex);

  // Simulate loading on mount (initial sprint tab)
  useEffect(() => {
    setLoading(true);
    setActiveTab('sprint');
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, [project.id]);

  // Smooth scroll into view on open
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [project.id]);

  function handleTabSwitch(tab: Tab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setLoading(true);
    setTimeout(() => setLoading(false), 750);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'sprint',     label: 'Sprint health' },
    { id: 'highlights', label: 'Highlights' },
    { id: 'team',       label: 'Team' },
  ];

  return (
    <div
      ref={panelRef}
      style={{
        marginTop: 20,
        background: 'var(--bb-pulse-bg)',
        border: '1px solid var(--bb-pulse-border)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid var(--bb-pulse-inner-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Heartbeat icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#E75026" strokeWidth="1.5" />
            <path d="M3 8h2l2-4 2.5 8L12 8h2" stroke="#E75026" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-pulse-title)' }}>
            {project.name}
          </span>
          {/* AI badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, color: '#E75026',
            background: '#FFF3F0', border: '1px solid #FFD9CC',
            borderRadius: 20, padding: '2px 8px',
          }}>
            <svg width="7" height="7" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="3.5" fill="#E75026" />
            </svg>
            AI Pulse
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close AI Pulse"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, lineHeight: 1, color: 'var(--bb-pulse-muted)',
            padding: '0 2px', display: 'flex', alignItems: 'center',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bb-pulse-title)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--bb-pulse-muted)')}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--bb-pulse-inner-border)',
        background: 'var(--bb-pulse-tab-bg)',
      }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabSwitch(t.id)}
            style={{
              padding: '10px 16px',
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer', border: 'none', background: 'none',
              fontFamily: 'inherit',
              color: activeTab === t.id ? '#E75026' : 'var(--bb-pulse-muted)',
              borderBottom: activeTab === t.id ? '2px solid #E75026' : '2px solid transparent',
              background: activeTab === t.id ? 'var(--bb-pulse-bg)' : 'none',
              transition: 'color 0.15s, border-color 0.15s',
            } as React.CSSProperties}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: 16 }}>
        {loading ? (
          <LoadingDots />
        ) : (
          <>
            {activeTab === 'sprint'     && <SprintTab     data={mockData} />}
            {activeTab === 'highlights' && <HighlightsTab data={mockData} />}
            {activeTab === 'team'       && <TeamTab       data={mockData} />}
          </>
        )}
      </div>
    </div>
  );
}
