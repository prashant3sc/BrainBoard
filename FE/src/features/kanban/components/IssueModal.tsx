import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '@/api/issues';
import { useRBAC } from '@/hooks/useRBAC';
import { mockUsers } from '@/mocks/users';
import type { Issue, IssueStatus, Priority } from '@/types';

interface Props {
  issue: Issue | null;
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
}

const PRIORITIES: Priority[]    = ['critical', 'high', 'medium', 'low'];
const STATUSES: IssueStatus[]   = ['todo', 'in_progress', 'done'];
const STATUS_LABELS: Record<IssueStatus, string> = {
  todo: 'To Do', in_progress: 'In Progress', done: 'Done',
};

const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400';

export function IssueModal({ issue, isOpen, projectId, onClose }: Props) {
  const isEditMode = issue !== null;
  const { can }    = useRBAC();
  const qc         = useQueryClient();
  const canEdit    = can('editIssue');
  const canDelete  = can('deleteIssue');

  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [priority, setPriority]     = useState<Priority>('medium');
  const [status, setStatus]         = useState<IssueStatus>('todo');
  const [storyPoints, setPoints]    = useState(3);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [titleError, setTitleError] = useState('');

  useEffect(() => {
    setTitle(issue?.title ?? '');
    setDesc(issue?.description ?? '');
    setPriority(issue?.priority ?? 'medium');
    setStatus(issue?.status ?? 'todo');
    setPoints(issue?.storyPoints ?? 3);
    setAssigneeId(issue?.assigneeId ?? '');
    setTitleError('');
  }, [issue]);

  function invalidateAndClose() {
    qc.invalidateQueries({ queryKey: ['issues', projectId] });
    onClose();
  }

  const createMutation = useMutation({
    mutationFn: () => issuesApi.create({ title, description, priority, status, storyPoints, assigneeId: assigneeId || null, projectId }),
    onSuccess: invalidateAndClose,
  });

  const updateMutation = useMutation({
    mutationFn: () => issuesApi.update(issue!.id, { title, description, priority, status, storyPoints, assigneeId: assigneeId || null }),
    onSuccess: invalidateAndClose,
  });

  const deleteMutation = useMutation({
    mutationFn: () => issuesApi.remove(issue!.id),
    onSuccess: invalidateAndClose,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setTitleError('Title is required'); return; }
    isEditMode ? updateMutation.mutate() : createMutation.mutate();
  }

  function handleDelete() {
    deleteMutation.mutate();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          {isEditMode ? 'Edit Issue' : 'New Issue'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Title *</label>
            <input disabled={!canEdit} value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(''); }} className={inputCls} placeholder="Issue title" />
            {titleError && <p className="mt-1 text-xs text-red-500">{titleError}</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
            <textarea disabled={!canEdit} rows={3} value={description} onChange={(e) => setDesc(e.target.value)} className={`${inputCls} resize-none`} placeholder="Optional details" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Priority</label>
              <select disabled={!canEdit} value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={inputCls}>
                {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Story Points</label>
              <input disabled={!canEdit} type="number" min={1} max={13} value={storyPoints} onChange={(e) => setPoints(Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isEditMode && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Status</label>
                <select disabled={!canEdit} value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)} className={inputCls}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Assignee</label>
              <select disabled={!canEdit} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputCls}>
                <option value="">Unassigned</option>
                {mockUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditMode && canDelete && (
                <button type="button" onClick={handleDelete} disabled={deleteMutation.isPending} className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              {canEdit && (
                <button type="submit" disabled={isPending} className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {isPending ? 'Saving…' : isEditMode ? 'Save' : 'Create'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
