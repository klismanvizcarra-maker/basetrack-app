import { Component, OnInit, OnDestroy, inject, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditLogStore } from './audit-log.store';

/** Pestaña "Bitácora de Auditoría" de Administración. Estilos en admin.component.scss (.admin-scope). */
@Component({
  selector: 'app-admin-audit-logs-tab',
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audit-logs-tab.component.html'
})
export class AdminAuditLogsTabComponent implements OnInit, OnDestroy {
  private store = inject(AuditLogStore);
  private ngZone = inject(NgZone);
  private reloadTimer?: ReturnType<typeof setTimeout>;

  get logs() {
    return this.store.logs();
  }

  // Casi cualquier cambio remoto genera un evento de auditoría: se recarga agrupando ráfagas
  private syncListener = (e: any) => {
    if (e.detail?.source === 'local') return;
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => this.ngZone.run(() => this.store.load()), 800);
  };

  ngOnInit(): void {
    this.store.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.reloadTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }
}
