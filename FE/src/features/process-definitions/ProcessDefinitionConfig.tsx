import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useProcessDefinitions,
  useCreateProcessDefinition,
  useUpdateProcessDefinition,
  useDeleteProcessDefinition,
} from '@/features/wiki/useProcessDefinitions';
import { useWikiPages } from '@/features/wiki/useWiki';
import type {
  ProcessDefinition,
  ProcessCategory,
  TriggerContext,
  IssueTypeScope,
  CreateProcessDefinitionDto,
} from '@/types';

interface Props {
  projectId: string;
}

const CATEGORY_OPTIONS: { value: ProcessCategory; label: string }[] = [
  { value: 'process',   label: 'Process' },
  { value: 'standard',  label: 'Standard' },
  { value: 'runbook',   label: 'Runbook' },
  { value: 'checklist', label: 'Checklist' },
];

const CONTEXT_OPTIONS: { value: TriggerContext; label: string }[] = [
  { value: 'issue_creation',    label: 'Issue Creation' },
  { value: 'issue_view',        label: 'Issue View' },
  { value: 'sprint_completion', label: 'Sprint Completion' },
  { value: 'release_task',      label: 'Release Task' },
  { value: 'incident',          label: 'Incident' },
  { value: 'bug',               label: 'Bug (issue type)' },
  { value: 'pr_review',         label: 'PR Review' },
  { value: 'definition_of_done','label': 'Definition of Done' },
];

const TYPE_OPTIONS: { value: IssueTypeScope; label: string }[] = [
  { value: 'all',     label: 'All types' },
  { value: 'task',    label: 'Task' },
  { value: 'subtask', label: 'Subtask' },
  { value: 'bug',     label: 'Bug' },
];

const CATEGORY_LABELS: Record<ProcessCategory, string> = {
  process:   'Process',
  standard:  'Standard',
  runbook:   'Runbook',
  checklist: 'Checklist',
};

const EMPTY_FORM: CreateProcessDefinitionDto = {
  wikiPageId:        '',
  category:          'process',
  trigger_contexts:  [],
  issue_type_scope:  [],
  short_description: '',
  is_active:         true,
  priority:          0,
};

