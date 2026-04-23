import { useState } from 'react';
import { useCreateProject } from '../useProjects';
import useAuthStore from '@/store/useAuthStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: Props) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const { mutate, isPending }         = useCreateProject();
  const user                          = useAuthStore((s) => s.user);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    mutate(
      { name, description, ownerId: user.id, memberIds: [user.id], isArchived: false },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
          onClose();
        },
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-xl"
        style={{
          background: 'var(--bb-modal-bg)',
          border: '1px solid var(--bb-modal-border)',
          padding: 24,
        }}
      >
        <h2 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600, color: 'var(--bb-modal-title)' }}>
          New Project
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-modal-label)' }}>
              Name *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Client Portal v3"
              className="bb-modal-input"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-modal-label)' }}>
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="bb-modal-input"
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bb-modal-cancel-bg)',
                border: '1px solid var(--bb-modal-cancel-border)',
                color: 'var(--bb-modal-cancel-color)',
                borderRadius: 6,
                padding: '7px 16px',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-hover-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-bg)')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                background: '#E75026',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: isPending ? 0.6 : 1,
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = '#C73D16'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#E75026'; }}
            >
              {isPending ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
