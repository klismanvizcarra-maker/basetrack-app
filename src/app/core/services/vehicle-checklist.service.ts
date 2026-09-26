import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { getApiBaseUrl } from '../constants/api.config';
import { getRealtimeData, saveRealtimeData } from '../storage/local-store.util';
import { CloudSyncService } from './cloud-sync.service';

export interface VehicleInfo {
  plate: 'BMC715' | 'BKS921' | 'BKS913' | 'BPS747';
  tag: string;
  model: string;
  color: string;
  area: string;
  baseOdometer: number;
  currentOdometer: number;
  lastChecklistDate: string | null;
  lastChecklistTime: string | null;
  lastDriverName: string | null;
  lastOperationalStatus: 'APTO' | 'OBSERVADO' | 'NO_APTO';
  totalChecklists: number;
}

export interface InspectionCheckItem {
  id: string;
  category: string;
  name: string;
  status: 'B' | 'M' | 'NA'; // Bueno, Malo, No Aplica
  observation?: string;
}

export interface VehicleChecklist {
  id: string;
  vehicle_plate: 'BMC715' | 'BKS921' | 'BKS913' | 'BPS747';
  date: string;
  time: string;
  shift: 'G1' | 'G2' | 'G3' | 'G4';
  shift_type: 'DIA' | 'NOCHE';
  driver_name: string;
  driver_dni: string;
  driver_license?: string;
  odometer: number;
  items: InspectionCheckItem[];
  has_observations: boolean;
  observation_notes?: string;
  photo_url?: string;
  operational_status: 'APTO' | 'OBSERVADO' | 'NO_APTO';
  created_at?: string;
}

export const OFFICIAL_VEHICLES_METADATA: VehicleInfo[] = [
  {
    plate: 'BMC715',
    tag: 'CAM-01',
    model: 'Toyota Hilux 4x4 Turbodiésel',
    color: 'Blanco Industrial',
    area: 'Supervisión de Operaciones',
    baseOdometer: 48250,
    currentOdometer: 48250,
    lastChecklistDate: null,
    lastChecklistTime: null,
    lastDriverName: null,
    lastOperationalStatus: 'APTO',
    totalChecklists: 0
  },
  {
    plate: 'BKS921',
    tag: 'CAM-02',
    model: 'Toyota Hilux 4x4 Turbodiésel',
    color: 'Blanco Industrial',
    area: 'Operaciones Bombas / Molienda',
    baseOdometer: 53120,
    currentOdometer: 53120,
    lastChecklistDate: null,
    lastChecklistTime: null,
    lastDriverName: null,
    lastOperationalStatus: 'APTO',
    totalChecklists: 0
  },
  {
    plate: 'BKS913',
    tag: 'CAM-03',
    model: 'Toyota Hilux 4x4 Turbodiésel',
    color: 'Blanco Industrial',
    area: 'Operaciones Ciclones / Planta',
    baseOdometer: 39800,
    currentOdometer: 39800,
    lastChecklistDate: null,
    lastChecklistTime: null,
    lastDriverName: null,
    lastOperationalStatus: 'APTO',
    totalChecklists: 0
  },
  {
    plate: 'BPS747',
    tag: 'CAM-04',
    model: 'Toyota Hilux 4x4 Turbodiésel',
    color: 'Blanco Industrial',
    area: 'Presa de Relaves / Auxiliares',
    baseOdometer: 61400,
    currentOdometer: 61400,
    lastChecklistDate: null,
    lastChecklistTime: null,
    lastDriverName: null,
    lastOperationalStatus: 'APTO',
    totalChecklists: 0
  }
];