function ProcessDefinitionForm({
  initial,
  wikiPages,
  onSave,
  onCancel,
  saving,
}: {
  initial: CreateProcessDefinitionDto;
  wikiPages: { id: string; title: string }[];
  onSave: (data: CreateProcessDefinitionDto) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<CreateProcessDefinitionDto>(initial);

  function toggleContext(ctx: TriggerContext) {
    setForm((f) => ({
      ...f,
      trigger_contexts: f.trigger_contexts.includes(ctx)
        ? f.trigger_contexts.filter((c) => c !== ctx)
        : [...f.trigger_contexts, ctx],
    }));
  }

  function toggleScope(t: IssueTypeScope) {
    setForm((f) => {
      const next = f.issue_type_scope.includes(t)
        ? f.issue_type_scope.filter((s) => s !== t)
        : [...f.issue_type_scope, t];
      return { ...f, issue_type_scope: next };
    });
  }

  const canSave = form.wikiPageId && form.trigger_contexts.length > 0;

  return (
    <div className="cc-form">
      <div className="cc-form-row">
        <label>Wiki page *</label>
        <select
          className="cc-select"
          style={{ width: '100%' }}
          value={form.wikiPageId}
          onChange={(e) => setForm((f) => ({ ...f, wikiPageId: e.target.value }))}
        >
          <option value="">— select a wiki page —</option>
          {wikiPages.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      <div className="cc-form-row cc-form-row-inline">
        <div>
          <label>Category</label>
          <select
            className="cc-select"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProcessCategory }))}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Display order</label>
          <input
            className="cc-input cc-input-sm"
            type="number"
            min={0}
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="cc-form-row">
        <label>Short description (shown inline)</label>
        <input
          className="cc-input"
          value={form.short_description ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, short_description: e.target.value }))}
          placeholder="One-line summary of what this doc covers"
        />
      </div>

      <div className="cc-form-row">
        <label>Surface in contexts *</label>
        <div className="cc-check-group pd-check-wrap">
          {CONTEXT_OPTIONS.map((o) => (
            <label key={o.value} className="cc-check-label">
              <input
                type="checkbox"
                checked={form.trigger_contexts.includes(o.value)}
                onChange={() => toggleContext(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      <div className="cc-form-row">
        <label>Applies to issue types (leave empty for all)</label>
        <div className="cc-check-group">
          {TYPE_OPTIONS.map((o) => (
            <label key={o.value} className="cc-check-label">
              <input
                type="checkbox"
                checked={form.issue_type_scope.includes(o.value)}
                onChange={() => toggleScope(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      <div className="cc-form-row">
        <label className="cc-check-label">
          <input
            type="checkbox"
            checked={form.is_active ?? true}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Active (surfaced to users)
        </label>
      </div>

      <div className="cc-form-actions">
        <button className="cc-btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className="cc-btn-primary"
          disabled={!canSave || saving}
          onClick={() => onSave(form)}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function ProcessDefinitionConfig({ projectId }: Props) {
  const { data: definitions = [], isLoading } = useProcessDefinitions(projectId);
  const { data: wikiPages = [] } = useWikiPages(projectId);

  const createMutation  = useCreateProcessDefinition(projectId);
  const updateMutation  = useUpdateProcessDefinition(projectId);
  const deleteMutation  = useDeleteProcessDefinition(projectId);

  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [error, setError]             = useState('');

  function handleCreate(data: CreateProcessDefinitionDto) {
    setError('');
    createMutation.mutate(data, {
      onSuccess: () => setShowForm(false),
      onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to save.'),
    });
  }

  function handleUpdate(id: string, data: CreateProcessDefinitionDto) {
    setError('');
    const { wikiPageId: _ignored, ...rest } = data;
    updateMutation.mutate(
      { id, dto: { ...rest } },
      {
        onSuccess: () => setEditingId(null),
        onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to update.'),
      },
    );
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => setDeletingId(null),
    });
  }

  function toggleActive(pd: ProcessDefinition) {
    updateMutation.mutate({ id: pd.id, dto: { is_active: !pd.isActive } });
  }

  const wikiPageOptions = wikiPages.map((p) => ({ id: p.id, title: p.title }));

  return (
    <div className="cc-section">
      <div className="cc-section-header">
        <div>
          <h3 className="cc-section-title">Process Definitions</h3>
          <p className="cc-section-desc">
            Mark wiki pages as process docs that surface inline during workflow — issue
            creation, sprint completion, and more.
          </p>
        </div>
        {!showForm && (
          <button className="cc-btn-primary" onClick={() => setShowForm(true)}>
            + Add process
          </button>
        )}
      </div>

      {error && <div className="cc-error">{error}</div>}

      {showForm && (
        <ProcessDefinitionForm
          initial={EMPTY_FORM}
          wikiPages={wikiPageOptions}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="cc-loading">Loading…</div>
      ) : definitions.length === 0 && !showForm ? (
        <div className="cc-empty">
          No process definitions yet. Add one to start surfacing relevant docs inline.
        </div>
      ) : (
        <div className="cc-list">
          {definitions.map((pd) => (
            <div key={pd.id} className={`cc-row${!pd.isActive ? ' cc-row--inactive' : ''}`}>
              {editingId === pd.id ? (
                <ProcessDefinitionForm
                  initial={{
                    wikiPageId:       pd.wikiPageId,
                    category:         pd.category,
                    trigger_contexts: pd.triggerContexts,
                    issue_type_scope: pd.issueTypeScope,
                    short_description:pd.shortDescription,
                    is_active:        pd.isActive,
                    priority:         pd.priority,
                  }}
                  wikiPages={wikiPageOptions}
                  onSave={(data) => handleUpdate(pd.id, data)}
                  onCancel={() => setEditingId(null)}
                  saving={updateMutation.isPending}
                />
              ) : (
                <>
                  <div className="cc-row-main">
                    <span className="pd-category-pill">{CATEGORY_LABELS[pd.category]}</span>
                    <span className="cc-row-name">{pd.wikiPageTitle}</span>
                    {!pd.isActive && <span className="cc-row-inactive-badge">Inactive</span>}
                  </div>

                  <div className="pd-context-chips">
                    {pd.triggerContexts.map((ctx) => (
                      <span key={ctx} className="pd-context-chip">{ctx.replace(/_/g, ' ')}</span>
                    ))}
                  </div>

                  {pd.shortDescription && (
                    <div className="cc-row-desc">{pd.shortDescription}</div>
                  )}

                  <div className="cc-row-actions">
                    <button
                      className="cc-btn-ghost"
                      onClick={() => toggleActive(pd)}
                      title={pd.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {pd.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="cc-btn-ghost" onClick={() => setEditingId(pd.id)}>
                      Edit
                    </button>
                    {deletingId === pd.id ? (
                      <>
                        <span className="cc-confirm-text">Delete?</span>
                        <button
                          className="cc-btn-danger"
                          onClick={() => handleDelete(pd.id)}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? '…' : 'Yes'}
                        </button>
                        <button className="cc-btn-ghost" onClick={() => setDeletingId(null)}>
                          No
                        </button>
                      </>
                    ) : (
                      <button
                        className="cc-btn-ghost cc-btn-ghost--danger"
                        onClick={() => setDeletingId(pd.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
