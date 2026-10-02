import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map, timeout } from 'rxjs';
import { OfflineSyncService } from '../offline/offline-sync.service';
import { updateGuardsCatalog } from '../../shared/utils/roster.util';
import { getRealtimeData } from '../storage/local-store.util';

export type PositionKey = 'SUPERVISOR' | 'SALA_CONTROL' | 'BOMBAS' | 'CICLONES_1' | 'CICLONES_2' | 'DISTRIBUIDOR' | 'DESCARGA_1' | 'DESCARGA_2' | 'MISCELANEOS' | string;

export interface CrewMember {
  id: string;
  name: string;
  document_id: string;
  primary_role: 'SUPERVISOR' | 'OPERADOR_SALA_CONTROL' | 'OPERADOR_BOMBAS' | 'OPERADOR_CICLONES_1' | 'OPERADOR_CICLONES_2' | 'OPERADOR_DISTRIBUIDOR' | 'OPERADOR_DESCARGA_1' | 'OPERADOR_DESCARGA_2' | 'OPERADOR_MISCELANEOS' | string;
  shift_code: 'G1' | 'G2' | 'G3' | 'G4' | string;
  radio_channel: string;
  phone_extension?: string;
  status: 'EN_TURNO' | 'DESCANSO' | 'VACACIONES' | 'PERMISO' | 'CAPACITACION';
  avatar_url: string;
  created_at?: string;
}

export interface CrewPositionMeta {
  key: PositionKey;
  title: string;
  defaultLocation: string;
  defaultRadio: string;
  badgeClass?: string;
  routeLink?: string;
  routeLabel?: string;
  iconSvg: string;
  description: string;
  isCustom?: boolean;
}

export interface CrewAreaAssignment {
  id: string;
  shift_code: string;
  shift_date: string;
  shift_type: 'DIA' | 'NOCHE' | string;
  position_key: PositionKey;
  position_title: string;
  operator_id?: string | null;
  backup_operator_id?: string | null;
  epp_verified: number;
  safety_talk_completed: number;
  radio_channel?: string;
  station_location?: string;
  notes?: string;
  updated_at?: string;
  operator_name?: string;
  operator_avatar?: string;
  operator_role?: string;
  operator_default_radio?: string;
  operator_phone?: string;
  operator_status?: string;
  backup_name?: string;
  backup_avatar?: string;
}

export interface SupervisorOperatorItem {
  assignment_id?: string;
  supervisor_id: string;
  operator_id: string;
  shift_code: string;
  operator_name: string;
  document_id: string;
  primary_role: string;
  radio_channel?: string;
  phone_extension?: string;
  operator_status?: string;
  operator_avatar?: string;
}

export interface SupervisorData {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  shift: string;
  avatar_url: string;
  is_active: number;
  operators: SupervisorOperatorItem[];
  operators_count: number;
}

export function sanitizeOfficialName(name: string): string {
  if (!name) return name;
  return name
    .replace(/CASTA[^\w\s]*EDA/gi, 'CASTAÑEDA')
    .replace(/CASTAEDA/gi, 'CASTAÑEDA')
    .replace(/RAM[^\w\s]*REZ/gi, 'RAMÍREZ')
    .replace(/SU[^\w\s]*REZ/gi, 'SUÁREZ')
    .replace(/PE[^\w\s]*A/gi, 'PEÑA');
}

import { getApiBaseUrl } from '../constants/api.config';

@Injectable({
  providedIn: 'root'
})
export class CrewService {
  private http = inject(HttpClient);
  private offlineSync = inject(OfflineSyncService);
  private get apiUrl(): string {
    return `${getApiBaseUrl()}/crew`;
  }

  // 9 Official Baseline Operational Positions (1 Supervisor de guardia + 8 Operadores)
  readonly defaultPositions: CrewPositionMeta[] = [
    {
      key: 'SUPERVISOR',
      title: 'Supervisor de guardia',
      defaultLocation: 'Supervisión de Turno / Gestión Operativa',
      defaultRadio: 'Canal 1 Operaciones / Control',
      badgeClass: 'card-supervisor',
      routeLink: '/shift-handover',
      routeLabel: 'Bitácora y Relevo',
      iconSvg: '🦺',
      description: 'Liderazgo operativo de guardia, gestión de seguridad y supervisión general de planta',
      isCustom: false
    },
    {
      key: 'SALA_CONTROL',
      title: 'Operador sala de control',
      defaultLocation: 'Sala de Control DCS / SCADA',
      defaultRadio: 'Canal 1 Operaciones / Control',
      badgeClass: 'card-control',
      routeLink: '/dashboard',
      routeLabel: 'Panel de control',
      iconSvg: '🖥️',
      description: 'Operación de consolas DCS/SCADA, monitoreo de variables de proceso, enclavamientos y alarmas',
      isCustom: false
    },
    {
      key: 'BOMBAS',
      title: 'Operador de bombas',
      defaultLocation: 'Sala de Bombas Slurry PP-101 a PP-104 & Sentinas',
      defaultRadio: 'Canal 3 Bombas',
      badgeClass: 'card-bombas',
      routeLink: '/pumps',
      routeLabel: 'Reporte de bombas',
      iconSvg: '🌊',
      description: 'Monitoreo de flujo, amperaje y presión en bombas PP-101 a PP-104 y niveles de poza',
      isCustom: false
    },
    {
      key: 'CICLONES_1',
      title: 'Operador de ciclones 1',
      defaultLocation: '1ra Estación Baterías de Ciclones D-10',
      defaultRadio: 'Canal 2 Ciclones',
      badgeClass: 'card-ciclones',
      routeLink: '/cyclones',
      routeLabel: 'Reporte de ciclones',
      iconSvg: '🌀',
      description: 'Muestreo metalúrgico horario de pulpa en 1ra batería, presiones y ápex/vortex',
      isCustom: false
    },
    {
      key: 'CICLONES_2',
      title: 'Operador de ciclones 2',
      defaultLocation: '2da Estación Baterías de Ciclones D-10',
      defaultRadio: 'Canal 2 Ciclones',
      badgeClass: 'card-ciclones',
      routeLink: '/cyclones',
      routeLabel: 'Reporte de ciclones',
      iconSvg: '🌪️',
      description: 'Control de balance de sólidos y granulometría de mallas -200 en 2da estación',
      isCustom: false
    },
    {
      key: 'DISTRIBUIDOR',
      title: 'Operador de distribuidor',
      defaultLocation: 'Cajón Distribuidor & Repartición de Carga',
      defaultRadio: 'Canal 6 Distribuidor / Flujo',
      badgeClass: 'card-distribuidor',
      routeLink: '',
      routeLabel: '',
      iconSvg: '🔀',
      description: 'Distribución balanceada de pulpa hacia baterías de clasificación y flotación',
      isCustom: false
    },
    {
      key: 'DESCARGA_1',
      title: 'Operador de descarga 1',
      defaultLocation: 'Línea HDPE de Impulsión & Estación Relaves',
      defaultRadio: 'Canal 4 Presa / Descarga',
      badgeClass: 'card-descarga',
      routeLink: '/tailings',
      routeLabel: 'Reporte de descarga',
      iconSvg: '🏔️',
      description: 'Supervisión de impulsión en tuberías HDPE y flujo de pulpa espesada',
      isCustom: false
    },
    {
      key: 'DESCARGA_2',
      title: 'Operador de descarga 2',
      defaultLocation: 'Presa Principal de Relaves & Muro de Contención',
      defaultRadio: 'Canal 4 Presa / Descarga',
      badgeClass: 'card-descarga',
      routeLink: '/tailings',
      routeLabel: 'Reporte de descarga',
      iconSvg: '🏞️',
      description: 'Inspección de vertedero, borde libre, muro y lecturas piezométricas',
      isCustom: false
    },
    {
      key: 'MISCELANEOS',
      title: 'Operador de misceláneos',
      defaultLocation: 'Planta de Reactivos, Floculante & Servicios Auxiliares',
      defaultRadio: 'Canal 5 Auxiliares / Planta',
      badgeClass: 'card-miscelaneos',
      routeLink: '',
      routeLabel: '',
      iconSvg: '⚙️',
      description: 'Preparación de reactivos, dosificación de floculante y apoyo en campo',
      isCustom: false
    }
  ];

