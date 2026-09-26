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

export const SAMPLE_INITIAL_CHECKLISTS: Record<string, VehicleChecklist[]> = {
  'BMC715': [
    {
      id: 'chk-init-bmc-1',
      vehicle_plate: 'BMC715',
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      time: '06:45',
      shift: 'G1',
      shift_type: 'DIA',
      driver_name: 'VIZCARRA CORI MANLEY KLISMAN',
      driver_dni: '71209033',
      driver_license: 'Q71209033',
      odometer: 48250,
      items: DEFAULT_INSPECTION_ITEMS,
      has_observations: false,
      operational_status: 'APTO'
    },
    {
      id: 'chk-init-bmc-2',
      vehicle_plate: 'BMC715',
      date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
      time: '18:50',
      shift: 'G4',
      shift_type: 'NOCHE',
      driver: 'ORTEGA RAMÍREZ CESAR',
      driver_name: 'ORTEGA RAMÍREZ CESAR',
      driver_dni: '40918239',
      driver_license: 'Q40918239',
      odometer: 48190,
      items: DEFAULT_INSPECTION_ITEMS,
      has_observations: false,
      operational_status: 'APTO'
    } as any
  ],
  'BKS921': [
    {
      id: 'chk-init-bks-1',
      vehicle_plate: 'BKS921',
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      time: '07:05',
      shift: 'G1',
      shift_type: 'DIA',
      driver_name: 'PILCO APAZA CARLOS EDUARDO',
      driver_dni: '42324277',
      driver_license: 'Q42324277',
      odometer: 53120,
      items: DEFAULT_INSPECTION_ITEMS,
      has_observations: true,
      observation_notes: 'Leve desgaste en plumilla limpiaparabrisas derecha. Unidad 100% operativa.',
      operational_status: 'OBSERVADO'
    },
    {
      id: 'chk-init-bks-2',
      vehicle_plate: 'BKS921',
      date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
      time: '06:50',
      shift: 'G4',
      shift_type: 'DIA',
      driver_name: 'CAMPOS ZEA OSWALDO',
      driver_dni: '72910394',
      driver_license: 'Q72910394',
      odometer: 53040,
      items: DEFAULT_INSPECTION_ITEMS,
      has_observations: false,
      operational_status: 'APTO'
    }
  ],
  'BKS913': [
    {
      id: 'chk-init-bks3-1',
      vehicle_plate: 'BKS913',
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      time: '06:55',
      shift: 'G1',
      shift_type: 'DIA',
      driver_name: 'VILCAMIZA PEVE JORGE RICARDO',
      driver_dni: '41748219',
      driver_license: 'Q41748219',
      odometer: 39800,
      items: DEFAULT_INSPECTION_ITEMS,
      has_observations: false,
      operational_status: 'APTO'
    },
    {
      id: 'chk-init-bks3-2',
      vehicle_plate: 'BKS913',
      date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
      time: '19:10',
      shift: 'G4',
      shift_type: 'NOCHE',
      driver_name: 'SUÁREZ MAMANI JULIO',
      driver_dni: '44819203',
      driver_license: 'Q44819203',
      odometer: 39710,
      items: DEFAULT_INSPECTION_ITEMS,
      has_observations: false,
      operational_status: 'APTO'
    }
  ],
  'BPS747': [
    {
      id: 'chk-init-bps-1',
      vehicle_plate: 'BPS747',
      date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      time: '07:15',
      shift: 'G1',
      shift_type: 'DIA',
      driver_name: 'MONTES RODRIGUEZ DIEGO ALEXANDER',
      driver_dni: '45437279',
      driver_license: 'Q45437279',
      odometer: 61400,
      items: DEFAULT_INSPECTION_ITEMS,
      has_observations: false,
      operational_status: 'APTO'
    },
    {
      id: 'chk-init-bps-2',
      vehicle_plate: 'BPS747',
      date: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
      time: '07:00',
      shift: 'G4',
      shift_type: 'DIA',
      driver_name: 'CORNEJO NINA ALONSO',
      driver_dni: '75910293',
      driver_license: 'Q75910293',
      odometer: 61310,
      items: DEFAULT_INSPECTION_ITEMS,
      has_observations: true,
      observation_notes: 'Presión neumático calibrada de 28 a 35 PSI.',
      operational_status: 'OBSERVADO'
    }
  ]
};

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

    // 1. Immediately display cached checklists for this plate with fallback to sample history
    const initialSamples = SAMPLE_INITIAL_CHECKLISTS[plate] || [];
    let cached = getRealtimeData<VehicleChecklist[]>(`basetrack_checklists_${plate}`, []);
    if (!Array.isArray(cached) || cached.length === 0) {
      cached = [...initialSamples];
      saveRealtimeData(`basetrack_checklists_${plate}`, cached);
    }
    this.checklistsSignal.set(cached);

    // 2. Fetch remote update from Render / Cloud
    this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/checklists?plate=${plate}`).pipe(
      tap(res => {
        this.isLoadingSignal.set(false);
        if (res && res.success && Array.isArray(res.data)) {
          const remoteMapped: VehicleChecklist[] = res.data.map(item => ({
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

          // Merge remote + local cached + initialSamples without losing any records
          const map = new Map<string, VehicleChecklist>();
          for (const r of remoteMapped) map.set(r.id, r);
          for (const c of cached) {
            if (!map.has(c.id)) map.set(c.id, c);
          }
          for (const s of initialSamples) {
            if (!map.has(s.id)) map.set(s.id, s);
          }
          const merged = Array.from(map.values()).sort((a, b) => (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time));

          if (this.selectedPlateSignal() === plate) {
            this.checklistsSignal.set(merged);
          }
          saveRealtimeData(`basetrack_checklists_${plate}`, merged);
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

    const targetPlate = checklist.vehicle_plate as 'BMC715' | 'BKS921' | 'BKS913' | 'BPS747';
    const initialSamples = SAMPLE_INITIAL_CHECKLISTS[targetPlate] || [];
    let currentList = getRealtimeData<VehicleChecklist[]>(`basetrack_checklists_${targetPlate}`, initialSamples);
    if (!Array.isArray(currentList) || currentList.length === 0) {
      currentList = [...initialSamples];
    }

    // Prepend new checklist and deduplicate
    const updatedList = [completeChecklist, ...currentList.filter(item => item.id !== newId)];
    saveRealtimeData(`basetrack_checklists_${targetPlate}`, updatedList);

    // If currently selected plate matches, update signal immediately
    if (this.selectedPlateSignal() === targetPlate) {
      this.checklistsSignal.set(updatedList);
    }

    // Update vehicle summary locally
    const currentVehicles = this.vehiclesSignal();
    const updatedVehicles = currentVehicles.map(v => {
      if (v.plate === targetPlate) {
        return {
          ...v,
          currentOdometer: checklist.odometer,
          lastChecklistDate: checklist.date,
          lastChecklistTime: checklist.time,
          lastDriverName: checklist.driver_name,
          lastOperationalStatus: checklist.operational_status,
          totalChecklists: (v.totalChecklists || 0) + 1
        };
      }
      return v;
    });
    this.vehiclesSignal.set(updatedVehicles);
    saveRealtimeData('basetrack_vehicles_summary', updatedVehicles);

    // Queue for sync and broadcast across tabs/devices
    this.cloudSync.broadcastChange('vehicle_checklists', 'CREATE', completeChecklist, `basetrack_checklists_${targetPlate}`);

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
