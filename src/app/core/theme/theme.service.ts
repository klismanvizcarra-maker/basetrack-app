import { Injectable, signal, computed, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'basetrack_theme_mode';

  // State: 'light' | 'dark' | 'auto'
  readonly themeMode = signal<ThemeMode>(this.getInitialThemeMode());

  // Actual active dark mode state
  readonly isDarkMode = signal<boolean>(false);

  // System media query matcher
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    this.initTheme();

    // Effect to apply theme whenever mode changes
    effect(() => {
      const mode = this.themeMode();
      this.applyTheme(mode);
    });
  }

  private getInitialThemeMode(): ThemeMode {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'light';
    }
    const saved = localStorage.getItem(this.STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
    return 'light';
  }

  private initTheme(): void {
    if (typeof window === 'undefined') return;

    if (window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaListener = (e: MediaQueryListEvent) => {
        if (this.themeMode() === 'auto') {
          this.updateDomTheme(e.matches);
        }
      };
      this.mediaQuery.addEventListener('change', this.mediaListener);
    }

    this.applyTheme(this.themeMode());
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeMode.set(mode);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_KEY, mode);
    }
  }

  toggleTheme(): void {
    const current = this.isDarkMode();
    this.setThemeMode(current ? 'light' : 'dark');
  }

  private applyTheme(mode: ThemeMode): void {
    if (typeof window === 'undefined') return;

    let dark = false;
    if (mode === 'dark') {
      dark = true;
    } else if (mode === 'light') {
      dark = false;
    } else if (mode === 'auto') {
      dark = !!this.mediaQuery?.matches;
    }

    this.updateDomTheme(dark);
  }

  private updateDomTheme(isDark: boolean): void {
    this.isDarkMode.set(isDark);

    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark-theme');
      body.classList.add('dark-theme');
      this.updateMetaThemeColor('#0a0f1d');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark-theme');
      body.classList.remove('dark-theme');
      this.updateMetaThemeColor('#031795');
    }
  }

  private updateMetaThemeColor(color: string): void {
    if (typeof document === 'undefined') return;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  }
}
