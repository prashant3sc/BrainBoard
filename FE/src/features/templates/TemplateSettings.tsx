import { useState } from 'react';
import { useProjectTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } from './useTemplates';
import type { WorkflowTemplate, TemplateType } from '@/types';

interface Props {
  projectId: string;
}

type TabT = TemplateType;

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

function TemplateForm({
  initial, type, onSave, onCancel,
}: {
  initial: typeof EMPTY_FORM;
  type: TemplateType;
  onSave: (data: typeof EMPTY_FORM) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...initial, template_type: type });
  const [configText, setConfigText] = useState(
    JSON.stringify(initial.config && Object.keys(initial.config).length ? initial.config : getDefaultConfig(type), null, 2)
  );
  const [configErr, setConfigErr] = useState('');

  function getDefaultConfig(t: TemplateType) {
    if (t === 'issue')   return { title: '', description: '', issue_type: 'task', priority: 'medium', label_names: [], story_points: null };
    if (t === 'wiki')    return { title: '', content: '' };
    return { labels: [], wiki_pages: [], sprint_defaults: { duration_weeks: 2 }, compliance_templates: [] };
  }

  function handleSave() {
    try {
      const parsed = JSON.parse(configText);
      setConfigErr('');
      onSave({ ...form, config: parsed });
    } catch {
      setConfigErr('Invalid JSON — fix before saving.');
    }
  }

  return (
    <div className="tpl-form">
      <div className="tpl-form-row">
        <label>Name *</label>
        <input className="tpl-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Security Bug" />
      </div>
      <div className="tpl-form-row">
        <label>Description</label>
        <textarea className="tpl-input tpl-textarea" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What does this template set up?" />
      </div>
      <div className="tpl-form-row tpl-form-inline">
        <div>
          <label>Icon (emoji)</label>
          <input className="tpl-input tpl-input-sm" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="🐛" maxLength={4} />
        </div>
        <div>
          <label>Category</label>
          <input className="tpl-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="engineering" />
        </div>
        <div>
          <label>Order</label>
          <input className="tpl-input tpl-input-sm" type="number" min={0} value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="tpl-form-row">
        <label>
          Config (JSON)
          <span className="tpl-hint"> — shape depends on type; edit to customise</span>
        </label>
        <textarea
          className={`tpl-input tpl-textarea tpl-code${configErr ? ' tpl-input-err' : ''}`}
          rows={10}
          value={configText}
          onChange={(e) => { setConfigText(e.target.value); setConfigErr(''); }}
          spellCheck={false}
        />
        {configErr && <p className="tpl-err">{configErr}</p>}
      </div>
      <div className="tpl-form-row tpl-form-inline">
        <label className="tpl-check-label">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
          Active
        </label>
      </div>
      <div className="tpl-form-actions">
        <button className="tpl-btn tpl-btn-save" onClick={handleSave} disabled={!form.name.trim()}>Save</button>
        <button className="tpl-btn tpl-btn-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function TemplateSettings({ projectId }: Props) {
  const [activeTab, setActiveTab] = useState<TabT>('issue');
  const [creating,  setCreating]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useProjectTemplates(projectId, activeTab);
  const { mutate: createTemplate } = useCreateTemplate(projectId);
  const { mutate: updateTemplate } = useUpdateTemplate(projectId);
  const { mutate: deleteTemplate } = useDeleteTemplate(projectId);

  const customTemplates = templates.filter((t) => !t.isSystem);
  const systemTemplates = templates.filter((t) => t.isSystem);

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

  return (
    <div className="tpl-settings-root">
      <div className="tpl-settings-top">
        <div>
          <h3 className="tpl-settings-heading">Workflow Templates</h3>
          <p className="tpl-settings-sub">
            Manage issue, wiki, and project templates for this project.
            System templates are read-only; create custom templates to override or extend them.
          </p>
        </div>
        {!creating && (
          <button className="tpl-btn tpl-btn-new" onClick={() => setCreating(true)}>
            + New Template
          </button>
        )}
      </div>

      {/* Type tabs */}
      <div className="tpl-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tpl-tab${activeTab === tab.id ? ' tpl-tab-active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setCreating(false); setEditingId(null); }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {creating && (
        <TemplateForm
          initial={{ ...EMPTY_FORM, template_type: activeTab }}
          type={activeTab}
          onSave={(data) => createTemplate({ ...data, template_type: activeTab }, { onSuccess: () => setCreating(false) })}
          onCancel={() => setCreating(false)}
        />
      )}

      {isLoading ? (
        <p className="tpl-loading">Loading…</p>
      ) : (
        <>
          {/* Custom templates */}
          {customTemplates.length > 0 && (
            <div>
              <p className="tpl-section-label">Custom</p>
              <div className="tpl-list">
                {customTemplates.map((tpl) => (
                  <div key={tpl.id} className={`tpl-row${!tpl.isActive ? ' tpl-row-inactive' : ''}`}>
                    {editingId === tpl.id ? (
                      <TemplateForm
                        initial={toFormState(tpl)}
                        type={tpl.templateType}
                        onSave={(data) => updateTemplate({ id: tpl.id, data }, { onSuccess: () => setEditingId(null) })}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <TemplateRowDisplay
                        tpl={tpl}
                        onEdit={() => setEditingId(tpl.id)}
                        onDelete={() => {
                          if (confirm(`Delete "${tpl.name}"?`)) deleteTemplate(tpl.id);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System templates (read-only) */}
          {systemTemplates.length > 0 && (
            <div style={{ marginTop: customTemplates.length ? 20 : 0 }}>
              <p className="tpl-section-label">System (read-only)</p>
              <div className="tpl-list">
                {systemTemplates.map((tpl) => (
                  <div key={tpl.id} className={`tpl-row tpl-row-system${!tpl.isActive ? ' tpl-row-inactive' : ''}`}>
                    <TemplateRowDisplay tpl={tpl} readOnly />
                  </div>
                ))}
              </div>
            </div>
          )}

          {templates.length === 0 && !creating && (
            <div className="tpl-empty">No {activeTab} templates yet.</div>
          )}
        </>
      )}
    </div>
  );
}

function TemplateRowDisplay({
  tpl, onEdit, onDelete, readOnly = false,
}: {
  tpl: WorkflowTemplate;
  onEdit?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="tpl-row-inner">
      <div className="tpl-row-main">
        <span className="tpl-row-icon">{tpl.icon || '📋'}</span>
        <div className="tpl-row-info">
          <span className="tpl-row-name">{tpl.name}</span>
          {tpl.description && <span className="tpl-row-desc">{tpl.description}</span>}
          <div className="tpl-row-tags">
            {tpl.category && <span className="tpl-tag">{tpl.category}</span>}
            {!tpl.isActive && <span className="tpl-tag tpl-tag-inactive">Inactive</span>}
            {tpl.isSystem && <span className="tpl-tag tpl-tag-system">System</span>}
          </div>
        </div>
      </div>
      {!readOnly && (
        <div className="tpl-row-actions">
          <button className="tpl-icon-btn" title="Edit" onClick={onEdit}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="tpl-icon-btn tpl-icon-btn-danger" title="Delete" onClick={onDelete}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
