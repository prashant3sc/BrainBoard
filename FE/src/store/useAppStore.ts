import { create } from 'zustand';

interface AppState {
  paletteOpen: boolean;
  togglePalette: () => void;
  closePalette: () => void;
}

const useAppStore = create<AppState>()((set) => ({
  paletteOpen: false,
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  closePalette:  () => set({ paletteOpen: false }),
}));

export default useAppStore;
