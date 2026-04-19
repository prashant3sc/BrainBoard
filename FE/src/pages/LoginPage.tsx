import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/useAuthStore';
import useAppStore from '@/store/useAppStore';
import { mockUsers } from '@/mocks/users';
import { authApi } from '@/api/auth';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/* ── BrainBoard icon ── */
function BrainBoardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48" aria-hidden="true">
      <rect x="1"  y="7"  width="8" height="8" rx="2"   fill="#E75026" />
      <rect x="11" y="7"  width="8" height="8" rx="2"   fill="#E75026" />
      <rect x="21" y="7"  width="5" height="8" rx="1.5" fill="#E75026" opacity="0.35" />
      <rect x="1"  y="17" width="8" height="5" rx="1.5" fill="#E75026" opacity="0.5" />
      <rect x="11" y="17" width="8" height="5" rx="1.5" fill="#E75026" opacity="0.35" />
      <rect x="21" y="17" width="5" height="5" rx="1.5" fill="#E75026" opacity="0.6" />
      <line x1="24" y1="7" x2="27" y2="4" stroke="#E75026" strokeWidth="1.2" opacity="0.5" />
      <circle cx="28" cy="3.5" r="3.5" fill="#E75026" />
      <circle cx="28" cy="3.5" r="2"   fill="white" />
      <circle cx="28" cy="3.5" r="1"   fill="#E75026" />
    </svg>
  );
}

/* ── OR divider ── */
function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ height: 1, flex: 1, background: 'var(--bb-border)' }} />
      <span style={{ fontSize: 12, color: 'var(--bb-text-muted)', fontWeight: 400 }}>OR</span>
      <div style={{ height: 1, flex: 1, background: 'var(--bb-border)' }} />
    </div>
  );
}

/* ── Field-level error ── */
function FieldError({ message }: { message: string }) {
  return (
    <span style={{ fontSize: 12, color: 'var(--bb-err-field)', marginTop: 4, display: 'block' }}>
      {message}
    </span>
  );
}

/* ── Input style builders ── */
function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: hasError ? 'var(--bb-bg-input-err)' : 'var(--bb-bg-input)',
    border: `1.5px solid ${hasError ? 'var(--bb-err-field)' : 'var(--bb-border)'}`,
    borderRadius: 8,
    padding: '11px 12px',
    fontSize: 14,
    color: 'var(--bb-text-primary)',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };
}

const focusStyle: React.CSSProperties = {
  borderColor: '#E75026',
  boxShadow: '0 0 0 3px rgba(231, 80, 38, 0.12)',
};

const focusErrorStyle: React.CSSProperties = {
  boxShadow: '0 0 0 3px rgba(222, 53, 11, 0.12)',
};

/* ── Eye icon for password toggle ── */
function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ── Controlled themed input field ── */
function Field({
  label, type, value, onChange, placeholder, autoComplete, error, rightSlot, showPasswordToggle,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  error?: string;
  rightSlot?: React.ReactNode;
  showPasswordToggle?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const hasError = Boolean(error);
  const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
          color: 'var(--bb-text-secondary)', textTransform: 'uppercase',
        }}>
          {label}
        </label>
        {rightSlot}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type={inputType}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          /* bb-input targets ::placeholder via index.css */
          className="bb-input"
          style={{
            ...inputStyle(hasError),
            ...(focused && !hasError ? focusStyle : {}),
            ...(focused && hasError  ? focusErrorStyle : {}),
            ...(showPasswordToggle ? { paddingRight: 40 } : {}),
          }}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            title={showPassword ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: 'var(--bb-text-muted)', display: 'flex', alignItems: 'center',
              borderRadius: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#E75026')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--bb-text-muted)')}
            tabIndex={-1}
          >
            <EyeIcon visible={showPassword} />
          </button>
        )}
      </div>
      {hasError && <FieldError message={error!} />}
    </div>
  );
}

/* ── Primary "Log in" button ── */
function LoginButton({ loading }: { loading: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [active,  setActive]  = useState(false);
  const bg = active ? '#A32E0E' : hovered ? '#C73D16' : '#E75026';

  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        width: '100%', height: 44,
        background: loading ? '#E75026' : bg,
        color: '#FFFFFF', fontWeight: 600, fontSize: 14,
        border: 'none', borderRadius: 8,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'background 0.15s',
        letterSpacing: '0.01em',
      }}
    >
      {loading ? 'Logging in…' : 'Log in'}
    </button>
  );
}

