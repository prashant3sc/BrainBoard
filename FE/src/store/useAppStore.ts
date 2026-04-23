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
  paletteOpen:     boolean;
  theme:           'light' | 'dark';
  semanticEnabled: boolean;
  togglePalette:   () => void;
  closePalette:    () => void;
  toggleTheme:     () => void;
  toggleSemantic:  () => void;
}

const useAppStore = create<AppState>()((set) => ({
  paletteOpen:     false,
  theme:           getInitialTheme(),
  semanticEnabled: getInitialSemantic(),

  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  closePalette:  () => set({ paletteOpen: false }),

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
