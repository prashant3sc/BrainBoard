import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWikiPages, useCreateWikiPage, useUpdateWikiPage, useDeleteWikiPage } from '@/features/wiki/useWiki';
import { WikiSidebar } from '@/features/wiki/components/WikiSidebar';
import { WikiEditor, type WikiEditorHandle } from '@/features/wiki/components/WikiEditor';
import { WikiMetaSidebar } from '@/features/wiki/components/WikiMetaSidebar';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useRBAC } from '@/hooks/useRBAC';
import type { WikiPage as WikiPageType } from '@/types';

export function WikiPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { can } = useRBAC();

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const editorRef = useRef<WikiEditorHandle>(null);

  const { data: pages = [], isLoading } = useWikiPages(projectId!);
  const { mutate: createPage } = useCreateWikiPage();
  const { mutate: updatePage, isPending: isSaving } = useUpdateWikiPage();
  const { mutate: deletePage } = useDeleteWikiPage();

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

      {/* ── Wiki topbar ── */}
      <div className="wiki-topbar">
        <div>
          <div className="wiki-topbar-title">Wiki</div>
          <div className="wiki-breadcrumb-row">
            BrainBoard › <span className="bc-hl">BB</span> › Wiki
            {selectedPage?.section && (
              <> › <span className="bc-hl">{selectedPage.section}</span></>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button className="wiki-tb-btn">⭐ Star page</button>
        <button className="wiki-tb-btn">↗ Share</button>

        {isEditing ? (
          <>
            <button className="wiki-tb-btn" onClick={handleCancel}>
              ✕ Cancel
            </button>
            <button
              className="wiki-tb-btn wiki-tb-btn-primary"
              onClick={handleSaveClick}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : '💾 Save'}
            </button>
          </>
        ) : (
          can('editWikiPage') && selectedPage && (
            <button className="wiki-tb-btn wiki-tb-btn-primary" onClick={handleEdit}>
              ✏️ Edit
            </button>
          )
        )}
      </div>

      {/* ── Three-panel wiki layout ── */}
      <div className="wiki-layout">

        {/* Left: page tree */}
        {isLoading ? (
          <div style={{
            width: 240,
            minWidth: 240,
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
            canCreate={can('createWikiPage')}
            canDelete={can('manageProjectMembers')}
          />
        )}

        {/* Center: doc viewer / editor */}
        <WikiEditor
          ref={editorRef}
          page={selectedPage}
          parentPage={parentPage}
          onSave={handleSave}
          isSaving={isSaving}
          canEdit={can('editWikiPage')}
          isEditing={isEditing}
        />

        {/* Right: metadata sidebar — only shown when a page is selected */}
        {selectedPage && (
          <WikiMetaSidebar page={selectedPage} allPages={pages} />
        )}

      </div>
    </div>
  );
}

export default WikiPage;
