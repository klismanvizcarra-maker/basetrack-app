import { Injectable, signal } from '@angular/core';

export type PlatformType = 'ios' | 'android' | 'mac' | 'windows' | 'pc';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private deferredPrompt: any = null;

  // Reactive state signals
  public canInstall = signal<boolean>(false);
  public isInstalled = signal<boolean>(false);
  public isIOS = signal<boolean>(false);
  public platform = signal<PlatformType>('pc');
  public isDismissed = signal<boolean>(false);
  public showInstallModal = signal<boolean>(false);

  constructor() {
    this.checkIfInstalled();
    this.detectPlatform();
    this.listenToInstallPrompt();
  }

  private checkIfInstalled(): void {
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                           (window.navigator as any).standalone === true;
      this.isInstalled.set(isStandalone);
    }
  }

  private detectPlatform(): void {
    if (typeof window !== 'undefined') {
      const userAgent = (window.navigator.userAgent || '').toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent) || 
                          (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      const isAndroidDevice = /android/.test(userAgent);
      const isMacDevice = /macintosh|mac os x/.test(userAgent) && !isIosDevice;
      const isWindowsDevice = /windows|win32/.test(userAgent);

      this.isIOS.set(isIosDevice && !(window.navigator as any).standalone);

      if (isIosDevice) {
        this.platform.set('ios');
      } else if (isAndroidDevice) {
        this.platform.set('android');
      } else if (isMacDevice) {
        this.platform.set('mac');
      } else if (isWindowsDevice) {
        this.platform.set('windows');
      } else {
        this.platform.set('pc');
      }

      try {
        const dismissed = localStorage.getItem('basetrack_pwa_dismissed') === 'true';
        this.isDismissed.set(dismissed);
      } catch (e) {}
    }
  }

  private listenToInstallPrompt(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e: any) => {
        // Prevent default mini-infobar from appearing
        e.preventDefault();
        this.deferredPrompt = e;
        this.canInstall.set(true);
        console.log('[PWA] beforeinstallprompt event captured. PWA installable!');
      });

      window.addEventListener('appinstalled', () => {
        this.canInstall.set(false);
        this.isInstalled.set(true);
        this.deferredPrompt = null;
        console.log('[PWA] BASETRACK successfully installed on device!');
      });
    }
  }

  public async promptInstall(): Promise<boolean> {
    if (this.deferredPrompt) {
      try {
        this.deferredPrompt.prompt();
        const choiceResult = await this.deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted installation prompt');
          this.canInstall.set(false);
          this.deferredPrompt = null;
          return true;
        } else {
          console.log('[PWA] User dismissed installation prompt');
          return false;
        }
      } catch (err) {
        console.warn('[PWA] Error launching install prompt', err);
      }
    } else {
      // General instructions modal
      this.showInstallModal.set(true);
    }
    return false;
  }

  public openInstallModal(): void {
    this.showInstallModal.set(true);
  }

  public closeInstallModal(): void {
    this.showInstallModal.set(false);
  }

  public dismissInstallCard(): void {
    this.isDismissed.set(true);
    try {
      localStorage.setItem('basetrack_pwa_dismissed', 'true');
    } catch (e) {}
  }

  public resetDismissState(): void {
    this.isDismissed.set(false);
    try {
      localStorage.removeItem('basetrack_pwa_dismissed');
    } catch (e) {}
  }
}
