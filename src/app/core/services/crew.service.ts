import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { OfflineSyncService } from '../offline/offline-sync.service';

export type PositionKey = 'BOMBAS' | 'CICLONES' | 'DESCARGA' | 'MISCELANEOS' | 'RELEVO';

export interface CrewMember {
  id: string;
  name: string;
  document_id: string;
  primary_role: 'OPERADOR_BOMBAS' | 'OPERADOR_CICLONES' | 'OPERADOR_DESCARGA' | 'OPERADOR_MISCELANEOS' | 'OPERADOR_RELEVO' | 'SUPERVISOR';
  shift_code: 'GUARDIA_A' | 'GUARDIA_B' | 'GUARDIA_C';
  radio_channel: string;
  phone_extension?: string;
  status: 'EN_TURNO' | 'DESCANSO' | 'VACACIONES' | 'PERMISO' | 'CAPACITACION';
  avatar_url: string;
  created_at?: string;
}

export interface CrewAreaAssignment {
  id: string;
  shift_code: string;
  shift_date: string;
  shift_type: 'DIA' | 'NOCHE';
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

@Injectable({
  providedIn: 'root'
})
export class CrewService {
  private http = inject(HttpClient);
  private offlineSync = inject(OfflineSyncService);
  private apiUrl = 'http://localhost:3001/api/crew';

  // Reactive State Signals
  crewMembers = signal<CrewMember[]>([]);
  activeAssignments = signal<CrewAreaAssignment[]>([]);
  isLoading = signal<boolean>(false);

  // Default fallback seeds when offline or first load (15 Official Plant Operators)
  private defaultMembers: CrewMember[] = [
    // Guardia A
    {
      id: 'op-klisman-a',
      name: 'VIZCARRA CORI MANLEY KLISMAN',
      document_id: '71209033',
      primary_role: 'OPERADOR_BOMBAS',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 3 Bombas',
      phone_extension: 'Ext. 4125',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-carlos-a',
      name: 'PILCO APAZA CARLOS EDUARDO',
      document_id: '42324277',
      primary_role: 'OPERADOR_CICLONES',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 2 Ciclones',
      phone_extension: 'Ext. 4122',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-jorge-a',
      name: 'VILCAMIZA PEVE JORGE RICARDO',
      document_id: '41748219',
      primary_role: 'OPERADOR_DESCARGA',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 4 Presa',
      phone_extension: 'Ext. 4124',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-vilma-a',
      name: 'ROSADO FALCON VILMA LUCIA',
      document_id: '45564062',
      primary_role: 'OPERADOR_MISCELANEOS',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 1 Operaciones',
      phone_extension: 'Ext. 4123',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-jhofer-a',
      name: 'PARI COAYLA JHOFER LUIS',
      document_id: '74924255',
      primary_role: 'OPERADOR_RELEVO',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 5 Relevo/Móvil',
      phone_extension: 'Ext. 4121',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-diego-a',
      name: 'MONTES RODRIGUEZ DIEGO ALEXANDER',
      document_id: '45437279',
      primary_role: 'OPERADOR_BOMBAS',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 3 Bombas',
      phone_extension: 'Ext. 4120',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-ronal-a',
      name: 'MAMANI MIRANDA RONAL',
      document_id: '72958467',
      primary_role: 'OPERADOR_CICLONES',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 2 Ciclones',
      phone_extension: 'Ext. 4119',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-anthony-a',
      name: 'MAMANI CUTIPA ANTHONY JESUS SMIT',
      document_id: '72297288',
      primary_role: 'OPERADOR_DESCARGA',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 4 Presa',
      phone_extension: 'Ext. 4118',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-victor-a',
      name: 'LLERENA CALLE-BRACAMONTE VICTOR ALEJANDRO II',
      document_id: '71491945',
      primary_role: 'OPERADOR_MISCELANEOS',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 1 Operaciones',
      phone_extension: 'Ext. 4117',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-edson-a',
      name: 'HILARI CABRERA EDSON EUSEBIO',
      document_id: '40824273',
      primary_role: 'OPERADOR_RELEVO',
      shift_code: 'GUARDIA_A',
      radio_channel: 'Canal 5 Relevo/Móvil',
      phone_extension: 'Ext. 4116',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80'
    },

    // Guardia B
    {
      id: 'op-emilio-b',
      name: 'ALIAGA CASTAÑEDA EMILIO URIEL',
      document_id: '46593500',
      primary_role: 'OPERADOR_BOMBAS',
      shift_code: 'GUARDIA_B',
      radio_channel: 'Canal 3 Bombas',
      phone_extension: 'Ext. 4102',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-luis-b',
      name: 'CASCASI FLORES LUIS ANTONIO',
      document_id: '43132072',
      primary_role: 'OPERADOR_CICLONES',
      shift_code: 'GUARDIA_B',
      radio_channel: 'Canal 2 Ciclones',
      phone_extension: 'Ext. 4105',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-valerie-b',
      name: 'CAYO GOMEZ VALERIE JAZMINE',
      document_id: '71719330',
      primary_role: 'OPERADOR_DESCARGA',
      shift_code: 'GUARDIA_B',
      radio_channel: 'Canal 4 Presa',
      phone_extension: 'Ext. 4109',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-pedro-b',
      name: 'CHOQUE MANZANO PEDRO IVAN',
      document_id: '75555937',
      primary_role: 'OPERADOR_MISCELANEOS',
      shift_code: 'GUARDIA_B',
      radio_channel: 'Canal 1 Operaciones',
      phone_extension: 'Ext. 4112',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80'
    },
    {
      id: 'op-paul-b',
      name: 'CRUZ APAZA PAUL',
      document_id: '44428468',
      primary_role: 'OPERADOR_RELEVO',
      shift_code: 'GUARDIA_B',
      radio_channel: 'Canal 5 Relevo/Móvil',
      phone_extension: 'Ext. 4115',
      status: 'EN_TURNO',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80'
    }
  ];

