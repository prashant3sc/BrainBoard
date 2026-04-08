import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import type { WikiPage } from '@/types';

interface Props {
  page: WikiPage | null;
  onSave: (title: string, content: string) => void;
  isSaving: boolean;
  canEdit: boolean;
}

export function WikiEditor({ page, onSave, isSaving, canEdit }: Props) {
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    setTitle(page?.title ?? '');
    setContent(page?.content ?? '');
  }, [page]);

  function handleSave() {
    onSave(title, content);
  }

  if (!page) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        Select a page from the sidebar to view or edit it.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-3">
        <div className="flex flex-1 flex-col">
          <input
            disabled={!canEdit}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
            className="text-xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300 disabled:text-gray-500"
          />
          <span className="text-xs text-gray-400 mt-0.5">
            Last updated: {new Date(page.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="shrink-0 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      {/* MDEditor */}
      <div className="flex-1 overflow-auto" data-color-mode="light">
        <MDEditor
          value={content}
          onChange={(val) => setContent(val ?? '')}
          preview={canEdit ? 'live' : 'preview'}
          height="100%"
          style={{ borderRadius: 0, border: 'none', flex: 1 }}
        />
      </div>
    </div>
  );
}
