import { useState, useRef, useEffect } from 'react';
import { useAIChat, type ChatMessage } from '../useAIChat';

interface Props {
  projectId?: string;
  projectName?: string;
  context?: 'wiki' | 'default';
}

const SUGGESTIONS_DEFAULT = [
  'Who is working on the frontend issues?',
  'What issues are currently in progress?',
  'Summarize the active sprint',
  'What does the auth wiki page say?',
];

const SUGGESTIONS_WIKI = [
  'Explain this page simply',
  'What are the key decisions documented here?',
  'Are there any related issues linked to this page?',
  'What changed in the latest version?',
];

/* ── Typing animation ── */
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 2px' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#E75026',
            animation: 'bb-chat-bounce 1.3s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ── AI logo mark ── */
function BrainBoardMark({ size = 18 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
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

/* ── Send icon ── */
function SendIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M1.5 7.5L13.5 1.5L9 13.5L7.5 8.5L1.5 7.5Z" fill={color} strokeLinejoin="round" />
    </svg>
  );
}

/* ── User message bubble ── */
function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
      <div
        style={{
          maxWidth: '82%',
          background: '#E75026',
          color: '#fff',
          borderRadius: '14px 14px 3px 14px',
          padding: '10px 14px',
          fontSize: 13,
          lineHeight: 1.55,
          boxShadow: '0 2px 8px rgba(231,80,38,0.25)',
          letterSpacing: '0.01em',
        }}
      >
        {msg.content}
      </div>
    </div>
  );
}

