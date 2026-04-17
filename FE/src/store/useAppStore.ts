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

interface AppState {
  paletteOpen: boolean;
  theme: 'light' | 'dark';
  togglePalette: () => void;
  closePalette:  () => void;
  toggleTheme:   () => void;
}

const useAppStore = create<AppState>()((set) => ({
  paletteOpen: false,
  theme: getInitialTheme(),

  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  closePalette:  () => set({ paletteOpen: false }),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('bb-theme', next); } catch { /* noop */ }
      return { theme: next };
    }),
}));

export default useAppStore;
