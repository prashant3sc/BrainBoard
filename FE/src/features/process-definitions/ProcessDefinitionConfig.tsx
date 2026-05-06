import { useState } from 'react';
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
  { value: 'issue_creation',    label: 'Issue creation' },
  { value: 'issue_view',        label: 'Issue view' },
  { value: 'sprint_completion', label: 'Sprint completion' },
  { value: 'release_task',      label: 'Release task' },
  { value: 'incident',          label: 'Incident' },
  { value: 'bug',               label: 'Bug' },
  { value: 'pr_review',         label: 'PR review' },
  { value: 'definition_of_done', label: 'Definition of done' },
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

function toCreateDto(pd: ProcessDefinition): CreateProcessDefinitionDto {
  return {
    wikiPageId:        pd.wikiPageId,
    category:          pd.category,
    trigger_contexts:  pd.triggerContexts,
    issue_type_scope:  pd.issueTypeScope,
    short_description: pd.shortDescription ?? '',
    is_active:         pd.isActive,
    priority:          pd.priority,
  };
}

export function ProcessDefinitionConfig({ projectId }: Props) {
  const { data: definitions = [], isLoading } = useProcessDefinitions(projectId);
  const { data: wikiPages = [] }              = useWikiPages(projectId);

  const createMutation = useCreateProcessDefinition(projectId);
  const updateMutation = useUpdateProcessDefinition(projectId);
  const deleteMutation = useDeleteProcessDefinition(projectId);

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [isCreateMode, setIsCreate]   = useState(true);
  const [formData, setFormData]       = useState<CreateProcessDefinitionDto>(EMPTY_FORM);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [error, setError]             = useState('');

  function selectItem(pd: ProcessDefinition) {
    setSelectedId(pd.id);
    setIsCreate(false);
    setFormData(toCreateDto(pd));
    setError('');
    setDeletingId(null);
  }

  function resetToCreate() {
    setSelectedId(null);
    setIsCreate(true);
    setFormData(EMPTY_FORM);
    setError('');
    setDeletingId(null);
  }

  function handleSave() {
    setError('');
    if (isCreateMode) {
      createMutation.mutate(formData, {
        onSuccess: resetToCreate,
        onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to save.'),
      });
    } else if (selectedId) {
      const { wikiPageId: _ignored, ...rest } = formData;
      updateMutation.mutate(
        { id: selectedId, dto: rest },
        { onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed to update.') },
      );
    }
  }

  function handleDuplicate(pd: ProcessDefinition) {
    createMutation.mutate({
      ...toCreateDto(pd),
      short_description: pd.shortDescription ? `${pd.shortDescription} (copy)` : '',
      is_active: false,
    });
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeletingId(null);
        if (selectedId === id) resetToCreate();
      },
    });
  }

  // Live preview sentence
  const previewWikiTitle = wikiPages.find(p => p.id === formData.wikiPageId)?.title ?? 'This process';
  const previewContexts  = formData.trigger_contexts
    .map(ctx => CONTEXT_OPTIONS.find(o => o.value === ctx)?.label ?? ctx)
    .join(', ');
  const hasScope = formData.issue_type_scope.length > 0 && !formData.issue_type_scope.includes('all');
  const previewScope = hasScope
    ? formData.issue_type_scope.map(t => TYPE_OPTIONS.find(o => o.value === t)?.label ?? t).join(', ') + ' issues'
    : 'all issue types';
  const previewSentence = formData.trigger_contexts.length > 0 && formData.wikiPageId
    ? `"${previewWikiTitle}" will appear during ${previewContexts} for ${previewScope}.`
    : formData.trigger_contexts.length > 0
      ? `Select a wiki page to complete the preview.`
      : `Select at least one context to see a preview.`;

  // Summary strip counts
  const activeCount     = definitions.filter(d => d.isActive).length;
  const uniqueContexts  = new Set(definitions.flatMap(d => d.triggerContexts)).size;
  const bugSpecific     = definitions.filter(d => d.issueTypeScope.includes('bug')).length;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const canSave  = !!formData.wikiPageId && formData.trigger_contexts.length > 0 && !isSaving;

  return (
    <div className="pds-root">

      {/* ── Stats strip (only when there are definitions) ── */}
      {definitions.length > 0 && (
        <div className="pds-stats">
          <div className="pds-stat">
            <span className="pds-stat-val">{activeCount}</span>
            <span className="pds-stat-label">Active</span>
          </div>
          <div className="pds-stat-sep" />
          <div className="pds-stat">
            <span className="pds-stat-val">{uniqueContexts}</span>
            <span className="pds-stat-label">Contexts covered</span>
          </div>
          {bugSpecific > 0 && (
            <>
              <div className="pds-stat-sep" />
              <div className="pds-stat">
                <span className="pds-stat-val">{bugSpecific}</span>
                <span className="pds-stat-label">Bug-specific</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Split view ── */}
      <div className="pds-split">

        {/* Left: list */}
        <div className="pds-left">
          <div className="pds-left-header">
            <span className="pds-left-title">Processes</span>
            <button className="pds-new-btn" onClick={resetToCreate}>+ New</button>
          </div>

          {isLoading ? (
            <div className="pds-empty-left">Loading…</div>
          ) : definitions.length === 0 ? (
            <div className="pds-empty-left">
              No process definitions yet.<br />
              Create one using the panel →
            </div>
          ) : (
            <div className="pds-list">
              {definitions.map((pd) => (
                <div
                  key={pd.id}
                  className={[
                    'pds-list-item',
                    selectedId === pd.id ? 'pds-list-item--selected' : '',
                    !pd.isActive       ? 'pds-list-item--inactive'  : '',
                  ].join(' ')}
                  onClick={() => selectItem(pd)}
                >
                  <div className="pds-item-header">
                    <span
                      className="pds-item-dot"
                      style={{ background: pd.isActive ? '#22C55E' : 'var(--bb-border)' }}
                    />
                    <span className="pds-item-name">{pd.wikiPageTitle}</span>
                    <span className="pds-item-category">{CATEGORY_LABELS[pd.category]}</span>
                  </div>
                  <div className="pds-item-contexts">
                    {pd.triggerContexts.slice(0, 3).map(ctx => (
                      <span key={ctx} className="pds-item-chip">
                        {ctx.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {pd.triggerContexts.length > 3 && (
                      <span className="pds-item-chip pds-item-chip--more">
                        +{pd.triggerContexts.length - 3}
                      </span>
                    )}
                  </div>
                  {pd.issueTypeScope.length > 0 && !pd.issueTypeScope.includes('all') && (
                    <div className="pds-item-scope">
                      {pd.issueTypeScope.map(t => (
                        <span key={t} className="pds-item-scope-chip">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: create / edit panel */}
        <div className="pds-right">

          {/* Panel header */}
          <div className="pds-panel-header">
            <h3 className="pds-panel-title">
              {isCreateMode ? 'New process definition' : 'Edit process definition'}
            </h3>

            {!isCreateMode && selectedId && (
              <div className="pds-panel-actions">
                <button
                  className="pds-action-btn"
                  onClick={() => {
                    const pd = definitions.find(d => d.id === selectedId);
                    if (pd) handleDuplicate(pd);
                  }}
                  disabled={createMutation.isPending}
                >
                  Duplicate
                </button>
                {deletingId === selectedId ? (
                  <div className="pds-delete-confirm">
                    <span>Delete?</span>
                    <button
                      className="cc-btn-danger"
                      onClick={() => handleDelete(selectedId)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? '…' : 'Yes'}
                    </button>
                    <button className="cc-btn-secondary" onClick={() => setDeletingId(null)}>
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="pds-action-btn pds-action-btn--danger"
                    onClick={() => setDeletingId(selectedId)}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {error && <div className="cc-error" style={{ margin: '0 20px' }}>{error}</div>}

          {/* Form body */}
          <div className="pds-form">

            {/* ── Source ── */}
            <div className="pds-group">
              <div className="pds-group-label">Source</div>
              <div className="pds-field">
                <label className="pds-field-label">
                  Wiki page <span className="pds-required">*</span>
                </label>
                <select
                  className="cc-select"
                  style={{ width: '100%' }}
                  value={formData.wikiPageId}
                  disabled={!isCreateMode}
                  onChange={(e) => setFormData(f => ({ ...f, wikiPageId: e.target.value }))}
                >
                  <option value="">— select a wiki page —</option>
                  {wikiPages.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                {!isCreateMode && (
                  <div className="pds-field-hint">Wiki page cannot be changed after creation.</div>
                )}
              </div>
            </div>

            {/* ── Classification ── */}
            <div className="pds-group">
              <div className="pds-group-label">Classification</div>
              <div className="pds-field-row">
                <div className="pds-field" style={{ flex: 1 }}>
                  <label className="pds-field-label">Category</label>
                  <select
                    className="cc-select"
                    value={formData.category}
                    onChange={(e) => setFormData(f => ({ ...f, category: e.target.value as ProcessCategory }))}
                  >
                    {CATEGORY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pds-field pds-field--sm">
                  <label className="pds-field-label">Display order</label>
                  <input
                    className="cc-input"
                    type="number"
                    min={0}
                    value={formData.priority}
                    style={{ width: 72 }}
                    onChange={(e) => setFormData(f => ({ ...f, priority: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="pds-field">
                <label className="pds-field-label">Summary shown to users</label>
                <input
                  className="cc-input"
                  style={{ width: '100%' }}
                  value={formData.short_description ?? ''}
                  placeholder="One-line summary of what this doc covers"
                  onChange={(e) => setFormData(f => ({ ...f, short_description: e.target.value }))}
                />
              </div>
            </div>

            {/* ── Where it appears ── */}
            <div className="pds-group">
              <div className="pds-group-label">
                Where it appears <span className="pds-required">*</span>
              </div>
              <div className="pds-field">
                <label className="pds-field-label">Show this during</label>
                <div className="pds-chips">
                  {CONTEXT_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      className={`pds-chip${formData.trigger_contexts.includes(o.value) ? ' pds-chip--on' : ''}`}
                      onClick={() =>
                        setFormData(f => ({
                          ...f,
                          trigger_contexts: f.trigger_contexts.includes(o.value)
                            ? f.trigger_contexts.filter(c => c !== o.value)
                            : [...f.trigger_contexts, o.value],
                        }))
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Scope ── */}
            <div className="pds-group">
              <div className="pds-group-label">Scope</div>
              <div className="pds-field">
                <label className="pds-field-label">Only for these issue types</label>
                <div className="pds-chips">
                  {TYPE_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      type="button"
                      className={`pds-chip${formData.issue_type_scope.includes(o.value) ? ' pds-chip--on' : ''}`}
                      onClick={() =>
                        setFormData(f => {
                          const next = f.issue_type_scope.includes(o.value)
                            ? f.issue_type_scope.filter(s => s !== o.value)
                            : [...f.issue_type_scope, o.value];
                          return { ...f, issue_type_scope: next };
                        })
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="pds-field-hint">Leave empty to apply to all issue types.</div>
              </div>
            </div>

            {/* ── State ── */}
            <div className="pds-group">
              <div className="pds-group-label">State</div>
              <div className="pds-toggle-row">
                <div>
                  <div className="pds-toggle-label">Active</div>
                  <div className="pds-toggle-desc">Surface this process to users during workflow</div>
                </div>
                <button
                  type="button"
                  className={`pds-toggle${formData.is_active ? ' pds-toggle--on' : ''}`}
                  aria-pressed={formData.is_active}
                  onClick={() => setFormData(f => ({ ...f, is_active: !f.is_active }))}
                >
                  <span className="pds-toggle-thumb" />
                </button>
              </div>
            </div>

            {/* ── Preview ── */}
            <div className="pds-preview">
              <div className="pds-preview-label">Preview</div>
              <div className="pds-preview-text">{previewSentence}</div>
            </div>

            {/* ── Actions ── */}
            <div className="pds-save-row">
              {!isCreateMode && (
                <button className="cc-btn-secondary" onClick={resetToCreate}>
                  Cancel
                </button>
              )}
              <button
                className="cc-btn-primary"
                disabled={!canSave}
                onClick={handleSave}
              >
                {isSaving
                  ? 'Saving…'
                  : isCreateMode
                    ? 'Create process'
                    : 'Save changes'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
