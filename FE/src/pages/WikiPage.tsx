import { useRef, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWikiPages, useCreateWikiPage, useUpdateWikiPage, useDeleteWikiPage } from '@/features/wiki/useWiki';
import { WikiSidebar } from '@/features/wiki/components/WikiSidebar';
import { WikiEditor, type WikiEditorHandle } from '@/features/wiki/components/WikiEditor';
import { WikiMetaSidebar } from '@/features/wiki/components/WikiMetaSidebar';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useRBAC } from '@/hooks/useRBAC';
import { useArchivedProject } from '@/hooks/useArchivedProject';
import { ArchivedBanner } from '@/components/common/ArchivedBanner';
import { projectsApi } from '@/api/projects';
import type { WikiPage as WikiPageType } from '@/types';

export function WikiPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = useRBAC();
  const { isArchived, isWriteLocked } = useArchivedProject(projectId);

  const [selectedPageId, setSelectedPageId] = useState<string | null>(searchParams.get('page'));
  const [isEditing, setIsEditing] = useState(false);

  const editorRef = useRef<WikiEditorHandle>(null);

  const { data: pages = [], isLoading } = useWikiPages(projectId!);
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: !!projectId,
  });
  const { mutate: createPage } = useCreateWikiPage();
  const { mutate: updatePage, isPending: isSaving } = useUpdateWikiPage();
  const { mutate: deletePage } = useDeleteWikiPage();

  /* If we landed with ?page=<id> in the URL, select it once pages have loaded */
  useEffect(() => {
    const paramId = searchParams.get('page');
    if (paramId && pages.length > 0) {
      setSelectedPageId(paramId);
      // Clean the param from the URL without a navigation push
      setSearchParams((prev) => { prev.delete('page'); return prev; }, { replace: true });
    }
  }, [pages]);

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;
  const parentPage = selectedPage?.parentId
    ? (pages.find((p) => p.id === selectedPage.parentId) ?? null)
    : null;

  function handleDeletePage(id: string) {
    deletePage(
      { id, projectId: projectId! },
      {
        onSuccess: () => {
          if (selectedPageId === id) {
            setSelectedPageId(null);
            setIsEditing(false);
          }
        },
      },
    );
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

  function handleSelectPage(page: WikiPageType) {
    setSelectedPageId(page.id);
    setIsEditing(false);
  }

  function handleEdit() {
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
  }

  function handleSaveClick() {
    editorRef.current?.save();
  }

  if (!projectId) {
    return (
      <p className="p-8 text-sm" style={{ color: 'var(--bb-error-color)' }}>
        No project selected.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Archived banner ── */}
      {isArchived && <ArchivedBanner viewOnly={isWriteLocked} />}

      {/* ── Wiki topbar ── */}
      <div className="wiki-topbar">
        <div className="wiki-topbar-left">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#E75026', flexShrink: 0 }}>
            <rect x="2" y="1" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 6h8M5 9h8M5 12h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="wiki-topbar-title">Wiki</div>
            <div className="wiki-breadcrumb-row">
              {project?.name ?? 'Project'} › Wiki
              {selectedPage?.section && <> › <span className="bc-hl">{selectedPage.section}</span></>}
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div className="wiki-topbar-actions">
          {isEditing ? (
            <>
              <button className="wiki-tb-btn" onClick={handleCancel}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Cancel
              </button>
              <button className="wiki-tb-btn wiki-tb-btn-primary" onClick={handleSaveClick} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="14 6"/>
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.5l2.5 2.5 5.5-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Save changes
                  </>
                )}
              </button>
            </>
          ) : (
            can('editWikiPage') && !isWriteLocked && selectedPage && (
              <button className="wiki-tb-btn wiki-tb-btn-primary" onClick={handleEdit}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M8 2l2 2L4 10H2V8L8 2z" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit page
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Three-panel wiki layout ── */}
      <div className="wiki-layout">

        {/* Left: page tree */}
        {isLoading ? (
          <div style={{
            width: 256, minWidth: 256,
            background: 'var(--bb-wiki-tree-bg)',
            borderRight: '1px solid var(--bb-wiki-tree-border)',
            padding: 16,
          }}>
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
        />

        {/* Right: metadata sidebar — only shown when a page is selected */}
        {selectedPage && (
          <WikiMetaSidebar page={selectedPage} allPages={pages} projectId={projectId!} />
        )}

      </div>
    </div>
  );
}

export default WikiPage;
