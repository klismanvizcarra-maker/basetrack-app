import { Injectable, inject, signal } from '@angular/core';
import { CrewService, SupervisorData, CrewMember } from '../../../../core/services/crew.service';

/**
 * Guardias (supervisores con sus operadores) compartidas entre Administración —contador de la
 * pestaña y modal de importación— y AdminGuardsTabComponent.
 */
@Injectable({ providedIn: 'root' })
export class GuardsStore {
  private crewService = inject(CrewService);
  private supervisorsSignal = signal<SupervisorData[]>([]);
  private operatorsSignal = signal<CrewMember[]>([]);
  private selectedSignal = signal<SupervisorData | null>(null);

  get supervisorsList(): SupervisorData[] { return this.supervisorsSignal(); }
  set supervisorsList(v: SupervisorData[]) { this.supervisorsSignal.set(v); }
  get allAvailableOperators(): CrewMember[] { return this.operatorsSignal(); }
  set allAvailableOperators(v: CrewMember[]) { this.operatorsSignal.set(v); }
  get selectedSupervisor(): SupervisorData | null { return this.selectedSignal(); }
  set selectedSupervisor(v: SupervisorData | null) { this.selectedSignal.set(v); }

  /** Precarga síncrona desde caché (0 ms) para Vercel y móviles */
  initFromCache(): void {
    const initialGuards = this.crewService.loadCachedSupervisorOperators();
    this.supervisorsList = initialGuards;
    this.selectedSupervisor = initialGuards[0] || null;
    this.allAvailableOperators = this.crewService.defaultMembers.filter(m => m.primary_role !== 'SUPERVISOR');
  }

  clear(): void {
    this.supervisorsList = [];
    this.allAvailableOperators = [];
    this.selectedSupervisor = null;
  }

  load(): void {
    const fallbackGuards = this.crewService.loadCachedSupervisorOperators();
    if (!this.supervisorsList || this.supervisorsList.length === 0) {
      this.supervisorsList = fallbackGuards;
      this.allAvailableOperators = this.crewService.allMembers().filter(m => m.primary_role !== 'SUPERVISOR');
      if (!this.selectedSupervisor && fallbackGuards.length > 0) {
        this.selectedSupervisor = fallbackGuards[0];
      }
    }

    this.crewService.loadSupervisorOperators().subscribe(res => {
      const list = res?.supervisors ? res.supervisors : [];
      this.supervisorsList = list;
      this.allAvailableOperators = (res?.all_operators && res.all_operators.length > 0) 
        ? res.all_operators 
        : (this.crewService.allMembers().length > 0 ? this.crewService.allMembers().filter(m => m.primary_role !== 'SUPERVISOR') : []);
      if (!this.selectedSupervisor && this.supervisorsList.length > 0) {
        this.selectedSupervisor = this.supervisorsList[0];
      } else if (this.selectedSupervisor) {
        const updated = this.supervisorsList.find(s => s.id === this.selectedSupervisor!.id || s.username === this.selectedSupervisor!.username);
        this.selectedSupervisor = updated || (this.supervisorsList.length > 0 ? this.supervisorsList[0] : null);
      } else {
        this.selectedSupervisor = null;
      }
    });
  }
}
