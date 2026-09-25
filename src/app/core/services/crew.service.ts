import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, map } from 'rxjs';
import { OfflineSyncService } from '../offline/offline-sync.service';

export type PositionKey = 'SUPERVISOR' | 'BOMBAS' | 'CICLONES_1' | 'CICLONES_2' | 'DISTRIBUIDOR' | 'DESCARGA_1' | 'DESCARGA_2' | 'MISCELANEOS' | string;

export interface CrewMember {
  id: string;
  name: string;
  document_id: string;
  primary_role: 'SUPERVISOR' | 'OPERADOR_BOMBAS' | 'OPERADOR_CICLONES_1' | 'OPERADOR_CICLONES_2' | 'OPERADOR_DISTRIBUIDOR' | 'OPERADOR_DESCARGA_1' | 'OPERADOR_DESCARGA_2' | 'OPERADOR_MISCELANEOS' | string;
  shift_code: 'G1' | 'G2' | 'G3' | 'G4' | 'GUARDIA_A' | 'GUARDIA_B' | 'GUARDIA_C' | string;
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
  operator_id: string;
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

  // 8 Official Baseline Operational Positions (1 Supervisor + 7 Operadores)
  readonly defaultPositions: CrewPositionMeta[] = [
    {
      key: 'SUPERVISOR',
      title: 'Supervisor de Guardia',
      defaultLocation: 'Sala de Control & Supervisión de Turno',
      defaultRadio: 'Canal 1 Operaciones / Control',
      badgeClass: 'card-supervisor',
      routeLink: '/shift-handover',
      routeLabel: 'Bitácora y Relevo',
      iconSvg: '👷‍♂️',
      description: 'Supervisión integral de planta concentradora, balance metalúrgico y control SCADA',
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

  // Default fallback seeds when offline or first load (32 Official Staff in 4 Shifts)
  private defaultMembers: CrewMember[] = [
    // Guardia 1 (G1) - 1 Supervisor + 7 Operadores
    { id: 'op-klisman-g1', name: 'VIZCARRA CORI MANLEY KLISMAN', document_id: '71209033', primary_role: 'SUPERVISOR', shift_code: 'G1', radio_channel: 'Canal 1 Operaciones / Control', phone_extension: 'Ext. 4125', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-carlos-g1', name: 'PILCO APAZA CARLOS EDUARDO', document_id: '42324277', primary_role: 'OPERADOR_BOMBAS', shift_code: 'G1', radio_channel: 'Canal 3 Bombas', phone_extension: 'Ext. 4122', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-jorge-g1', name: 'VILCAMIZA PEVE JORGE RICARDO', document_id: '41748219', primary_role: 'OPERADOR_CICLONES_1', shift_code: 'G1', radio_channel: 'Canal 2 Ciclones', phone_extension: 'Ext. 4124', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-vilma-g1', name: 'ROSADO FALCON VILMA LUCIA', document_id: '45564062', primary_role: 'OPERADOR_CICLONES_2', shift_code: 'G1', radio_channel: 'Canal 2 Ciclones', phone_extension: 'Ext. 4123', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-jhofer-g1', name: 'PARI COAYLA JHOFER LUIS', document_id: '74924255', primary_role: 'OPERADOR_DISTRIBUIDOR', shift_code: 'G1', radio_channel: 'Canal 6 Distribuidor / Flujo', phone_extension: 'Ext. 4121', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-diego-g1', name: 'MONTES RODRIGUEZ DIEGO ALEXANDER', document_id: '45437279', primary_role: 'OPERADOR_DESCARGA_1', shift_code: 'G1', radio_channel: 'Canal 4 Presa / Descarga', phone_extension: 'Ext. 4120', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-ronal-g1', name: 'MAMANI MIRANDA RONAL', document_id: '72958467', primary_role: 'OPERADOR_DESCARGA_2', shift_code: 'G1', radio_channel: 'Canal 4 Presa / Descarga', phone_extension: 'Ext. 4119', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-anthony-g1', name: 'MAMANI CUTIPA ANTHONY JESUS SMIT', document_id: '72297288', primary_role: 'OPERADOR_MISCELANEOS', shift_code: 'G1', radio_channel: 'Canal 5 Auxiliares / Planta', phone_extension: 'Ext. 4118', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },

    // Guardia 2 (G2) - 1 Supervisor + 7 Operadores
    { id: 'op-victor-g2', name: 'LLERENA CALLE-BRACAMONTE VICTOR ALEJANDRO II', document_id: '71491945', primary_role: 'SUPERVISOR', shift_code: 'G2', radio_channel: 'Canal 1 Operaciones / Control', phone_extension: 'Ext. 4117', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-edson-g2', name: 'HILARI CABRERA EDSON EUSEBIO', document_id: '40824273', primary_role: 'OPERADOR_BOMBAS', shift_code: 'G2', radio_channel: 'Canal 3 Bombas', phone_extension: 'Ext. 4116', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-emilio-g2', name: 'ALIAGA CASTAÑEDA EMILIO URIEL', document_id: '46593500', primary_role: 'OPERADOR_CICLONES_1', shift_code: 'G2', radio_channel: 'Canal 2 Ciclones', phone_extension: 'Ext. 4102', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-luis-g2', name: 'CASCASI FLORES LUIS ANTONIO', document_id: '43132072', primary_role: 'OPERADOR_CICLONES_2', shift_code: 'G2', radio_channel: 'Canal 2 Ciclones', phone_extension: 'Ext. 4105', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-valerie-g2', name: 'CAYO GOMEZ VALERIE JAZMINE', document_id: '71719330', primary_role: 'OPERADOR_DISTRIBUIDOR', shift_code: 'G2', radio_channel: 'Canal 6 Distribuidor / Flujo', phone_extension: 'Ext. 4109', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-pedro-g2', name: 'CHOQUE MANZANO PEDRO IVAN', document_id: '75555937', primary_role: 'OPERADOR_DESCARGA_1', shift_code: 'G2', radio_channel: 'Canal 4 Presa / Descarga', phone_extension: 'Ext. 4112', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-paul-g2', name: 'CRUZ APAZA PAUL', document_id: '44428468', primary_role: 'OPERADOR_DESCARGA_2', shift_code: 'G2', radio_channel: 'Canal 4 Presa / Descarga', phone_extension: 'Ext. 4115', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-carlos-g2', name: 'BARRIOS HUAMÁN CARLOS', document_id: '72190458', primary_role: 'OPERADOR_MISCELANEOS', shift_code: 'G2', radio_channel: 'Canal 5 Auxiliares / Planta', phone_extension: 'Ext. 4130', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },

    // Guardia 3 (G3) - 1 Supervisor + 7 Operadores
    { id: 'op-sup-g3', name: 'MENDOZA QUISPE HÉCTOR', document_id: '41920394', primary_role: 'SUPERVISOR', shift_code: 'G3', radio_channel: 'Canal 1 Operaciones / Control', phone_extension: 'Ext. 4140', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-bmb-g3', name: 'CHÁVEZ ROJAS MARCO ANTONIO', document_id: '70491823', primary_role: 'OPERADOR_BOMBAS', shift_code: 'G3', radio_channel: 'Canal 3 Bombas', phone_extension: 'Ext. 4141', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-cyc1-g3', name: 'TORRES FLORES ÁNGEL', document_id: '43920194', primary_role: 'OPERADOR_CICLONES_1', shift_code: 'G3', radio_channel: 'Canal 2 Ciclones', phone_extension: 'Ext. 4142', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-cyc2-g3', name: 'GUTIÉRREZ VERA JUAN CARLOS', document_id: '71829304', primary_role: 'OPERADOR_CICLONES_2', shift_code: 'G3', radio_channel: 'Canal 2 Ciclones', phone_extension: 'Ext. 4143', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-dist-g3', name: 'QUISPE APAZA RENATO', document_id: '45819203', primary_role: 'OPERADOR_DISTRIBUIDOR', shift_code: 'G3', radio_channel: 'Canal 6 Distribuidor / Flujo', phone_extension: 'Ext. 4144', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-des1-g3', name: 'HUAMÁN CARBAJAL EDGAR', document_id: '74829104', primary_role: 'OPERADOR_DESCARGA_1', shift_code: 'G3', radio_channel: 'Canal 4 Presa / Descarga', phone_extension: 'Ext. 4145', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-des2-g3', name: 'SALAS VÁSQUEZ GABRIEL', document_id: '42910293', primary_role: 'OPERADOR_DESCARGA_2', shift_code: 'G3', radio_channel: 'Canal 4 Presa / Descarga', phone_extension: 'Ext. 4146', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-misc-g3', name: 'FERNÁNDEZ COSI WILBER', document_id: '73910293', primary_role: 'OPERADOR_MISCELANEOS', shift_code: 'G3', radio_channel: 'Canal 5 Auxiliares / Planta', phone_extension: 'Ext. 4147', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80' },

    // Guardia 4 (G4) - 1 Supervisor + 7 Operadores
    { id: 'op-sup-g4', name: 'ORTEGA RAMÍREZ CESAR', document_id: '40918239', primary_role: 'SUPERVISOR', shift_code: 'G4', radio_channel: 'Canal 1 Operaciones / Control', phone_extension: 'Ext. 4160', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-bmb-g4', name: 'CAMPOS ZEA OSWALDO', document_id: '72910394', primary_role: 'OPERADOR_BOMBAS', shift_code: 'G4', radio_channel: 'Canal 3 Bombas', phone_extension: 'Ext. 4161', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-cyc1-g4', name: 'SUÁREZ MAMANI JULIO', document_id: '44819203', primary_role: 'OPERADOR_CICLONES_1', shift_code: 'G4', radio_channel: 'Canal 2 Ciclones', phone_extension: 'Ext. 4162', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-cyc2-g4', name: 'DELGADO PACHECO ENRIQUE', document_id: '71920394', primary_role: 'OPERADOR_CICLONES_2', shift_code: 'G4', radio_channel: 'Canal 2 Ciclones', phone_extension: 'Ext. 4163', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-dist-g4', name: 'TITO CONDORI SAMUEL', document_id: '46819203', primary_role: 'OPERADOR_DISTRIBUIDOR', shift_code: 'G4', radio_channel: 'Canal 6 Distribuidor / Flujo', phone_extension: 'Ext. 4164', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-des1-g4', name: 'CORNEJO NINA ALONSO', document_id: '75910293', primary_role: 'OPERADOR_DESCARGA_1', shift_code: 'G4', radio_channel: 'Canal 4 Presa / Descarga', phone_extension: 'Ext. 4165', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-des2-g4', name: 'VILLALBA ZAPATA OSCAR', document_id: '43819203', primary_role: 'OPERADOR_DESCARGA_2', shift_code: 'G4', radio_channel: 'Canal 4 Presa / Descarga', phone_extension: 'Ext. 4166', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-misc-g4', name: 'ZAMORA PÉREZ CHRISTIAN', document_id: '72819203', primary_role: 'OPERADOR_MISCELANEOS', shift_code: 'G4', radio_channel: 'Canal 5 Auxiliares / Planta', phone_extension: 'Ext. 4167', status: 'EN_TURNO', avatar_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80' }
  ];

  // Reactive State Signals
  positions = signal<CrewPositionMeta[]>(this.defaultPositions);
  crewMembers = signal<CrewMember[]>([]);
  allMembers = signal<CrewMember[]>(this.defaultMembers);
  activeAssignments = signal<CrewAreaAssignment[]>([]);
  isLoading = signal<boolean>(false);

  constructor() {
    this.loadPositions().subscribe();
  }

  // ==========================================
  // 1. POSITIONS MANAGEMENT (STANDARD & CUSTOM)
  // ==========================================
  loadPositions(): Observable<CrewPositionMeta[]> {
    const cachedCustom = this.loadCachedCustomPositions();
    const initialList = [...this.defaultPositions, ...cachedCustom];
    this.positions.set(initialList);

    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/positions`).pipe(
      tap(res => {
        if (res?.success && Array.isArray(res.data)) {
          const apiCustoms: CrewPositionMeta[] = res.data.map(d => ({
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
        if (res?.success && res.data?.length > 0) {
          const clean = res.data.map(m => ({
            ...m,
            shift_code: m.shift_code === 'GUARDIA_A' ? 'G1' :
                        m.shift_code === 'GUARDIA_B' ? 'G2' :
                        m.shift_code === 'GUARDIA_C' ? 'G3' :
                        m.shift_code === 'GUARDIA_D' ? 'G4' : (m.shift_code || 'G1')
          }));
          this.allMembers.set(clean);
          const filtered = normShift ? clean.filter(m => m.shift_code === normShift) : clean;
          this.crewMembers.set(filtered);
          this.saveCache('basetrack_crew_members', clean);
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
      operator_id: payload.operator_id || '',
      backup_operator_id: payload.backup_operator_id || null,
      epp_verified: payload.epp_verified !== undefined ? payload.epp_verified : 1,
      safety_talk_completed: payload.safety_talk_completed !== undefined ? payload.safety_talk_completed : 1,
      radio_channel: payload.radio_channel,
      station_location: payload.station_location,
      notes: payload.notes
    };

    // Optimistic local update
    const current = [...this.activeAssignments()];
    const idx = current.findIndex(a => a.position_key === completePayload.position_key);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...completePayload };
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

  private loadCachedMembers(shift?: string): void {
    const normShift = shift === 'GUARDIA_A' ? 'G1' :
                      shift === 'GUARDIA_B' ? 'G2' :
                      shift === 'GUARDIA_C' ? 'G3' :
                      shift === 'GUARDIA_D' ? 'G4' : shift;
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      this.allMembers.set(this.defaultMembers);
      this.crewMembers.set(normShift ? this.defaultMembers.filter(m => m.shift_code === normShift) : this.defaultMembers);
      return;
    }
    try {
      const cached = localStorage.getItem('basetrack_crew_members');
      let list = this.defaultMembers;
      if (cached) {
        const parsed = JSON.parse(cached);
        const hasOldMocks = Array.isArray(parsed) && parsed.some((m: any) => m.name === 'Juan Pérez Huamán' || m.document_id === '70412893');
        if (Array.isArray(parsed) && parsed.length >= 15 && !hasOldMocks) {
          list = parsed.map((m: any) => ({
            ...m,
            shift_code: m.shift_code === 'GUARDIA_A' ? 'G1' :
                        m.shift_code === 'GUARDIA_B' ? 'G2' :
                        m.shift_code === 'GUARDIA_C' ? 'G3' :
                        m.shift_code === 'GUARDIA_D' ? 'G4' : (m.shift_code || 'G1')
          }));
          this.saveCache('basetrack_crew_members', list);
        }
      }
      this.allMembers.set(list);
      this.crewMembers.set(normShift ? list.filter(m => m.shift_code === normShift) : list);
    } catch {
      this.allMembers.set(this.defaultMembers);
      this.crewMembers.set(normShift ? this.defaultMembers.filter(m => m.shift_code === normShift) : this.defaultMembers);
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
        const hasOldMocks = Array.isArray(parsed) && parsed.some((a: any) => a.operator_name === 'Juan Pérez Huamán' || a.operator_name === 'Manuel Condori Ramos');
        if (Array.isArray(parsed) && parsed.length > 0 && !hasOldMocks) {
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

  private synthesizeDefaultAssignments(date: string, shiftCode: string, shiftType: 'DIA' | 'NOCHE'): void {
    const all = this.allMembers().length > 0 ? this.allMembers() : this.defaultMembers;
    const shiftMembers = all.filter(m => m.shift_code === shiftCode);
    const members = shiftMembers.length > 0 ? shiftMembers : all;

    const opSupervisor = members.find(m => m.primary_role === 'SUPERVISOR') || members[0];
    const opBombas = members.find(m => m.primary_role === 'OPERADOR_BOMBAS') || members[1] || members[0];
    const opCiclones1 = members.find(m => m.primary_role === 'OPERADOR_CICLONES_1') || members[2] || members[0];
    const opCiclones2 = members.find(m => m.primary_role === 'OPERADOR_CICLONES_2') || members[3] || members[0];
    const opDistribuidor = members.find(m => m.primary_role === 'OPERADOR_DISTRIBUIDOR') || members[4] || members[0];
    const opDescarga1 = members.find(m => m.primary_role === 'OPERADOR_DESCARGA_1') || members[5] || members[0];
    const opDescarga2 = members.find(m => m.primary_role === 'OPERADOR_DESCARGA_2') || members[6] || members[0];
    const opMisc = members.find(m => m.primary_role === 'OPERADOR_MISCELANEOS') || members[7] || members[0];

    const defaults: CrewAreaAssignment[] = [
      {
        id: `assign-sup-${shiftCode}-${shiftType}`,
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'SUPERVISOR',
        position_title: 'Supervisor de Guardia',
        operator_id: opSupervisor?.id || 'op-klisman-g1',
        operator_name: opSupervisor?.name || 'VIZCARRA CORI MANLEY KLISMAN',
        operator_avatar: opSupervisor?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
        operator_role: 'SUPERVISOR',
        operator_phone: opSupervisor?.phone_extension || 'Ext. 4125',
        operator_default_radio: opSupervisor?.radio_channel || 'Canal 1 Operaciones / Control',
        backup_operator_id: null,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 1 Operaciones / Control',
        station_location: 'Sala de Control & Supervisión de Turno',
        notes: 'Liderazgo de guardia, supervisión operativa y control SCADA'
      },
      {
        id: `assign-bombas-${shiftCode}-${shiftType}`,
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'BOMBAS',
        position_title: 'Operador de bombas',
        operator_id: opBombas?.id || 'op-carlos-g1',
        operator_name: opBombas?.name || 'PILCO APAZA CARLOS EDUARDO',
        operator_avatar: opBombas?.avatar_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
        operator_role: 'OPERADOR_BOMBAS',
        operator_phone: opBombas?.phone_extension || 'Ext. 4122',
        operator_default_radio: opBombas?.radio_channel || 'Canal 3 Bombas',
        backup_operator_id: opMisc?.id || null,
        backup_name: opMisc?.name,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 3 Bombas',
        station_location: 'Sala de Bombas Slurry PP-101 a PP-104 & Sentinas',
        notes: 'Monitoreo de flujo, amperaje y presión en bombas y pozas'
      },
      {
        id: `assign-ciclones1-${shiftCode}-${shiftType}`,
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'CICLONES_1',
        position_title: 'Operador de ciclones 1',
        operator_id: opCiclones1?.id || 'op-jorge-g1',
        operator_name: opCiclones1?.name || 'VILCAMIZA PEVE JORGE RICARDO',
        operator_avatar: opCiclones1?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
        operator_role: 'OPERADOR_CICLONES_1',
        operator_phone: opCiclones1?.phone_extension || 'Ext. 4124',
        operator_default_radio: opCiclones1?.radio_channel || 'Canal 2 Ciclones',
        backup_operator_id: opMisc?.id || null,
        backup_name: opMisc?.name,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 2 Ciclones',
        station_location: '1ra Estación Baterías de Ciclones D-10',
        notes: 'Muestreo metalúrgico horario en 1ra estación, presiones y mallas'
      },
      {
        id: `assign-ciclones2-${shiftCode}-${shiftType}`,
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'CICLONES_2',
        position_title: 'Operador de ciclones 2',
        operator_id: opCiclones2?.id || 'op-vilma-g1',
        operator_name: opCiclones2?.name || 'ROSADO FALCON VILMA LUCIA',
        operator_avatar: opCiclones2?.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
        operator_role: 'OPERADOR_CICLONES_2',
        operator_phone: opCiclones2?.phone_extension || 'Ext. 4123',
        operator_default_radio: opCiclones2?.radio_channel || 'Canal 2 Ciclones',
        backup_operator_id: opMisc?.id || null,
        backup_name: opMisc?.name,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 2 Ciclones',
        station_location: '2da Estación Baterías de Ciclones D-10',
        notes: 'Planilla metalúrgica, % de sólidos y granulometría de malla -200'
      },
      {
        id: `assign-dist-${shiftCode}-${shiftType}`,
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'DISTRIBUIDOR',
        position_title: 'Operador de distribuidor',
        operator_id: opDistribuidor?.id || 'op-jhofer-g1',
        operator_name: opDistribuidor?.name || 'PARI COAYLA JHOFER LUIS',
        operator_avatar: opDistribuidor?.avatar_url || 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80',
        operator_role: 'OPERADOR_DISTRIBUIDOR',
        operator_phone: opDistribuidor?.phone_extension || 'Ext. 4121',
        operator_default_radio: opDistribuidor?.radio_channel || 'Canal 6 Distribuidor / Flujo',
        backup_operator_id: opMisc?.id || null,
        backup_name: opMisc?.name,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 6 Distribuidor / Flujo',
        station_location: 'Cajón Distribuidor & Repartición de Carga',
        notes: 'Distribución uniforme de carga y flujo hacia líneas de clasificación'
      },
      {
        id: `assign-descarga1-${shiftCode}-${shiftType}`,
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'DESCARGA_1',
        position_title: 'Operador de descarga 1',
        operator_id: opDescarga1?.id || 'op-diego-g1',
        operator_name: opDescarga1?.name || 'MONTES RODRIGUEZ DIEGO ALEXANDER',
        operator_avatar: opDescarga1?.avatar_url || 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80',
        operator_role: 'OPERADOR_DESCARGA_1',
        operator_phone: opDescarga1?.phone_extension || 'Ext. 4120',
        operator_default_radio: opDescarga1?.radio_channel || 'Canal 4 Presa / Descarga',
        backup_operator_id: opMisc?.id || null,
        backup_name: opMisc?.name,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 4 Presa / Descarga',
        station_location: 'Línea HDPE de Impulsión & Estación Relaves',
        notes: 'Supervisión de presiones en línea HDPE y flujo de pulpa espesada'
      },
      {
        id: `assign-descarga2-${shiftCode}-${shiftType}`,
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'DESCARGA_2',
        position_title: 'Operador de descarga 2',
        operator_id: opDescarga2?.id || 'op-ronal-g1',
        operator_name: opDescarga2?.name || 'MAMANI MIRANDA RONAL',
        operator_avatar: opDescarga2?.avatar_url || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
        operator_role: 'OPERADOR_DESCARGA_2',
        operator_phone: opDescarga2?.phone_extension || 'Ext. 4119',
        operator_default_radio: opDescarga2?.radio_channel || 'Canal 4 Presa / Descarga',
        backup_operator_id: opMisc?.id || null,
        backup_name: opMisc?.name,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 4 Presa / Descarga',
        station_location: 'Presa Principal de Relaves & Muro de Contención',
        notes: 'Inspección de vertederos, nivel de laguna, borde libre y piezómetros'
      },
      {
        id: `assign-misc-${shiftCode}-${shiftType}`,
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'MISCELANEOS',
        position_title: 'Operador de misceláneos',
        operator_id: opMisc?.id || 'op-anthony-g1',
        operator_name: opMisc?.name || 'MAMANI CUTIPA ANTHONY JESUS SMIT',
        operator_avatar: opMisc?.avatar_url || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80',
        operator_role: 'OPERADOR_MISCELANEOS',
        operator_phone: opMisc?.phone_extension || 'Ext. 4118',
        operator_default_radio: opMisc?.radio_channel || 'Canal 5 Auxiliares / Planta',
        backup_operator_id: null,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 5 Auxiliares / Planta',
        station_location: 'Planta de Reactivos, Floculante & Servicios Auxiliares',
        notes: 'Preparación de reactivos, apoyo en espesadores e inspección general'
      }
    ];

    this.activeAssignments.set(defaults);
    this.saveCache(`basetrack_assignments_${date}_${shiftCode}_${shiftType}`, defaults);
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
