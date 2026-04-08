import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useWikiPages, useCreateWikiPage, useUpdateWikiPage } from '@/features/wiki/useWiki';
import { WikiSidebar } from '@/features/wiki/components/WikiSidebar';
import { WikiEditor } from '@/features/wiki/components/WikiEditor';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { useRBAC } from '@/hooks/useRBAC';

export function WikiPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { can } = useRBAC();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const { data: pages = [], isLoading } = useWikiPages(projectId!);
  const { mutate: createPage }  = useCreateWikiPage();
  const { mutate: updatePage, isPending: isSaving } = useUpdateWikiPage();

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;

  function handleCreatePage(parentId: string | null) {
    createPage(
      { title: 'New Page', content: '', parentId, projectId: projectId! },
      { onSuccess: (newPage) => setSelectedPageId(newPage.id) },
    );
  }

  function handleSave(title: string, content: string) {
    if (!selectedPageId) return;
    updatePage({ id: selectedPageId, dto: { title, content }, projectId: projectId! });
  }

  function handleSelectPage(page: { id: string }) {
    setSelectedPageId(page.id);
  }

  if (!projectId) return <p className="p-8 text-sm text-red-500">No project selected.</p>;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={4} /></div>
        ) : (
          <WikiSidebar
            pages={pages}
            selectedPageId={selectedPageId}
            onSelect={handleSelectPage}
            onCreatePage={handleCreatePage}
            canCreate={can('createWikiPage')}
          />
        )}
      </div>

      {/* Editor */}
      <WikiEditor
        page={selectedPage}
        onSave={handleSave}
        isSaving={isSaving}
        canEdit={can('editWikiPage')}
      />
    </div>
  );
}

export default WikiPage;
