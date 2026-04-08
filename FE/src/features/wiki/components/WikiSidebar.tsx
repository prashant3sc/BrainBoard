import { useState } from 'react';
import type { WikiPage } from '@/types';

interface TreeNode {
  page: WikiPage;
  children: WikiPage[];
}

interface Props {
  pages: WikiPage[];
  selectedPageId: string | null;
  onSelect: (page: WikiPage) => void;
  onCreatePage: (parentId: string | null) => void;
  canCreate: boolean;
}

export function WikiSidebar({ pages, selectedPageId, onSelect, onCreatePage, canCreate }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const topLevel = pages.filter((p) => p.parentId === null);
  const tree: TreeNode[] = topLevel.map((page) => ({
    page,
    children: pages.filter((p) => p.parentId === page.id),
  }));

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleCreateRoot() {
    onCreatePage(null);
  }

  const activeCls = 'bg-indigo-50 text-indigo-700 font-medium';
  const baseCls   = 'text-gray-700 hover:bg-gray-100';

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Pages</span>
        {canCreate && (
          <button onClick={handleCreateRoot} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
            + New Page
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {tree.map(({ page, children }) => (
          <div key={page.id}>
            {/* Top-level page row */}
            <div
              className="group flex items-center justify-between rounded-md px-2 py-1.5 cursor-pointer"
              onMouseEnter={() => setHoveredId(page.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <button
                onClick={() => { onSelect(page); if (children.length) toggleExpand(page.id); }}
                className={`flex-1 text-left text-sm truncate rounded ${selectedPageId === page.id ? activeCls : baseCls} px-1`}
              >
                {children.length > 0 && (
                  <span className="mr-1 text-xs text-gray-400">{expanded[page.id] ? '▾' : '▸'}</span>
                )}
                {page.title}
              </button>
              {canCreate && hoveredId === page.id && (
                <button
                  onClick={() => onCreatePage(page.id)}
                  className="ml-1 shrink-0 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                  title="Add sub-page"
                >
                  + Sub
                </button>
              )}
            </div>

            {/* Sub-pages */}
            {expanded[page.id] && children.map((child) => (
              <button
                key={child.id}
                onClick={() => onSelect(child)}
                className={`w-full text-left rounded-md px-2 py-1.5 pl-7 text-sm truncate ${selectedPageId === child.id ? activeCls : baseCls}`}
              >
                {child.title}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}