  loadCrew(shift?: string): Observable<any> {
    this.isLoading.set(true);
    const url = shift ? `${this.apiUrl}/members?shift=${shift}` : `${this.apiUrl}/members`;

    return this.http.get<{ success: boolean; count: number; data: CrewMember[] }>(url).pipe(
      tap((res) => {
        this.isLoading.set(false);
        if (res?.success && res.data?.length > 0) {
          this.crewMembers.set(res.data);
          this.saveCache('basetrack_crew_members', res.data);
        } else {
          this.loadCachedMembers();
        }
      }),
      catchError((err) => {
        this.isLoading.set(false);
        console.warn('[CrewService] Error conectando a API backend, cargando caché local:', err);
        this.loadCachedMembers();
        return of({ success: true, data: this.crewMembers() });
      })
    );
  }

  loadAssignments(date: string, shiftCode: string, shiftType: 'DIA' | 'NOCHE'): Observable<any> {
    this.isLoading.set(true);
    const url = `${this.apiUrl}/assignments?date=${date}&shift_code=${shiftCode}&shift_type=${shiftType}`;

    return this.http.get<{ success: boolean; data: CrewAreaAssignment[] }>(url).pipe(
      tap((res) => {
        this.isLoading.set(false);
        if (res?.success && res.data) {
          this.activeAssignments.set(res.data);
          this.saveCache(`basetrack_assignments_${date}_${shiftCode}_${shiftType}`, res.data);
        } else {
          this.loadCachedAssignments(date, shiftCode, shiftType);
        }
      }),
      catchError((err) => {
        this.isLoading.set(false);
        console.warn('[CrewService] Error cargando asignaciones, usando respaldo local:', err);
        this.loadCachedAssignments(date, shiftCode, shiftType);
        return of({ success: true, data: this.activeAssignments() });
      })
    );
  }