  // Official supervisors dictionary by shift - Oficial Anglo American / BASETRACK
  public static readonly OFFICIAL_SUPERVISOR_MAP: Record<string, CrewMember> = {
    G1: {
      id: 'sup-g1',
      name: 'GONGORA ROJAS MIGUEL ALONSO',
      document_id: '41833717',
      primary_role: 'SUPERVISOR',
      shift_code: 'G1',
      radio_channel: 'Canal 1 Operaciones / Control',
      phone_extension: 'Ext. 4125',
      status: 'EN_TURNO',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=GONGORA'
    },
    G2: {
      id: 'sup-g2',
      name: 'ALIAGA CASTAÑEDA EMILIO URIEL',
      document_id: '46593500',
      primary_role: 'SUPERVISOR',
      shift_code: 'G2',
      radio_channel: 'Canal 1 Operaciones / Control',
      phone_extension: 'Ext. 4125',
      status: 'EN_TURNO',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ALIAGA'
    },
    G3: {
      id: 'sup-g3',
      name: 'ARI MAMANI HUGO ANDRES',
      document_id: '40132660',
      primary_role: 'SUPERVISOR',
      shift_code: 'G3',
      radio_channel: 'Canal 1 Operaciones / Control',
      phone_extension: 'Ext. 4125',
      status: 'EN_TURNO',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=HUGO_ARI'
    },
    G4: {
      id: 'sup-g4',
      name: 'FERNANDEZ ASCURRA DANTE PACO',
      document_id: '18110964',
      primary_role: 'SUPERVISOR',
      shift_code: 'G4',
      radio_channel: 'Canal 1 Operaciones / Control',
      phone_extension: 'Ext. 4125',
      status: 'EN_TURNO',
      avatar_url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DANTE_FERNANDEZ'
    }
  };

  // Baseline catalog of 32 official operational operators from Anglo American / BASETRACK master CSV
  public static readonly OFFICIAL_CREW_CATALOG: Record<string, Record<string, { name: string; dni: string; radio: string }>> = {
    G1: {
      SUPERVISOR: { name: 'GONGORA ROJAS MIGUEL ALONSO', dni: '41833717', radio: 'Canal 1 Operaciones / Control' },
      BOMBAS: { name: 'LLERENA CALLE - BRACAMONTE VICTOR ALEJANDRO II', dni: '71491945', radio: 'Canal 3 Bombas' },
      CICLONES_1: { name: 'PILCO APAZA CARLOS EDUARDO', dni: '42324277', radio: 'Canal 2 Ciclones' },
      CICLONES_2: { name: 'VIZCARRA CORI MANLEY KLISMAN', dni: '71209033', radio: 'Canal 2 Ciclones' },
      DISTRIBUIDOR: { name: 'CAYO GOMEZ VALERIE JAZMINE', dni: '71719330', radio: 'Canal 6 Distribuidor' },
      DESCARGA_1: { name: 'VILCHEZ NAVARRO LENIS AUDEL', dni: '70745703', radio: 'Canal 4 Presa / Descarga' },
      DESCARGA_2: { name: 'MIRANDA ALARCON JULIO ALBERTO', dni: '80624359', radio: 'Canal 4 Presa / Descarga' },
      MISCELANEOS: { name: 'COLLANTES PUMA ALVARO DEMTRIO', dni: '46082271', radio: 'Canal 5 Auxiliares' },
      SALA_CONTROL: { name: 'VIZCARRA CORI MANLEY KLISMAN', dni: '71209033', radio: 'Canal 1 Operaciones / Control' }
    },
    G2: {
      SUPERVISOR: { name: 'ALIAGA CASTAÑEDA EMILIO URIEL', dni: '46593500', radio: 'Canal 1 Operaciones / Control' },
      BOMBAS: { name: 'ARI ACERO JULIO LUIS ANDREE', dni: '46022412', radio: 'Canal 3 Bombas' },
      CICLONES_1: { name: 'CHAMA CAHUANA DIEGO', dni: '47345426', radio: 'Canal 2 Ciclones' },
      CICLONES_2: { name: 'COAYLA RAMOS DEYVI ALBERTH', dni: '46108897', radio: 'Canal 2 Ciclones' },
      DISTRIBUIDOR: { name: 'LAQUI FALCON ANGELA MAYUMY', dni: '47507242', radio: 'Canal 6 Distribuidor' },
      DESCARGA_1: { name: 'LIMA MELO JUAN VICTOR', dni: '43830918', radio: 'Canal 4 Presa / Descarga' },
      DESCARGA_2: { name: 'MOSCOSO SANCHEZ PEDRO JESUS PAULINO', dni: '45073740', radio: 'Canal 4 Presa / Descarga' },
      MISCELANEOS: { name: 'ROMERO GIRALDO ELVIS MIGUEL', dni: '76676074', radio: 'Canal 5 Auxiliares' },
      SALA_CONTROL: { name: 'ARI ACERO JULIO LUIS ANDREE', dni: '46022412', radio: 'Canal 1 Operaciones / Control' }
    },
    G3: {
      SUPERVISOR: { name: 'ARI MAMANI HUGO ANDRES', dni: '40132660', radio: 'Canal 1 Operaciones / Control' },
      BOMBAS: { name: 'CHOQUE MANZANO PEDRO IVAN', dni: '75555937', radio: 'Canal 3 Bombas' },
      CICLONES_1: { name: 'MAMANI CUTIPA ANTHONY JESUS SMIT', dni: '72297288', radio: 'Canal 2 Ciclones' },
      CICLONES_2: { name: 'ROSADO FALCON VILMA LUCIA', dni: '45564062', radio: 'Canal 2 Ciclones' },
      DISTRIBUIDOR: { name: 'VILCAMIZA PEVE JORGE RICARDO', dni: '41748219', radio: 'Canal 6 Distribuidor' },
      DESCARGA_1: { name: 'PARI COAYLA JHOFER LUIS', dni: '74924255', radio: 'Canal 4 Presa / Descarga' },
      DESCARGA_2: { name: 'CRUZ APAZA PAUL', dni: '44428468', radio: 'Canal 4 Presa / Descarga' },
      MISCELANEOS: { name: 'MONTES RODRIGUEZ DIEGO ALEXANDER', dni: '45437279', radio: 'Canal 5 Auxiliares' },
      SALA_CONTROL: { name: 'CHOQUE MANZANO PEDRO IVAN', dni: '75555937', radio: 'Canal 1 Operaciones / Control' }
    },
    G4: {
      SUPERVISOR: { name: 'FERNANDEZ ASCURRA DANTE PACO', dni: '18110964', radio: 'Canal 1 Operaciones / Control' },
      BOMBAS: { name: 'CABELLO RODRIGUEZ JONATHAN SERGIO', dni: '46317960', radio: 'Canal 3 Bombas' },
      CICLONES_1: { name: 'CALIZAYA CUAYLA MADELEYN WENDY', dni: '72471346', radio: 'Canal 2 Ciclones' },
      CICLONES_2: { name: 'HILARI CABRERA EDSON EUSEBIO', dni: '40824273', radio: 'Canal 2 Ciclones' },
      DISTRIBUIDOR: { name: 'MAMANCHURA PAQUERA DAVID PRUDENCIO', dni: '72297311', radio: 'Canal 6 Distribuidor' },
      DESCARGA_1: { name: 'MAMANI MARCA ALEXIS RODRIGO', dni: '70858297', radio: 'Canal 4 Presa / Descarga' },
      DESCARGA_2: { name: 'QUISPE MEDINA FERMIN HANDERSON', dni: '43656602', radio: 'Canal 4 Presa / Descarga' },
      MISCELANEOS: { name: 'YAÑEZ PEREZ ROBERTO CARLOS', dni: '29679222', radio: 'Canal 5 Auxiliares' },
      SALA_CONTROL: { name: 'CABELLO RODRIGUEZ JONATHAN SERGIO', dni: '46317960', radio: 'Canal 1 Operaciones / Control' }
    }
  };

