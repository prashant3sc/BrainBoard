import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '@/features/projects/useProjects';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { CreateProjectModal } from '@/features/projects/components/CreateProjectModal';
import { useRBAC } from '@/hooks/useRBAC';
import useAppStore from '@/store/useAppStore';
import type { Project } from '@/types';

type Filter = 'All' | 'Active' | 'In progress' | 'Archived';
const FILTERS: Filter[] = ['All', 'Active', 'In progress', 'Archived'];

export function DashboardPage() {
  const { data: projects, isLoading, isError } = useProjects();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const { can } = useRBAC();
  const { togglePalette } = useAppStore();
  const navigate = useNavigate();

  function handleProjectClick(project: Project) {
    navigate(`/projects/${project.id}/kanban`);
  }

  /* All projects are considered Active — "In progress"/"Archived" show empty */
  const displayed = (() => {
    if (!projects) return [];
    if (activeFilter === 'All' || activeFilter === 'Active') return projects;
    return [];
  })();

  const subtitle =
    projects && projects.length > 0
      ? `${projects.length} active project${projects.length !== 1 ? 's' : ''} across your workspace`
      : 'No projects yet';

  return (
    <>
      {/* ── Topbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 32px',
        background: 'var(--bb-topbar-bg)',
        borderBottom: '1px solid var(--bb-topbar-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-root)' }}>Workspace</span>
          <span style={{ fontSize: 13, color: 'var(--bb-bc-sep)', margin: '0 2px' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-bc-current)' }}>Projects</span>
        </div>

        {/* Search + New Project */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Search box — opens AI palette (Cmd+K) on click */}
          <div
            role="button"
            tabIndex={0}
            onClick={togglePalette}
            onKeyDown={(e) => e.key === 'Enter' && togglePalette()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'var(--bb-search-bg)',
              border: '1px solid var(--bb-search-border)',
              borderRadius: 6,
              padding: '6px 12px',
              width: 200,
              cursor: 'text',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="var(--bb-search-text)" strokeWidth="1.4" />
              <path d="M10 10l2.5 2.5" stroke="var(--bb-search-text)" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--bb-search-text)', userSelect: 'none' }}>Search projects…</span>
            <kbd style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--bb-search-text)', background: 'none', border: 'none' }}>⌘K</kbd>
          </div>

          {/* New Project button */}
          {can('createProject') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#E75026',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#C73D16')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#E75026')}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New Project
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '28px 32px', flex: 1, background: 'var(--bb-content-bg)', minHeight: 'calc(100vh - 57px)' }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--bb-page-title)', letterSpacing: '-0.4px' }}>
            Projects
          </div>
          <div style={{ fontSize: 13, color: 'var(--bb-page-subtitle)', marginTop: 3 }}>
            {subtitle}
          </div>
        </div>

        {/* Filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`bb-filter-btn${activeFilter === f ? ' bb-filter-active' : ''}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Section label */}
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          color: 'var(--bb-section-label)', textTransform: 'uppercase', marginBottom: 12,
        }}>
          Your projects
        </div>

        {/* ── Loading skeletons ── */}
        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                background: 'var(--bb-skeleton-card-bg)',
                border: '1px solid var(--bb-card-border)',
                borderRadius: 10,
                padding: 20,
                minHeight: 178,
              }}>
                <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 8, height: 36, width: 36, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 14, width: '60%', marginBottom: 8 }} />
                <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 12, width: '90%', marginBottom: 4 }} />
                <div style={{ background: 'var(--bb-skeleton-stripe-bg)', borderRadius: 4, height: 12, width: '70%' }} />
              </div>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {isError && (
          <p style={{ fontSize: 13, color: 'var(--bb-error-color)' }}>Failed to load projects.</p>
        )}

        {/* ── Projects grid ── */}
        {!isLoading && !isError && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {displayed.map((project, i) => (
              <ProjectCard key={project.id} project={project} onClick={handleProjectClick} index={i} />
            ))}

            {/* "Create new project" card */}
            {can('createProject') && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsCreateModalOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setIsCreateModalOpen(true)}
                className="bb-new-project-card"
                style={{
                  background: 'var(--bb-new-card-bg)',
                  border: '1.5px dashed var(--bb-new-card-border)',
                  borderRadius: 10,
                  padding: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  minHeight: 178,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div className="bb-new-icon" style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--bb-new-icon-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: 'var(--bb-new-icon-color)',
                  transition: 'background 0.15s, color 0.15s',
                  lineHeight: 1,
                }}>
                  +
                </div>
                <span className="bb-new-label" style={{ fontSize: 12.5, color: 'var(--bb-new-label-color)', fontWeight: 500 }}>
                  Create new project
                </span>
              </div>
            )}

            {/* Empty state */}
            {displayed.length === 0 && !can('createProject') && (
              <div style={{
                gridColumn: '1 / -1', textAlign: 'center',
                padding: '48px 0', color: 'var(--bb-page-subtitle)', fontSize: 13,
              }}>
                No projects found.
              </div>
            )}
          </div>
        )}
      </div>

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </>
  );
}

export default DashboardPage;
