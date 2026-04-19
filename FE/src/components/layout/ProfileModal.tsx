import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import useAuthStore from '@/store/useAuthStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" stroke="currentColor" strokeWidth="1.4"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.3 4.4C2.8 5.5 1.7 7 1 8c1.3 2.4 4 5 7 5 1.4 0 2.7-.5 3.8-1.2M7 3.1C7.3 3 7.7 3 8 3c3 0 5.7 2.6 7 5-.4.8-1 1.6-1.7 2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function ProfileModal({ isOpen, onClose }: Props) {
  const user = useAuthStore((s) => s.user);

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw,     setNewPw]       = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showCur,   setShowCur]     = useState(false);
  const [showNew,   setShowNew]     = useState(false);
  const [showConf,  setShowConf]    = useState(false);
  const [error,     setError]       = useState('');
  const [success,   setSuccess]     = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setError(''); setSuccess(false);
    setShowCur(false); setShowNew(false); setShowConf(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const changeMut = useMutation({
    mutationFn: () => authApi.changePassword(currentPw, newPw),
    onSuccess: () => {
      setSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { current_password?: string[]; new_password?: string[]; detail?: string } } })
          ?.response?.data?.current_password?.[0] ??
        (err as { response?: { data?: { new_password?: string[] } } })
          ?.response?.data?.new_password?.[0] ??
        'Something went wrong. Please try again.';
      setError(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (!currentPw || !newPw || !confirmPw) { setError('All fields are required.'); return; }
    if (newPw.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    changeMut.mutate();
  }

  if (!isOpen || !user) return null;

  return (
    <div className="prof-overlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="prof-modal bb-modal-animate">

        {/* Header */}
        <div className="prof-header">
          <span className="prof-title">My Profile</span>
          <button className="kb-modal-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* User card */}
        <div className="prof-user-card">
          <div className="prof-avatar-lg">{getInitials(user.name)}</div>
          <div className="prof-user-info">
            <span className="prof-user-name">{user.name}</span>
            <span className="prof-user-email">{user.email}</span>
            <span className="prof-role-badge">{user.role}</span>
          </div>
        </div>

        <div className="prof-divider" />

        {/* Password section */}
        <div className="prof-section-label">Change Password</div>
        <form onSubmit={handleSubmit} className="prof-form" autoComplete="off">

          <div className="prof-field">
            <label className="kb-label">Current password</label>
            <div className="prof-pw-wrap">
              <input
                type={showCur ? 'text' : 'password'}
                className="kb-input"
                placeholder="Enter current password"
                value={currentPw}
                autoComplete="current-password"
                onChange={(e) => { setCurrentPw(e.target.value); setError(''); setSuccess(false); }}
              />
              <button type="button" className="prof-eye" onClick={() => setShowCur((v) => !v)}>
                <EyeIcon open={showCur} />
              </button>
            </div>
          </div>

          <div className="prof-field">
            <label className="kb-label">New password</label>
            <div className="prof-pw-wrap">
              <input
                type={showNew ? 'text' : 'password'}
                className="kb-input"
                placeholder="At least 8 characters"
                value={newPw}
                autoComplete="new-password"
                onChange={(e) => { setNewPw(e.target.value); setError(''); setSuccess(false); }}
              />
              <button type="button" className="prof-eye" onClick={() => setShowNew((v) => !v)}>
                <EyeIcon open={showNew} />
              </button>
            </div>
          </div>

          <div className="prof-field">
            <label className="kb-label">Confirm new password</label>
            <div className="prof-pw-wrap">
              <input
                type={showConf ? 'text' : 'password'}
                className="kb-input"
                placeholder="Repeat new password"
                value={confirmPw}
                autoComplete="new-password"
                onChange={(e) => { setConfirmPw(e.target.value); setError(''); setSuccess(false); }}
              />
              <button type="button" className="prof-eye" onClick={() => setShowConf((v) => !v)}>
                <EyeIcon open={showConf} />
              </button>
            </div>
          </div>

          {error   && <div className="prof-msg prof-msg-error">{error}</div>}
          {success && <div className="prof-msg prof-msg-success">Password updated successfully.</div>}

          <div className="prof-footer">
            <button type="button" className="kb-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="kb-btn-create" disabled={changeMut.isPending}>
              {changeMut.isPending ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
