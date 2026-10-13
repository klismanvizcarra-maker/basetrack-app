import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('BASETRACK APP');

  ngOnInit(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      // Purge any bloated sync_queue (> 50KB) created by prior circular loops
      try {
        const syncQueueRaw = localStorage.getItem('basetrack_sync_queue');
        if (syncQueueRaw && syncQueueRaw.length > 50000) {
          console.warn('[App] Purgando basetrack_sync_queue sobredimensionada');
          localStorage.removeItem('basetrack_sync_queue');
        }
      } catch {}

      // Clean up any oversized localStorage keys (> 500KB) to prevent storage freeze
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('basetrack_')) {
            const val = localStorage.getItem(k);
            if (val && val.length > 500000) {
              keysToRemove.push(k);
            }
          }
        }
        for (const k of keysToRemove) {
          console.warn(`[App] Purgando clave sobredimensionada: ${k}`);
          localStorage.removeItem(k);
        }
      } catch {}

      const RESET_KEY = 'basetrack_clean_slate_v7_oct02';
      if (!localStorage.getItem(RESET_KEY)) {
        const preserveKeys = [
          'basetrack_token',
          'basetrack_auth_token',
          'basetrack_user',
          'basetrack_active_user',
          'basetrack_theme'
        ];
        const preserved: Record<string, string> = {};
        for (const k of preserveKeys) {
          const val = localStorage.getItem(k);
          if (val) preserved[k] = val;
        }

        localStorage.clear();

        for (const [k, val] of Object.entries(preserved)) {
          localStorage.setItem(k, val);
        }
        localStorage.setItem(RESET_KEY, 'active');

        if (window.indexedDB) {
          try {
            window.indexedDB.deleteDatabase('basetrack_db');
            window.indexedDB.deleteDatabase('basetrack_offline_db');
          } catch (e) {
            console.warn('[App] Error limpiando IndexedDB antigua:', e);
          }
        }
      }
    }
  }
}

