import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, catchError, map } from 'rxjs';
import { getApiBaseUrl } from '../constants/api.config';
import { getRealtimeData, saveRealtimeData } from '../storage/local-store.util';

export interface PlantParameters {
  // 1. Metas Generales de Producción & Turnos
  plant_name: string;
  tonnage_target_shift: number;
  nominal_feed_rate_tph: number;
  shift_day_hours: string;
  shift_night_hours: string;

  // 2. Control Metalúrgico & Baterías de Ciclones
  cyclones_target_mesh200_of: number;
  cyclones_min_mesh200_of: number;
  cyclones_target_solids_uf: number;
  cyclones_feed_pressure_min: number;
  cyclones_feed_pressure_max: number;
  cyclones_feed_density_nominal: number;

  // 3. Transporte de Pulpa & Sentinas
  pumps_slurry_flow_target: number;
  pumps_critical_pressure_psi: number;
  sump_high_level_warning: number;
  sump_critical_level_danger: number;

  // 4. Depósito de Relaves & Presa de Agua
  tailings_min_freeboard_meters: number;
  tailings_max_dam_level_msnm: number;
  tailings_max_piezometer_kpa: number;
  tailings_solids_nominal_pct: number;

  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_PLANT_PARAMETERS: PlantParameters = {
  plant_name: 'Planta Concentradora San Rafael',
  tonnage_target_shift: 24500,
  nominal_feed_rate_tph: 2040,
  shift_day_hours: '07:00 - 19:00',
  shift_night_hours: '19:00 - 07:00',

  cyclones_target_mesh200_of: 80.0,
  cyclones_min_mesh200_of: 75.0,
  cyclones_target_solids_uf: 70.0,
  cyclones_feed_pressure_min: 12.0,
  cyclones_feed_pressure_max: 16.0,
  cyclones_feed_density_nominal: 1520,

  pumps_slurry_flow_target: 1850,
  pumps_critical_pressure_psi: 85.0,
  sump_high_level_warning: 80.0,
  sump_critical_level_danger: 92.0,

  tailings_min_freeboard_meters: 2.5,
  tailings_max_dam_level_msnm: 4450.0,
  tailings_max_piezometer_kpa: 120.0,
  tailings_solids_nominal_pct: 62.0,

  updated_at: new Date().toISOString(),
  updated_by: 'Administración'
};

const STORAGE_KEY = 'plant_parameters';

@Injectable({
  providedIn: 'root'
})
export class PlantParametersService {
  private http = inject(HttpClient);

  // Reactive Signal for instant reactivity across all modules
  readonly parameters = signal<PlantParameters>(this.getInitialParameters());

  // High-level computed targets
  readonly tonnageTarget = computed(() => this.parameters().tonnage_target_shift);
  readonly minFreeboard = computed(() => this.parameters().tailings_min_freeboard_meters);
  readonly targetMesh200 = computed(() => this.parameters().cyclones_target_mesh200_of);
  readonly feedPressureRange = computed(() => `${this.parameters().cyclones_feed_pressure_min} - ${this.parameters().cyclones_feed_pressure_max} PSI`);

  constructor() {
    this.fetchFromBackend().subscribe();
  }

  private getInitialParameters(): PlantParameters {
    const cached = getRealtimeData<PlantParameters | null>(STORAGE_KEY, null);
    if (cached && typeof cached === 'object' && cached.tonnage_target_shift) {
      return { ...DEFAULT_PLANT_PARAMETERS, ...cached };
    }
    return DEFAULT_PLANT_PARAMETERS;
  }

  fetchFromBackend(): Observable<PlantParameters> {
    return this.http.get<{ success: boolean; data: PlantParameters }>(`${getApiBaseUrl()}/admin/plant-parameters`).pipe(
      map(res => {
        if (res && res.success && res.data) {
          const merged = { ...DEFAULT_PLANT_PARAMETERS, ...res.data };
          this.parameters.set(merged);
          saveRealtimeData(STORAGE_KEY, merged);
          return merged;
        }
        return this.parameters();
      }),
      catchError(() => of(this.parameters()))
    );
  }

  saveParameters(params: PlantParameters): Observable<{ success: boolean; message: string; data: PlantParameters }> {
    const payload: PlantParameters = {
      ...params,
      updated_at: new Date().toISOString()
    };

    // Update locally and in realtime storage immediately
    this.parameters.set(payload);
    saveRealtimeData(STORAGE_KEY, payload);

    return this.http.put<{ success: boolean; message: string; data: PlantParameters }>(
      `${getApiBaseUrl()}/admin/plant-parameters`,
      payload
    ).pipe(
      tap(res => {
        if (res && res.data) {
          this.parameters.set(res.data);
          saveRealtimeData(STORAGE_KEY, res.data);
        }
      }),
      catchError(() => of({
        success: true,
        message: 'Parámetros de planta guardados localmente y en memoria operativa.',
        data: payload
      }))
    );
  }

  resetToDefaults(): Observable<{ success: boolean; message: string; data: PlantParameters }> {
    return this.saveParameters({
      ...DEFAULT_PLANT_PARAMETERS,
      updated_at: new Date().toISOString(),
      updated_by: 'Restablecimiento de Fábrica'
    });
  }
}
