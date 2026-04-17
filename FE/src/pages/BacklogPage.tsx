import { useState, useMemo } from 'react';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
type IssueType = 'bug' | 'story' | 'task' | 'epic' | 'improvement' | 'chore' | 'security' | 'design' | 'question';
type BadgeKind  = 'critical' | 'high' | 'medium' | 'low' | 'story' | 'epic';
type StatusKind = 'todo' | 'inprogress' | 'done' | 'blocked' | 'review';
type AssigneeKey = 'pk' | 'lt' | 'sr' | 'am' | 'kw' | 'none';

interface BacklogIssue {
  id: string;
  type: IssueType;
  key: string;
  summary: string;
  badges: BadgeKind[];
  status: StatusKind;
  assignee: AssigneeKey;
  storyPts: string;
}

interface SprintStats { done: number; inprogress: number; blocked: number; todo: number; }

interface SprintData {
  id: string;
  name: string;
  tag?: 'active' | 'upcoming';
  dates?: string;
  issueCount: number;
  storyPts?: number;
  action: string;
  stats?: SprintStats;
  progress?: number;
  issues: BacklogIssue[];
}

/* ─────────────────────────────────────────────
   Mock data (matches the design spec exactly)
───────────────────────────────────────────── */
const SPRINTS: SprintData[] = [
  {
    id: 'sprint-12',
    name: 'Sprint 12',
    tag: 'active',
    dates: 'Apr 14 – Apr 28, 2026',
    issueCount: 14,
    storyPts: 55,
    action: 'Complete sprint',
    stats: { done: 4, inprogress: 5, blocked: 2, todo: 3 },
    progress: 28,
    issues: [
      { id: 's12-1', type: 'bug',         key: 'BB-247', summary: 'Login fails on Safari when 2FA is enabled — affects ~12% of users',              badges: ['critical'],         status: 'inprogress', assignee: 'pk',   storyPts: '5'  },
      { id: 's12-2', type: 'story',       key: 'BB-243', summary: 'Allow users to bulk-archive completed issues from the board view',                badges: ['story', 'high'],    status: 'inprogress', assignee: 'lt',   storyPts: '8'  },
      { id: 's12-3', type: 'task',        key: 'BB-251', summary: 'Upgrade react-dnd to v16 and resolve drag ghost offset regression',               badges: ['medium'],           status: 'blocked',    assignee: 'sr',   storyPts: '3'  },
      { id: 's12-4', type: 'bug',         key: 'BB-248', summary: "Notification bell badge count doesn't reset after reading all notifications",     badges: ['high'],             status: 'todo',       assignee: 'none', storyPts: '2'  },
      { id: 's12-5', type: 'epic',        key: 'BB-230', summary: 'Q2 Performance Initiative — reduce dashboard load time to under 1.5 s',           badges: ['epic'],             status: 'inprogress', assignee: 'am',   storyPts: '21' },
      { id: 's12-6', type: 'improvement', key: 'BB-252', summary: 'Add keyboard shortcut (⌘K) to open global search from any view',                  badges: ['medium'],           status: 'done',       assignee: 'lt',   storyPts: '3'  },
      { id: 's12-7', type: 'chore',       key: 'BB-249', summary: 'Migrate legacy REST calls in settings module to new GraphQL schema',               badges: ['low'],              status: 'inprogress', assignee: 'kw',   storyPts: '5'  },
      { id: 's12-8', type: 'security',    key: 'BB-254', summary: 'Rotate expired JWT secret and update token validation middleware',                 badges: ['critical'],         status: 'blocked',    assignee: 'pk',   storyPts: '3'  },
      { id: 's12-9', type: 'design',      key: 'BB-241', summary: 'Redesign empty state illustrations across board, backlog, and reports',            badges: ['medium'],           status: 'review',     assignee: 'sr',   storyPts: '5'  },
    ],
  },
  {
    id: 'sprint-13',
    name: 'Sprint 13',
    tag: 'upcoming',
    dates: 'Apr 29 – May 12, 2026',
    issueCount: 8,
    storyPts: 32,
    action: 'Start sprint',
    issues: [
      { id: 's13-1', type: 'story',       key: 'BB-257', summary: 'User-level notification preferences — granular control per project and event type', badges: ['story', 'high'],   status: 'todo', assignee: 'am',   storyPts: '8'  },
      { id: 's13-2', type: 'bug',         key: 'BB-255', summary: 'Column drag order not persisting after page refresh on Firefox',                    badges: ['high'],            status: 'todo', assignee: 'none', storyPts: '3'  },
      { id: 's13-3', type: 'improvement', key: 'BB-258', summary: 'Export board as PDF/PNG snapshot for async stakeholder updates',                    badges: ['medium'],          status: 'todo', assignee: 'kw',   storyPts: '5'  },
      { id: 's13-4', type: 'chore',       key: 'BB-256', summary: 'Add Datadog RUM tracing to all public API endpoints for latency observability',    badges: ['low'],             status: 'todo', assignee: 'lt',   storyPts: '3'  },
      { id: 's13-5', type: 'security',    key: 'BB-259', summary: 'Enforce PKCE flow for all OAuth integrations, deprecate implicit grant',            badges: ['critical'],        status: 'todo', assignee: 'pk',   storyPts: '5'  },
      { id: 's13-6', type: 'design',      key: 'BB-261', summary: 'Audit WCAG AA color contrast across all interactive components',                    badges: ['medium'],          status: 'todo', assignee: 'sr',   storyPts: '5'  },
      { id: 's13-7', type: 'question',    key: 'BB-262', summary: 'Research: evaluate Turso vs PlanetScale for multi-region read replicas',            badges: ['low'],             status: 'todo', assignee: 'pk',   storyPts: '—'  },
    ],
  },
  {
    id: 'backlog',
    name: 'Backlog',
    issueCount: 25,
    action: 'Create sprint',
    issues: [
      { id: 'bl-1', type: 'epic',        key: 'BB-200', summary: 'Offline mode — local-first sync engine with conflict resolution',               badges: ['epic'],            status: 'todo', assignee: 'none', storyPts: '89' },
      { id: 'bl-2', type: 'story',       key: 'BB-212', summary: 'Integrate GitHub PR status into issue cards — show CI/CD state inline',         badges: ['story', 'high'],   status: 'todo', assignee: 'none', storyPts: '13' },
      { id: 'bl-3', type: 'improvement', key: 'BB-236', summary: 'Dark mode — full theme toggle with system preference sync',                      badges: ['medium'],          status: 'todo', assignee: 'none', storyPts: '8'  },
      { id: 'bl-4', type: 'bug',         key: 'BB-239', summary: 'Mentions autocomplete shows deactivated users in the dropdown list',             badges: ['low'],             status: 'todo', assignee: 'none', storyPts: '2'  },
      { id: 'bl-5', type: 'chore',       key: 'BB-263', summary: 'Remove deprecated v1 API client library and update all call sites',              badges: ['low'],             status: 'todo', assignee: 'none', storyPts: '3'  },
      { id: 'bl-6', type: 'design',      key: 'BB-264', summary: 'Design onboarding checklist UI for new workspace members',                       badges: ['medium'],          status: 'todo', assignee: 'sr',   storyPts: '5'  },
      { id: 'bl-7', type: 'task',        key: 'BB-265', summary: 'Write integration tests for issue drag-and-drop between sprint columns',          badges: ['medium'],          status: 'todo', assignee: 'none', storyPts: '3'  },
      { id: 'bl-8', type: 'question',    key: 'BB-266', summary: 'Spike: explore AI-powered issue auto-triage and priority suggestion',             badges: ['low'],             status: 'todo', assignee: 'am',   storyPts: '—'  },
    ],
  },
];

