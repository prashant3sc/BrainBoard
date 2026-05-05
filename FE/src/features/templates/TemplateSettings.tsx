import { useState } from 'react';
import { useProjectTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from './useTemplates';
import type { WorkflowTemplate, TemplateType } from '@/types';

interface Props {
  projectId: string;
}

type TabT = TemplateType;
type PanelMode = 'idle' | 'create' | 'edit' | 'preview';

const TABS: { id: TabT; label: string; icon: string }[] = [
  { id: 'issue',   label: 'Issue',   icon: '🎫' },
  { id: 'wiki',    label: 'Wiki',    icon: '📄' },
  { id: 'project', label: 'Project', icon: '🚀' },
];

const EMPTY_FORM = {
  name:          '',
  description:   '',
  icon:          '',
  category:      '',
  template_type: 'issue' as TemplateType,
  is_active:     true,
  config:        {} as Record<string, unknown>,
  order:         0,
};

// ── Pure helpers (outside components so they are stable references) ──────────

function getDefaultConfig(t: TemplateType): Record<string, unknown> {
  if (t === 'issue') return { title: '', description: '', issue_type: 'task', priority: 'medium', label_names: [], story_points: null };
  if (t === 'wiki')  return { title: '', content: '' };
  return { labels: [], wiki_pages: [], sprint_defaults: { duration_weeks: 2 }, compliance_templates: [] };
}

function toFormState(tpl: WorkflowTemplate): typeof EMPTY_FORM {
  return {
    name:          tpl.name,
    description:   tpl.description,
    icon:          tpl.icon,
    category:      tpl.category,
    template_type: tpl.templateType,
    is_active:     tpl.isActive,
    config:        tpl.config as Record<string, unknown>,
    order:         tpl.order,
  };
}

// ── TemplateForm ─────────────────────────────────────────────────────────────

function TemplateForm({
  initial,
  type,
  onSave,
  onCancel,
  readOnly = false,
  extraActions,
}: {
  initial: typeof EMPTY_FORM;
  type: TemplateType;
  onSave?: (data: typeof EMPTY_FORM) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  extraActions?: React.ReactNode;
}) {
  const [form, setForm] = useState({ ...initial, template_type: type });
  const initCfg = initial.config && Object.keys(initial.config).length
    ? initial.config
    : getDefaultConfig(type);
  const [configText, setConfigText] = useState(JSON.stringify(initCfg, null, 2));
  const [configErr,  setConfigErr]  = useState('');
  const [showAdv,    setShowAdv]    = useState(false);

  function getParsedConfig(): Record<string, unknown> {
    try { return JSON.parse(configText); } catch { return {}; }
  }

  function updateConfigField(key: string, value: unknown) {
    try {
      const updated = { ...JSON.parse(configText), [key]: value };
      setConfigText(JSON.stringify(updated, null, 2));
      setConfigErr('');
    } catch { /* broken JSON — leave text as-is */ }
  }

  function updateNestedConfigField(outerKey: string, innerKey: string, value: unknown) {
    try {
      const current = JSON.parse(configText) as Record<string, unknown>;
      const outer   = (current[outerKey] as Record<string, unknown>) ?? {};
      setConfigText(JSON.stringify({ ...current, [outerKey]: { ...outer, [innerKey]: value } }, null, 2));
      setConfigErr('');
    } catch { /* broken JSON */ }
  }

  function handleSave() {
    try {
      const parsed = JSON.parse(configText);
      setConfigErr('');
      onSave?.({ ...form, config: parsed });
    } catch {
      setConfigErr('Invalid JSON — fix before saving.');
      setShowAdv(true);
    }
  }

  const cfg = getParsedConfig();

  function renderStructuredFields() {
    if (readOnly) {
      const entries = Object.entries(cfg).filter(([, v]) => v !== null && v !== '');
      if (!entries.length) {
        return <p className="tpl-read-muted" style={{ fontSize: 12, margin: 0 }}>No config defined.</p>;
      }
      return (
        <div className="tpl-kv-list">
          {entries.map(([k, v]) => (
            <div key={k} className="tpl-kv-row">
              <span className="tpl-kv-key">{k.replace(/_/g, ' ')}</span>
              <span className="tpl-kv-val">
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (type === 'issue') {
      return (
        <div className="tpl-struct-fields">
          <div className="tpl-form-row">
            <label>Default Title</label>
            <input
              className="tpl-input"
              value={String(cfg.title ?? '')}
              placeholder="e.g. [Security] Vulnerability"
              onChange={(e) => updateConfigField('title', e.target.value)}
            />
          </div>
          <div className="tpl-form-row">
            <label>Default Description</label>
            <textarea
              className="tpl-input tpl-textarea"
              rows={3}
              value={String(cfg.description ?? '')}
              placeholder="Steps to reproduce, expected behavior…"
              onChange={(e) => updateConfigField('description', e.target.value)}
            />
          </div>
          <div className="tpl-form-row tpl-form-inline">
            <div>
              <label>Issue Type</label>
              <select
                className="tpl-input"
                value={String(cfg.issue_type ?? 'task')}
                onChange={(e) => updateConfigField('issue_type', e.target.value)}
              >
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="story">Story</option>
                <option value="epic">Epic</option>
              </select>
            </div>
            <div>
              <label>Priority</label>
              <select
                className="tpl-input"
                value={String(cfg.priority ?? 'medium')}
                onChange={(e) => updateConfigField('priority', e.target.value)}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label>Story Points</label>
              <input
                className="tpl-input tpl-input-sm"
                type="number"
                min={0}
                value={cfg.story_points != null ? Number(cfg.story_points) : ''}
                placeholder="—"
                onChange={(e) => updateConfigField('story_points', e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
        </div>
      );
    }

    if (type === 'wiki') {
      return (
        <div className="tpl-struct-fields">
          <div className="tpl-form-row">
            <label>Default Page Title</label>
            <input
              className="tpl-input"
              value={String(cfg.title ?? '')}
              placeholder="e.g. Meeting Notes — {{date}}"
              onChange={(e) => updateConfigField('title', e.target.value)}
            />
          </div>
          <div className="tpl-form-row">
            <label>Default Content</label>
            <textarea
              className="tpl-input tpl-textarea"
              rows={5}
              value={String(cfg.content ?? '')}
              placeholder="Default wiki page content…"
              onChange={(e) => updateConfigField('content', e.target.value)}
            />
          </div>
        </div>
      );
    }

    // project
    const sprintDef = (cfg.sprint_defaults as Record<string, unknown>) ?? {};
    return (
      <div className="tpl-struct-fields">
        <div className="tpl-form-row">
          <label>Sprint Duration (weeks)</label>
          <input
            className="tpl-input tpl-input-sm"
            type="number"
            min={1}
            max={52}
            value={Number(sprintDef.duration_weeks ?? 2)}
            onChange={(e) =>
              updateNestedConfigField('sprint_defaults', 'duration_weeks', Number(e.target.value))
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="tpl-editor">

      {/* ── Section: Basic Info ───────────────────────────────────────── */}
      <div className="tpl-editor-section">
        <p className="tpl-editor-section-title">Basic Info</p>

        <div className="tpl-form-row">
          <label>Name{!readOnly && ' *'}</label>
          {readOnly
            ? <span className="tpl-read-val">{form.name}</span>
            : (
              <input
                className="tpl-input"
                value={form.name}
                placeholder="e.g. Security Bug"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            )
          }
        </div>

        {(form.description || !readOnly) && (
          <div className="tpl-form-row">
            <label>Description</label>
            {readOnly
              ? <span className="tpl-read-val tpl-read-muted">{form.description || '—'}</span>
              : (
                <textarea
                  className="tpl-input tpl-textarea"
                  rows={2}
                  value={form.description}
                  placeholder="What does this template set up?"
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              )
            }
          </div>
        )}

        <div className="tpl-form-row tpl-form-inline">
          <div>
            <label>Icon</label>
            {readOnly
              ? <span className="tpl-read-val">{form.icon || '—'}</span>
              : (
                <input
                  className="tpl-input tpl-input-sm"
                  value={form.icon}
                  placeholder="🐛"
                  maxLength={4}
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                />
              )
            }
          </div>
          <div style={{ flex: 1 }}>
            <label>Category</label>
            {readOnly
              ? <span className="tpl-read-val">{form.category || '—'}</span>
              : (
                <input
                  className="tpl-input"
                  value={form.category}
                  placeholder="engineering"
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              )
            }
          </div>
          <div>
            <label>Order</label>
            {readOnly
              ? <span className="tpl-read-val">{form.order}</span>
              : (
                <input
                  className="tpl-input tpl-input-sm"
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
                />
              )
            }
          </div>
          {!readOnly && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label>&nbsp;</label>
              <label className="tpl-check-label">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── Section: Template Content ─────────────────────────────────── */}
      <div className="tpl-editor-section">
        <p className="tpl-editor-section-title">
          {type === 'issue'
            ? '🎫 Issue Defaults'
            : type === 'wiki'
            ? '📄 Page Defaults'
            : '🚀 Project Defaults'}
        </p>
        {renderStructuredFields()}
      </div>

      {/* ── Section: Advanced Config (accordion) ─────────────────────── */}
      <div className="tpl-editor-section">
        <button className="tpl-adv-toggle" type="button" onClick={() => setShowAdv((v) => !v)}>
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            className={`tpl-chevron${showAdv ? ' tpl-chevron-open' : ''}`}
          >
            <path
              d="M2 4l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Advanced Config (JSON)
        </button>

        {showAdv && (
          <div className="tpl-adv-body">
            {readOnly
              ? <pre className="tpl-input tpl-textarea tpl-code tpl-code-pre">{configText}</pre>
              : (
                <>
                  <textarea
                    className={`tpl-input tpl-textarea tpl-code${configErr ? ' tpl-input-err' : ''}`}
                    rows={8}
                    value={configText}
                    spellCheck={false}
                    onChange={(e) => { setConfigText(e.target.value); setConfigErr(''); }}
                  />
                  {configErr && <p className="tpl-err">{configErr}</p>}
                </>
              )
            }
          </div>
        )}
      </div>

      {/* ── Form actions ──────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="tpl-editor-actions">
          <button
            className="tpl-btn tpl-btn-save"
            onClick={handleSave}
            disabled={!form.name.trim()}
          >
            Save
          </button>
          <button className="tpl-btn tpl-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          {extraActions}
        </div>
      )}
    </div>
  );
}

// ── TemplateSettings ──────────────────────────────────────────────────────────

export function TemplateSettings({ projectId }: Props) {
  const [activeTab,  setActiveTab]  = useState<TabT>('issue');
  const [panelMode,  setPanelMode]  = useState<PanelMode>('idle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formSeed,   setFormSeed]   = useState<typeof EMPTY_FORM | null>(null);

  const { data: templates = [], isLoading } = useProjectTemplates(projectId, activeTab);
  const { mutate: createTemplate } = useCreateTemplate(projectId);
  const { mutate: updateTemplate } = useUpdateTemplate(projectId);
  const { mutate: deleteTemplate } = useDeleteTemplate(projectId);

  const customTemplates  = templates.filter((t) => !t.isSystem);
  const systemTemplates  = templates.filter((t) => t.isSystem);
  const selectedTemplate = selectedId
    ? (templates.find((t) => t.id === selectedId) ?? null)
    : null;

  // ── Panel helpers ───────────────────────────────────────────────────────

  function openCreate(seed?: typeof EMPTY_FORM) {
    setSelectedId(null);
    setPanelMode('create');
    setFormSeed(seed ?? null);
  }

  function openEdit(tpl: WorkflowTemplate) {
    setSelectedId(tpl.id);
    setPanelMode('edit');
    setFormSeed(null);
  }

  function openPreview(tpl: WorkflowTemplate) {
    setSelectedId(tpl.id);
    setPanelMode('preview');
    setFormSeed(null);
  }

  function closePanel() {
    setPanelMode('idle');
    setSelectedId(null);
    setFormSeed(null);
  }

  function handleDuplicate(tpl: WorkflowTemplate) {
    openCreate({ ...toFormState(tpl), name: `Copy of ${tpl.name}`, is_active: true });
  }

  function handleDelete(tpl: WorkflowTemplate) {
    if (confirm(`Delete "${tpl.name}"?`)) {
      deleteTemplate(tpl.id);
      closePanel();
    }
  }

  function switchTab(tab: TabT) {
    setActiveTab(tab);
    setPanelMode('idle');
    setSelectedId(null);
    setFormSeed(null);
  }

  // ── Right-panel renderer ────────────────────────────────────────────────

  function renderRightPanel() {

    // ── Create mode ──────────────────────────────────────────────────────
    if (panelMode === 'create') {
      const seed = formSeed ?? { ...EMPTY_FORM, template_type: activeTab };
      return (
        <>
          <div className="tpl-panel-header">
            <h4 className="tpl-panel-title">
              {formSeed ? 'Duplicate Template' : 'New Template'}
            </h4>
            <span className="tpl-mode-badge tpl-mode-create">Create</span>
          </div>
          <TemplateForm
            initial={seed}
            type={activeTab}
            onSave={(data) =>
              createTemplate(
                { ...data, template_type: activeTab },
                { onSuccess: () => closePanel() },
              )
            }
            onCancel={closePanel}
          />
        </>
      );
    }

    // ── Edit mode ────────────────────────────────────────────────────────
    if (panelMode === 'edit' && selectedTemplate) {
      return (
        <>
          <div className="tpl-panel-header">
            <h4 className="tpl-panel-title">
              {selectedTemplate.icon && (
                <span className="tpl-panel-icon">{selectedTemplate.icon}</span>
              )}
              {selectedTemplate.name}
            </h4>
            <span className="tpl-mode-badge tpl-mode-edit">Editing</span>
          </div>
          <TemplateForm
            key={selectedTemplate.id}
            initial={toFormState(selectedTemplate)}
            type={selectedTemplate.templateType}
            onSave={(data) =>
              updateTemplate(
                { id: selectedTemplate.id, data },
                { onSuccess: () => closePanel() },
              )
            }
            onCancel={closePanel}
            extraActions={
              <div className="tpl-extra-actions">
                <button
                  className="tpl-btn tpl-btn-outline"
                  onClick={() => handleDuplicate(selectedTemplate)}
                >
                  Duplicate
                </button>
                <button
                  className="tpl-btn tpl-btn-danger"
                  onClick={() => handleDelete(selectedTemplate)}
                >
                  Delete
                </button>
              </div>
            }
          />
        </>
      );
    }

    // ── Preview mode (system templates, or custom viewed before editing) ──
    if (panelMode === 'preview' && selectedTemplate) {
      return (
        <>
          <div className="tpl-panel-header">
            <h4 className="tpl-panel-title">
              {selectedTemplate.icon && (
                <span className="tpl-panel-icon">{selectedTemplate.icon}</span>
              )}
              {selectedTemplate.name}
            </h4>
            {selectedTemplate.isSystem
              ? <span className="tpl-mode-badge tpl-mode-system">System</span>
              : <span className="tpl-mode-badge tpl-mode-custom">Custom</span>
            }
          </div>

          {selectedTemplate.isSystem && (
            <div className="tpl-system-notice">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              <span>Read-only starter kit. Duplicate to create a customizable copy.</span>
              <button
                className="tpl-btn tpl-btn-new tpl-btn-sm"
                onClick={() => handleDuplicate(selectedTemplate)}
              >
                Duplicate to Customize
              </button>
            </div>
          )}

          <TemplateForm
            key={selectedTemplate.id}
            initial={toFormState(selectedTemplate)}
            type={selectedTemplate.templateType}
            readOnly
          />

          {!selectedTemplate.isSystem && (
            <div className="tpl-preview-actions">
              <button
                className="tpl-btn tpl-btn-save"
                onClick={() => openEdit(selectedTemplate)}
              >
                Edit
              </button>
              <button
                className="tpl-btn tpl-btn-outline"
                onClick={() => handleDuplicate(selectedTemplate)}
              >
                Duplicate
              </button>
              <button
                className="tpl-btn tpl-btn-danger"
                onClick={() => handleDelete(selectedTemplate)}
              >
                Delete
              </button>
            </div>
          )}
        </>
      );
    }

    // ── Idle / empty state ────────────────────────────────────────────────
    return (
      <div className="tpl-idle-state">
        <span className="tpl-idle-emoji">
          {activeTab === 'issue' ? '🎫' : activeTab === 'wiki' ? '📄' : '🚀'}
        </span>
        <p className="tpl-idle-title">
          {activeTab === 'issue'
            ? 'Issue Templates'
            : activeTab === 'wiki'
            ? 'Wiki Templates'
            : 'Project Templates'}
        </p>
        <p className="tpl-idle-sub">
          {activeTab === 'issue'
            ? 'Define issue blueprints with preset types, priorities, and descriptions.'
            : activeTab === 'wiki'
            ? 'Define page blueprints for consistent documentation structure.'
            : 'Define project blueprints with default labels, sprints, and configurations.'}
        </p>
        <button className="tpl-btn tpl-btn-new" onClick={() => openCreate()}>
          + New Template
        </button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="tpl-settings-root">

      {/* Header */}
      <div className="tpl-settings-top">
        <div>
          <h3 className="tpl-settings-heading">Workflow Templates</h3>
          <p className="tpl-settings-sub">
            Manage issue, wiki, and project templates.
            System templates are read-only starter kits — duplicate to customize.
          </p>
        </div>
        <button className="tpl-btn tpl-btn-new" onClick={() => openCreate()}>
          + New Template
        </button>
      </div>

      {/* Type tabs */}
      <div className="tpl-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tpl-tab${activeTab === tab.id ? ' tpl-tab-active' : ''}`}
            onClick={() => switchTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Split-view layout ─────────────────────────────────────────────── */}
      <div className="tpl-split">

        {/* Left: template library */}
        <div className="tpl-split-left">
          <div className="tpl-left-header">
            <span className="tpl-left-title">Library</span>
            <button className="tpl-left-new-btn" title="New template" onClick={() => openCreate()}>
              <svg width="11" height="11" viewBox="0 0 12 12">
                <path
                  d="M6 1v10M1 6h10"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <p className="tpl-loading" style={{ padding: '14px 16px' }}>Loading…</p>
          ) : (
            <div className="tpl-left-body">

              {customTemplates.length > 0 && (
                <>
                  <p className="tpl-left-group-label">Custom</p>
                  {customTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      className={[
                        'tpl-left-item',
                        selectedId === tpl.id ? 'tpl-left-item-active' : '',
                        !tpl.isActive        ? 'tpl-left-item-dim'    : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => openEdit(tpl)}
                    >
                      <span className="tpl-left-item-icon">{tpl.icon || '📋'}</span>
                      <div className="tpl-left-item-body">
                        <span className="tpl-left-item-name">{tpl.name}</span>
                        {tpl.description && (
                          <span className="tpl-left-item-desc">{tpl.description}</span>
                        )}
                        {tpl.category && (
                          <span className="tpl-left-item-cat">{tpl.category}</span>
                        )}
                      </div>
                      {!tpl.isActive && (
                        <span className="tpl-mini-badge tpl-mini-off">Off</span>
                      )}
                    </button>
                  ))}
                </>
              )}

              {systemTemplates.length > 0 && (
                <>
                  <p
                    className="tpl-left-group-label"
                    style={{ marginTop: customTemplates.length ? 16 : 0 }}
                  >
                    System
                  </p>
                  {systemTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      className={[
                        'tpl-left-item tpl-left-item-sys',
                        selectedId === tpl.id ? 'tpl-left-item-active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => openPreview(tpl)}
                    >
                      <span className="tpl-left-item-icon">{tpl.icon || '📋'}</span>
                      <div className="tpl-left-item-body">
                        <span className="tpl-left-item-name">{tpl.name}</span>
                        {tpl.description && (
                          <span className="tpl-left-item-desc">{tpl.description}</span>
                        )}
                      </div>
                      <span className="tpl-mini-badge tpl-mini-sys">SYS</span>
                    </button>
                  ))}
                </>
              )}

              {templates.length === 0 && (
                <div className="tpl-left-empty">No {activeTab} templates yet.</div>
              )}
            </div>
          )}
        </div>

        {/* Right: editor / preview panel */}
        <div className="tpl-split-right">
          {renderRightPanel()}
        </div>

      </div>
    </div>
  );
}
