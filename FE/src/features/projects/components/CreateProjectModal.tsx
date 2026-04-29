import { useState } from 'react';
import { useCreateProject } from '../useProjects';
import useAuthStore from '@/store/useAuthStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function deriveKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

export function CreateProjectModal({ isOpen, onClose }: Props) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [key, setKey]                 = useState('');
  const [keyTouched, setKeyTouched]   = useState(false);
  const { mutate, isPending, error }  = useCreateProject();
  const user                          = useAuthStore((s) => s.user);

  if (!isOpen) return null;

  function handleNameChange(val: string) {
    setName(val);
    if (!keyTouched) {
      setKey(deriveKey(val));
    }
  }

  function handleKeyChange(val: string) {
    setKeyTouched(true);
    setKey(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !key) return;
    mutate(
      { name, description, key, ownerId: user.id, memberIds: [user.id], isArchived: false },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
          setKey('');
          setKeyTouched(false);
          onClose();
        },
      },
    );
  }

  const keyValid = /^[A-Z0-9]{1,6}$/.test(key);
  const serverError = (error as any)?.response?.data?.key?.[0] ?? null;

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
          {/* Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-modal-label)' }}>
              Name *
            </label>
            <input
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Client Portal v3"
              className="bb-modal-input"
            />
          </div>

          {/* Ticket Prefix / Key */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-modal-label)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Ticket Prefix *
              <span style={{
                fontSize: 10, fontWeight: 600, color: 'var(--bb-text-muted)',
                background: 'var(--bb-bg-input)', border: '1px solid var(--bb-border)',
                borderRadius: 4, padding: '1px 6px',
              }}>
                e.g. BB, SHOP, API
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                required
                value={key}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="BB"
                maxLength={6}
                className="bb-modal-input"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  borderColor: serverError ? '#DE350B' : (!keyTouched || keyValid) ? undefined : '#DE350B',
                }}
              />
              {key && (
                <span style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 12, fontWeight: 700, color: '#E75026', opacity: 0.8,
                }}>
                  → {key}-1, {key}-2, …
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: serverError ? '#DE350B' : 'var(--bb-text-muted)', margin: 0 }}>
              {serverError
                ? serverError
                : 'Uppercase letters and numbers only, max 6 chars. Cannot be changed after creation.'}
            </p>
          </div>

          {/* Description */}
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
                borderRadius: 6, padding: '7px 16px', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-hover-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bb-modal-cancel-bg)')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !keyValid}
              style={{
                background: '#E75026', color: '#FFFFFF', border: 'none',
                borderRadius: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600,
                cursor: (isPending || !keyValid) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: (isPending || !keyValid) ? 0.6 : 1,
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { if (!isPending && keyValid) e.currentTarget.style.background = '#C73D16'; }}
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