export const DEFAULT_INSPECTION_ITEMS: InspectionCheckItem[] = [
  // 1. Luces y Sistema Eléctrico
  { id: 'luces_principales', category: 'Luces y Eléctrico', name: 'Luces altas, bajas y de posición', status: 'B' },
  { id: 'luces_freno_retro', category: 'Luces y Eléctrico', name: 'Luces de freno y marcha atrás (retro)', status: 'B' },
  { id: 'direccionales_intermitentes', category: 'Luces y Eléctrico', name: 'Luces direccionales e intermitentes de emergencia', status: 'B' },
  { id: 'circulina_pertiga', category: 'Luces y Eléctrico', name: 'Circulina estroboscópica y pértiga con luz LED', status: 'B' },
  { id: 'alarma_retroceso_bocina', category: 'Luces y Eléctrico', name: 'Alarma sonora de retroceso y bocina de cabina', status: 'B' },
  { id: 'faros_neblineros', category: 'Luces y Eléctrico', name: 'Faros neblineros frontales operativos', status: 'B' },

  // 2. Niveles de Fluidos y Mecánica
  { id: 'nivel_aceite_motor', category: 'Niveles y Motor', name: 'Nivel y estado de aceite de motor (varilla)', status: 'B' },
  { id: 'nivel_refrigerante', category: 'Niveles y Motor', name: 'Nivel de refrigerante en depósito / radiador', status: 'B' },
  { id: 'liquido_frenos_embrague', category: 'Niveles y Motor', name: 'Nivel de líquido de frenos y embrague', status: 'B' },
  { id: 'direccion_hidraulica', category: 'Niveles y Motor', name: 'Líquido de dirección hidráulica sin fugas', status: 'B' },
  { id: 'fugas_visibles', category: 'Niveles y Motor', name: 'Inspección inferior libre de goteos o fugas visibles', status: 'B' },

  // 3. Neumáticos y Rodamiento
  { id: 'presion_neumaticos', category: 'Neumáticos', name: 'Presión de inflado en las 4 ruedas (32-35 PSI)', status: 'B' },
  { id: 'cocada_desgaste', category: 'Neumáticos', name: 'Profundidad de cocada / banda de rodamiento adecuada', status: 'B' },
  { id: 'neumatico_repuesto', category: 'Neumáticos', name: 'Neumático de repuesto con presión correcta', status: 'B' },
  { id: 'ajuste_tuercas', category: 'Neumáticos', name: 'Espárragos y tuercas completas con seguro/torque', status: 'B' },

  // 4. Cabina, Visibilidad y Frenos
  { id: 'cinturones_seguridad', category: 'Cabina y Frenos', name: 'Cinturones de 3 puntos operativos en todos los asientos', status: 'B' },
  { id: 'parabrisas_espejos', category: 'Cabina y Frenos', name: 'Parabrisas, lunas y espejos retrovisores limpios y sin trizaduras', status: 'B' },
  { id: 'limpiaparabrisas_plumillas', category: 'Cabina y Frenos', name: 'Plumillas limpiaparabrisas y líquido eyector', status: 'B' },
  { id: 'freno_servicio', category: 'Cabina y Frenos', name: 'Eficacia del freno de servicio (pedal firme sin esponjosidad)', status: 'B' },
  { id: 'freno_estacionamiento', category: 'Cabina y Frenos', name: 'Freno de mano / estacionamiento bloquea correctamente', status: 'B' },

  // 5. Equipo de Emergencia Minero
  { id: 'extintor_pqs', category: 'Equipo Emergencia', name: 'Extintor PQS de 6 o 9 kg vigente con manómetro en verde', status: 'B' },
  { id: 'botiquin_primeros_auxilios', category: 'Equipo Emergencia', name: 'Botiquín de primeros auxilios completo e inspeccionado', status: 'B' },
  { id: 'tacos_seguridad', category: 'Equipo Emergencia', name: '2 cuñas o tacos de seguridad de poliuretano/madera dura', status: 'B' },
  { id: 'conos_seguridad', category: 'Equipo Emergencia', name: '2 conos de seguridad reflectivos de 28 pulgadas', status: 'B' },
  { id: 'gata_llave_ruedas', category: 'Equipo Emergencia', name: 'Gata hidráulica de botella y llave de ruedas', status: 'B' },
  { id: 'jaula_antivuelco', category: 'Equipo Emergencia', name: 'Barra / jaula antivuelco certificada interna y externa', status: 'B' },

  // 6. Documentación Oficial
  { id: 'soat_vigente', category: 'Documentación', name: 'SOAT vigente y póliza de seguro vehicular', status: 'B' },
  { id: 'revision_tecnica', category: 'Documentación', name: 'Certificado de Inspección Técnica Vehicular vigente', status: 'B' },
  { id: 'tarjeta_propiedad', category: 'Documentación', name: 'Tarjeta de identificación vehicular en guantera', status: 'B' }
];

@Injectable({
  providedIn: 'root'
})
export class VehicleChecklistService {
  private http = inject(HttpClient);
  private cloudSync = inject(CloudSyncService);

  private get apiUrl(): string {
    return `${getApiBaseUrl()}/vehicles`;
  }

  // Reactive State Signals
  public vehiclesSignal = signal<VehicleInfo[]>(this.loadCachedVehicles());
  public selectedPlateSignal = signal<'BMC715' | 'BKS921' | 'BKS913' | 'BPS747'>('BMC715');
  public checklistsSignal = signal<VehicleChecklist[]>([]);
  public isLoadingSignal = signal<boolean>(false);

  // Computed views
  public vehicles = computed(() => this.vehiclesSignal());
  public selectedPlate = computed(() => this.selectedPlateSignal());
  public currentVehicle = computed(() => {
    const plate = this.selectedPlateSignal();
    return this.vehiclesSignal().find(v => v.plate === plate) || this.vehiclesSignal()[0];
  });
  public checklists = computed(() => this.checklistsSignal());
  public isLoading = computed(() => this.isLoadingSignal());

  constructor() {
    this.refreshVehicles();
    this.selectVehicle('BMC715');
  }

  public selectVehicle(plate: 'BMC715' | 'BKS921' | 'BKS913' | 'BPS747'): void {
    this.selectedPlateSignal.set(plate);
    this.loadChecklistsForPlate(plate);
  }