  // Default staff catalog: Empty. All operational data is populated strictly from CSV / Database
  public readonly defaultMembers: CrewMember[] = [];

  // Reactive State Signals
  positions = signal<CrewPositionMeta[]>(this.defaultPositions);
  crewMembers = signal<CrewMember[]>([]);
  allMembers = signal<CrewMember[]>([]);
  activeAssignments = signal<CrewAreaAssignment[]>([]);
  supervisorsWithOperators = signal<SupervisorData[]>([]);
  myOperators = signal<CrewMember[]>([]);
  filterByMySupervisor = signal<boolean>(true);
  isLoading = signal<boolean>(false);

  constructor() {
    this.loadPositions().subscribe();
  }

  // ==========================================
  // 1. POSITIONS MANAGEMENT (STANDARD & CUSTOM)
  // ==========================================
  loadPositions(): Observable<CrewPositionMeta[]> {
    const standardKeys = new Set(this.defaultPositions.map(p => p.key));
    const cachedCustom = this.loadCachedCustomPositions().filter(p => !standardKeys.has(p.key) && p.isCustom);
    this.saveCache('basetrack_custom_positions', cachedCustom);
    this.positions.set([...this.defaultPositions, ...cachedCustom]);

    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/positions`).pipe(
      tap(res => {
        if (res?.success && Array.isArray(res.data)) {
          const apiCustoms: CrewPositionMeta[] = res.data
            .filter(d => Boolean(d.is_custom) && !standardKeys.has(d.key))
            .map(d => ({
              key: d.key,
              title: d.title,
              defaultLocation: d.default_location || d.defaultLocation || 'Planta Concentradora',
              defaultRadio: d.default_radio || d.defaultRadio || 'Canal 1 Operaciones',
              badgeClass: d.badge_class || d.badgeClass || 'card-custom',
              iconSvg: d.icon_svg || d.iconSvg || '⚙️',
              description: d.description || 'Posición operativa de planta',
              isCustom: true
            }));

          const mapPositions = new Map<string, CrewPositionMeta>();
          cachedCustom.forEach(c => mapPositions.set(c.key, c));
          apiCustoms.forEach(c => mapPositions.set(c.key, c));
          const mergedCustoms = Array.from(mapPositions.values());

          this.saveCache('basetrack_custom_positions', mergedCustoms);
          this.positions.set([...this.defaultPositions, ...mergedCustoms]);
        }
      }),
      map(() => this.positions()),
      catchError(err => {
        console.warn('[CrewService] Error cargando posiciones de API, usando locales:', err);
        return of(this.positions());
      })
    );
  }

  createPosition(pos: Partial<CrewPositionMeta>): Observable<any> {
    const rawKey = pos.key || ('POS_' + (pos.title || 'EXTRA').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() + '_' + Date.now().toString(36));
    const newPos: CrewPositionMeta = {
      key: rawKey,
      title: (pos.title || 'Nueva Posición').trim(),
      defaultLocation: (pos.defaultLocation || 'Planta Concentradora').trim(),
      defaultRadio: (pos.defaultRadio || 'Canal 1 Operaciones').trim(),
      badgeClass: pos.badgeClass || 'card-custom',
      iconSvg: pos.iconSvg || '⚙️',
      description: (pos.description || 'Consignas y responsabilidades de puesto en planta').trim(),
      isCustom: true
    };

    const current = [...this.positions(), newPos];
    this.positions.set(current);

    const customs = current.filter(p => p.isCustom);
    this.saveCache('basetrack_custom_positions', customs);

    return this.http.post<any>(`${this.apiUrl}/positions`, {
      key: newPos.key,
      title: newPos.title,
      default_location: newPos.defaultLocation,
      default_radio: newPos.defaultRadio,
      badge_class: newPos.badgeClass,
      icon_svg: newPos.iconSvg,
      description: newPos.description
    }).pipe(
      catchError(err => {
        console.warn('[CrewService] Error guardando posición en API, registrada localmente:', err);
        return of({ success: true, key: newPos.key });
      })
    );
  }

  deletePosition(key: string): Observable<any> {
    const current = this.positions().filter(p => p.key !== key);
    this.positions.set(current);

    const customs = current.filter(p => p.isCustom);
    this.saveCache('basetrack_custom_positions', customs);

    // Also remove from activeAssignments
    const currentAssigns = this.activeAssignments().filter(a => a.position_key !== key);
    this.activeAssignments.set(currentAssigns);

    return this.http.delete(`${this.apiUrl}/positions/${key}`).pipe(
      catchError(err => {
        console.warn('[CrewService] Error eliminando posición en API:', err);
        return of({ success: true });
      })
    );
  }

  private loadCachedCustomPositions(): CrewPositionMeta[] {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
    try {
      const cached = localStorage.getItem('basetrack_custom_positions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('[CrewService] Error leyendo basetrack_custom_positions:', e);
    }
    return [];
  }

  // ==========================================
  // 2. CREW MEMBERS DIRECTORY
  // ==========================================
  loadCrew(shift?: string): Observable<any> {
    const normShift = shift === 'GUARDIA_A' ? 'G1' :
                      shift === 'GUARDIA_B' ? 'G2' :
                      shift === 'GUARDIA_C' ? 'G3' :
                      shift === 'GUARDIA_D' ? 'G4' : shift;
    this.isLoading.set(true);

    return this.http.get<{ success: boolean; count: number; data: CrewMember[] }>(`${this.apiUrl}/members`).pipe(
      tap((res) => {
        this.isLoading.set(false);
        if (res?.success && res.data && res.data.length > 0) {
          const clean = res.data.map(m => ({
            ...m,
            primary_role: m.primary_role || 'OPERADOR_BOMBAS',
            name: sanitizeOfficialName(m.name),
            shift_code: m.shift_code === 'GUARDIA_A' ? 'G1' :
                        m.shift_code === 'GUARDIA_B' ? 'G2' :
                        m.shift_code === 'GUARDIA_C' ? 'G3' :
                        m.shift_code === 'GUARDIA_D' ? 'G4' : (m.shift_code || 'G1')
          }));

          this.allMembers.set(clean);
          const filtered = normShift ? clean.filter(m => m.shift_code === normShift) : clean;
          this.crewMembers.set(filtered);
          this.saveCache('basetrack_crew_members', clean);

          // Sincronizar catálogo de roster con supervisores reales oficiales
          const foundSups: any = {};
          clean.forEach(m => {
            if (['G1', 'G2', 'G3', 'G4'].includes(m.shift_code) && m.primary_role === 'SUPERVISOR') {
              foundSups[m.shift_code] = {
                supervisorName: sanitizeOfficialName(m.name),
                supervisorUser: m.name,
                avatarUrl: m.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.name}`
              };
            }
          });
          if (Object.keys(foundSups).length > 0) {
            updateGuardsCatalog(foundSups);
          }
        } else if (res?.success && Array.isArray(res.data) && res.data.length === 0) {
          this.allMembers.set([]);
          this.crewMembers.set([]);
          this.saveCache('basetrack_crew_members', []);
        } else {
          this.loadCachedMembers(normShift);
        }
      }),
      catchError((err) => {
        this.isLoading.set(false);
        console.warn('[CrewService] Error conectando a API backend, cargando caché local:', err);
        this.loadCachedMembers(normShift);
        return of({ success: true, data: this.crewMembers() });
      })
    );
  }

  loadAssignments(date: string, shiftCode: string, shiftType: 'DIA' | 'NOCHE'): Observable<any> {
    const normShift = shiftCode === 'GUARDIA_A' ? 'G1' :
                      shiftCode === 'GUARDIA_B' ? 'G2' :
                      shiftCode === 'GUARDIA_C' ? 'G3' :
                      shiftCode === 'GUARDIA_D' ? 'G4' : (shiftCode || 'G1');
    this.isLoading.set(true);
    const url = `${this.apiUrl}/assignments?date=${date}&shift_code=${normShift}&shift_type=${shiftType}`;

    return this.http.get<{ success: boolean; data: CrewAreaAssignment[] }>(url).pipe(
      tap((res) => {
        this.isLoading.set(false);
        if (res?.success && res.data && res.data.length > 0) {
          const clean = res.data.map(a => ({
            ...a,
            shift_code: a.shift_code === 'GUARDIA_A' ? 'G1' :
                        a.shift_code === 'GUARDIA_B' ? 'G2' :
                        a.shift_code === 'GUARDIA_C' ? 'G3' :
                        a.shift_code === 'GUARDIA_D' ? 'G4' : (a.shift_code || 'G1')
          }));
          this.activeAssignments.set(clean);
          this.saveCache(`basetrack_assignments_${date}_${normShift}_${shiftType}`, clean);
        } else if (res?.success && Array.isArray(res.data) && res.data.length === 0) {
          this.activeAssignments.set([]);
          this.saveCache(`basetrack_assignments_${date}_${normShift}_${shiftType}`, []);
        } else {
          this.loadCachedAssignments(date, normShift, shiftType);
        }
      }),
      catchError((err) => {
        this.isLoading.set(false);
        console.warn('[CrewService] Error cargando asignaciones, usando respaldo local:', err);
        this.loadCachedAssignments(date, normShift, shiftType);
        return of({ success: true, data: this.activeAssignments() });
      })
    );
  }

  saveAssignment(payload: Partial<CrewAreaAssignment>): Observable<any> {
    const url = `${this.apiUrl}/assignments`;

    const assignId = payload.id || ('assign-' + (payload.position_key || 'pos').toString().toLowerCase() + '-' + Date.now());
    const completePayload: CrewAreaAssignment = {
      id: assignId,
      shift_code: payload.shift_code || 'G1',
      shift_date: payload.shift_date || new Date().toISOString().split('T')[0],
      shift_type: payload.shift_type || 'DIA',
      position_key: payload.position_key || 'BOMBAS',
      position_title: payload.position_title || 'Operador',
      operator_id: payload.operator_id !== undefined ? payload.operator_id : null,
      operator_name: payload.operator_id ? payload.operator_name : undefined,
      operator_avatar: payload.operator_id ? payload.operator_avatar : undefined,
      operator_role: payload.operator_id ? payload.operator_role : undefined,
      operator_phone: payload.operator_id ? payload.operator_phone : undefined,
      operator_default_radio: payload.operator_id ? payload.operator_default_radio : undefined,
      backup_operator_id: payload.backup_operator_id || null,
      backup_name: payload.backup_operator_id ? payload.backup_name : undefined,
      epp_verified: payload.epp_verified !== undefined ? payload.epp_verified : (payload.operator_id ? 1 : 0),
      safety_talk_completed: payload.safety_talk_completed !== undefined ? payload.safety_talk_completed : (payload.operator_id ? 1 : 0),
      radio_channel: payload.radio_channel,
      station_location: payload.station_location,
      notes: payload.notes
    };

    // Optimistic local update
    let current = [...this.activeAssignments()];

    // Regla de unicidad operativa: Cada operador solo realiza una posición a la vez.
    // Si se asigna un operador titular, se vacía de cualquier otra posición en el estado activo.
    if (completePayload.operator_id) {
      current = current.map(a => {
        if (a.position_key !== completePayload.position_key && a.operator_id === completePayload.operator_id) {
          return {
            ...a,
            operator_id: null as any,
            operator_name: undefined,
            operator_avatar: undefined,
            operator_role: undefined
          };
        }
        return a;
      });
    }

    const idx = current.findIndex(a => a.position_key === completePayload.position_key);
    if (idx >= 0) {
      current[idx] = { 
        ...current[idx], 
        ...completePayload,
        operator_name: completePayload.operator_id ? completePayload.operator_name : undefined,
        operator_avatar: completePayload.operator_id ? completePayload.operator_avatar : undefined,
        operator_role: completePayload.operator_id ? completePayload.operator_role : undefined
      };
    } else {
      current.push(completePayload);
    }
    this.activeAssignments.set(current);

    if (completePayload.shift_date && completePayload.shift_code && completePayload.shift_type) {
      this.saveCache(`basetrack_assignments_${completePayload.shift_date}_${completePayload.shift_code}_${completePayload.shift_type}`, current);
    }

    if (!this.offlineSync.isOnline()) {
      this.offlineSync.queueAction(url, 'POST', completePayload, `Asignación ${completePayload.position_title}`);
      return of({ success: true, message: 'Asignación guardada en almacenamiento local' });
    }

    return this.http.post<any>(url, completePayload).pipe(
      catchError((err) => {
        console.warn('[CrewService] Fallo al guardar en backend, agregando a cola offline:', err);
        this.offlineSync.queueAction(url, 'POST', completePayload, `Asignación ${completePayload.position_title}`);
        return of({ success: true, message: 'Guardado local offline' });
      })
    );
  }

  checkin(assignmentId: string, eppVerified?: boolean, safetyTalk?: boolean): Observable<any> {
    const url = `${this.apiUrl}/assignments/${assignmentId}/checkin`;
    const payload = {
      epp_verified: eppVerified,
      safety_talk_completed: safetyTalk
    };

    const current = this.activeAssignments().map(a => {
      if (a.id === assignmentId) {
        return {
          ...a,
          epp_verified: eppVerified !== undefined ? (eppVerified ? 1 : 0) : a.epp_verified,
          safety_talk_completed: safetyTalk !== undefined ? (safetyTalk ? 1 : 0) : a.safety_talk_completed
        };
      }
      return a;
    });
    this.activeAssignments.set(current);

    const first = current[0];
    if (first && first.shift_date && first.shift_code && first.shift_type) {
      this.saveCache(`basetrack_assignments_${first.shift_date}_${first.shift_code}_${first.shift_type}`, current);
    }

    if (!this.offlineSync.isOnline()) {
      this.offlineSync.queueAction(url, 'PATCH', payload, `Check-in Asignación ${assignmentId}`);
      return of({ success: true });
    }

    return this.http.patch(url, payload).pipe(
      catchError((err) => {
        this.offlineSync.queueAction(url, 'PATCH', payload, `Check-in Asignación ${assignmentId}`);
        return of({ success: true });
      })
    );
  }

  createCrewMember(member: Partial<CrewMember>): Observable<any> {
    const url = `${this.apiUrl}/members`;
    const offlineId = 'local-' + Date.now();
    const localNew: CrewMember = {
      id: offlineId,
      name: member.name || '',
      document_id: member.document_id || '',
      primary_role: member.primary_role || 'OPERADOR_BOMBAS',
      shift_code: member.shift_code || 'G1',
      radio_channel: member.radio_channel || 'Canal 1 Operaciones',
      phone_extension: member.phone_extension,
      status: member.status || 'EN_TURNO',
      avatar_url: member.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80'
    };

    const updatedAll = [...this.allMembers(), localNew];
    this.allMembers.set(updatedAll);
    const updatedShift = [...this.crewMembers(), localNew];
    this.crewMembers.set(updatedShift);
    this.saveCache('basetrack_crew_members', updatedAll);

    return this.http.post<any>(url, member).pipe(
      tap(() => {
        this.loadCrew(member.shift_code).subscribe();
      }),
      catchError((err) => {
        console.warn('[CrewService] HTTP fail on createCrewMember, queued offline:', err);
        this.offlineSync.queueAction(url, 'POST', member, `Nuevo Operador ${member.name}`);
        return of({ success: true, id: offlineId });
      })
    );
  }

  updateCrewMember(id: string, member: Partial<CrewMember>): Observable<any> {
    const url = `${this.apiUrl}/members/${id}`;

    const updatedAll = this.allMembers().map(m => m.id === id ? { ...m, ...member } as CrewMember : m);
    this.allMembers.set(updatedAll);
    const updatedShift = this.crewMembers().map(m => m.id === id ? { ...m, ...member } as CrewMember : m);
    this.crewMembers.set(updatedShift);
    this.saveCache('basetrack_crew_members', updatedAll);

    if (!this.offlineSync.isOnline()) {
      this.offlineSync.queueAction(url, 'PUT', member, `Actualizar Operador ${member.name || id}`);
      return of({ success: true });
    }

    return this.http.put(url, member).pipe(
      catchError((err) => {
        this.offlineSync.queueAction(url, 'PUT', member, `Actualizar Operador ${member.name || id}`);
        return of({ success: true });
      })
    );
  }

  deleteCrewMember(id: string): Observable<any> {
    const url = `${this.apiUrl}/members/${id}`;

    const filteredAll = this.allMembers().filter(m => m.id !== id);
    this.allMembers.set(filteredAll);
    const filteredShift = this.crewMembers().filter(m => m.id !== id);
    this.crewMembers.set(filteredShift);
    this.saveCache('basetrack_crew_members', filteredAll);

    if (!this.offlineSync.isOnline()) {
      this.offlineSync.queueAction(url, 'DELETE' as any, {}, `Baja Operador ${id}`);
      return of({ success: true });
    }

    return this.http.delete(url).pipe(
      catchError((err) => {
        this.offlineSync.queueAction(url, 'DELETE' as any, {}, `Baja Operador ${id}`);
        return of({ success: true });
      })
    );
  }

  // ==========================================
  // 3. SUPERVISOR & OPERATORS MANAGEMENT
  // ==========================================
  loadSupervisorOperators(): Observable<{ success: boolean; supervisors: SupervisorData[]; all_operators: CrewMember[] }> {
    const user = getRealtimeData<any>('currentUser', null);
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPERVISOR') {
      const cached = this.loadCachedSupervisorOperators();
      this.supervisorsWithOperators.set(cached);
      return of({ success: true, supervisors: cached, all_operators: this.allMembers() });
    }

    const url = `${getApiBaseUrl()}/admin/supervisor-operators`;
    return this.http.get<{ success: boolean; supervisors: SupervisorData[]; all_operators: CrewMember[] }>(url).pipe(
      timeout(4000),
      tap(res => {
        if (res?.success && Array.isArray(res.supervisors) && res.supervisors.length > 0) {
          this.supervisorsWithOperators.set(res.supervisors);
          this.saveCache('basetrack_supervisor_operators', res.supervisors);
        } else if (res?.success && Array.isArray(res.supervisors) && res.supervisors.length === 0) {
          this.supervisorsWithOperators.set([]);
          this.saveCache('basetrack_supervisor_operators', []);
        } else {
          const fallback = this.loadCachedSupervisorOperators();
          this.supervisorsWithOperators.set(fallback);
          if (res) res.supervisors = fallback;
        }
      }),
      catchError(err => {
        console.warn('[CrewService] Error o timeout cargando supervisor-operators, usando respaldo oficial:', err);
        const cached = this.loadCachedSupervisorOperators();
        this.supervisorsWithOperators.set(cached);
        return of({ success: true, supervisors: cached, all_operators: this.allMembers() });
      })
    );
  }

  assignOperatorToSupervisor(supervisorId: string, operatorId: string, shiftCode?: string): Observable<any> {
    const url = `${getApiBaseUrl()}/admin/supervisor-operators/assign`;
    const payload = { supervisor_id: supervisorId, operator_id: operatorId, shift_code: shiftCode };

    return this.http.post<any>(url, payload).pipe(
      tap(() => {
        this.loadSupervisorOperators().subscribe();
      }),
      catchError(err => {
        console.warn('[CrewService] Fallback local para asignar operador a supervisor:', err);
        const current = [...this.supervisorsWithOperators()];
        const sup = current.find(s => s.id === supervisorId || s.username === supervisorId);
        const op = this.allMembers().find(o => o.id === operatorId);
        if (sup && op && !sup.operators.some(o => o.operator_id === operatorId)) {
          sup.operators.push({
            assignment_id: 'local-' + Date.now(),
            supervisor_id: supervisorId,
            operator_id: operatorId,
            shift_code: shiftCode || op.shift_code || sup.shift,
            operator_name: op.name,
            document_id: op.document_id,
            primary_role: op.primary_role,
            radio_channel: op.radio_channel,
            phone_extension: op.phone_extension,
            operator_status: op.status,
            operator_avatar: op.avatar_url
          });
          sup.operators_count = sup.operators.length;
          this.supervisorsWithOperators.set(current);
          this.saveCache('basetrack_supervisor_operators', current);
        }
        return of({ success: true });
      })
    );
  }

  removeOperatorFromSupervisor(supervisorId: string, operatorId: string): Observable<any> {
    const url = `${getApiBaseUrl()}/admin/supervisor-operators/remove`;
    const payload = { supervisor_id: supervisorId, operator_id: operatorId };

    return this.http.post<any>(url, payload).pipe(
      tap(() => {
        this.loadSupervisorOperators().subscribe();
      }),
      catchError(err => {
        console.warn('[CrewService] Fallback local para desvincular operador:', err);
        const current = [...this.supervisorsWithOperators()];
        const sup = current.find(s => s.id === supervisorId || s.username === supervisorId);
        if (sup) {
          sup.operators = sup.operators.filter(o => o.operator_id !== operatorId);
          sup.operators_count = sup.operators.length;
          this.supervisorsWithOperators.set(current);
          this.saveCache('basetrack_supervisor_operators', current);
        }
        return of({ success: true });
      })
    );
  }

  autoAssignByShift(supervisorId?: string, shiftCode?: string): Observable<any> {
    const url = `${getApiBaseUrl()}/admin/supervisor-operators/auto-assign`;
    return this.http.post<any>(url, { supervisor_id: supervisorId, shift_code: shiftCode }).pipe(
      tap(() => {
        this.loadSupervisorOperators().subscribe();
      }),
      catchError(err => {
        console.warn('[CrewService] Fallback auto-assign local:', err);
        return of({ success: true });
      })
    );
  }

  loadMyOperators(supervisorId?: string): Observable<{ success: boolean; data: CrewMember[] }> {
    let url = `${this.apiUrl}/my-operators`;
    if (supervisorId) {
      url += `?supervisor_id=${encodeURIComponent(supervisorId)}`;
    }

    return this.http.get<{ success: boolean; data: CrewMember[] }>(url).pipe(
      tap(res => {
        if (res?.success && Array.isArray(res.data)) {
          this.myOperators.set(res.data);
          this.saveCache('basetrack_my_operators', res.data);
        }
      }),
      catchError(err => {
        console.warn('[CrewService] Error cargando my-operators, usando caché local o filtro por guardia:', err);
        const cached = this.loadCachedMyOperators();
        this.myOperators.set(cached);
        return of({ success: true, data: cached });
      })
    );
  }

  public loadCachedSupervisorOperators(): SupervisorData[] {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const c = localStorage.getItem('basetrack_supervisor_operators');
        if (c) {
          const parsed = JSON.parse(c);
          const hasOld = Array.isArray(parsed) && parsed.some((s: any) => 
            s.username?.startsWith('op_test_') ||
            s.username?.startsWith('sup_g1_') ||
            s.full_name?.includes('TEST') ||
            s.full_name?.includes('PRUEBA')
          );
          if (hasOld) {
            localStorage.removeItem('basetrack_supervisor_operators');
            return [];
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((s: any) => ({
              ...s,
              full_name: sanitizeOfficialName(s.full_name),
              operators: (s.operators || []).map((o: any) => ({
                ...o,
                operator_name: sanitizeOfficialName(o.operator_name)
              }))
            }));
          }
        }
      } catch {}
    }
    return [];
  }

  private loadCachedMyOperators(): CrewMember[] {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const c = localStorage.getItem('basetrack_my_operators');
        if (c) {
          const parsed = JSON.parse(c);
          const hasOld = Array.isArray(parsed) && parsed.some((m: any) => 
            m.name?.includes('TEST') ||
            m.name?.includes('PRUEBA')
          );
          if (hasOld) {
            localStorage.removeItem('basetrack_my_operators');
            return [];
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((m: any) => ({
              ...m,
              name: sanitizeOfficialName(m.name)
            }));
          }
        }
      } catch {}
    }
    return [];
  }

  private loadCachedMembers(shift?: string): void {
    const normShift = shift === 'GUARDIA_A' ? 'G1' :
                      shift === 'GUARDIA_B' ? 'G2' :
                      shift === 'GUARDIA_C' ? 'G3' :
                      shift === 'GUARDIA_D' ? 'G4' : shift;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      this.allMembers.set([]);
      this.crewMembers.set([]);
      return;
    }
    try {
      const cached = localStorage.getItem('basetrack_crew_members');
      let list: CrewMember[] = [];
      if (cached) {
        const parsed = JSON.parse(cached);
        const hasOldMocks = Array.isArray(parsed) && parsed.some((m: any) => 
          m.name?.includes('TEST') ||
          m.name?.includes('PRUEBA') ||
          m.name?.includes('Roberto Quispe') ||
          m.name?.includes('Marco Vel') ||
          m.name?.toLowerCase().includes('marck')
        );
        if (Array.isArray(parsed) && !hasOldMocks) {
          list = parsed.map((m: any) => ({
            ...m,
            name: sanitizeOfficialName(m.name),
            shift_code: m.shift_code === 'GUARDIA_A' ? 'G1' :
                        m.shift_code === 'GUARDIA_B' ? 'G2' :
                        m.shift_code === 'GUARDIA_C' ? 'G3' :
                        m.shift_code === 'GUARDIA_D' ? 'G4' : (m.shift_code || 'G1')
          }));
        } else {
          list = [];
          localStorage.removeItem('basetrack_crew_members');
        }
      }
      this.allMembers.set(list);
      this.crewMembers.set(normShift ? list.filter(m => m.shift_code === normShift) : list);
    } catch {
      this.allMembers.set([]);
      this.crewMembers.set([]);
    }
  }

  private loadCachedAssignments(date: string, shiftCode: string, shiftType: string): void {
    const normShift = shiftCode === 'GUARDIA_A' ? 'G1' :
                      shiftCode === 'GUARDIA_B' ? 'G2' :
                      shiftCode === 'GUARDIA_C' ? 'G3' :
                      shiftCode === 'GUARDIA_D' ? 'G4' : (shiftCode || 'G1');
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      this.synthesizeDefaultAssignments(date, normShift, shiftType as 'DIA' | 'NOCHE');
      return;
    }
    try {
      const key = `basetrack_assignments_${date}_${normShift}_${shiftType}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const hasOldMocks = Array.isArray(parsed) && parsed.some((a: any) => 
          a.operator_id === 'op-g1-sup' ||
          a.operator_id === 'op-g2-sup' ||
          a.operator_id === 'op-g3-sup' ||
          a.operator_id === 'op-g4-sup' ||
          a.operator_id?.startsWith('ref-') ||
          a.operator_name?.includes('TEST') ||
          a.operator_name?.includes('PRUEBA') ||
          a.operator_name?.includes('Roberto Quispe') ||
          a.operator_name?.includes('Marco Vel') ||
          a.operator_name?.includes('VIZCARRA CORI') ||
          a.operator_name?.toLowerCase().includes('marck')
        );
        if (hasOldMocks) {
          localStorage.removeItem(key);
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.map((a: any) => ({
            ...a,
            shift_code: a.shift_code === 'GUARDIA_A' ? 'G1' :
                        a.shift_code === 'GUARDIA_B' ? 'G2' :
                        a.shift_code === 'GUARDIA_C' ? 'G3' :
                        a.shift_code === 'GUARDIA_D' ? 'G4' : (a.shift_code || 'G1')
          }));
          this.activeAssignments.set(clean);
          return;
        }
      }
      this.synthesizeDefaultAssignments(date, normShift, shiftType as 'DIA' | 'NOCHE');
    } catch {
      this.synthesizeDefaultAssignments(date, normShift, shiftType as 'DIA' | 'NOCHE');
    }
  }

  public getOfficialShiftStaff(shiftCode: string): {
    supervisor: CrewMember;
    controlRoom: CrewMember;
    bombas: CrewMember;
    ciclones1: CrewMember;
    ciclones2: CrewMember;
    distribuidor: CrewMember;
    descarga1: CrewMember;
    descarga2: CrewMember;
    miscelaneos: CrewMember;
  } {
    const normShift = shiftCode === 'GUARDIA_A' ? 'G1' :
                      shiftCode === 'GUARDIA_B' ? 'G2' :
                      shiftCode === 'GUARDIA_C' ? 'G3' :
                      shiftCode === 'GUARDIA_D' ? 'G4' : (shiftCode || 'G1');

    const activeShiftStaff = this.allMembers().filter(m => m.shift_code === normShift);
    const usedStaffIds = new Set<string>();

    const findStaff = (role: string): CrewMember => {
      let found = activeShiftStaff.find(m => !usedStaffIds.has(m.id) && (m.primary_role === role || m.primary_role === 'OPERADOR_' + role));
      if (found) {
        usedStaffIds.add(found.id);
        return found;
      }
      if (role === 'SUPERVISOR') {
        const foundSup = activeShiftStaff.find(m => m.primary_role === 'SUPERVISOR');
        if (foundSup) {
          usedStaffIds.add(foundSup.id);
          return foundSup;
        }
      }

      return {
        id: '',
        name: '--- Vacante ---',
        document_id: '---',
        primary_role: role,
        shift_code: normShift,
        radio_channel: '---',
        phone_extension: '',
        status: 'EN_TURNO',
        avatar_url: ''
      };
    };

    return {
      supervisor: findStaff('SUPERVISOR'),
      controlRoom: findStaff('SALA_CONTROL'),
      bombas: findStaff('BOMBAS'),
      ciclones1: findStaff('CICLONES_1'),
      ciclones2: findStaff('CICLONES_2'),
      distribuidor: findStaff('DISTRIBUIDOR'),
      descarga1: findStaff('DESCARGA_1'),
      descarga2: findStaff('DESCARGA_2'),
      miscelaneos: findStaff('MISCELANEOS')
    };
  }

  public synthesizeDefaultAssignments(date: string, shiftCode: string, shiftType: 'DIA' | 'NOCHE'): void {
    const normShift = shiftCode === 'GUARDIA_A' ? 'G1' :
                      shiftCode === 'GUARDIA_B' ? 'G2' :
                      shiftCode === 'GUARDIA_C' ? 'G3' :
                      shiftCode === 'GUARDIA_D' ? 'G4' : (shiftCode || 'G1');

    const staff = this.getOfficialShiftStaff(normShift);

    const positionConfigs = [
      {
        key: 'SUPERVISOR',
        title: 'Supervisor de guardia',
        member: staff.supervisor,
        defaultRole: 'SUPERVISOR',
        phone: 'Ext. 4125',
        radio: 'Canal 1 Operaciones / Control',
        location: 'Supervisión de Turno / Gestión Operativa',
        notes: 'Liderazgo operativo de guardia, gestión de seguridad y supervisión general de planta'
      },
      {
        key: 'SALA_CONTROL',
        title: 'Operador sala de control',
        member: staff.controlRoom,
        defaultRole: 'OPERADOR_SALA_CONTROL',
        phone: 'Ext. 4121',
        radio: 'Canal 1 Operaciones / Control',
        location: 'Sala de Control DCS / SCADA',
        notes: 'Operación de consolas DCS/SCADA, monitoreo de variables de proceso, enclavamientos y alarmas'
      },
      {
        key: 'BOMBAS',
        title: 'Operador de bombas',
        member: staff.bombas,
        defaultRole: 'OPERADOR_BOMBAS',
        phone: 'Ext. 4120',
        radio: 'Canal 3 Bombas',
        location: 'Sala de Bombas Slurry PP-101 a PP-104 & Sentinas',
        notes: 'Monitoreo de flujo, amperaje y presión en bombas y pozas'
      },
      {
        key: 'CICLONES_1',
        title: 'Operador de ciclones 1',
        member: staff.ciclones1,
        defaultRole: 'OPERADOR_CICLONES_1',
        phone: 'Ext. 4122',
        radio: 'Canal 2 Ciclones',
        location: '1ra Estación Baterías de Ciclones D-10',
        notes: 'Muestreo metalúrgico horario en 1ra estación, presiones y mallas'
      },
      {
        key: 'CICLONES_2',
        title: 'Operador de ciclones 2',
        member: staff.ciclones2,
        defaultRole: 'OPERADOR_CICLONES_2',
        phone: 'Ext. 4119',
        radio: 'Canal 2 Ciclones',
        location: '2da Estación Baterías de Ciclones D-10',
        notes: 'Planilla metalúrgica, % de sólidos y granulometría de malla -200'
      },
      {
        key: 'DISTRIBUIDOR',
        title: 'Operador de distribuidor',
        member: staff.distribuidor,
        defaultRole: 'OPERADOR_DISTRIBUIDOR',
        phone: 'Ext. 4116',
        radio: 'Canal 6 Distribuidor / Flujo',
        location: 'Cajón Distribuidor & Repartición de Carga',
        notes: 'Distribución uniforme de carga y flujo hacia líneas de clasificación'
      },
      {
        key: 'DESCARGA_1',
        title: 'Operador de descarga 1',
        member: staff.descarga1,
        defaultRole: 'OPERADOR_DESCARGA_1',
        phone: 'Ext. 4124',
        radio: 'Canal 4 Presa / Descarga',
        location: 'Línea HDPE de Impulsión & Estación Relaves',
        notes: 'Supervisión de presiones en línea HDPE y flujo de pulpa espesada'
      },
      {
        key: 'DESCARGA_2',
        title: 'Operador de descarga 2',
        member: staff.descarga2,
        defaultRole: 'OPERADOR_DESCARGA_2',
        phone: 'Ext. 4118',
        radio: 'Canal 4 Presa / Descarga',
        location: 'Presa Principal de Relaves & Muro de Contención',
        notes: 'Inspección de vertederos, nivel de laguna, borde libre y piezómetros'
      },
      {
        key: 'MISCELANEOS',
        title: 'Operador de misceláneos',
        member: staff.miscelaneos,
        defaultRole: 'OPERADOR_MISCELANEOS',
        phone: 'Ext. 4123',
        radio: 'Canal 5 Auxiliares / Planta',
        location: 'Planta de Reactivos, Floculante & Servicios Auxiliares',
        notes: 'Preparación de reactivos, apoyo en espesadores e inspección general'
      }
    ];

    const defaults: CrewAreaAssignment[] = positionConfigs.map(pos => {
      const isAssigned = !!(pos.member && pos.member.id && pos.member.id.trim() !== '');
      return {
        id: `assign-${pos.key.toLowerCase()}-${normShift}-${shiftType}`,
        shift_code: normShift,
        shift_date: date,
        shift_type: shiftType,
        position_key: pos.key,
        position_title: pos.title,
        operator_id: isAssigned ? pos.member!.id : null,
        operator_name: isAssigned ? pos.member!.name : undefined,
        operator_avatar: isAssigned ? pos.member!.avatar_url : undefined,
        operator_role: isAssigned ? (pos.member!.primary_role || pos.defaultRole) : pos.defaultRole,
        operator_phone: isAssigned ? (pos.member!.phone_extension || pos.phone) : pos.phone,
        operator_default_radio: isAssigned ? (pos.member!.radio_channel || pos.radio) : pos.radio,
        backup_operator_id: null,
        backup_name: undefined,
        epp_verified: isAssigned ? 1 : 0,
        safety_talk_completed: isAssigned ? 1 : 0,
        radio_channel: isAssigned ? (pos.member!.radio_channel || pos.radio) : pos.radio,
        station_location: pos.location,
        notes: pos.notes
      };
    });

    this.activeAssignments.set(defaults);
    this.saveCache(`basetrack_assignments_${date}_${normShift}_${shiftType}`, defaults);
  }

  public getAssignedOperatorForPosition(positionKey: string, shiftCode?: string): CrewMember | undefined {
    const raw = shiftCode || (typeof localStorage !== 'undefined' ? localStorage.getItem('basetrack_active_shift') : null) || 'G1';
    const normShift = raw === 'GUARDIA_A' ? 'G1' :
                      raw === 'GUARDIA_B' ? 'G2' :
                      raw === 'GUARDIA_C' ? 'G3' :
                      raw === 'GUARDIA_D' ? 'G4' : raw;

    const assign = this.activeAssignments().find(a => a.position_key === positionKey && (!a.shift_code || a.shift_code === normShift));
    if (assign && assign.operator_id) {
      const found = this.allMembers().find(m => m.id === assign.operator_id);
      if (found) return found;
    }

    const staff = this.getOfficialShiftStaff(normShift);
    const map: Record<string, CrewMember> = {
      'SUPERVISOR': staff.supervisor,
      'SALA_CONTROL': staff.controlRoom,
      'BOMBAS': staff.bombas,
      'CICLONES_1': staff.ciclones1,
      'CICLONES_2': staff.ciclones2,
      'DISTRIBUIDOR': staff.distribuidor,
      'DESCARGA_1': staff.descarga1,
      'DESCARGA_2': staff.descarga2,
      'MISCELANEOS': staff.miscelaneos
    };
    if (map[positionKey] && map[positionKey].id && map[positionKey].id.trim() !== '') {
      return map[positionKey];
    }

    if (positionKey === 'SUPERVISOR') {
      const foundSup = this.allMembers().find(m => m.shift_code === normShift && m.primary_role === 'SUPERVISOR');
      return foundSup;
    }
    return undefined;
  }

  public getActiveSupervisorForShift(shiftCode?: string): CrewMember | undefined {
    const raw = shiftCode || (typeof localStorage !== 'undefined' ? localStorage.getItem('basetrack_active_shift') : null) || 'G1';
    const normShift = raw === 'GUARDIA_A' ? 'G1' :
                      raw === 'GUARDIA_B' ? 'G2' :
                      raw === 'GUARDIA_C' ? 'G3' :
                      raw === 'GUARDIA_D' ? 'G4' : raw;
    const staff = this.getOfficialShiftStaff(normShift);
    if (staff && staff.supervisor && staff.supervisor.name && staff.supervisor.id) {
      return staff.supervisor;
    }
    const foundSup = this.allMembers().find(m => m.shift_code === normShift && m.primary_role === 'SUPERVISOR');
    return foundSup;
  }

  private saveCache(key: string, data: any): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[CrewService] Error guardando en localStorage:', e);
    }
  }
}
