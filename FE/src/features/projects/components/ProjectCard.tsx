import { useState, useEffect, useRef } from 'react';
import type { Project } from '@/types';

interface Props {
  project: Project;
  onClick: (project: Project) => void;
  onPulse: (project: Project, index: number) => void;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onArchive?: (project: Project) => void;
  canManage?: boolean;
  index?: number;
  isPulseActive?: boolean;
}

const ICONS = ['🖥️', '⚙️', '📦', '🚀', '🎯', '🔧', '📊', '🛠️'];

export function ProjectCard({
  project, onClick, onPulse, onEdit, onDelete, onArchive,
  canManage = false, index = 0, isPulseActive = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const date = new Date(project.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const isBlue   = index % 2 === 1;
  const icon     = ICONS[index % ICONS.length];
  const initials = project.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(project)}
      onKeyDown={(e) => e.key === 'Enter' && onClick(project)}
      className="bb-project-card"
      style={{
        background: 'var(--bb-card-bg)',
        border: `1px solid ${project.isArchived ? 'var(--bb-tbl-wrap-border)' : 'var(--bb-card-border)'}`,
        borderRadius: 10,
        padding: 20,
        cursor: 'pointer',
        position: 'relative',
        opacity: project.isArchived ? 0.72 : 1,
      }}
    >
      {/* Card header: icon + status badge + three-dot menu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
          background: project.isArchived
            ? 'var(--bb-skeleton-stripe-bg)'
            : isBlue ? 'var(--bb-card-icon-blue)' : 'var(--bb-card-icon-orange)',
        }}>
          {icon}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Status badge — only shown when archived */}
          {project.isArchived && (
            <span style={{
              fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
              background: 'var(--bb-skeleton-card-bg)',
              color: 'var(--bb-text-muted)',
              border: '1px solid var(--bb-tbl-wrap-border)',
            }}>
              Archived
            </span>
          )}

          {canManage && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                className="bb-card-menu-btn"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                title="More options"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="2.5" r="1.3" />
                  <circle cx="8" cy="8"   r="1.3" />
                  <circle cx="8" cy="13.5" r="1.3" />
                </svg>
              </button>

              {menuOpen && (
                <div className="bb-card-dropdown" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="bb-card-dropdown-option"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit?.(project); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11.5 2.5a2.121 2.121 0 0 1 3 3L5 15H2v-3L11.5 2.5z" />
                    </svg>
                    Edit project
                  </button>

                  <button
                    className="bb-card-dropdown-option"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive?.(project); }}
                  >
                    {project.isArchived ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 14 15 14 15 4" /><polyline points="1 4 8 10 15 4" /><polyline points="5 4 11 4" />
                        </svg>
                        Unarchive
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 14 15 14 15 4" /><polyline points="1 4 8 10 15 4" /><line x1="8" y1="1" x2="8" y2="9" />
                        </svg>
                        Archive
                      </>
                    )}
                  </button>

                  <button
                    className="bb-card-dropdown-option bb-card-dropdown-danger"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete?.(project); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 4 4 4 14 4" />
                      <path d="M5 4V2h6v2" />
                      <path d="M13 4l-.867 9.747A1 1 0 0 1 11.138 15H4.862a1 1 0 0 1-.995-.93L3 4" />
                    </svg>
                    Delete project
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
          <button
            className="bb-pulse-btn"
            onClick={(e) => { e.stopPropagation(); onPulse(project, index); }}
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