/* ── Assistant message bubble ── */
function AssistantBubble({ msg }: { msg: ChatMessage }) {
  const outOfScope = msg.out_of_scope;

  return (
    <div style={{ display: 'flex', gap: 9, marginBottom: 14, alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div
        style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: 'var(--bb-nav-active-bg)',
          border: '1.5px solid rgba(231,80,38,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: 1,
        }}
      >
        <BrainBoardMark size={14} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            background: outOfScope
              ? 'var(--bb-bg-input-err)'
              : 'var(--bb-bg-card)',
            border: `1.5px solid ${outOfScope ? 'var(--bb-err-border)' : 'var(--bb-border)'}`,
            borderRadius: '3px 14px 14px 14px',
            padding: '10px 13px',
            fontSize: 13,
            lineHeight: 1.65,
            color: outOfScope ? 'var(--bb-err-text)' : 'var(--bb-text-primary)',
            boxShadow: '0 1px 4px rgba(9,30,66,0.05)',
          }}
        >
          {msg.isLoading ? <TypingDots /> : msg.content}
        </div>

        {/* Source citations */}
        {!msg.isLoading && msg.sources && msg.sources.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--bb-text-muted)', fontWeight: 500 }}>From:</span>
            {msg.sources.map((s, i) => (
              <span
                key={i}
                style={{
                  fontSize: 10, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 99,
                  background: 'var(--bb-nav-active-bg)',
                  color: '#E75026',
                  border: '1px solid rgba(231,80,38,0.2)',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Suggestion chip ── */
function SuggestionChip({ text, onClick }: { text: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left',
        background: hovered ? 'var(--bb-nav-active-bg)' : 'var(--bb-bg-input)',
        border: `1.5px solid ${hovered ? 'rgba(231,80,38,0.35)' : 'var(--bb-border)'}`,
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        color: hovered ? '#E75026' : 'var(--bb-text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span style={{ opacity: 0.5, fontSize: 14 }}>›</span>
      {text}
    </button>
  );
}

interface WikiContext {
  id: string;
  title: string;
  text: string;
}

/* ── Main chat panel ── */
export function ChatPanel({ projectId, projectName, context = 'default' }: Props) {
  const SUGGESTIONS = context === 'wiki' ? SUGGESTIONS_WIKI : SUGGESTIONS_DEFAULT;
  const [wikiContext, setWikiContext] = useState<WikiContext | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage, clearMessages } = useAIChat(projectId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const [btnHover, setBtnHover] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      inputRef.current?.focus();
    }
  }, [open, messages.length]);

  // Keep a ref so the explain handler always sees the latest wikiContext
  const wikiContextRef = useRef<WikiContext | null>(null);
  useEffect(() => { wikiContextRef.current = wikiContext; }, [wikiContext]);

  useEffect(() => {
    function handleExplain(e: Event) {
      const text = (e as CustomEvent<{ text: string }>).detail.text;
      if (!text) return;
      const prompt = `Explain this:\n\n"${text}"`;
      setOpen(true);
      // Auto-send immediately — no need to press Enter
      sendMessage(prompt, wikiContextRef.current ?? undefined);
    }
    window.addEventListener('wiki:explain', handleExplain);
    return () => window.removeEventListener('wiki:explain', handleExplain);
  }, [sendMessage]); // sendMessage is stable (useCallback)

  useEffect(() => {
    function handlePageContext(e: Event) {
      const detail = (e as CustomEvent<WikiContext | null>).detail;
      setWikiContext(detail ?? null);
    }
    window.addEventListener('wiki:page-context', handlePageContext);
    return () => window.removeEventListener('wiki:page-context', handlePageContext);
  }, []);

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text, wikiContext ?? undefined);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const isEmpty = messages.length === 0;
  const canSend = !!input.trim() && !isLoading;

  return (
    <>
      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes bb-chat-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes bb-chat-in {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes bb-fab-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(231,80,38,0.45); }
          70%  { box-shadow: 0 0 0 10px rgba(231,80,38,0); }
          100% { box-shadow: 0 0 0 0   rgba(231,80,38,0); }
        }
        .bb-chat-input:focus {
          outline: none;
          border-color: #E75026 !important;
          box-shadow: 0 0 0 3px rgba(231,80,38,0.12);
        }
        .bb-chat-scroll::-webkit-scrollbar { width: 4px; }
        .bb-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .bb-chat-scroll::-webkit-scrollbar-thumb { background: var(--bb-border); border-radius: 4px; }
      `}</style>

      {/* ── FAB trigger ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setBtnHover(true)}
        onMouseLeave={() => setBtnHover(false)}
        title="BrainBoard AI Assistant"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 44, height: 44, borderRadius: 13,
          background: open ? 'var(--bb-bg-card)' : 'transparent',
          border: open ? '2px solid #E75026' : 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s, border 0.2s',
          boxShadow: 'none',
          outline: 'none',
          overflow: 'hidden',
          filter: !open && btnHover ? 'brightness(0.85)' : 'none',
          appearance: 'none',
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="#E75026" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={44} height={44} aria-hidden="true" style={{ display: 'block', borderRadius: 13 }}>
            <rect width="64" height="64" rx="16" fill="#E75026"/>
            <rect x="14" y="20" width="10" height="10" rx="2.5" fill="white"/>
            <rect x="27" y="20" width="10" height="10" rx="2.5" fill="white" opacity=".55"/>
            <rect x="40" y="20" width="10" height="10" rx="2.5" fill="white" opacity=".3"/>
            <rect x="14" y="33" width="10" height="7"  rx="2"   fill="white" opacity=".45"/>
            <rect x="27" y="33" width="10" height="7"  rx="2"   fill="white"/>
            <rect x="40" y="33" width="10" height="7"  rx="2"   fill="white" opacity=".55"/>
            <circle cx="47" cy="18" r="6"   fill="white"/>
            <circle cx="47" cy="18" r="3.5" fill="#E75026"/>
            <circle cx="47" cy="18" r="1.6" fill="white"/>
            <path d="M32 44 Q32 50 26 52 Q30 50 36 52 Q30 50 32 44Z" fill="white" opacity=".5"/>
          </svg>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div
          style={{
            position: 'fixed', bottom: 94, right: 28, zIndex: 999,
            width: 'min(390px, calc(100vw - 40px))',
            height: 'min(560px, calc(100vh - 110px))',
            background: 'var(--bb-bg-card)',
            border: '1.5px solid var(--bb-border)',
            borderRadius: 18,
            boxShadow: '0 12px 48px rgba(9,30,66,0.18), 0 2px 8px rgba(9,30,66,0.08)',
            display: 'flex', flexDirection: 'column',
            animation: 'bb-chat-in 0.22s cubic-bezier(0.22,1,0.36,1)',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              padding: '14px 16px 12px',
              borderBottom: '1px solid var(--bb-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
              background: 'var(--bb-bg-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Logo block */}
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--bb-nav-active-bg)',
                  border: '1.5px solid rgba(231,80,38,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <BrainBoardMark size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--bb-text-primary)', lineHeight: 1.2 }}>
                  BrainBoard Assistant
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  {/* Live dot */}
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ fontSize: 10.5, color: 'var(--bb-text-muted)', fontWeight: 500 }}>
                    {projectName ? `Scoped to ${projectName}` : 'All projects'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  style={{
                    background: 'none', border: '1px solid var(--bb-border)',
                    borderRadius: 7, cursor: 'pointer',
                    color: 'var(--bb-text-muted)', fontSize: 11,
                    padding: '3px 8px', fontWeight: 500,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#E75026';
                    e.currentTarget.style.color = '#E75026';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--bb-border)';
                    e.currentTarget.style.color = 'var(--bb-text-muted)';
                  }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--bb-text-muted)', display: 'flex', padding: 4,
                  borderRadius: 6, transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#E75026'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--bb-text-muted)'; }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Messages ── */}
          <div
            className="bb-chat-scroll"
            style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 4px' }}
          >
            {isEmpty ? (
              /* Empty state */
              <div>
                {/* Welcome */}
                <div
                  style={{
                    textAlign: 'center', marginBottom: 20, padding: '18px 16px',
                    background: 'var(--bb-bg-input)',
                    borderRadius: 14,
                    border: '1.5px solid var(--bb-border)',
                  }}
                >
                  <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                    <div
                      style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: 'var(--bb-nav-active-bg)',
                        border: '2px solid rgba(231,80,38,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <BrainBoardMark size={28} />
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--bb-text-primary)', marginBottom: 5 }}>
                    Hey, I'm BrainBoard AI
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--bb-text-muted)', lineHeight: 1.6 }}>
                    {wikiContext
                      ? <>Ask me anything about<br/><strong style={{ color: 'var(--bb-text-primary)' }}>"{wikiContext.title}"</strong></>
                      : <>Ask me anything about your issues, sprints,<br/>wiki pages, or team members.</>
                    }
                  </div>
                </div>

                {/* Suggestions */}
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--bb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                  Try asking
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTIONS.map((s) => (
                    <SuggestionChip
                      key={s}
                      text={s}
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) =>
                msg.role === 'user'
                  ? <UserBubble key={msg.id} msg={msg} />
                  : <AssistantBubble key={msg.id} msg={msg} />
              )
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── Input bar ── */}
          <div
            style={{
              padding: '10px 12px 12px',
              borderTop: '1px solid var(--bb-border)',
              flexShrink: 0,
              background: 'var(--bb-bg-card)',
            }}
          >
            {/* Scope badge */}
            {(wikiContext || projectName) && (
              <div style={{ marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    fontSize: 10, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 99,
                    background: 'var(--bb-nav-active-bg)',
                    color: '#E75026',
                    border: '1px solid rgba(231,80,38,0.2)',
                    maxWidth: 160, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={wikiContext ? wikiContext.title : projectName}
                >
                  {wikiContext ? (
                    <>📄 {wikiContext.title}</>
                  ) : projectName}
                </span>
                <span style={{ fontSize: 10, color: 'var(--bb-text-muted)' }}>
                  {wikiContext ? 'wiki context' : 'scoped'}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={inputRef}
                className="bb-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about issues, sprints, team…"
                disabled={isLoading}
                style={{
                  flex: 1,
                  borderRadius: 11,
                  border: '1.5px solid var(--bb-border)',
                  padding: '9px 13px',
                  fontSize: 13,
                  background: 'var(--bb-bg-input)',
                  color: 'var(--bb-text-primary)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                style={{
                  width: 40, height: 40, borderRadius: 11,
                  border: `1.5px solid ${canSend ? '#E75026' : 'var(--bb-border)'}`,
                  flexShrink: 0,
                  background: canSend ? '#E75026' : 'var(--bb-bg-input)',
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  boxShadow: canSend ? '0 2px 8px rgba(231,80,38,0.3)' : 'none',
                }}
                onMouseEnter={(e) => { if (canSend) e.currentTarget.style.background = '#C73F1A'; }}
                onMouseLeave={(e) => { if (canSend) e.currentTarget.style.background = '#E75026'; }}
              >
                <SendIcon color={canSend ? '#fff' : 'var(--bb-text-muted)'} />
              </button>
            </div>

            <div style={{ marginTop: 7, fontSize: 10, color: 'var(--bb-text-muted)', textAlign: 'center' }}>
              Read-only · Enter to send
            </div>
          </div>
        </div>
      )}
    </>
  );
}
