import { describe, it, expect, beforeEach } from 'vitest';
import useAppStore from '@/store/useAppStore';

beforeEach(() => {
  useAppStore.setState({
    paletteOpen: false,
    theme: 'light',
    semanticEnabled: false,
    showLoginSplash: false,
    splashReady: false,
  });
  localStorage.clear();
});

describe('useAppStore', () => {
  describe('palette', () => {
    it('starts closed', () => {
      expect(useAppStore.getState().paletteOpen).toBe(false);
    });

    it('togglePalette opens and closes', () => {
      useAppStore.getState().togglePalette();
      expect(useAppStore.getState().paletteOpen).toBe(true);
      useAppStore.getState().togglePalette();
      expect(useAppStore.getState().paletteOpen).toBe(false);
    });

    it('closePalette sets paletteOpen to false', () => {
      useAppStore.setState({ paletteOpen: true });
      useAppStore.getState().closePalette();
      expect(useAppStore.getState().paletteOpen).toBe(false);
    });
  });

  describe('theme', () => {
    it('toggleTheme switches light → dark', () => {
      useAppStore.setState({ theme: 'light' });
      useAppStore.getState().toggleTheme();
      expect(useAppStore.getState().theme).toBe('dark');
    });

    it('toggleTheme switches dark → light', () => {
      useAppStore.setState({ theme: 'dark' });
      useAppStore.getState().toggleTheme();
      expect(useAppStore.getState().theme).toBe('light');
    });

    it('persists theme to localStorage', () => {
      useAppStore.setState({ theme: 'light' });
      useAppStore.getState().toggleTheme();
      expect(localStorage.getItem('bb-theme')).toBe('dark');
    });
  });

  describe('semanticEnabled', () => {
    it('starts disabled', () => {
      expect(useAppStore.getState().semanticEnabled).toBe(false);
    });

    it('toggleSemantic enables then disables', () => {
      useAppStore.getState().toggleSemantic();
      expect(useAppStore.getState().semanticEnabled).toBe(true);
      useAppStore.getState().toggleSemantic();
      expect(useAppStore.getState().semanticEnabled).toBe(false);
    });

    it('persists semanticEnabled to localStorage', () => {
      useAppStore.getState().toggleSemantic();
      expect(localStorage.getItem('bb-semantic')).toBe('true');
    });
  });

  describe('login splash', () => {
    it('triggerLoginSplash sets showLoginSplash true and splashReady false', () => {
      useAppStore.getState().triggerLoginSplash();
      expect(useAppStore.getState().showLoginSplash).toBe(true);
      expect(useAppStore.getState().splashReady).toBe(false);
    });

    it('signalSplashReady sets splashReady true', () => {
      useAppStore.getState().triggerLoginSplash();
      useAppStore.getState().signalSplashReady();
      expect(useAppStore.getState().splashReady).toBe(true);
    });

    it('hideLoginSplash resets both flags', () => {
      useAppStore.getState().triggerLoginSplash();
      useAppStore.getState().signalSplashReady();
      useAppStore.getState().hideLoginSplash();
      expect(useAppStore.getState().showLoginSplash).toBe(false);
      expect(useAppStore.getState().splashReady).toBe(false);
    });
  });
});