/* ── SSO button ── */
function SSOButton() {
  const [hovered, setHovered] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', height: 44,
        background: hovered
          ? (isDark ? 'rgba(231,80,38,0.10)' : '#FFF3F0')
          : 'var(--bb-bg-input)',
        border: `1.5px solid ${hovered ? '#E75026' : 'var(--bb-border)'}`,
        borderRadius: 8,
        color: 'var(--bb-text-secondary)',
        fontWeight: 500, fontSize: 14,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      Continue with SSO account
    </button>
  );
}

/* ── Theme toggle (visible on login page too) ── */
function ThemeToggle() {
  const { theme, toggleTheme } = useAppStore();
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'fixed', top: 16, right: 16,
        background: 'var(--bb-bg-card)',
        border: '1px solid var(--bb-border)',
        borderRadius: 8, padding: '6px 10px',
        cursor: 'pointer', fontSize: 16,
        color: 'var(--bb-text-secondary)',
        transition: 'background 0.15s',
      }}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '☀' : '🌙'}
    </button>
  );
}

/* ── Page ── */
export function LoginPage() {
  const { login, isLoggedIn } = useAuthStore();
  const navigate = useNavigate();

  const [selectedUserId, setSelectedUserId] = useState(mockUsers[0].id);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [emailErr,    setEmailErr]    = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [submitErr,   setSubmitErr]   = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoggedIn()) return <Navigate to="/dashboard" replace />;

  function validate(): boolean {
    let ok = true;
    if (!email.trim()) {
      setEmailErr('This field is required.'); ok = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailErr('Enter a valid email address.'); ok = false;
    } else { setEmailErr(''); }

    if (!password) {
      setPasswordErr('This field is required.'); ok = false;
    } else { setPasswordErr(''); }

    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitErr('');
    if (!USE_MOCK && !validate()) return;
    setLoading(true);
    try {
      if (USE_MOCK) {
        const user = mockUsers.find((u) => u.id === selectedUserId)!;
        login(user, 'mock-token');
      } else {
        const data = await authApi.login(email, password);
        login(data.user, data.token);
      }
      navigate('/dashboard', { replace: true });
    } catch {
      setSubmitErr('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const [selectFocused, setSelectFocused] = useState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bb-bg-page)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    }}>
      <ThemeToggle />

      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--bb-bg-card)',
        border: '1px solid var(--bb-border)',
        borderRadius: 12,
        padding: '40px 40px 36px',
        boxShadow: 'var(--bb-shadow-card)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <BrainBoardIcon />
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--bb-text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
            BrainBoard
          </h1>
          <p style={{ fontSize: 14, fontWeight: 400, color: 'var(--bb-text-secondary)', margin: 0 }}>
            Log in to continue
          </p>
          {USE_MOCK && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#974F0C',
              background: '#FFF3CD', borderRadius: 20,
              padding: '2px 10px', letterSpacing: '0.04em',
            }}>
              DEMO MODE
            </span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {USE_MOCK ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                color: 'var(--bb-text-secondary)', textTransform: 'uppercase',
              }}>
                Login as
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                onFocus={() => setSelectFocused(true)}
                onBlur={() => setSelectFocused(false)}
                className="bb-input"
                style={{
                  ...inputStyle(false),
                  cursor: 'pointer',
                  ...(selectFocused ? focusStyle : {}),
                }}
              >
                {mockUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <Field
                label="Email" type="email" value={email}
                onChange={(v) => { setEmail(v); if (emailErr) setEmailErr(''); }}
                placeholder="you@company.com" autoComplete="email"
                error={emailErr}
              />
              <Field
                label="Password" type="password" value={password}
                onChange={(v) => { setPassword(v); if (passwordErr) setPasswordErr(''); }}
                placeholder="••••••••" autoComplete="current-password"
                error={passwordErr}
                showPasswordToggle
                rightSlot={
                  <button type="button"
                    style={{ fontSize: 12, color: '#E75026', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    Forgot password?
                  </button>
                }
              />
            </>
          )}

          {/* Submit error */}
          {submitErr && (
            <div style={{
              fontSize: 13, color: 'var(--bb-err-text)',
              background: 'var(--bb-err-bg)',
              border: '1px solid var(--bb-err-border)',
              borderRadius: 6, padding: '10px 12px',
            }}>
              {submitErr}
            </div>
          )}

          <LoginButton loading={loading} />

          {!USE_MOCK && (
            <>
              {/* <OrDivider />
              <SSOButton /> */}
            </>
          )}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
