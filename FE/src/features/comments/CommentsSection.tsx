import { useState, useRef, useEffect } from 'react';
import type { Comment, CommentAuthor, CommentReply } from '@/types';
import { useComments, useCreateComment, useEditComment, useDeleteComment } from './useComments';
import useAuthStore from '@/store/useAuthStore';
import './comments.css';

// ─── Avatar ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#E75026','#0052CC','#00875A','#6554C0','#FF8B00','#00B8D9','#36B37E','#FF5630'];

function Avatar({ author, size = 30 }: { author: CommentAuthor; size?: number }) {
  const color = AVATAR_COLORS[author.fullName.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 700,
      userSelect: 'none',
    }}>
      {author.avatar}
    </div>
  );
}

// ─── Timestamp ───────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const Dot = () => <span style={{ color: 'var(--bb-text-muted)', fontSize: 10, lineHeight: 1 }}>•</span>;

// ─── Inline editor (edit mode textarea) ──────────────────────────────────────
function InlineEditor({ initialValue, onSave, onCancel, isPending }: {
  initialValue: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [val, setVal] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.setSelectionRange(val.length, val.length); }, []); // eslint-disable-line

  return (
    <div className="cm-editor-wrap" style={{ marginTop: 4 }}>
      <textarea
        ref={ref}
        className="cm-textarea"
        value={val}
        rows={3}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      />
      <div className="cm-editor-actions">
        <span className="cm-hint">Esc to cancel</span>
        <button type="button" className="cm-btn-cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="cm-btn-save" disabled={!val.trim() || isPending} onClick={() => onSave(val.trim())}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── CommentBubble ────────────────────────────────────────────────────────────
interface BubbleProps {
  id: string;
  author: CommentAuthor;
  body: string;
  isEdited: boolean;
  createdAt: string;
  isReply?: boolean;
  currentUserId?: string;
  currentUserRole?: string;
  issueId: string;
  hasOthersReplies?: boolean;
  onReply?: () => void;
}

function CommentBubble({
  id, author, body, isEdited, createdAt,
  isReply = false,
  currentUserId, currentUserRole,
  issueId, hasOthersReplies = false,
  onReply,
}: BubbleProps) {
  const [editing,   setEditing]   = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  const editMut   = useEditComment(issueId);
  const deleteMut = useDeleteComment(issueId);

  const isOwn     = currentUserId === author.id;
  const canDelete = currentUserRole === 'admin' || currentUserRole === 'pm';

  function handleSave(newBody: string) {
    editMut.mutate({ commentId: id, body: newBody }, { onSuccess: () => setEditing(false) });
  }

  function handleDelete() {
    setDeleteErr('');
    deleteMut.mutate(id, {
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
          ?? 'Could not delete comment.';
        setDeleteErr(msg);
      },
    });
  }

  return (
    <div className={`cm-bubble${isReply ? ' cm-bubble-reply' : ''}`}>
      <Avatar author={author} size={isReply ? 24 : 28} />
      <div className="cm-bubble-content">
        {/* Header row */}
        <div className="cm-bubble-header">
          <span className="cm-author">{author.fullName}</span>
          <Dot />
          <span className="cm-time">{timeAgo(createdAt)}</span>
          {isEdited && <><Dot /><span className="cm-edited">edited</span></>}
        </div>

        {/* Body or editor */}
        {editing ? (
          <InlineEditor
            initialValue={body}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            isPending={editMut.isPending}
          />
        ) : (
          <p className="cm-body">{body}</p>
        )}

        {/* Error */}
        {deleteErr && <p className="cm-delete-err">{deleteErr}</p>}

        {/* Action row */}
        {!editing && (
          <div className="cm-actions">
            {!isReply && onReply && (
              <button type="button" className="cm-action-btn" onClick={onReply}>Reply</button>
            )}
            {isOwn && (
              <button type="button" className="cm-action-btn" onClick={() => { setEditing(true); setDeleteErr(''); }}>
                Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="cm-action-btn cm-action-delete"
                onClick={handleDelete}
                disabled={deleteMut.isPending}
                title={hasOthersReplies ? 'Cannot delete — has replies from other users' : 'Delete comment'}
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────
function CommentComposer({ issueId, parentId, placeholder, onSuccess, onCancel, autoFocus = false }: {
  issueId: string;
  parentId?: string;
  placeholder?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const mut = useCreateComment(issueId);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  function submit() {
    if (!body.trim()) return;
    mut.mutate({ body: body.trim(), parentId }, {
      onSuccess: () => { setBody(''); onSuccess?.(); },
    });
  }

  return (
    <div className="cm-composer">
      <textarea
        ref={ref}
        className="cm-textarea"
        placeholder={placeholder ?? 'Add a comment…'}
        value={body}
        rows={3}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
      />
      <div className="cm-editor-actions">
        <span className="cm-hint">Ctrl+Enter to submit</span>
        {onCancel && <button type="button" className="cm-btn-cancel" onClick={onCancel}>Cancel</button>}
        <button type="button" className="cm-btn-save" disabled={!body.trim() || mut.isPending} onClick={submit}>
          {mut.isPending ? 'Posting…' : parentId ? 'Reply' : 'Comment'}
        </button>
      </div>
    </div>
  );
}

// ─── Thread (1 top-level comment + its replies) ───────────────────────────────
function CommentThread({ comment, issueId, currentUserId, currentUserRole }: {
  comment: Comment;
  issueId: string;
  currentUserId?: string;
  currentUserRole?: string;
}) {
  const [showReply, setShowReply] = useState(false);
  const hasOthersReplies = comment.replies.some((r) => r.author.id !== comment.author.id);

  return (
    <div className="cm-thread">
      {/* Top-level comment */}
      <CommentBubble
        id={comment.id}
        author={comment.author}
        body={comment.body}
        isEdited={comment.isEdited}
        createdAt={comment.createdAt}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        issueId={issueId}
        hasOthersReplies={hasOthersReplies}
        onReply={() => setShowReply((v) => !v)}
      />

      {/* Existing replies */}
      {comment.replies.length > 0 && (
        <div className="cm-replies">
          {comment.replies.map((reply: CommentReply) => (
            <CommentBubble
              key={reply.id}
              id={reply.id}
              author={reply.author}
              body={reply.body}
              isEdited={reply.isEdited}
              createdAt={reply.createdAt}
              isReply
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              issueId={issueId}
            />
          ))}
        </div>
      )}

      {/* Reply composer */}
      {showReply && (
        <div className="cm-reply-composer">
          <CommentComposer
            issueId={issueId}
            parentId={comment.id}
            placeholder={`Reply to ${comment.author.fullName}…`}
            autoFocus
            onSuccess={() => setShowReply(false)}
            onCancel={() => setShowReply(false)}
          />
        </div>
      )}
    </div>
  );
}

// ─── CommentsSection (exported) ───────────────────────────────────────────────
export function CommentsSection({ issueId }: { issueId: string }) {
  const { data: comments = [], isLoading, isError } = useComments(issueId);
  const user = useAuthStore((s) => s.user);

  const fakeAuthor: CommentAuthor = {
    id: user?.id ?? '',
    firstName: '',
    lastName: '',
    fullName: user?.name ?? 'You',
    avatar: user?.name?.[0]?.toUpperCase() ?? '?',
  };

  return (
    <section className="cm-section">
      {/* Heading */}
      <h3 className="cm-heading">
        Comments
        {comments.length > 0 && <span className="cm-count">{comments.length}</span>}
      </h3>

      {/* States */}
      {isLoading && <p className="cm-empty">Loading comments…</p>}
      {isError   && <p className="cm-empty" style={{ color: '#DE350B', fontStyle: 'normal' }}>Failed to load comments.</p>}

      {!isLoading && !isError && comments.length === 0 && (
        <p className="cm-empty">No comments yet — be the first to leave one.</p>
      )}

      {/* Threads */}
      <div className="cm-list">
        {comments.map((c: Comment) => (
          <CommentThread
            key={c.id}
            comment={c}
            issueId={issueId}
            currentUserId={user?.id}
            currentUserRole={user?.role}
          />
        ))}
      </div>

      {/* New comment composer */}
      <div className="cm-new-comment">
        <Avatar author={fakeAuthor} size={28} />
        <div style={{ flex: 1 }}>
          <CommentComposer
            issueId={issueId}
            placeholder="Add a comment…"
          />
        </div>
      </div>
    </section>
  );
}
