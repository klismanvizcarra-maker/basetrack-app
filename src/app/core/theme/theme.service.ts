import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeToggleOrigin {
  clientX?: number;
  clientY?: number;
  target?: EventTarget | null;
}

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

  // Track initialization to avoid jarring animation on cold load
  private isInitialized = false;
  private isTransitioning = false;

  constructor() {
    this.initTheme();
    this.isInitialized = true;
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
          this.executeThemeChange(e.matches, 'auto', undefined);
        }
      };
      this.mediaQuery.addEventListener('change', this.mediaListener);
    }

    const mode = this.themeMode();
    const isDark = this.resolveIsDark(mode);
    this.updateDomTheme(isDark);
  }

  private resolveIsDark(mode: ThemeMode): boolean {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return !!this.mediaQuery?.matches;
  }

  setThemeMode(mode: ThemeMode, origin?: MouseEvent | ThemeToggleOrigin): void {
    const targetDark = this.resolveIsDark(mode);

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.STORAGE_KEY, mode);
    }

    // If cold init, or dark state doesn't actually change, update signal without animation
    if (!this.isInitialized || targetDark === this.isDarkMode()) {
      this.themeMode.set(mode);
      return;
    }

    this.executeThemeChange(targetDark, mode, origin);
  }

  toggleTheme(origin?: MouseEvent | ThemeToggleOrigin): void {
    const current = this.isDarkMode();
    this.setThemeMode(current ? 'light' : 'dark', origin);
  }

  private executeThemeChange(
    targetDark: boolean,
    targetMode: ThemeMode,
    origin?: MouseEvent | ThemeToggleOrigin
  ): void {
    if (typeof document === 'undefined') {
      this.updateDomTheme(targetDark);
      this.themeMode.set(targetMode);
      return;
    }

    // Respect user's reduced-motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const supportsViewTransition =
      typeof (document as any).startViewTransition === 'function' &&
      !prefersReducedMotion;

    if (supportsViewTransition) {
      this.performViewTransition(targetDark, targetMode, origin);
    } else {
      this.performClassTransition(targetDark, targetMode, prefersReducedMotion);
    }
  }

  private performViewTransition(
    targetDark: boolean,
    targetMode: ThemeMode,
    origin?: MouseEvent | ThemeToggleOrigin
  ): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const root = document.documentElement;

    // Calculate origin coordinates for the circular reveal
    const coords = this.getOriginCoordinates(origin);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxRadius = Math.ceil(Math.hypot(Math.max(coords.x, w - coords.x), Math.max(coords.y, h - coords.y)));

    root.style.setProperty('--theme-x', `${Math.round(coords.x)}px`);
    root.style.setProperty('--theme-y', `${Math.round(coords.y)}px`);
    root.style.setProperty('--theme-r', `${maxRadius}px`);
    root.classList.add('theme-vt-active');

    try {
      const transition = (document as any).startViewTransition(() => {
        this.updateDomTheme(targetDark);
        this.themeMode.set(targetMode);
      });

      transition.finished
        .catch(() => {})
        .finally(() => {
          root.classList.remove('theme-vt-active');
          this.isTransitioning = false;
        });
    } catch {
      root.classList.remove('theme-vt-active');
      this.isTransitioning = false;
      this.performClassTransition(targetDark, targetMode, false);
    }
  }

  private performClassTransition(
    targetDark: boolean,
    targetMode: ThemeMode,
    reducedMotion: boolean
  ): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const root = document.documentElement;

    if (!reducedMotion) {
      root.classList.add('theme-smooth-transition');
    }

    this.updateDomTheme(targetDark);
    this.themeMode.set(targetMode);

    if (!reducedMotion) {
      window.setTimeout(() => {
        root.classList.remove('theme-smooth-transition');
        this.isTransitioning = false;
      }, 450);
    } else {
      this.isTransitioning = false;
    }
  }

  private getOriginCoordinates(origin?: MouseEvent | ThemeToggleOrigin): { x: number; y: number } {
    let x = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    let y = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

    if (!origin) {
      return { x, y };
    }

    if (origin.target && typeof (origin.target as HTMLElement).getBoundingClientRect === 'function') {
      const el = origin.target as HTMLElement;
      const targetBtn = el.closest('button, .theme-option-box, .sidebar-theme-row, .hub-action-btn') || el;
      const rect = targetBtn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
    }

    if (typeof origin.clientX === 'number' && origin.clientX > 0) {
      return { x: origin.clientX, y: origin.clientY || 0 };
    }

    return { x, y };
  }

  private updateDomTheme(isDark: boolean): void {
    this.isDarkMode.set(isDark);

    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark-theme', 'dark');
      body.classList.add('dark-theme', 'dark');
      this.updateMetaThemeColor('#0a0f1d');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark-theme', 'dark');
      body.classList.remove('dark-theme', 'dark');
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
