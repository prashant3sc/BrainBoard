import { useState, useEffect, useRef } from 'react';
import type { Project } from '@/types';
import type { AiPulseData, AiPulseHighlight, AiPulseTeamMember } from '@/api/projects';
import { useAiPulse } from '../useAiPulse';

type Tab = 'sprint' | 'highlights' | 'team';

// ── Highlight tag styling ────────────────────────────────────────────────────

const TAG_STYLE: Record<AiPulseHighlight['tag'], { dot: string; bg: string; color: string }> = {
  'Shipped':     { dot: '#006644', bg: '#E3FCEF', color: '#006644' },
  'In progress': { dot: '#0052CC', bg: '#DEEBFF', color: '#0747A6' },
  'At risk':     { dot: '#7A5800', bg: '#FFFAE6', color: '#7A5800' },
  'Blocked':     { dot: '#BF2600', bg: '#FFEBE6', color: '#BF2600' },
  'Planned':     { dot: '#172B4D', bg: '#F4F5F7', color: '#42526E' },
};

// ── Avatar colours derived deterministically from the member's name ──────────

const AVATAR_PALETTES = [
  { bg: '#DBEAFE', color: '#1D4ED8' },
  { bg: '#FCE7F3', color: '#9D174D' },
  { bg: '#D1FAE5', color: '#065F46' },
  { bg: '#FEF3C7', color: '#92400E' },
  { bg: '#EDE9FE', color: '#5B21B6' },
  { bg: '#FEE2E2', color: '#991B1B' },
  { bg: '#CCFBF1', color: '#0F766E' },
];

function avatarPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ── Sprint Health tab ────────────────────────────────────────────────────────

function SprintTab({ data }: { data: AiPulseData }) {
  const s = data.sprint;
  const total = s.done + s.in_progress + s.review + s.todo;
  const pct = total > 0 ? Math.round((s.done / total) * 100) : 0;
  const [health, healthColor] =
    pct >= 60 ? ['On track', 'var(--bb-pulse-health-green)']
    : pct >= 35 ? ['At risk',  'var(--bb-pulse-health-amber)']
    :             ['Behind',   'var(--bb-pulse-health-red)'];
  const ptPct = s.points_total > 0 ? Math.round((s.points_burned / s.points_total) * 100) : 0;

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-pulse-title)' }}>{s.name}</span>
        <span style={{ fontSize: 11, color: 'var(--bb-pulse-muted)' }}>{fmt(s.start)} – {fmt(s.end)}</span>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Sprint health', value: health,             valueColor: healthColor },
          { label: 'Completed',     value: String(s.done),     valueColor: 'var(--bb-pulse-title)' },
          { label: 'In progress',   value: String(s.in_progress + s.review), valueColor: 'var(--bb-pulse-health-amber)' },
          { label: 'To do',         value: String(s.todo),     valueColor: 'var(--bb-pulse-title)' },
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

      {/* Story points progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--bb-pulse-muted)', marginBottom: 6 }}>
          <span>Story points burned</span>
          <span>
            <strong style={{ color: 'var(--bb-pulse-title)' }}>{s.points_burned}</strong>
            {' '}/ {s.points_total} pts
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--bb-pulse-inner-border)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${ptPct}%`, background: '#E75026', borderRadius: 20, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* AI summary */}
      <div style={{
        background: 'var(--bb-pulse-metric-bg)',
        border: '1px solid var(--bb-pulse-inner-border)',
        borderRadius: 8, padding: '10px 12px',
        fontSize: 11, color: 'var(--bb-pulse-text)', lineHeight: 1.65,
      }}>
        <strong style={{ color: 'var(--bb-pulse-title)', display: 'block', marginBottom: 4 }}>AI summary</strong>
        {data.summary}
      </div>
    </div>
  );
}

// ── Highlights tab ───────────────────────────────────────────────────────────

