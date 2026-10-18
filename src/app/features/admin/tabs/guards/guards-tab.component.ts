import { Component, OnInit, Output, EventEmitter, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/ui/modal.component';
import { CrewService, SupervisorData, CrewMember } from '../../../../core/services/crew.service';
import { GuardsStore } from './guards.store';
import { finalize } from 'rxjs';
import { getEffectiveAvatar } from '../../../../shared/utils/avatar.util';

/**
 * Pestaña "Guardias" de Administración: supervisores G1-G4, sus operadores y vinculación.
 * Estilos en admin.component.scss (.admin-scope).
 */
@Component({
  selector: 'app-admin-guards-tab',
  // Muta estado en callbacks HTTP: requiere revisión en cada ciclo (Angular 22 usa OnPush por defecto)
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './guards-tab.component.html',
  // Sus bloques se comportan como hijos directos de .admin-page (mantiene el espaciado)
  host: { style: 'display: contents' }
})
export class AdminGuardsTabComponent implements OnInit {
  /** Mensajes para el aviso general de Administración */
  @Output() notify = new EventEmitter<{ text: string; ms: number }>();
  /** Abre la carga masiva por CSV (que vive en el padre) preseleccionando la guardia */
  @Output() openBulkImport = new EventEmitter<string>();

  private crewService = inject(CrewService);
  private guardsStore = inject(GuardsStore);

  getAvatar(url?: string | null, name?: string, role?: string, shift?: string): string {
    return getEffectiveAvatar(url, name, role, shift);
  }

  get supervisorsList(): SupervisorData[] { return this.guardsStore.supervisorsList; }
  get allAvailableOperators(): CrewMember[] { return this.guardsStore.allAvailableOperators; }
  get selectedSupervisor(): SupervisorData | null { return this.guardsStore.selectedSupervisor; }
  set selectedSupervisor(v: SupervisorData | null) { this.guardsStore.selectedSupervisor = v; }

  ngOnInit(): void {
    this.loadSupervisorsAndOperators();
  }

  loadSupervisorsAndOperators(): void {
    this.guardsStore.load();
  }

  // Supervisores y Operadores (Apartado Nuevo)
  supervisorSearchQuery = '';
  isAssignOperatorModalOpen = false;
  operatorToAssignId = '';
  operatorSearchQuery = '';
  isAutoAssigning = false;

  selectSupervisor(sup: SupervisorData): void {
    this.selectedSupervisor = sup;
  }

  openAssignOperatorModal(): void {
    this.operatorToAssignId = '';
    this.operatorSearchQuery = '';
    this.isAssignOperatorModalOpen = true;
  }

  confirmAssignOperator(): void {
    if (!this.selectedSupervisor || !this.operatorToAssignId) return;
    this.crewService.assignOperatorToSupervisor(this.selectedSupervisor.id, this.operatorToAssignId, this.selectedSupervisor.shift).subscribe({
      next: () => {
        this.isAssignOperatorModalOpen = false;
        this.loadSupervisorsAndOperators();
        this.notify.emit({ text: 'Operador vinculado a la cuadrilla exitosamente', ms: 4000 });
      }
    });
  }

  confirmRemoveOperator(operatorId: string, operatorName: string): void {
    if (!this.selectedSupervisor) return;
    if (confirm(`¿Confirma desvincular al operador ${operatorName} de la supervisión de ${this.selectedSupervisor.full_name}?`)) {
      this.crewService.removeOperatorFromSupervisor(this.selectedSupervisor.id, operatorId).subscribe({
        next: () => {
          this.loadSupervisorsAndOperators();
          this.notify.emit({ text: `Operador ${operatorName} desvinculado de la cuadrilla`, ms: 4000 });
        }
      });
    }
  }

  triggerAutoAssignByShift(): void {
    if (confirm('¿Desea auto-vincular automáticamente los operadores de cada guardia (G1 a G4) con sus respectivos supervisores oficiales?')) {
      this.isAutoAssigning = true;
      const timeoutSafety = setTimeout(() => {
        this.isAutoAssigning = false;
      }, 5000);

      this.crewService.autoAssignByShift().pipe(
        finalize(() => {
          clearTimeout(timeoutSafety);
          this.isAutoAssigning = false;
        })
      ).subscribe({
        next: () => {
          this.loadSupervisorsAndOperators();
          this.notify.emit({ text: 'Auto-asignación por guardia completada con éxito', ms: 5000 });
        },
        error: (err) => {
          console.warn('[Admin] Error en auto-asignación:', err);
        }
      });
    }
  }

  get unassignedOperatorsForSelectedSupervisor(): CrewMember[] {
    if (!this.selectedSupervisor) return [];
    const assignedIds = new Set(this.selectedSupervisor.operators.map(o => o.operator_id));
    let list = this.allAvailableOperators.filter(o => !assignedIds.has(o.id));
    if (this.operatorSearchQuery.trim()) {
      const q = this.operatorSearchQuery.toLowerCase().trim();
      list = list.filter(o => o.name.toLowerCase().includes(q) || o.document_id.includes(q) || (o.primary_role || '').toLowerCase().includes(q));
    }
    return list;
  }

  get filteredSupervisors(): SupervisorData[] {
    if (!this.supervisorSearchQuery.trim()) return this.supervisorsList;
    const q = this.supervisorSearchQuery.toLowerCase().trim();
    return this.supervisorsList.filter(s => 
      s.full_name.toLowerCase().includes(q) || 
      s.username.toLowerCase().includes(q) || 
      s.shift.toLowerCase().includes(q)
    );
  }

  getOperatorsForSelectedShift(): CrewMember[] {
    if (!this.selectedSupervisor) return [];
    return this.unassignedOperatorsForSelectedSupervisor.filter(o => o.shift_code === this.selectedSupervisor!.shift);
  }

  getOperatorsForOtherShifts(): CrewMember[] {
    if (!this.selectedSupervisor) return [];
    return this.unassignedOperatorsForSelectedSupervisor.filter(o => o.shift_code !== this.selectedSupervisor!.shift);
  }

  getSelectedOperatorForPreview(): CrewMember | undefined {
    if (!this.operatorToAssignId) return undefined;
    return this.allAvailableOperators.find(o => o.id === this.operatorToAssignId);
  }

  formatRoleName(role: string): string {
    switch (role) {
      case 'OPERADOR_BOMBAS': return 'Operador de Bombas';
      case 'OPERADOR_CICLONES_1': return 'Operador de Ciclones 1';
      case 'OPERADOR_CICLONES_2': return 'Operador de Ciclones 2';
      case 'OPERADOR_DISTRIBUIDOR': return 'Operador de Distribuidor';
      case 'OPERADOR_DESCARGA_1': return 'Operador de Descarga 1';
      case 'OPERADOR_DESCARGA_2': return 'Operador de Descarga 2';
      case 'OPERADOR_MISCELANEOS': return 'Operador Misceláneos';
      case 'SUPERVISOR': return 'Supervisor de Planta';
      default: return role || 'Operador';
    }
  }

  getGuardSquadProgress(s: SupervisorData): number {
    const count = s.operators_count || s.operators?.length || 0;
    return Math.min(100, Math.round((count / 7) * 100));
  }
}
