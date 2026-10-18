import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlantParametersService, PlantParameters, DEFAULT_PLANT_PARAMETERS } from '../../../../core/services/plant-parameters.service';

/**
 * Pestaña "Parámetros de Planta" de Administración: metas de producción, control metalúrgico,
 * bombas y presa de relaves. Solo recarga ante cambios remotos de los propios parámetros, para no
 * descartar ediciones sin guardar cuando llegan eventos de otros módulos.
 * Los estilos viven en admin.component.scss (.admin-scope).
 */
@Component({
  selector: 'app-admin-plant-parameters-tab',
  // Muta estado en callbacks HTTP: requiere revisión en cada ciclo (Angular 22 usa OnPush por defecto)
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plant-parameters-tab.component.html'
})
export class AdminPlantParametersTabComponent implements OnInit, OnDestroy {
  plantParamsService = inject(PlantParametersService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Parámetros de Planta & Metas Operacionales
  editablePlantParams: PlantParameters = { ...DEFAULT_PLANT_PARAMETERS };
  isSavingPlantParams = false;
  plantParamsSuccessMessage = '';
  plantParamsErrorMessage = '';

  private syncListener = (e: any) => {
    if (e.detail?.source === 'local') return;
    const ent = (e.detail?.entity || '').toLowerCase();
    const key = (e.detail?.key || '').toLowerCase();
    if (ent.includes('param') || ent.includes('planta') || key.includes('param')) {
      this.ngZone.run(() => {
        this.loadPlantParameters();
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    }
  };

  ngOnInit(): void {
    this.loadPlantParameters();
    if (typeof window !== 'undefined') {
      window.addEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('basetrack_cloud_sync', this.syncListener);
    }
  }

  loadPlantParameters(): void {
    this.editablePlantParams = { ...this.plantParamsService.parameters() };
    this.plantParamsService.fetchFromBackend().subscribe(params => {
      if (params) {
        this.editablePlantParams = { ...params };
      }
    });
  }

  savePlantParameters(): void {
    this.isSavingPlantParams = true;
    this.plantParamsSuccessMessage = '';
    this.plantParamsErrorMessage = '';

    this.plantParamsService.saveParameters(this.editablePlantParams).subscribe({
      next: (res) => {
        this.isSavingPlantParams = false;
        if (res && res.data) {
          this.editablePlantParams = { ...res.data };
        }
        this.plantParamsSuccessMessage = '¡Parámetros de planta y metas operacionales guardados con éxito!';
        setTimeout(() => this.plantParamsSuccessMessage = '', 6000);
      },
      error: (err) => {
        this.isSavingPlantParams = false;
        // El servicio revirtió los parámetros rechazados: el formulario vuelve al estado vigente
        this.editablePlantParams = { ...this.plantParamsService.parameters() };
        this.plantParamsErrorMessage = err?.error?.message || err?.message || 'Error al guardar los parámetros.';
        setTimeout(() => this.plantParamsErrorMessage = '', 6000);
      }
    });
  }

  resetPlantParametersToDefaults(): void {
    if (confirm('¿Confirmas restablecer todos los parámetros de planta a los valores nominales de fábrica?')) {
      this.isSavingPlantParams = true;
      this.plantParamsService.resetToDefaults().subscribe({
        next: (res) => {
          this.isSavingPlantParams = false;
          if (res && res.data) {
            this.editablePlantParams = { ...res.data };
          }
          this.plantParamsSuccessMessage = 'Parámetros restablecidos a los valores nominales de fábrica.';
          setTimeout(() => this.plantParamsSuccessMessage = '', 6000);
        },
        error: (err) => {
          this.isSavingPlantParams = false;
          this.editablePlantParams = { ...this.plantParamsService.parameters() };
          this.plantParamsErrorMessage = err?.message || 'Error al restablecer los parámetros.';
          setTimeout(() => this.plantParamsErrorMessage = '', 6000);
        }
      });
    }
  }
}
