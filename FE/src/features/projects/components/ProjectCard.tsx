import type { Project } from '@/types';

interface Props {
  project: Project;
  onClick: (project: Project) => void;
  onPulse: (project: Project, index: number) => void;
  index?: number;
  isPulseActive?: boolean;
}

const ICONS = ['🖥️', '⚙️', '📦', '🚀', '🎯', '🔧', '📊', '🛠️'];

export function ProjectCard({ project, onClick, onPulse, index = 0, isPulseActive = false }: Props) {
  const date = new Date(project.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isBlue   = index % 2 === 1;
  const icon     = ICONS[index % ICONS.length];
  const initials = project.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(project)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(project)}
      className="bb-project-card"
      style={{
        background: 'var(--bb-card-bg)',
        border: '1px solid var(--bb-card-border)',
        borderRadius: 10,
        padding: 20,
        cursor: 'pointer',
      }}
    >
      {/* Card header: icon + status badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
          background: isBlue ? 'var(--bb-card-icon-blue)' : 'var(--bb-card-icon-orange)',
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
          background: 'var(--bb-status-active-bg)',
          color: 'var(--bb-status-active-color)',
        }}>
          Active
        </span>
      </div>

      {/* Name */}
      <div style={{
        fontSize: 14.5, fontWeight: 600,
        color: 'var(--bb-card-name)',
        marginBottom: 6, letterSpacing: '-0.2px',
      }}>
        {project.name}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 12.5,
        color: 'var(--bb-card-desc)',
        lineHeight: 1.55,
        marginBottom: 16,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {project.description || 'No description provided.'}
      </div>

      {/* Meta: date + pulse btn + avatar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 14,
        borderTop: '1px solid var(--bb-card-meta-border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--bb-card-date)', fontFamily: 'monospace' }}>
          {date}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* AI Pulse button */}
          <button
            className="bb-pulse-btn"
            onClick={(e) => {
              e.stopPropagation();
              onPulse(project, index);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 6,
              fontSize: 11, fontWeight: 600,
              color: '#E75026',
              background: isPulseActive ? '#FFD9CC' : '#FFF3F0',
              border: '1px solid #FFD9CC',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#FFD9CC')}
            onMouseLeave={(e) => (e.currentTarget.style.background = isPulseActive ? '#FFD9CC' : '#FFF3F0')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="#E75026" strokeWidth="1.5" />
              <path d="M2 6h1.5l1.5-3 2 6 1.5-3H10" stroke="#E75026" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            AI Pulse
          </button>

          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '2px solid var(--bb-mini-avatar-border)',
            fontSize: 9, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isBlue ? '#B3D4FF' : '#FFAB8F',
            color: isBlue ? '#0747A6' : '#7A1F08',
          }}>
            {initials}
          </div>
        </div>
      </div>
    </div>
  );
}
