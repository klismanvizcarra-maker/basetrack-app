import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly title = signal('BASETRACK APP');

  ngOnInit(): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
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

