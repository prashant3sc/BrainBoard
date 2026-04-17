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

const REACTIONS_DEFAULT = [
  { emoji: '👍', count: 8, reacted: true },
  { emoji: '❤️', count: 3, reacted: false },
  { emoji: '🔥', count: 2, reacted: false },
  { emoji: '💡', count: 1, reacted: false },
];

export const WikiEditor = forwardRef<WikiEditorHandle, Props>(function WikiEditor(
  { page, parentPage, onSave, isSaving: _isSaving, canEdit, isEditing },
  ref,
) {
  const [title, setTitle] = useState('');
  const [reactions, setReactions] = useState(REACTIONS_DEFAULT);

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
    editorProps: {
      attributes: {
        class: 'wiki-prosemirror-content',
      },
    },
  });

  /* Sync editable mode */
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing && canEdit);
    }
  }, [editor, isEditing, canEdit]);

  /* Sync content + title when selected page changes */
  useEffect(() => {
    setTitle(page?.title ?? '');
    if (editor && page) {
      editor.commands.setContent(page.content ?? '', false);
    } else if (editor && !page) {
      editor.commands.setContent('', false);
    }
    setReactions(REACTIONS_DEFAULT);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id]);

  /* Expose save() to parent via ref */
  useImperativeHandle(ref, () => ({
    save: () => {
      if (!page) return;
      onSave(title, editor?.getHTML() ?? '');
    },
  }));

  function toggleReaction(idx: number) {
    setReactions((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, reacted: !r.reacted, count: r.reacted ? r.count - 1 : r.count + 1 }
          : r,
      ),
    );
  }

  /* ── Toolbar helpers ── */
  function ToolBtn({
    active,
    title: tip,
    onClick,
    children,
  }: {
    active?: boolean;
    title?: string;
    onClick?: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        className={`tb-tool ${active ? 'is-active' : ''}`}
        title={tip}
        onClick={onClick}
        type="button"
        disabled={!isEditing || !canEdit}
      >
        {children}
      </button>
    );
  }

  function LabelBtn({
    onClick,
    children,
  }: {
    onClick?: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        className="tb-tool-label"
        onClick={onClick}
        type="button"
        disabled={!isEditing || !canEdit}
      >
        {children}
      </button>
    );
  }

  /* ── Empty state ── */
  if (!page) {
    return (
      <div className="wiki-doc-area" style={{ alignItems: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--bb-text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--bb-page-title)', marginBottom: 6 }}>
            Select a page
          </div>
          <div style={{ fontSize: 13 }}>
            Choose a page from the left sidebar to view or edit it.
          </div>
        </div>
      </div>
    );
  }

  /* ── Full doc view ── */
  return (
    <div className="wiki-doc-area">
      <div className="wiki-doc-inner">

        {/* Breadcrumb */}
        <div className="doc-breadcrumb">
          <span className="crumb-link">Wiki</span>
          <span className="crumb-sep">›</span>
          {page.section && (
            <>
              <span className="crumb-link">{page.section}</span>
              <span className="crumb-sep">›</span>
            </>
          )}
          {parentPage && (
            <>
              <span className="crumb-link">{parentPage.title}</span>
              <span className="crumb-sep">›</span>
            </>
          )}
          <span style={{ color: 'var(--bb-page-title)' }}>{page.title}</span>
        </div>

        {/* Doc header */}
        <div style={{ marginBottom: 28 }}>
          {page.emoji && (
            <span className="doc-emoji">{page.emoji}</span>
          )}

          {/* Title */}
          {isEditing && canEdit ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              style={{
                fontFamily: "'DM Serif Display', 'Georgia', serif",
                fontSize: 32,
                fontWeight: 400,
                color: 'var(--bb-page-title)',
                lineHeight: 1.2,
                marginBottom: 10,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                width: '100%',
                display: 'block',
              }}
            />
          ) : (
            <div className="doc-title">{page.title}</div>
          )}

          {/* Meta row */}
          <div className="doc-meta">
            {page.contributors && page.contributors[0] && (
              <div className="meta-chip">
                <div className={`meta-avatar ${page.contributors[0].colorClass}`}>
                  {page.contributors[0].initials}
                </div>
                <span>
                  {page.contributors[0].name} &nbsp;·&nbsp;{' '}
                  {formatRelativeDate(page.updatedAt)}
                </span>
              </div>
            )}
            {page.viewCount !== undefined && (
              <div className="meta-chip">👁 {page.viewCount} views this week</div>
            )}
            {page.commentCount !== undefined && (
              <div className="meta-chip">💬 {page.commentCount} comments</div>
            )}
          </div>

          {/* Tags */}
          {page.tags && page.tags.length > 0 && (
            <div className="doc-tags">
              {page.tags.map((tag) => (
                <button key={tag} className="doc-tag">{tag}</button>
              ))}
            </div>
          )}
        </div>

        <div className="doc-divider" />

        {/* Editor toolbar */}
        <div className="wiki-editor-toolbar">
          {/* Heading selector */}
          <LabelBtn
            onClick={() => {
              if (!editor) return;
              if (editor.isActive('heading', { level: 1 })) {
                editor.chain().focus().setParagraph().run();
              } else if (editor.isActive('heading', { level: 2 })) {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
              } else if (editor.isActive('heading', { level: 3 })) {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
              } else {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
              }
            }}
          >
            {editor?.isActive('heading', { level: 1 })
              ? 'Heading 1 ▾'
              : editor?.isActive('heading', { level: 2 })
              ? 'Heading 2 ▾'
              : editor?.isActive('heading', { level: 3 })
              ? 'Heading 3 ▾'
              : 'Paragraph ▾'}
          </LabelBtn>

          <div className="tb-sep" />

          <ToolBtn
            active={editor?.isActive('bold')}
            title="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <b>B</b>
          </ToolBtn>
          <ToolBtn
            active={editor?.isActive('italic')}
            title="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <i>I</i>
          </ToolBtn>
          <ToolBtn
            active={editor?.isActive('underline')}
            title="Underline"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <u>U</u>
          </ToolBtn>
          <ToolBtn
            active={editor?.isActive('strike')}
            title="Strikethrough"
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <s>S</s>
          </ToolBtn>

          <div className="tb-sep" />

          <ToolBtn
            active={editor?.isActive('bulletList')}
            title="Bullet list"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            ☰
          </ToolBtn>
          <ToolBtn
            active={editor?.isActive('orderedList')}
            title="Numbered list"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            ≡
          </ToolBtn>
          <ToolBtn
            active={editor?.isActive('taskList')}
            title="Task list"
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
          >
            ☑
          </ToolBtn>

          <div className="tb-sep" />

          <ToolBtn
            active={editor?.isActive('link')}
            title="Link"
            onClick={() => {
              if (!editor) return;
              const url = prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
          >
            🔗
          </ToolBtn>
          <ToolBtn
            title="Image"
            onClick={() => {
              if (!editor) return;
              const url = prompt('Enter image URL:');
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            }}
          >
            🖼
          </ToolBtn>
          <ToolBtn
            active={editor?.isActive('codeBlock')}
            title="Code block"
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            {'</>'}
          </ToolBtn>
          <ToolBtn
            title="Insert table"
            onClick={() =>
              editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          >
            ⊞
          </ToolBtn>

          <div className="tb-sep" />

          <ToolBtn
            active={editor?.isActive('blockquote')}
            title="Blockquote / Callout"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            💡
          </ToolBtn>

          <div className="tb-sep" />

          <ToolBtn
            active={editor?.isActive('highlight')}
            title="Highlight"
            onClick={() => editor?.chain().focus().toggleHighlight().run()}
          >
            ✨
          </ToolBtn>
        </div>

        {/* Tiptap content */}
        <EditorContent editor={editor} />

        {/* Reactions */}
        <div className="wiki-reactions">
          <div style={{ fontSize: 11, color: 'var(--bb-text-muted)', marginBottom: 8 }}>
            Was this page helpful?
          </div>
          <div className="reactions">
            {reactions.map((r, i) => (
              <button
                key={r.emoji}
                className={`reaction ${r.reacted ? 'reacted' : ''}`}
                onClick={() => toggleReaction(i)}
              >
                {r.emoji} <span className="reaction-count">{r.count}</span>
              </button>
            ))}
            <button className="reaction">+ Add</button>
          </div>
        </div>

      </div>
    </div>
  );
});

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