function HighlightsTab({ highlights }: { highlights: AiPulseHighlight[] }) {
  if (highlights.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--bb-pulse-muted)', padding: '12px 0' }}>No highlights available.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {highlights.map((h, i) => {
        const style = TAG_STYLE[h.tag] ?? TAG_STYLE['Planned'];
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px',
            background: 'var(--bb-pulse-metric-bg)',
            border: '1px solid var(--bb-pulse-inner-border)',
            borderRadius: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: style.dot, flexShrink: 0, marginTop: 3 }} />
            <div style={{ fontSize: 12, color: 'var(--bb-pulse-text)', lineHeight: 1.5 }}>
              {h.text}
              <span style={{
                display: 'inline-block', fontSize: 10, fontWeight: 600,
                padding: '1px 7px', borderRadius: 10, marginLeft: 8,
                background: style.bg, color: style.color, verticalAlign: 'middle',
              }}>
                {h.tag}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Team tab ─────────────────────────────────────────────────────────────────

function TeamTab({ team }: { team: AiPulseTeamMember[] }) {
  if (team.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--bb-pulse-muted)', padding: '12px 0' }}>No assigned team members in this sprint.</p>;
  }
  const sorted = [...team].sort((a, b) => b.task_count - a.task_count);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((m) => {
        const { bg, color } = avatarPalette(m.name);
        return (
          <div key={m.name} style={{
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
              background: bg, color,
            }}>
              {initials(m.name)}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bb-pulse-title)' }}>{m.name}</div>
              <div style={{ fontSize: 11, color: 'var(--bb-pulse-muted)', textTransform: 'capitalize' }}>{m.role}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--bb-pulse-muted)' }}>
              <strong style={{ color: 'var(--bb-pulse-title)' }}>{m.task_count}</strong> tasks
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Loading / Error states ───────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '28px 0' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bb-pulse-dot" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{
      padding: '20px 16px', textAlign: 'center',
      fontSize: 12, color: 'var(--bb-pulse-muted)', lineHeight: 1.6,
    }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>⚠️</div>
      {message}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface AiPulseProps {
  project: Project;
  projectIndex: number;
  onClose: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'sprint',     label: 'Sprint health' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'team',       label: 'Team' },
];

export function AiPulse({ project, onClose }: AiPulseProps) {
  const [activeTab, setActiveTab] = useState<Tab>('sprint');
  const panelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error } = useAiPulse(project.id, true);

  // Reset to sprint tab whenever the panel opens for a new project
  useEffect(() => {
    setActiveTab('sprint');
  }, [project.id]);

  // Smooth scroll into view on open
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [project.id]);

  const errorMessage = isError
    ? (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail === 'No active sprint.'
      ? 'This project has no active sprint yet. Start a sprint from the Backlog to see AI Pulse.'
      : 'Could not load AI Pulse. Make sure the AI service is running.'
    : null;

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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#E75026" strokeWidth="1.5" />
            <path d="M3 8h2l2-4 2.5 8L12 8h2" stroke="#E75026" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--bb-pulse-title)' }}>
            {project.name}
          </span>
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
        <button
          onClick={onClose}
          aria-label="Close AI Pulse"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, lineHeight: 1, color: 'var(--bb-pulse-muted)',
            padding: '0 2px', display: 'flex', alignItems: 'center', fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--bb-pulse-title)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--bb-pulse-muted)')}
        >
          ×
        </button>
      </div>

      {/* Tabs — hidden while loading or on error */}
      {!isLoading && !errorMessage && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--bb-pulse-inner-border)',
          background: 'var(--bb-pulse-tab-bg)',
        }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '10px 16px', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: 'none', fontFamily: 'inherit',
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
      )}

      {/* Body */}
      <div style={{ padding: 16 }}>
        {isLoading && <LoadingDots />}
        {errorMessage && <ErrorState message={errorMessage} />}
        {data && !isLoading && (
          <>
            {activeTab === 'sprint'     && <SprintTab data={data} />}
            {activeTab === 'highlights' && <HighlightsTab highlights={data.highlights} />}
            {activeTab === 'team'       && <TeamTab team={data.team} />}
          </>
        )}
      </div>
    </div>
  );
}
