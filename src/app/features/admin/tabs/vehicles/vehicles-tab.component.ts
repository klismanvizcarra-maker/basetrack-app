import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/ui/modal.component';
import { VehicleChecklistService, VehicleInfo } from '../../../../core/services/vehicle-checklist.service';

/**
 * Pestaña "Padrón de Camionetas" de Administración: altas, bajas, edición de placas y estado de la flota 4x4.
 * Los estilos viven en admin.component.scss (.admin-scope).
 */
@Component({
  selector: 'app-admin-vehicles-tab',
  // Muta estado en callbacks HTTP: requiere revisión en cada ciclo (Angular 22 usa OnPush por defecto)
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './vehicles-tab.component.html'
})
export class AdminVehiclesTabComponent implements OnInit, OnDestroy {
  private vehicleChecklistService = inject(VehicleChecklistService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Flota de Camionetas Mineras 4x4
  vehiclesList: VehicleInfo[] = [];
  isLoadingVehicles = false;
  vehiclesSearchQuery = '';
  vehiclesFilterStatus: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  isCreateVehicleModalOpen = false;
  isEditVehicleModalOpen = false;
  selectedVehicleForEdit: VehicleInfo | null = null;
  vehicleFormPlate = '';
  vehicleFormTag = '';
  vehicleFormModel = 'Toyota Hilux 4x4 Turbodiésel';
  vehicleFormColor = 'Blanco Industrial';
  vehicleFormArea = 'Supervisión de Operaciones';
  vehicleFormBaseOdometer = 0;
  vehicleFormIsActive = true;
  isSavingVehicle = false;
  vehicleActionSuccessMessage = '';
  vehicleActionErrorMessage = '';
  vehicleModalErrorMessage = '';

  get activeVehiclesCount(): number {
    return this.vehiclesList.filter(v => v.is_active !== 0 && v.is_active !== false).length;
  }

  get decommissionedVehiclesCount(): number {
    return this.vehiclesList.filter(v => v.is_active === 0 || v.is_active === false).length;
  }

  get totalFleetOdometer(): number {
    return this.vehiclesList.reduce((acc, v) => acc + (Number(v.currentOdometer) || Number(v.baseOdometer) || 0), 0);
  }

  get filteredVehiclesList(): VehicleInfo[] {
    return this.vehiclesList.filter(veh => {
      if (this.vehiclesFilterStatus === 'ACTIVE' && (veh.is_active === 0 || veh.is_active === false)) return false;
      if (this.vehiclesFilterStatus === 'INACTIVE' && (veh.is_active !== 0 && veh.is_active !== false)) return false;

      const q = (this.vehiclesSearchQuery || '').trim().toLowerCase();
      if (!q) return true;

      const matchesPlate = (veh.plate || '').toLowerCase().includes(q);
      const matchesTag = (veh.tag || '').toLowerCase().includes(q);
      const matchesModel = (veh.model || '').toLowerCase().includes(q);
      const matchesArea = (veh.area || '').toLowerCase().includes(q);
      const matchesDriver = (veh.lastDriverName || '').toLowerCase().includes(q);

      return matchesPlate || matchesTag || matchesModel || matchesArea || matchesDriver;
    });
  }

  private syncListener = (e: any) => {
    if (e.detail?.source === 'local') return;
    const ent = (e.detail?.entity || '').toLowerCase();
    const key = (e.detail?.key || '').toLowerCase();
    if (ent.includes('vehicle') || ent.includes('camioneta') || key.includes('vehicle')) {
      this.ngZone.run(() => {
        this.loadVehiclesFleet();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }
  };

  ngOnInit(): void {
    this.loadVehiclesFleet();
    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  loadVehiclesFleet(): void {
    this.isLoadingVehicles = true;
    this.vehicleChecklistService.getAllVehiclesAdmin().subscribe({
      next: (res) => {
        this.isLoadingVehicles = false;
        if (res && res.success && Array.isArray(res.data)) {
          this.vehiclesList = res.data;
        } else {
          this.vehiclesList = this.vehicleChecklistService.vehicles();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingVehicles = false;
        this.vehiclesList = this.vehicleChecklistService.vehicles();
        this.cdr.markForCheck();
      }
    });
  }

  openCreateVehicleModal(): void {
    this.vehicleFormPlate = '';
    const nextNum = this.vehiclesList.length + 1;
    this.vehicleFormTag = `CAM-${nextNum < 10 ? '0' + nextNum : nextNum}`;
    this.vehicleFormModel = 'Toyota Hilux 4x4 Turbodiésel';
    this.vehicleFormColor = 'Blanco Industrial';
    this.vehicleFormArea = 'Supervisión de Operaciones';
    this.vehicleFormBaseOdometer = 0;
    this.vehicleModalErrorMessage = '';
    this.isCreateVehicleModalOpen = true;
  }

  submitCreateVehicle(): void {
    const rawPlate = (this.vehicleFormPlate || '').toUpperCase().replace(/\s+/g, '').trim();
    if (!rawPlate || rawPlate.length < 3) {
      this.vehicleModalErrorMessage = 'La placa vehicular es obligatoria (mínimo 3 caracteres).';
      return;
    }

    this.isSavingVehicle = true;
    this.vehicleModalErrorMessage = '';

    this.vehicleChecklistService.createVehicle({
      plate: rawPlate,
      tag: (this.vehicleFormTag || '').toUpperCase().trim(),
      model: this.vehicleFormModel.trim(),
      color: this.vehicleFormColor.trim(),
      area: this.vehicleFormArea.trim(),
      baseOdometer: Number(this.vehicleFormBaseOdometer) || 0,
      is_active: 1
    }).subscribe({
      next: (res) => {
        this.isSavingVehicle = false;
        if (res && res.success) {
          this.isCreateVehicleModalOpen = false;
          this.vehicleActionSuccessMessage = `¡Camioneta ${rawPlate} dada de alta exitosamente en el padrón!`;
          setTimeout(() => this.vehicleActionSuccessMessage = '', 5000);
          this.loadVehiclesFleet();
        } else {
          this.vehicleModalErrorMessage = res?.message || 'Error al dar de alta la camioneta.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingVehicle = false;
        this.vehicleModalErrorMessage = err?.error?.message || err?.message || 'Error al comunicarse con el servidor.';
        this.cdr.markForCheck();
      }
    });
  }

  openEditVehicleModal(veh: VehicleInfo): void {
    this.selectedVehicleForEdit = veh;
    this.vehicleFormPlate = veh.plate;
    this.vehicleFormTag = veh.tag;
    this.vehicleFormModel = veh.model;
    this.vehicleFormColor = veh.color;
    this.vehicleFormArea = veh.area;
    this.vehicleFormBaseOdometer = veh.baseOdometer;
    this.vehicleFormIsActive = veh.is_active !== 0 && veh.is_active !== false;
    this.vehicleModalErrorMessage = '';
    this.isEditVehicleModalOpen = true;
  }

  submitEditVehicle(): void {
    if (!this.selectedVehicleForEdit) return;

    const rawPlate = (this.vehicleFormPlate || '').toUpperCase().replace(/\s+/g, '').trim();
    if (!rawPlate || rawPlate.length < 3) {
      this.vehicleModalErrorMessage = 'La placa vehicular es obligatoria.';
      return;
    }

    this.isSavingVehicle = true;
    this.vehicleModalErrorMessage = '';

    const idOrPlate = this.selectedVehicleForEdit.id || this.selectedVehicleForEdit.plate;

    this.vehicleChecklistService.updateVehicle(idOrPlate, {
      plate: rawPlate,
      tag: (this.vehicleFormTag || '').toUpperCase().trim(),
      model: this.vehicleFormModel.trim(),
      color: this.vehicleFormColor.trim(),
      area: this.vehicleFormArea.trim(),
      baseOdometer: Number(this.vehicleFormBaseOdometer) || 0,
      is_active: this.vehicleFormIsActive ? 1 : 0
    }).subscribe({
      next: (res) => {
        this.isSavingVehicle = false;
        if (res && res.success) {
          this.isEditVehicleModalOpen = false;
          this.vehicleActionSuccessMessage = `¡Camioneta ${rawPlate} actualizada con éxito en el padrón!`;
          setTimeout(() => this.vehicleActionSuccessMessage = '', 5000);
          this.loadVehiclesFleet();
        } else {
          this.vehicleModalErrorMessage = res?.message || 'Error al actualizar la camioneta.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingVehicle = false;
        this.vehicleModalErrorMessage = err?.error?.message || err?.message || 'Error al actualizar datos.';
        this.cdr.markForCheck();
      }
    });
  }

  toggleVehicleActiveStatus(veh: VehicleInfo): void {
    const isCurrentlyActive = veh.is_active !== 0 && veh.is_active !== false;
    const confirmMsg = isCurrentlyActive
      ? `¿Estás seguro de dar de baja la camioneta ${veh.plate} (${veh.tag})? Ya no estará disponible para realizar checklists en terreno.`
      : `¿Deseas reactivar la camioneta ${veh.plate} (${veh.tag}) en el padrón operacional?`;

    if (!confirm(confirmMsg)) return;

    const idOrPlate = veh.id || veh.plate;
    this.vehicleChecklistService.toggleVehicleStatus(idOrPlate, !isCurrentlyActive).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.vehicleActionSuccessMessage = `Camioneta ${veh.plate} ${isCurrentlyActive ? 'dada de baja' : 'reactivada'} exitosamente.`;
          setTimeout(() => this.vehicleActionSuccessMessage = '', 5000);
          this.loadVehiclesFleet();
        }
      },
      error: (err) => {
        this.vehicleActionErrorMessage = err?.error?.message || 'Error al cambiar estado de la unidad.';
        setTimeout(() => this.vehicleActionErrorMessage = '', 5000);
      }
    });
  }

  deleteVehicleFromFleet(veh: VehicleInfo): void {
    if (!confirm(`¿Deseas eliminar la camioneta ${veh.plate} (${veh.tag}) del padrón? Si tiene inspecciones registradas, se dará de baja automáticamente para resguardar la trazabilidad.`)) {
      return;
    }

    const idOrPlate = veh.id || veh.plate;
    this.vehicleChecklistService.deleteVehicle(idOrPlate).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.vehicleActionSuccessMessage = res.message || `Camioneta ${veh.plate} procesada del padrón.`;
          setTimeout(() => this.vehicleActionSuccessMessage = '', 5000);
          this.loadVehiclesFleet();
        }
      },
      error: (err) => {
        this.vehicleActionErrorMessage = err?.error?.message || 'Error al eliminar unidad.';
        setTimeout(() => this.vehicleActionErrorMessage = '', 5000);
      }
    });
  }
}