/* ─────────────────────────────────────────────
   Lookup maps
───────────────────────────────────────────── */
const TYPE_ICON: Record<IssueType, string> = {
  bug: '🐛', story: '📖', task: '✅', epic: '⚡',
  improvement: '💡', chore: '🔧', security: '🔒',
  design: '🎨', question: '❓',
};

const TYPE_LABEL: Record<IssueType, string> = {
  bug: 'Bug', story: 'Story', task: 'Task', epic: 'Epic',
  improvement: 'Improvement', chore: 'Chore', security: 'Security',
  design: 'Design', question: 'Question',
};

const BADGE_CLASS: Record<BadgeKind, string> = {
  critical: 'bb-badge bb-badge-critical',
  high:     'bb-badge bb-badge-high',
  medium:   'bb-badge bb-badge-medium',
  low:      'bb-badge bb-badge-low',
  story:    'bb-badge bb-badge-story',
  epic:     'bb-badge bb-badge-epic',
};

const BADGE_LABEL: Record<BadgeKind, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium',
  low: 'Low', story: 'Story', epic: 'Epic',
};

const STATUS_CLASS: Record<StatusKind, string> = {
  todo:       'bb-status-badge bb-st-todo',
  inprogress: 'bb-status-badge bb-st-prog',
  done:       'bb-status-badge bb-st-done',
  blocked:    'bb-status-badge bb-st-blocked',
  review:     'bb-status-badge bb-st-review',
};

