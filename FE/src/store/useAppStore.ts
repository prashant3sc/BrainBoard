import { create } from 'zustand';

function getInitialTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('bb-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function getInitialSemantic(): boolean {
  try {
    return localStorage.getItem('bb-semantic') === 'true';
  } catch {
    return false;
  }
}

interface AppState {
  paletteOpen:         boolean;
  theme:               'light' | 'dark';
  semanticEnabled:     boolean;
  showLoginSplash:     boolean;
  splashReady:         boolean;   // true when dashboard data is loaded → triggers exit
  togglePalette:       () => void;
  closePalette:        () => void;
  toggleTheme:         () => void;
  toggleSemantic:      () => void;
  triggerLoginSplash:  () => void; // call on login button click
  signalSplashReady:   () => void; // call when dashboard data is ready
  hideLoginSplash:     () => void; // call after exit animation finishes
}

const useAppStore = create<AppState>()((set) => ({
  paletteOpen:     false,
  theme:           getInitialTheme(),
  semanticEnabled: getInitialSemantic(),
  showLoginSplash: false,
  splashReady:     false,

  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  closePalette:  () => set({ paletteOpen: false }),
  triggerLoginSplash:  () => set({ showLoginSplash: true, splashReady: false }),
  signalSplashReady:   () => set({ splashReady: true }),
  hideLoginSplash:     () => set({ showLoginSplash: false, splashReady: false }),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('bb-theme', next); } catch { /* noop */ }
      return { theme: next };
    }),

  toggleSemantic: () =>
    set((s) => {
      const next = !s.semanticEnabled;
      try { localStorage.setItem('bb-semantic', String(next)); } catch { /* noop */ }
      return { semanticEnabled: next };
    }),
}));

export default useAppStore;
