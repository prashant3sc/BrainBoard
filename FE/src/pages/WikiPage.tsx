import { useRef, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useWikiPages, useCreateWikiPage, useUpdateWikiPage, useDeleteWikiPage, useWikiLinks } from '@/features/wiki/useWiki';

import { WikiSidebar } from '@/features/wiki/components/WikiSidebar';
import { WikiEditor, type WikiEditorHandle } from '@/features/wiki/components/WikiEditor';
import { LinkedIssuesPanel, type PanelTab } from '@/features/wiki/components/LinkedIssuesPanel';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useRBAC } from '@/hooks/useRBAC';
import { useArchivedProject } from '@/hooks/useArchivedProject';
import { ArchivedBanner } from '@/components/common/ArchivedBanner';
import type { WikiPage as WikiPageType } from '@/types';

const FAV_KEY = 'wks_fav_pages';
function loadFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]'); } catch { return []; }
}
function saveFavs(ids: string[]) { localStorage.setItem(FAV_KEY, JSON.stringify(ids)); }

export function WikiPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useRBAC();
  const { isArchived, isWriteLocked, project } = useArchivedProject(projectId);

  const [selectedPageId,  setSelectedPageId]  = useState<string | null>(searchParams.get('page'));
  const [isEditing,       setIsEditing]       = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('wks_sidebar_collapsed') === 'true'
  );
  const [favIds,       setFavIds]       = useState<string[]>(loadFavs);
  const [panelTab,     setPanelTab]     = useState<PanelTab | null>(null);

  const editorRef = useRef<WikiEditorHandle>(null);

  const { data: pages = [], isLoading } = useWikiPages(projectId!);

  const { mutate: createPage } = useCreateWikiPage();
  const { mutate: updatePage, isPending: isSaving } = useUpdateWikiPage();
  const { mutate: deletePage } = useDeleteWikiPage();
  const { data: linkedItems = [] } = useWikiLinks(selectedPageId ?? '');

  useEffect(() => {
    const paramId = searchParams.get('page');
    if (paramId && pages.length > 0) {
      setSelectedPageId(paramId);
      setSearchParams((prev) => { prev.delete('page'); return prev; }, { replace: true });
    }
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;
  const parentPage   = selectedPage?.parentId
    ? (pages.find((p) => p.id === selectedPage.parentId) ?? null)
    : null;

  const isFav = selectedPageId ? favIds.includes(selectedPageId) : false;

  function toggleSidebar() {
    setSidebarCollapsed((v) => {
      localStorage.setItem('wks_sidebar_collapsed', String(!v));
      return !v;
    });
  }

  function toggleFav() {
    if (!selectedPageId) return;
    setFavIds((prev) => {
      const next = prev.includes(selectedPageId)
        ? prev.filter((id) => id !== selectedPageId)
        : [...prev, selectedPageId];
      saveFavs(next);
      return next;
    });
  }

  function handleDeletePage(id: string) {
    deletePage({ id, projectId: projectId! }, {
      onSuccess: () => { if (selectedPageId === id) { setSelectedPageId(null); setIsEditing(false); } },
    });
  }
  function handleCreatePage(parentId: string | null) {
    createPage(
      { title: 'New Page', content: '', parentId, projectId: projectId! },
      { onSuccess: (newPage) => { setSelectedPageId(newPage.id); setIsEditing(true); } },
    );
  }
  function handleSave(title: string, content: string) {
    if (!selectedPageId) return;
    updatePage(
      { id: selectedPageId, dto: { title, content }, projectId: projectId! },
      { onSuccess: () => setIsEditing(false) },
    );
  }
  function handleSelectPage(page: WikiPageType) { setSelectedPageId(page.id); setIsEditing(false); }
  function handleExplain(text: string) {
    window.dispatchEvent(new CustomEvent('wiki:explain', { detail: { text } }));
  }

  if (!projectId) {
    return <p className="p-8 text-sm" style={{ color: 'var(--bb-error-color)' }}>No project selected.</p>;
  }

  const sidebarW = sidebarCollapsed ? 40 : 260;

  /* ── Breadcrumb segments ── */
  const crumbs: { label: string; muted?: boolean }[] = [
    { label: project?.name ?? 'Project', muted: true },
    { label: 'Wiki', muted: true },
    ...(parentPage ? [{ label: parentPage.title, muted: true }] : []),
    ...(selectedPage ? [{ label: selectedPage.title }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {isArchived && <ArchivedBanner viewOnly={isWriteLocked} />}

      {/* ── Unified topbar ── */}
      <div className="wiki-topbar">

        {/* Left: sidebar header section — width mirrors sidebar */}
        <div className="wiki-topbar-sidebar-sec" style={{ width: sidebarW, minWidth: sidebarW }}>
          {sidebarCollapsed ? (
            <button className="wks-collapse-btn" onClick={toggleSidebar} title="Expand sidebar">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 2l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 2l4 5-4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : (
            <>
              <div className="wiki-topbar-brand">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#E75026', flexShrink: 0 }}>
                  <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M5 5.5h6M5 8h6M5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span className="wiki-topbar-brand-name">Wiki</span>
              </div>
              <button className="wks-collapse-btn" onClick={toggleSidebar} title="Collapse sidebar">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2L5 7l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 2L1 7l4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="wiki-topbar-divider" />

        {/* Center: breadcrumb */}
        <div className="wiki-topbar-crumbs">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span className="wiki-topbar-sep">/</span>}
              <span className={c.muted ? 'wiki-topbar-crumb-muted' : 'wiki-topbar-crumb-active'}>
                {c.label}
              </span>
            </span>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Right: actions */}
        {selectedPage && (
          <div className="wiki-topbar-actions">
            {/* Favorite */}
            <button
              className={`wiki-topbar-btn${isFav ? ' wiki-topbar-btn-active' : ''}`}
              onClick={toggleFav}
              title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1.5l1.55 3.14 3.46.5-2.5 2.44.59 3.44L7 9.27l-3.1 1.75.59-3.44L2 5.14l3.46-.5L7 1.5z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
                  fill={isFav ? 'currentColor' : 'none'}
                />
              </svg>
              {isFav ? 'Favorited' : 'Favorite'}
            </button>

            {/* Edit / Save / Cancel */}
            {isEditing && can('editWikiPage') && !isWriteLocked ? (
              <>
                <button className="wiki-topbar-btn" onClick={() => setIsEditing(false)}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Cancel
                </button>
                <button
                  className="wiki-topbar-btn wiki-topbar-btn-primary"
                  onClick={() => editorRef.current?.save()}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6.5l2.5 2.5 5.5-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Save
                    </>
                  )}
                </button>
              </>
            ) : can('editWikiPage') && !isWriteLocked && (
              <button className="wiki-topbar-btn" onClick={() => setIsEditing(true)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 2l2 2L4 10H2V8L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}

            {/* Link issue */}
            {can('editWikiPage') && !isWriteLocked && (
              <button
                className={`wiki-topbar-btn${panelTab === 'issues' ? ' wiki-topbar-btn-active' : ''}`}
                onClick={() => setPanelTab((t) => t === 'issues' ? null : 'issues')}
                title="Linked issues"
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M5.5 8.5a3.5 3.5 0 0 0 5 0l1.5-1.5a3.5 3.5 0 0 0-5-5L6.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M8.5 5.5a3.5 3.5 0 0 0-5 0L2 7a3.5 3.5 0 0 0 5 5l.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Link issue
              </button>
            )}

            {/* History */}
            <button
              className={`wiki-topbar-btn${panelTab === 'history' ? ' wiki-topbar-btn-active' : ''}`}
              onClick={() => setPanelTab((t) => t === 'history' ? null : 'history')}
              title="Version history"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M7 1a6 6 0 1 0 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M13 1v4H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              History
            </button>

            {/* Info */}
            <button
              className={`wiki-topbar-btn${panelTab === 'info' ? ' wiki-topbar-btn-active' : ''}`}
              onClick={() => setPanelTab((t) => t === 'info' ? null : 'info')}
              title="Page info"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 6.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="7" cy="4.5" r=".8" fill="currentColor"/>
              </svg>
              Info
            </button>

            {/* More options */}
            <button className="wiki-topbar-btn-icon" title="More options">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="2.5" cy="7" r="1.2" fill="currentColor"/>
                <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
                <circle cx="11.5" cy="7" r="1.2" fill="currentColor"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Wiki layout ── */}
      <div className="wiki-layout" style={{ flex: 1, minHeight: 0 }}>

        {/* Left: page tree */}
        {isLoading ? (
          <div style={{ width: sidebarW, minWidth: sidebarW, background: 'var(--bb-wiki-tree-bg)', borderRight: '1px solid var(--bb-wiki-tree-border)', padding: 16, transition: 'width .2s, min-width .2s' }}>
            <LoadingSkeleton rows={6} />
          </div>
        ) : (
          <WikiSidebar
            pages={pages}
            selectedPageId={selectedPageId}
            onSelect={handleSelectPage}
            onCreatePage={handleCreatePage}
            onDeletePage={handleDeletePage}
            canCreate={can('createWikiPage') && !isWriteLocked}
            canDelete={can('editWikiPage') && !isWriteLocked}
            collapsed={sidebarCollapsed}
            favIds={favIds}
            onFavChange={setFavIds}
          />
        )}

        {/* Center: doc viewer / editor */}
        <WikiEditor
          ref={editorRef}
          page={selectedPage}
          parentPage={parentPage}
          onSave={handleSave}
          isSaving={isSaving}
          canEdit={can('editWikiPage') && !isWriteLocked}
          isEditing={isEditing}
          onExplain={handleExplain}
          linkedCount={linkedItems.length}
        />

        {/* Details panel — slides in from right, inside layout */}
        {panelTab && selectedPage && (
          <LinkedIssuesPanel
            page={selectedPage}
            allPages={pages}
            projectId={projectId!}
            initialTab={panelTab}
            onClose={() => setPanelTab(null)}
          />
        )}
      </div>
    </div>
  );
}

export default WikiPage;