  saveAssignment(payload: Partial<CrewAreaAssignment>): Observable<any> {
    const url = `${this.apiUrl}/assignments`;

    // Optimistic local update
    const current = [...this.activeAssignments()];
    const idx = current.findIndex(a => a.position_key === payload.position_key);
    if (idx >= 0) {
      current[idx] = { ...current[idx], ...payload } as CrewAreaAssignment;
    } else {
      current.push(payload as CrewAreaAssignment);
    }
    this.activeAssignments.set(current);

    if (!this.offlineSync.isOnline()) {
      this.offlineSync.queueAction(url, 'POST', payload, `Asignación ${payload.position_title || payload.position_key}`);
      return of({ success: true, message: 'Asignación guardada en cola offline' });
    }

    return this.http.post<any>(url, payload).pipe(
      tap(() => {
        if (payload.shift_date && payload.shift_code && payload.shift_type) {
          this.saveCache(`basetrack_assignments_${payload.shift_date}_${payload.shift_code}_${payload.shift_type}`, current);
        }
      }),
      catchError((err) => {
        console.warn('[CrewService] Fallo al guardar en backend, agregando a cola offline:', err);
        this.offlineSync.queueAction(url, 'POST', payload, `Asignación ${payload.position_title || payload.position_key}`);
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

    // Optimistic update
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

    if (!this.offlineSync.isOnline()) {
      const offlineId = 'local-' + Date.now();
      const localNew: CrewMember = {
        id: offlineId,
        name: member.name || '',
        document_id: member.document_id || '',
        primary_role: member.primary_role || 'OPERADOR_BOMBAS',
        shift_code: member.shift_code || 'GUARDIA_A',
        radio_channel: member.radio_channel || 'Canal 1 Operaciones',
        phone_extension: member.phone_extension,
        status: member.status || 'EN_TURNO',
        avatar_url: member.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80'
      };
      this.crewMembers.set([...this.crewMembers(), localNew]);
      this.saveCache('basetrack_crew_members', this.crewMembers());
      this.offlineSync.queueAction(url, 'POST', member, `Nuevo Operador ${member.name}`);
      return of({ success: true, id: offlineId });
    }

    return this.http.post<any>(url, member).pipe(
      tap((res) => {
        this.loadCrew(member.shift_code).subscribe();
      }),
      catchError((err) => {
        this.offlineSync.queueAction(url, 'POST', member, `Nuevo Operador ${member.name}`);
        return of({ success: true });
      })
    );
  }

  updateCrewMember(id: string, member: Partial<CrewMember>): Observable<any> {
    const url = `${this.apiUrl}/members/${id}`;

    // Optimistic update
    const updated = this.crewMembers().map(m => m.id === id ? { ...m, ...member } as CrewMember : m);
    this.crewMembers.set(updated);
    this.saveCache('basetrack_crew_members', updated);

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

    const filtered = this.crewMembers().filter(m => m.id !== id);
    this.crewMembers.set(filtered);
    this.saveCache('basetrack_crew_members', filtered);

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

  private loadCachedMembers(): void {
    try {
      const cached = localStorage.getItem('basetrack_crew_members');
      if (cached) {
        const parsed = JSON.parse(cached);
        const hasOldMocks = Array.isArray(parsed) && parsed.some((m: any) => m.name === 'Juan Pérez Huamán' || m.document_id === '70412893');
        if (Array.isArray(parsed) && parsed.length >= 15 && !hasOldMocks) {
          this.crewMembers.set(parsed);
        } else {
          this.crewMembers.set(this.defaultMembers);
          this.saveCache('basetrack_crew_members', this.defaultMembers);
        }
      } else {
        this.crewMembers.set(this.defaultMembers);
        this.saveCache('basetrack_crew_members', this.defaultMembers);
      }
    } catch {
      this.crewMembers.set(this.defaultMembers);
    }
  }

  private loadCachedAssignments(date: string, shiftCode: string, shiftType: string): void {
    try {
      const key = `basetrack_assignments_${date}_${shiftCode}_${shiftType}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const hasOldMocks = Array.isArray(parsed) && parsed.some((a: any) => a.operator_name === 'Juan Pérez Huamán' || a.operator_name === 'Manuel Condori Ramos');
        if (Array.isArray(parsed) && parsed.length > 0 && !hasOldMocks) {
          this.activeAssignments.set(parsed);
        } else {
          this.synthesizeDefaultAssignments(date, shiftCode, shiftType as 'DIA' | 'NOCHE');
        }
      } else {
        // Synthesize default 5 assignments from available members
        this.synthesizeDefaultAssignments(date, shiftCode, shiftType as 'DIA' | 'NOCHE');
      }
    } catch {
      this.synthesizeDefaultAssignments(date, shiftCode, shiftType as 'DIA' | 'NOCHE');
    }
  }

  private synthesizeDefaultAssignments(date: string, shiftCode: string, shiftType: 'DIA' | 'NOCHE'): void {
    const members = this.crewMembers();
    const opBombas = members.find(m => m.primary_role === 'OPERADOR_BOMBAS') || members[0];
    const opCiclones = members.find(m => m.primary_role === 'OPERADOR_CICLONES') || members[1] || members[0];
    const opDescarga = members.find(m => m.primary_role === 'OPERADOR_DESCARGA') || members[2] || members[0];
    const opMisc = members.find(m => m.primary_role === 'OPERADOR_MISCELANEOS') || members[3] || members[0];
    const opRelevo = members.find(m => m.primary_role === 'OPERADOR_RELEVO') || members[4] || members[0];

    const defaults: CrewAreaAssignment[] = [
      {
        id: 'assign-bombas',
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'BOMBAS',
        position_title: 'Operador de Bombas',
        operator_id: opBombas?.id || 'op-klisman-a',
        operator_name: opBombas?.name || 'VIZCARRA CORI MANLEY KLISMAN',
        operator_avatar: opBombas?.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
        operator_role: opBombas?.primary_role || 'OPERADOR_BOMBAS',
        operator_phone: opBombas?.phone_extension || 'Ext. 4125',
        operator_default_radio: 'Canal 3 Bombas',
        backup_operator_id: opRelevo?.id || null,
        backup_name: opRelevo?.name || 'PARI COAYLA JHOFER LUIS',
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 3 Bombas',
        station_location: 'Sala de Bombas Slurry & Sentina Principal',
        notes: 'Monitoreo de bombas PP-101 a PP-104 y niveles de poza'
      },
      {
        id: 'assign-ciclones',
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'CICLONES',
        position_title: 'Operador de Ciclones',
        operator_id: opCiclones?.id || 'op-carlos-a',
        operator_name: opCiclones?.name || 'PILCO APAZA CARLOS EDUARDO',
        operator_avatar: opCiclones?.avatar_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
        operator_role: opCiclones?.primary_role || 'OPERADOR_CICLONES',
        operator_phone: opCiclones?.phone_extension || 'Ext. 4122',
        operator_default_radio: 'Canal 2 Ciclones',
        backup_operator_id: opRelevo?.id || null,
        backup_name: opRelevo?.name || 'PARI COAYLA JHOFER LUIS',
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 2 Ciclones',
        station_location: '1ra y 2da Estación Baterías de Ciclones',
        notes: 'Muestreo metalúrgico horario y granulometría de mallas -200'
      },
      {
        id: 'assign-descarga',
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'DESCARGA',
        position_title: 'Operador de descarga',
        operator_id: opDescarga?.id || 'op-jorge-a',
        operator_name: opDescarga?.name || 'VILCAMIZA PEVE JORGE RICARDO',
        operator_avatar: opDescarga?.avatar_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
        operator_role: opDescarga?.primary_role || 'OPERADOR_DESCARGA',
        operator_phone: opDescarga?.phone_extension || 'Ext. 4124',
        operator_default_radio: 'Canal 4 Presa',
        backup_operator_id: opRelevo?.id || null,
        backup_name: opRelevo?.name || 'PARI COAYLA JHOFER LUIS',
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 4 Presa',
        station_location: 'Línea de Impulsión & Presa de Relaves Principal',
        notes: 'Inspección de canaletas, borde libre de presa y piezómetros'
      },
      {
        id: 'assign-miscelaneos',
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'MISCELANEOS',
        position_title: 'Operador Misceláneos',
        operator_id: opMisc?.id || 'op-vilma-a',
        operator_name: opMisc?.name || 'ROSADO FALCON VILMA LUCIA',
        operator_avatar: opMisc?.avatar_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80',
        operator_role: opMisc?.primary_role || 'OPERADOR_MISCELANEOS',
        operator_phone: opMisc?.phone_extension || 'Ext. 4123',
        operator_default_radio: 'Canal 1 Operaciones',
        backup_operator_id: opRelevo?.id || null,
        backup_name: opRelevo?.name || 'PARI COAYLA JHOFER LUIS',
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 1 Operaciones',
        station_location: 'Planta General & Muestreo Auxiliar',
        notes: 'Preparación de reactivos, control de floculante y apoyo en campo'
      },
      {
        id: 'assign-relevo',
        shift_code: shiftCode,
        shift_date: date,
        shift_type: shiftType,
        position_key: 'RELEVO',
        position_title: 'Operador de Relevo',
        operator_id: opRelevo?.id || 'op-jhofer-a',
        operator_name: opRelevo?.name || 'PARI COAYLA JHOFER LUIS',
        operator_avatar: opRelevo?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80',
        operator_role: opRelevo?.primary_role || 'OPERADOR_RELEVO',
        operator_phone: opRelevo?.phone_extension || 'Ext. 4121',
        operator_default_radio: 'Canal 5 Relevo/Móvil',
        backup_operator_id: null,
        epp_verified: 1,
        safety_talk_completed: 1,
        radio_channel: 'Canal 5 Relevo/Móvil',
        station_location: 'Cobertura Volante Móvil en Planta',
        notes: 'Cobertura de pausas activas, relevos de refrigerio y emergencias'
      }
    ];

    this.activeAssignments.set(defaults);
    this.saveCache(`basetrack_assignments_${date}_${shiftCode}_${shiftType}`, defaults);
  }

  private saveCache(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[CrewService] Error guardando en localStorage:', e);
    }
  }
}