const STATUS_LABEL: Record<StatusKind, string> = {
  todo: 'To do', inprogress: 'In progress', done: 'Done',
  blocked: 'Blocked', review: 'In review',
};

const ASSIGNEE_DATA: Record<AssigneeKey, { label: string; cls: string }> = {
  pk:   { label: 'PK', cls: 'bb-assignee bb-av-pk' },
  lt:   { label: 'LT', cls: 'bb-assignee bb-av-lt' },
  sr:   { label: 'SR', cls: 'bb-assignee bb-av-sr' },
  am:   { label: 'AM', cls: 'bb-assignee bb-av-am' },
  kw:   { label: 'KW', cls: 'bb-assignee bb-av-kw' },
  none: { label: '—',  cls: 'bb-assignee bb-av-none' },
};

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
function IssueRow({ issue }: { issue: BacklogIssue }) {
  const av = ASSIGNEE_DATA[issue.assignee];
  return (
    <div className="bb-issue-row">
      <span className="bb-issue-type" title={TYPE_LABEL[issue.type]}>
        {TYPE_ICON[issue.type]}
      </span>
      <span className="bb-issue-key">{issue.key}</span>
      <span className="bb-issue-summary">{issue.summary}</span>
      <div className="bb-issue-labels">
        {issue.badges.map((b) => (
          <span key={b} className={BADGE_CLASS[b]}>{BADGE_LABEL[b]}</span>
        ))}
      </div>
      <span className={STATUS_CLASS[issue.status]}>{STATUS_LABEL[issue.status]}</span>
      <div className={av.cls} title={av.label}>{av.label}</div>
      <span className="bb-story-pts">{issue.storyPts}</span>
    </div>
  );
}

interface SprintBlockProps {
  sprint: SprintData;
  collapsed: boolean;
  onToggle: () => void;
}