  public refreshVehicles(): void {
    this.http.get<{ success: boolean; data: VehicleInfo[] }>(`${this.apiUrl}/summary`).pipe(
      tap(res => {
        if (res && res.success && Array.isArray(res.data)) {
          this.vehiclesSignal.set(res.data);
          saveRealtimeData('basetrack_vehicles_summary', res.data);
        }
      }),
      catchError(() => {
        return of({ success: false, data: this.loadCachedVehicles() });
      })
    ).subscribe();
  }

  public loadChecklistsForPlate(plate: 'BMC715' | 'BKS921' | 'BKS913' | 'BPS747'): void {
    this.isLoadingSignal.set(true);

    // 1. Immediately display cached checklists for this plate (Offline First)
    const cached = getRealtimeData<VehicleChecklist[]>(`basetrack_checklists_${plate}`, []);
    this.checklistsSignal.set(cached);

    // 2. Fetch remote update from Render / Cloud
    this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/checklists?plate=${plate}`).pipe(
      tap(res => {
        this.isLoadingSignal.set(false);
        if (res && res.success && Array.isArray(res.data)) {
          const mapped: VehicleChecklist[] = res.data.map(item => ({
            id: item.id,
            vehicle_plate: item.vehicle_plate,
            date: item.date,
            time: item.time,
            shift: item.shift,
            shift_type: item.shift_type,
            driver_name: item.driver_name,
            driver_dni: item.driver_dni,
            driver_license: item.driver_license,
            odometer: item.odometer,
            items: item.items || [],
            has_observations: Boolean(item.has_observations),
            observation_notes: item.observation_notes,
            photo_url: item.photo_url,
            operational_status: item.operational_status,
            created_at: item.created_at
          }));

          this.checklistsSignal.set(mapped);
          saveRealtimeData(`basetrack_checklists_${plate}`, mapped);
        }
      }),
      catchError(err => {
        this.isLoadingSignal.set(false);
        console.warn(`[VehicleChecklistService] Backend no disponible para placa ${plate}, usando caché offline:`, err);
        return of({ success: false, data: cached });
      })
    ).subscribe();
  }

  public saveChecklist(checklist: Omit<VehicleChecklist, 'id'>): Observable<{ success: boolean; id?: string }> {
    const newId = 'chk-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const completeChecklist: VehicleChecklist = {
      ...checklist,
      id: newId,
      created_at: new Date().toISOString()
    };

    // Update local signal and cache immediately for selected plate
    const currentList = this.checklistsSignal();
    const updatedList = [completeChecklist, ...currentList];
    this.checklistsSignal.set(updatedList);
    saveRealtimeData(`basetrack_checklists_${checklist.vehicle_plate}`, updatedList);

    // Update vehicle summary locally
    const currentVehicles = this.vehiclesSignal();
    const updatedVehicles = currentVehicles.map(v => {
      if (v.plate === checklist.vehicle_plate) {
        return {
          ...v,
          currentOdometer: checklist.odometer,
          lastChecklistDate: checklist.date,
          lastChecklistTime: checklist.time,
          lastDriverName: checklist.driver_name,
          lastOperationalStatus: checklist.operational_status,
          totalChecklists: v.totalChecklists + 1
        };
      }
      return v;
    });
    this.vehiclesSignal.set(updatedVehicles);
    saveRealtimeData('basetrack_vehicles_summary', updatedVehicles);

    // Queue for sync and broadcast across tabs/devices
    this.cloudSync.broadcastChange('vehicle_checklists', 'CREATE', completeChecklist, `basetrack_checklists_${checklist.vehicle_plate}`);

    // Send to central Render Cloud backend
    const payload = {
      vehicle_plate: checklist.vehicle_plate,
      date: checklist.date,
      time: checklist.time,
      shift: checklist.shift,
      shift_type: checklist.shift_type,
      driver_name: checklist.driver_name,
      driver_dni: checklist.driver_dni,
      driver_license: checklist.driver_license,
      odometer: checklist.odometer,
      items: checklist.items,
      has_observations: checklist.has_observations,
      observation_notes: checklist.observation_notes,
      photo_url: checklist.photo_url,
      operational_status: checklist.operational_status
    };

    return new Observable(observer => {
      this.http.post<{ success: boolean; id: string }>(`${this.apiUrl}/checklists`, payload).subscribe({
        next: (res) => {
          this.refreshVehicles();
          observer.next({ success: true, id: res?.id || newId });
          observer.complete();
        },
        error: (err) => {
          console.warn('[VehicleChecklistService] Guardado en modo local contingencia:', err);
          // Return success true because it was persisted in offline storage
          observer.next({ success: true, id: newId });
          observer.complete();
        }
      });
    });
  }

  private loadCachedVehicles(): VehicleInfo[] {
    return getRealtimeData<VehicleInfo[]>('basetrack_vehicles_summary', OFFICIAL_VEHICLES_METADATA);
  }
}
