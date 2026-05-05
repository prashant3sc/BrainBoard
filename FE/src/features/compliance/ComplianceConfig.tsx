import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/api/compliance';
import type { ComplianceTemplate } from '@/types';

interface Props {
  projectId: string;
}

const APPLIES_OPTIONS = [
  { value: 'all',     label: 'All types' },
  { value: 'task',    label: 'Task' },
  { value: 'subtask', label: 'Subtask' },
  { value: 'bug',     label: 'Bug' },
];

const ROLE_OPTIONS = [
  { value: 'developer', label: 'Developer+' },
  { value: 'pm',        label: 'PM+' },
  { value: 'admin',     label: 'Admin only' },
];

const STATUS_OPTIONS = ['todo', 'in_progress', 'review', 'done'];

const EMPTY_FORM = {
  name: '',
  description: '',
  applies_to: 'all',
  blocks_on: [] as string[],
  required_role: 'developer',
  is_active: true,
  order: 0,
};

function TemplateForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: typeof EMPTY_FORM;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);

  function toggleBlock(s: string) {
    setForm((f) => ({
      ...f,
      blocks_on: f.blocks_on.includes(s)
        ? f.blocks_on.filter((x) => x !== s)
        : [...f.blocks_on, s],
    }));
  }

  return (
    <div className="cc-form">
      <div className="cc-form-row">
        <label>Name *</label>
        <input
          className="cc-input"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. QA Sign-off"
        />
      </div>
      <div className="cc-form-row">
        <label>Description</label>
        <textarea
          className="cc-input cc-textarea"
          rows={2}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="What does this check verify?"
        />
      </div>
      <div className="cc-form-row cc-form-row-inline">
        <div>
          <label>Applies to</label>
          <select
            className="cc-select"
            value={form.applies_to}
            onChange={(e) => setForm((f) => ({ ...f, applies_to: e.target.value }))}
          >
            {APPLIES_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Min. role to complete</label>
          <select
            className="cc-select"
            value={form.required_role}
            onChange={(e) => setForm((f) => ({ ...f, required_role: e.target.value }))}
          >
            {ROLE_OPTIONS.map((o) => (
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
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="cc-form-row">
        <label>Gates status transitions</label>
        <div className="cc-check-group">
          {STATUS_OPTIONS.map((s) => (
            <label key={s} className="cc-check-label">
              <input
                type="checkbox"
                checked={form.blocks_on.includes(s)}
                onChange={() => toggleBlock(s)}
              />
              {s}
            </label>
          ))}
        </div>
        <p className="cc-hint">
          If any statuses are selected, issues cannot transition to them until this check is complete.
        </p>
      </div>
      <div className="cc-form-row cc-form-row-inline">
        <label className="cc-check-label">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Active
        </label>
      </div>
      <div className="cc-form-actions">
        <button className="cc-btn cc-btn-save" onClick={() => onSave(form)} disabled={!form.name.trim()}>
          Save
        </button>
        <button className="cc-btn cc-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ComplianceConfig({ projectId }: Props) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<ComplianceTemplate[]>({
    queryKey: ['compliance-templates', projectId],
    queryFn:  () => complianceApi.listTemplates(projectId),
  });

  const { mutate: createTemplate } = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      complianceApi.createTemplate(projectId, {
        ...data,
        blocks_on: data.blocks_on.join(','),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-templates', projectId] });
      setCreating(false);
    },
  });

  const { mutate: updateTemplate } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY_FORM }) =>
      complianceApi.updateTemplate(projectId, id, {
        ...data,
        blocks_on: data.blocks_on.join(','),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-templates', projectId] });
      setEditingId(null);
    },
  });

  const { mutate: deleteTemplate } = useMutation({
    mutationFn: (id: string) => complianceApi.deleteTemplate(projectId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-templates', projectId] }),
  });

  function toFormState(tpl: ComplianceTemplate): typeof EMPTY_FORM {
    return {
      name:          tpl.name,
      description:   tpl.description,
      applies_to:    tpl.appliesTo,
      blocks_on:     tpl.blocksOn ? tpl.blocksOn.split(',').map((s) => s.trim()).filter(Boolean) : [],
      required_role: tpl.requiredRole,
      is_active:     tpl.isActive,
      order:         tpl.order,
    };
  }

  return (
    <div className="cc-root">
      <div className="cc-top">
        <div>
          <h3 className="cc-heading">Compliance Checks</h3>
          <p className="cc-subheading">
            Define required sign-offs for issues in this project. Active checks are
            auto-assigned to matching issues and can gate status transitions.
          </p>
        </div>
        {!creating && (
          <button className="cc-btn cc-btn-new" onClick={() => setCreating(true)}>
            + New Check
          </button>
        )}
      </div>

      {creating && (
        <TemplateForm
          initial={{ ...EMPTY_FORM }}
          onSave={(data) => createTemplate(data)}
          onCancel={() => setCreating(false)}
        />
      )}

      {isLoading ? (
        <p className="cc-loading">Loading…</p>
      ) : templates.length === 0 && !creating ? (
        <div className="cc-empty">
          <p>No compliance checks defined yet.</p>
        </div>
      ) : (
        <div className="cc-list">
          {templates.map((tpl) => {
            const isEditing = editingId === tpl.id;
            const blocks    = tpl.blocksOn
              ? tpl.blocksOn.split(',').map((s) => s.trim()).filter(Boolean)
              : [];
            return (
              <div key={tpl.id} className={`cc-row${!tpl.isActive ? ' cc-row-inactive' : ''}`}>
                {isEditing ? (
                  <TemplateForm
                    initial={toFormState(tpl)}
                    onSave={(data) => updateTemplate({ id: tpl.id, data })}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="cc-row-main">
                      <span className={`cc-active-dot${tpl.isActive ? ' cc-active-dot-on' : ''}`} />
                      <div className="cc-row-info">
                        <span className="cc-row-name">{tpl.name}</span>
                        {tpl.description && (
                          <span className="cc-row-desc">{tpl.description}</span>
                        )}
                        <div className="cc-row-tags">
                          <span className="cc-tag">{tpl.appliesTo === 'all' ? 'All types' : tpl.appliesTo}</span>
                          <span className="cc-tag">{tpl.requiredRole}+</span>
                          {blocks.length > 0 && (
                            <span className="cc-tag cc-tag-blocks">
                              gates: {blocks.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="cc-row-actions">
                      <button className="cc-icon-btn" title="Edit" onClick={() => setEditingId(tpl.id)}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        className="cc-icon-btn cc-icon-btn-danger"
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Delete "${tpl.name}"? This will remove it from all issues.`))
                            deleteTemplate(tpl.id);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
