import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import type { WikiPage } from '@/types';

export interface WikiEditorHandle {
  save: () => void;
}

interface Props {
  page: WikiPage | null;
  parentPage: WikiPage | null;
  onSave: (title: string, content: string) => void;
  isSaving: boolean;
  canEdit: boolean;
  isEditing: boolean;
}

/* ── SVG icon set ── */
function Ic({ d, w = 14, h = 14 }: { d: string; w?: number; h?: number }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TbSep() { return <div className="wke-tb-sep" />; }

function TbBtn({ active, title: tip, onClick, disabled, children }: {
  active?: boolean; title?: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      className={`wke-tb-btn${active ? ' wke-tb-btn-active' : ''}`}
      title={tip}
      onClick={onClick}
      type="button"
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export const WikiEditor = forwardRef<WikiEditorHandle, Props>(function WikiEditor(
  { page, parentPage, onSave, isSaving: _isSaving, canEdit, isEditing },
  ref,
) {
  const [title, setTitle] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start writing your page…' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
    ],
    content: page?.content ?? '',
    editable: isEditing && canEdit,
    editorProps: { attributes: { class: 'wiki-prosemirror-content' } },
  });

  useEffect(() => {
    if (editor) editor.setEditable(isEditing && canEdit);
  }, [editor, isEditing, canEdit]);

  useEffect(() => {
    setTitle(page?.title ?? '');
    if (editor && page) {
      editor.commands.setContent(page.content ?? '', { emitUpdate: false });
    } else if (editor && !page) {
      editor.commands.setContent('', { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id]);

  useImperativeHandle(ref, () => ({
    save: () => {
      if (!page) return;
      onSave(title, editor?.getHTML() ?? '');
    },
  }));

  const disabled = !isEditing || !canEdit;

  function headingLabel() {
    if (!editor) return 'Paragraph';
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    return 'Paragraph';
  }

  function cycleHeading() {
    if (!editor) return;
    if (editor.isActive('paragraph')) editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (editor.isActive('heading', { level: 2 })) editor.chain().focus().toggleHeading({ level: 3 }).run();
    else if (editor.isActive('heading', { level: 3 })) editor.chain().focus().toggleHeading({ level: 1 }).run();
    else editor.chain().focus().setParagraph().run();
  }

  /* ── Empty state ── */
  if (!page) {
    return (
      <div className="wke-area wke-area-empty">
        <div className="wke-empty-state">
          <div className="wke-empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="8" y="4" width="32" height="40" rx="4" stroke="currentColor" strokeWidth="2" opacity=".2"/>
              <path d="M15 16h18M15 22h18M15 28h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".4"/>
            </svg>
          </div>
          <div className="wke-empty-title">Select a page</div>
          <div className="wke-empty-sub">Choose a page from the sidebar to view or edit its content.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wke-area">
      <div className="wke-inner">

        {/* Breadcrumb */}
        <div className="wke-breadcrumb">
          <span className="wke-crumb wke-crumb-link">Wiki</span>
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ opacity: .4 }}>
            <path d="M1 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {page.section && (
            <>
              <span className="wke-crumb wke-crumb-link">{page.section}</span>
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ opacity: .4 }}>
                <path d="M1 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
          {parentPage && (
            <>
              <span className="wke-crumb wke-crumb-link">{parentPage.title}</span>
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" style={{ opacity: .4 }}>
                <path d="M1 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
          <span className="wke-crumb wke-crumb-current">{page.title}</span>
        </div>

        {/* Doc header */}
        <div className="wke-doc-header">
          {page.emoji && <span className="wke-emoji">{page.emoji}</span>}

          {isEditing && canEdit ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              className="wke-title-input"
            />
          ) : (
            <h1 className="wke-title">{page.title}</h1>
          )}

          {/* Meta row */}
          <div className="wke-meta-row">
            {page.contributors?.[0] && (
              <div className="wke-meta-chip">
                <div className={`wke-meta-avatar ${page.contributors[0].colorClass}`}>
                  {page.contributors[0].initials}
                </div>
                <span>{page.contributors[0].name}</span>
                <span className="wke-meta-sep">·</span>
                <span>{formatRelativeDate(page.updatedAt)}</span>
              </div>
            )}
            {page.viewCount !== undefined && (
              <div className="wke-meta-chip">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <ellipse cx="7" cy="7" rx="6" ry="4" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="7" cy="7" r="2" fill="currentColor" opacity=".5"/>
                </svg>
                {page.viewCount} views
              </div>
            )}
            {page.commentCount !== undefined && page.commentCount > 0 && (
              <div className="wke-meta-chip">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2h10a1 1 0 011 1v6a1 1 0 01-1 1H5l-3 2V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                {page.commentCount} comments
              </div>
            )}
          </div>

          {/* Tags */}
          {page.tags && page.tags.length > 0 && (
            <div className="wke-tags">
              {page.tags.map((tag) => (
                <span key={tag} className="wke-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="wke-divider" />

        {/* Editor toolbar — always shown but disabled when not editing */}
        <div className={`wke-toolbar${disabled ? ' wke-toolbar-disabled' : ''}`}>
          {/* Heading selector */}
          <button className="wke-tb-label" onClick={cycleHeading} disabled={disabled} type="button">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 3v8M7 3v8M2 7h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M10 6l2 5M10 6l-2 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {headingLabel()}
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: .5 }}>
              <path d="M1.5 2.5l2.5 2.5 2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <TbSep />

          <TbBtn active={editor?.isActive('bold')} title="Bold (Ctrl+B)" onClick={() => editor?.chain().focus().toggleBold().run()} disabled={disabled}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M4 3h4a2.5 2.5 0 010 5H4V3zM4 8h4.5a2.5 2.5 0 010 5H4V8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          </TbBtn>
          <TbBtn active={editor?.isActive('italic')} title="Italic (Ctrl+I)" onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={disabled}>
            <svg width="11" height="13" viewBox="0 0 11 14" fill="none">
              <path d="M8 2H5M6 12H3M6.5 2L4.5 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </TbBtn>
          <TbBtn active={editor?.isActive('underline')} title="Underline (Ctrl+U)" onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={disabled}>
            <svg width="13" height="14" viewBox="0 0 13 14" fill="none">
              <path d="M2 2v5a4.5 4.5 0 009 0V2M1 13h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </TbBtn>
          <TbBtn active={editor?.isActive('strike')} title="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()} disabled={disabled}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <path d="M2 7h10M4.5 4.5C4.5 3 5.5 2 7 2s2.5.8 2.5 2c0 1-.6 1.7-1.5 2.2M4.5 9c0 1.2 1 2 2.5 2s2.5-.8 2.5-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </TbBtn>
          <TbBtn active={editor?.isActive('highlight')} title="Highlight" onClick={() => editor?.chain().focus().toggleHighlight().run()} disabled={disabled}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L12 5L6 11H3V8L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M1 13h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </TbBtn>

          <TbSep />

          <TbBtn active={editor?.isActive('bulletList')} title="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={disabled}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <circle cx="2" cy="3" r="1.2" fill="currentColor"/>
              <circle cx="2" cy="7" r="1.2" fill="currentColor"/>
              <circle cx="2" cy="11" r="1.2" fill="currentColor"/>
              <path d="M5 3h7M5 7h7M5 11h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </TbBtn>
          <TbBtn active={editor?.isActive('orderedList')} title="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={disabled}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <path d="M1.5 2h1V5M1.5 5h2M1 8.5h1.5a1 1 0 010 2H1M2.5 10.5h.5a1 1 0 010 2H1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 3h7M6 7h7M6 11h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </TbBtn>
          <TbBtn active={editor?.isActive('taskList')} title="Task list" onClick={() => editor?.chain().focus().toggleTaskList().run()} disabled={disabled}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <rect x="1" y="1.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M2 3.5l1 1 1.5-1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="1" y="7.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M6.5 4h6M6.5 10h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </TbBtn>

          <TbSep />

          <TbBtn active={editor?.isActive('blockquote')} title="Blockquote" onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={disabled}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <rect x="1" y="1.5" width="2.5" height="10" rx="1.25" fill="currentColor" opacity=".35"/>
              <path d="M5.5 4h7M5.5 7h7M5.5 10h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </TbBtn>
          <TbBtn active={editor?.isActive('codeBlock')} title="Code block" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} disabled={disabled}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <path d="M4.5 3.5L1 6.5l3.5 3M9.5 3.5L13 6.5l-3.5 3M8 2l-2 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </TbBtn>

          <TbSep />

          <TbBtn active={editor?.isActive('link')} title="Insert link" onClick={() => {
            if (!editor) return;
            const url = prompt('Enter URL:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }} disabled={disabled}>
            <Ic d="M8 2.5l1.5-1.5a2.5 2.5 0 013.5 3.5L11.5 6M6 11.5l-1.5 1.5A2.5 2.5 0 011 9.5L2.5 8M5 9l4-4" />
          </TbBtn>
          <TbBtn title="Insert image" onClick={() => {
            if (!editor) return;
            const url = prompt('Enter image URL:');
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }} disabled={disabled}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <rect x="1" y="1.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="4.5" cy="4.5" r="1.2" fill="currentColor" opacity=".5"/>
              <path d="M1 9.5l3.5-3 3 3 2-2 3.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </TbBtn>
          <TbBtn title="Insert table" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={disabled}>
            <svg width="14" height="13" viewBox="0 0 14 13" fill="none">
              <rect x="1" y="1.5" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 5.5h12M5 5.5v6M5 1.5v4" stroke="currentColor" strokeWidth="1.1"/>
            </svg>
          </TbBtn>
        </div>

        {/* Tiptap content */}
        <EditorContent editor={editor} />

      </div>
    </div>
  );
});

function formatRelativeDate(dateStr: string): string {
  const date   = new Date(dateStr);
  const now    = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
