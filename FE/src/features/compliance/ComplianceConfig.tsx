import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi } from '@/api/compliance';
import type { ComplianceTemplate } from '@/types';

interface Props {
  projectId: string;
}

/* ── constants ─────────────────────────────────────────────────────────── */

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

const STATUS_OPTIONS = [
  { value: 'todo',        label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review',      label: 'In Review' },
  { value: 'done',        label: 'Done' },
];

const APPLIES_LABELS: Record<string, string> = {
  all: 'All types', task: 'Task', subtask: 'Subtask', bug: 'Bug',
};

const ROLE_LABELS: Record<string, string> = {
  developer: 'Developer+', pm: 'PM+', admin: 'Admin only', viewer: 'Viewer+',
};

const EMPTY_FORM = {
  name:          '',
  description:   '',
  applies_to:    'all',
  blocks_on:     [] as string[],
  required_role: 'developer',
  is_active:     true,
  order:         0,
};

type FormState  = typeof EMPTY_FORM;
type PanelMode  = 'create' | 'edit' | 'duplicate';

/* ── helpers ───────────────────────────────────────────────────────────── */

function useToast() {
  const [state, setState] = useState({ msg: '', visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function show(msg: string) {
    if (timer.current) clearTimeout(timer.current);
    setState({ msg, visible: true });
    timer.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), 3000);
  }
  return { toastMsg: state.msg, toastVisible: state.visible, showToast: show };
}

function toFormState(tpl: ComplianceTemplate): FormState {
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

function buildPreview(form: FormState): string {
  const type  = APPLIES_LABELS[form.applies_to] ?? form.applies_to;
  const role  = ROLE_LABELS[form.required_role]  ?? form.required_role;
  const name  = form.name.trim() || 'this check';
  const blocks = form.blocks_on;

  if (blocks.length === 0) {
    return `${type} issues require "${name}" to be completed by ${role}.`;
  }
  const blockLabels = blocks.map((b) => STATUS_OPTIONS.find((o) => o.value === b)?.label ?? b);
  return `${type} issues cannot move to ${blockLabels.join(' / ')} until "${name}" is complete by ${role}.`;
}

/* ── icons ─────────────────────────────────────────────────────────────── */

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

const DuplicateIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M3 11V3h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */

export function ComplianceConfig({ projectId }: Props) {
  const qc = useQueryClient();
  const { toastMsg, toastVisible, showToast } = useToast();

  /* panel state */
  const [panelMode, setPanelMode]   = useState<PanelMode>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm]             = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving]         = useState(false);

  /* ── queries ── */
  const { data: templates = [], isLoading } = useQuery<ComplianceTemplate[]>({
    queryKey: ['compliance-templates', projectId],
    queryFn:  () => complianceApi.listTemplates(projectId),
  });

  /* ── mutations ── */
  const { mutate: createTemplate } = useMutation({
    mutationFn: (data: FormState) =>
      complianceApi.createTemplate(projectId, { ...data, blocks_on: data.blocks_on.join(',') }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['compliance-templates', projectId] });
      setSaving(false);
      showToast('Compliance check created');
      setSelectedId(created.id);
      setPanelMode('edit');
    },
    onError: () => setSaving(false),
  });

  const { mutate: updateTemplate } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormState }) =>
      complianceApi.updateTemplate(projectId, id, { ...data, blocks_on: data.blocks_on.join(',') }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-templates', projectId] });
      setSaving(false);
      showToast('Compliance check updated');
    },
    onError: () => setSaving(false),
  });

  const { mutate: deleteTemplate } = useMutation({
    mutationFn: (id: string) => complianceApi.deleteTemplate(projectId, id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['compliance-templates', projectId] });
      showToast('Compliance check deleted');
      if (selectedId === id) resetToCreate();
    },
  });

  /* ── panel controls ── */
  function resetToCreate() {
    setSelectedId(null);
    setPanelMode('create');
    setForm({ ...EMPTY_FORM });
  }

  function selectTemplate(tpl: ComplianceTemplate) {
    setSelectedId(tpl.id);
    setPanelMode('edit');
    setForm(toFormState(tpl));
  }

  function duplicateTemplate(tpl: ComplianceTemplate) {
    setSelectedId(null);
    setPanelMode('duplicate');
    setForm({ ...toFormState(tpl), name: `${tpl.name} (copy)` });
  }

  function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (panelMode === 'edit' && selectedId) {
      updateTemplate({ id: selectedId, data: form });
    } else {
      createTemplate(form);
    }
  }

  function handleCancel() {
    if (panelMode === 'edit' && selectedId) {
      const tpl = templates.find((t) => t.id === selectedId);
      if (tpl) setForm(toFormState(tpl));
    } else {
      resetToCreate();
    }
  }

  function toggleBlock(s: string) {
    setForm((f) => ({
      ...f,
      blocks_on: f.blocks_on.includes(s)
        ? f.blocks_on.filter((x) => x !== s)
        : [...f.blocks_on, s],
    }));
  }

  /* ── derived ── */
  const panelTitle =
    panelMode === 'edit'      ? 'Edit Check'        :
    panelMode === 'duplicate' ? 'Duplicate Check'   :
                                'New Compliance Check';

  /* ── render ── */
  return (
    <div className="ccs-root">

      {/* ── Page header ── */}
      <div className="ccs-page-header">
        <div>
          <h3 className="cc-heading">Compliance Checks</h3>
          <p className="cc-subheading">
            Define required sign-offs for issues. Active checks are auto-assigned to matching
            issues and can gate status transitions.
          </p>
        </div>
        <button className="cc-btn-new" onClick={resetToCreate}>+ New Check</button>
      </div>

      {/* ── Split layout ── */}
      <div className="ccs-layout">

        {/* ════ LEFT PANEL ════ */}
        <div className="ccs-left">

          {isLoading ? (
            <p className="ccs-list-placeholder">Loading…</p>
          ) : templates.length === 0 ? (
            <div className="ccs-empty-list">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: .35 }}>
                <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 12h12M10 17h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <p>No checks defined yet.</p>
              <p>Use the form to create your first compliance check.</p>
            </div>
          ) : (
            templates.map((tpl) => {
              const blocks = tpl.blocksOn
                ? tpl.blocksOn.split(',').map((s) => s.trim()).filter(Boolean)
                : [];
              const isSelected = selectedId === tpl.id;

              return (
                <div
                  key={tpl.id}
                  className={[
                    'ccs-card',
                    isSelected    ? 'ccs-card--selected' : '',
                    !tpl.isActive ? 'ccs-card--inactive' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectTemplate(tpl)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && selectTemplate(tpl)}
                >
                  {/* card header: name + badge */}
                  <div className="ccs-card-header">
                    <span className="ccs-card-name">{tpl.name}</span>
                    <span className={`ccs-badge ${tpl.isActive ? 'ccs-badge--active' : 'ccs-badge--inactive'}`}>
                      {tpl.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* description */}
                  {tpl.description && (
                    <p className="ccs-card-desc">{tpl.description}</p>
                  )}

                  {/* metadata */}
                  <div className="ccs-card-meta">
                    <span className="ccs-meta-row">
                      <span className="ccs-meta-key">Applies to</span>
                      <span className="ccs-meta-val">
                        {APPLIES_LABELS[tpl.appliesTo] ?? tpl.appliesTo}
                      </span>
                    </span>
                    <span className="ccs-meta-row">
                      <span className="ccs-meta-key">Min role</span>
                      <span className="ccs-meta-val">
                        {ROLE_LABELS[tpl.requiredRole] ?? tpl.requiredRole}
                      </span>
                    </span>
                    {blocks.length > 0 && (
                      <span className="ccs-meta-row">
                        <span className="ccs-meta-key">Blocks</span>
                        <span className="ccs-meta-val ccs-meta-val--blocks">
                          {blocks.join(', ')}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* row actions */}
                  <div className="ccs-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="cc-icon-btn"
                      title="Edit"
                      onClick={() => selectTemplate(tpl)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="cc-icon-btn"
                      title="Duplicate"
                      onClick={() => duplicateTemplate(tpl)}
                    >
                      <DuplicateIcon />
                    </button>
                    <button
                      className="cc-icon-btn cc-icon-btn-danger"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete "${tpl.name}"? This will remove it from all issues.`))
                          deleteTemplate(tpl.id);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className="ccs-right">

          {/* panel header */}
          <div className="ccs-panel-header">
            <span className="ccs-panel-title">{panelTitle}</span>
            {panelMode !== 'create' && (
              <button className="ccs-ghost-btn" onClick={resetToCreate}>
                + New Check
              </button>
            )}
          </div>

          {/* ── Section: Basic Info ── */}
          <div className="ccs-form-section">
            <p className="ccs-section-label">Basic Info</p>

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
          </div>

          {/* ── Section: Scope ── */}
          <div className="ccs-form-section">
            <p className="ccs-section-label">Scope</p>

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
          </div>

          {/* ── Section: Transition Rules ── */}
          <div className="ccs-form-section">
            <p className="ccs-section-label">Transition Rules</p>

            <div className="cc-form-row">
              <label>Gates status transitions</label>
              <div className="cc-check-group">
                {STATUS_OPTIONS.map((s) => (
                  <label key={s.value} className="cc-check-label">
                    <input
                      type="checkbox"
                      checked={form.blocks_on.includes(s.value)}
                      onChange={() => toggleBlock(s.value)}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
              <p className="cc-hint">
                Issues cannot transition to checked statuses until this check is complete.
              </p>
            </div>
          </div>

          {/* ── Section: State ── */}
          <div className="ccs-form-section">
            <p className="ccs-section-label">State</p>
            <label className="cc-check-label">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Active — auto-assign to matching issues
            </label>
          </div>

          {/* ── Preview ── */}
          <div className="ccs-preview">
            <p className="ccs-preview-label">Preview</p>
            <p className="ccs-preview-text">{buildPreview(form)}</p>
          </div>

          {/* ── Actions ── */}
          <div className="cc-form-actions" style={{ marginTop: 4 }}>
            <button
              className="cc-btn cc-btn-save"
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
            >
              {saving
                ? 'Saving…'
                : panelMode === 'edit'
                  ? 'Update Check'
                  : 'Create Check'}
            </button>
            <button className="cc-btn cc-btn-cancel" onClick={handleCancel}>
              {panelMode === 'edit' ? 'Revert' : 'Reset'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Toast ── */}
      <div className={`bb-toast${toastVisible ? ' bb-toast-show' : ''}`}
           style={{ opacity: toastVisible ? 1 : 0, transition: 'opacity .2s' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" fill="#006644" />
          <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{toastMsg}</span>
      </div>
    </div>
  );
}