function SprintBlock({ sprint, collapsed, onToggle }: SprintBlockProps) {
  const visibleCount = sprint.issues.length;

  return (
    <div className="bb-sprint-block">
      {/* Header */}
      <div className="bb-sprint-header" onClick={onToggle}>
        <span className={`bb-sprint-chevron${collapsed ? '' : ' open'}`}>▶</span>
        <span className="bb-sprint-name">{sprint.name}</span>

        {sprint.tag === 'active' && (
          <span className="bb-sprint-tag bb-sprint-tag-active">Active</span>
        )}
        {sprint.tag === 'upcoming' && (
          <span className="bb-sprint-tag bb-sprint-tag-upcoming">Upcoming</span>
        )}

        {sprint.dates && (
          <span className="bb-sprint-dates">{sprint.dates}</span>
        )}

        <span
          className="bb-sprint-count"
          style={sprint.tag ? undefined : { marginLeft: 0 }}
        >
          {sprint.tag
            ? `${sprint.issueCount} issues · ${sprint.storyPts} pts`
            : `${sprint.issueCount} issues`}
        </span>

        {sprint.tag && <span style={{ flex: 1 }} />}

        <button
          className="bb-sprint-action"
          onClick={(e) => e.stopPropagation()}
        >
          {sprint.action}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div>
          {/* Stats strip — active sprint only */}
          {sprint.stats && (
            <div className="bb-stats-strip">
              <div className="bb-stat-item">
                <div className="bb-stat-dot bb-dot-done" />
                {sprint.stats.done} done
              </div>
              <div className="bb-stat-item">
                <div className="bb-stat-dot bb-dot-prog" />
                {sprint.stats.inprogress} in progress
              </div>
              <div className="bb-stat-item">
                <div className="bb-stat-dot bb-dot-blocked" />
                {sprint.stats.blocked} blocked
              </div>
              <div className="bb-stat-item">
                <div className="bb-stat-dot bb-dot-todo" />
                {sprint.stats.todo} to do
              </div>
            </div>
          )}

          {/* Progress bar — active sprint only */}
          {sprint.progress !== undefined && (
            <div className="bb-sprint-progress">
              <span className="bb-progress-label">
                {sprint.stats?.done} / {sprint.issueCount}
              </span>
              <div className="bb-progress-bar">
                <div
                  className="bb-progress-fill"
                  style={{ width: `${sprint.progress}%` }}
                />
              </div>
              <span className="bb-progress-label">{sprint.progress}% complete</span>
            </div>
          )}

          {/* Issues */}
          <div className="bb-issue-list">
            {sprint.issues.length === 0 ? (
              <div style={{
                padding: '16px 14px',
                fontSize: 12,
                color: 'var(--bb-bl-count)',
                fontStyle: 'italic',
              }}>
                No issues match your search.
              </div>
            ) : (
              sprint.issues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
const FILTERS = [
  { key: 'assignee', label: '👤 Assignee' },
  { key: 'label',    label: '🏷️ Label'    },
  { key: 'priority', label: '⚡ Priority' },
  { key: 'type',     label: '🔖 Type'     },
  { key: 'sprint',   label: '📅 Sprint'   },
];

const LEGEND: Array<{ icon: string; label: string }> = [
  { icon: '🐛', label: 'Bug'         },
  { icon: '📖', label: 'Story'       },
  { icon: '✅', label: 'Task'        },
  { icon: '⚡', label: 'Epic'        },
  { icon: '💡', label: 'Improvement' },
  { icon: '🔧', label: 'Chore'       },
  { icon: '🔒', label: 'Security'    },
  { icon: '🎨', label: 'Design'      },
  { icon: '❓', label: 'Question'    },
];

export default function BacklogPage() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['assignee']));

  const totalIssues = SPRINTS.reduce((sum, s) => sum + s.issues.length, 0);

  const filteredSprints = useMemo(() => {
    if (!search.trim()) return SPRINTS;
    const q = search.toLowerCase();
    return SPRINTS.map((sprint) => ({
      ...sprint,
      issues: sprint.issues.filter(
        (i) =>
          i.summary.toLowerCase().includes(q) ||
          i.key.toLowerCase().includes(q)
      ),
    }));
  }, [search]);

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bb-content-bg)',
      }}
    >
      {/* ── Topbar ── */}
      <div
        style={{
          height: 52,
          background: 'var(--bb-topbar-bg)',
          borderBottom: '1px solid var(--bb-topbar-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-page-title)' }}>
            Backlog
          </div>
          <div style={{ fontSize: 11, color: 'var(--bb-bc-root)', marginTop: 2 }}>
            BrainBoard{' '}
            <span style={{ color: 'var(--bb-bc-sep)' }}>›</span>{' '}
            <span style={{ color: '#E75026' }}>BB</span>{' '}
            <span style={{ color: 'var(--bb-bc-sep)' }}>›</span>{' '}
            <span style={{ color: 'var(--bb-bc-current)' }}>Backlog</span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button className="bb-bl-tb-btn">
          <span style={{ fontSize: 12 }}>🔍</span> Epic view
        </button>
        <button className="bb-bl-tb-btn">
          <span style={{ fontSize: 12 }}>⚙️</span> Group by
        </button>
        <button className="bb-bl-tb-btn bb-bl-tb-btn-primary">
          + Create issue
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px' }}>

        {/* ── Toolbar ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          <div className="bb-bl-search-box">
            <span style={{ color: 'var(--bb-bl-count)', fontSize: 13 }}>🔍</span>
            <input
              className="bb-bl-search-input"
              placeholder="Search issues…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter buttons */}
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`bb-bl-filter-btn${activeFilters.has(f.key) ? ' active' : ''}`}
              onClick={() => toggleFilter(f.key)}
            >
              {f.label}
            </button>
          ))}

          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'var(--bb-bl-count)',
            }}
          >
            {totalIssues} issues total
          </span>
        </div>

        {/* ── Sprint blocks ── */}
        {filteredSprints.map((sprint) => (
          <SprintBlock
            key={sprint.id}
            sprint={sprint}
            collapsed={!!collapsed[sprint.id]}
            onToggle={() =>
              setCollapsed((prev) => ({ ...prev, [sprint.id]: !prev[sprint.id] }))
            }
          />
        ))}

        {/* ── Legend ── */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            padding: '14px 2px 4px',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--bb-bl-count)',
              fontWeight: 600,
            }}
          >
            Issue types:
          </span>
          {LEGEND.map((l) => (
            <span
              key={l.label}
              style={{
                fontSize: 11,
                color: 'var(--bb-bl-count)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {l.icon} {l.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
