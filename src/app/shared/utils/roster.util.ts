/**
 * BASETRACK APP - Sistema de Roster de Guardias y Rol de Turnos
 * Régimen Operacional Minero: 8x8 (4 Días + 4 Noches = 8 Trabajo x 8 Descanso/Bajada)
 * Turnos de 12 horas:
 * - Turno Día:  07:00 a 19:00
 * - Turno Noche: 19:00 a 07:00
 * 
 * Rotación Cíclica de 16 días (4 bloques de 4 días):
 * - Bloque 1 (4d): Día G1 | Noche G3 | Descanso G2, G4
 * - Bloque 2 (4d): Día G2 | Noche G1 | Descanso G3, G4
 * - Bloque 3 (4d): Día G4 | Noche G2 | Descanso G1, G3 (Anclado: 26-Sep-2026 G1 inicia descanso)
 * - Bloque 4 (4d): Día G3 (Hugo M.) | Noche G4 | Descanso G1, G2
 */

export type GuardCode = 'G1' | 'G2' | 'G3' | 'G4';
export type ShiftType = 'DIA' | 'NOCHE' | 'DESCANSO';

export interface GuardInfo {
  code: GuardCode;
  name: string;
  supervisorName: string;
  supervisorUser: string;
  colorHex: string;
  bgLight: string;
  badgeBorder: string;
  avatarUrl: string;
}

export const GUARDS_CATALOG: Record<GuardCode, GuardInfo> = {
  G1: {
    code: 'G1',
    name: 'Guardia 1',
    supervisorName: 'Sin Asignar',
    supervisorUser: '',
    colorHex: '#1d4ed8', // Azul Cobalto
    bgLight: '#eff6ff',
    badgeBorder: '#93c5fd',
    avatarUrl: ''
  },
  G2: {
    code: 'G2',
    name: 'Guardia 2',
    supervisorName: 'Sin Asignar',
    supervisorUser: '',
    colorHex: '#059669', // Verde Esmeralda
    bgLight: '#ecfdf5',
    badgeBorder: '#6ee7b7',
    avatarUrl: ''
  },
  G3: {
    code: 'G3',
    name: 'Guardia 3',
    supervisorName: 'Sin Asignar',
    supervisorUser: '',
    colorHex: '#d97706', // Ámbar Minero
    bgLight: '#fffbeb',
    badgeBorder: '#fcd34d',
    avatarUrl: ''
  },
  G4: {
    code: 'G4',
    name: 'Guardia 4',
    supervisorName: 'Sin Asignar',
    supervisorUser: '',
    colorHex: '#7c3aed', // Púrpura Industrial
    bgLight: '#f5f3ff',
    badgeBorder: '#c4b5fd',
    avatarUrl: ''
  }
};

/**
 * Permite actualizar dinámicamente el catálogo de guardias con supervisores cargados desde API o lote.
 */
export function updateGuardsCatalog(supervisors: Partial<Record<GuardCode, Partial<GuardInfo>>>): void {
  (Object.keys(supervisors) as GuardCode[]).forEach(code => {
    if (GUARDS_CATALOG[code] && supervisors[code]) {
      const s = supervisors[code]!;
      if (s.supervisorName) GUARDS_CATALOG[code].supervisorName = s.supervisorName;
      if (s.supervisorUser) GUARDS_CATALOG[code].supervisorUser = s.supervisorUser;
      if (s.avatarUrl) GUARDS_CATALOG[code].avatarUrl = s.avatarUrl;
    }
  });
}

// Validar y cargar automáticamente supervisores guardados en almacenamiento local si existen
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    const rawCrew = localStorage.getItem('basetrack_crew_members');
    if (rawCrew) {
      const parsed = JSON.parse(rawCrew);
      const isStale = Array.isArray(parsed) && parsed.some((m: any) => 
        (m.shift_code === 'G1' && m.primary_role === 'SUPERVISOR' && !m.name?.includes('GONGORA')) ||
        (m.shift_code === 'G2' && m.primary_role === 'SUPERVISOR' && !m.name?.includes('ALIAGA')) ||
        (m.shift_code === 'G3' && m.primary_role === 'SUPERVISOR' && !m.name?.includes('ARI MAMANI')) ||
        (m.shift_code === 'G4' && m.primary_role === 'SUPERVISOR' && !m.name?.includes('FERNANDEZ')) ||
        m.name?.includes('Roberto Quispe') ||
        m.name?.includes('Marco Vel') ||
        (m.primary_role === 'SUPERVISOR' && (m.name?.includes('VIZCARRA CORI') || m.name?.includes('LLERENA CALLE') || m.name?.includes('MENDOZA QUISPE') || m.name?.includes('ORTEGA RAM')))
      );

      if (isStale) {
        localStorage.removeItem('basetrack_crew_members');
        localStorage.removeItem('basetrack_supervisor_operators');
        localStorage.removeItem('basetrack_my_operators');
      } else if (Array.isArray(parsed)) {
        const foundSups: Partial<Record<GuardCode, Partial<GuardInfo>>> = {};
        parsed.forEach((m: any) => {
          const shift = (m.shift_code || m.shift) as GuardCode;
          if (['G1', 'G2', 'G3', 'G4'].includes(shift) && m.primary_role === 'SUPERVISOR') {
            foundSups[shift] = {
              supervisorName: m.name || m.full_name,
              supervisorUser: m.username || m.name,
              avatarUrl: m.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.name}`
            };
          }
        });
        if (Object.keys(foundSups).length > 0) {
          updateGuardsCatalog(foundSups);
        }
      }
    }
  } catch (e) {
    // Ignorar error de parseo local
  }
}

export interface GuardDailyStatus {
  guard: GuardInfo;
  shift: ShiftType;
  shiftLabel: string;
  dayInStage: number; // Ej. Día 2 de 4 en DÍA, o Día 5 de 8 en DESCANSO
  totalDaysInStage: number; // 4 para DÍA/NOCHE, 8 para DESCANSO
}

export interface DayRoster {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  dayOfWeek: number; // 0=Dom, 1=Lun, ..., 6=Sáb
  dayName: string; // "Lunes", "Martes", etc.
  cycleDay: number; // 0..15
  blockNumber: number; // 1, 2, 3, 4
  dayInBlock: number; // 1..4
  dayShiftGuard: GuardInfo;
  nightShiftGuard: GuardInfo;
  offGuards: GuardInfo[];
  guardStatus: Record<GuardCode, GuardDailyStatus>;
  isToday: boolean;
}

export interface MonthRoster {
  year: number;
  month: number; // 0-indexed (0=Enero, 8=Septiembre, 9=Octubre)
  monthName: string;
  days: DayRoster[];
  currentDayRoster?: DayRoster;
}

// Fecha ancla: 26 de septiembre de 2026 inició el Bloque 3 (G1 entró a descanso)
// Nota: month index 8 = Septiembre
const ANCHOR_DATE = new Date(2026, 8, 26, 0, 0, 0, 0);

interface BlockDefinition {
  blockNumber: number;
  dia: GuardCode;
  noche: GuardCode;
  descanso: [GuardCode, GuardCode];
}

const BLOCKS_SEQUENCE: BlockDefinition[] = [
  // Bloque 3: (Días 0 a 3 desde 26-Sep-2026)
  { blockNumber: 3, dia: 'G4', noche: 'G2', descanso: ['G1', 'G3'] },
  // Bloque 4: (Días 4 a 7 desde 26-Sep-2026)
  { blockNumber: 4, dia: 'G3', noche: 'G4', descanso: ['G1', 'G2'] },
  // Bloque 1: (Días 8 a 11 desde 26-Sep-2026)
  { blockNumber: 1, dia: 'G1', noche: 'G3', descanso: ['G2', 'G4'] },
  // Bloque 2: (Días 12 a 15 desde 26-Sep-2026)
  { blockNumber: 2, dia: 'G2', noche: 'G1', descanso: ['G3', 'G4'] }
];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Calcula el estado de todas las guardias para una fecha dada.
 */
export function getRosterForDate(inputDate: Date | string): DayRoster {
  let target: Date;
  if (typeof inputDate === 'string') {
    const parts = inputDate.split('-').map(Number);
    target = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  } else {
    target = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate(), 0, 0, 0, 0);
  }

  const diffMs = target.getTime() - ANCHOR_DATE.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const cycleDay = ((diffDays % 16) + 16) % 16; // 0..15

  const blockSeqIndex = Math.floor(cycleDay / 4); // 0..3
  const dayInBlock = (cycleDay % 4) + 1; // 1..4

  const block = BLOCKS_SEQUENCE[blockSeqIndex];
  const dayGuard = GUARDS_CATALOG[block.dia];
  const nightGuard = GUARDS_CATALOG[block.noche];
  const offGuards = block.descanso.map(code => GUARDS_CATALOG[code]);

  // Cálculo individual de día en etapa para cada una de las 4 guardias
  const guardStatus: Record<GuardCode, GuardDailyStatus> = {} as any;

  (['G1', 'G2', 'G3', 'G4'] as GuardCode[]).forEach(code => {
    let shift: ShiftType;
    let shiftLabel: string;
    let dayInStage: number;
    let totalDaysInStage: number;

    if (code === block.dia) {
      shift = 'DIA';
      shiftLabel = 'Turno Día (07:00 - 19:00)';
      dayInStage = dayInBlock;
      totalDaysInStage = 4;
    } else if (code === block.noche) {
      shift = 'NOCHE';
      shiftLabel = 'Turno Noche (19:00 - 07:00)';
      dayInStage = dayInBlock;
      totalDaysInStage = 4;
    } else {
      shift = 'DESCANSO';
      shiftLabel = 'Descanso / Bajada';
      totalDaysInStage = 8;
      // Determinar si está en los primeros 4 días o en los últimos 4 días de descanso
      // G1 descansa en Bloque 3 (días 1-4) y Bloque 4 (días 5-8)
      // G2 descansa en Bloque 4 (días 1-4) y Bloque 1 (días 5-8)
      // G4 descansa en Bloque 1 (días 1-4) y Bloque 2 (días 5-8)
      // G3 descansa en Bloque 2 (días 1-4) y Bloque 3 (días 5-8)
      if (code === 'G1') {
        dayInStage = (block.blockNumber === 3) ? dayInBlock : 4 + dayInBlock;
      } else if (code === 'G2') {
        dayInStage = (block.blockNumber === 4) ? dayInBlock : 4 + dayInBlock;
      } else if (code === 'G4') {
        dayInStage = (block.blockNumber === 1) ? dayInBlock : 4 + dayInBlock;
      } else { // G3
        dayInStage = (block.blockNumber === 2) ? dayInBlock : 4 + dayInBlock;
      }
    }

    guardStatus[code] = {
      guard: GUARDS_CATALOG[code],
      shift,
      shiftLabel,
      dayInStage,
      totalDaysInStage
    };
  });

  const now = new Date();
  const isToday = (
    now.getFullYear() === target.getFullYear() &&
    now.getMonth() === target.getMonth() &&
    now.getDate() === target.getDate()
  );

  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');

  return {
    date: target,
    dateStr: `${yyyy}-${mm}-${dd}`,
    dayNumber: target.getDate(),
    dayOfWeek: target.getDay(),
    dayName: DAY_NAMES[target.getDay()],
    cycleDay,
    blockNumber: block.blockNumber,
    dayInBlock,
    dayShiftGuard: dayGuard,
    nightShiftGuard: nightGuard,
    offGuards,
    guardStatus,
    isToday
  };
}

/**
 * Obtiene el calendario mensual completo con el Roster de todos sus días.
 */
export function getMonthRoster(year: number, monthIndex: number): MonthRoster {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days: DayRoster[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIndex, d);
    days.push(getRosterForDate(date));
  }

  const todayRoster = days.find(d => d.isToday) || getRosterForDate(new Date());

  return {
    year,
    month: monthIndex,
    monthName: MONTH_NAMES[monthIndex],
    days,
    currentDayRoster: todayRoster
  };
}

/**
 * Retorna la fecha local en formato YYYY-MM-DD sin desplazamiento UTC
 */
export function getLocalDateString(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Determina cuál guardia está activamente en planta en este instante según la hora local.
 * Turno Día: 07:00:00 a 18:59:59
 * Turno Noche: 19:00:00 a 06:59:59
 */
export function getCurrentActiveShift(): {
  activeGuard: GuardInfo;
  nextGuard: GuardInfo;
  shiftName: 'DIA' | 'NOCHE';
  referenceDate: Date;
  dateStr: string;
} {
  const now = new Date();
  const currentHour = now.getHours();
  const isDayShift = currentHour >= 7 && currentHour < 19;

  // Si son antes de las 07:00, todavía corresponde a la noche de la fecha calendario anterior
  const referenceDate = new Date(now);
  if (currentHour < 7) {
    referenceDate.setDate(referenceDate.getDate() - 1);
  }

  const dateStr = getLocalDateString(referenceDate);
  const dayRoster = getRosterForDate(referenceDate);

  if (isDayShift) {
    return {
      activeGuard: dayRoster.dayShiftGuard,
      nextGuard: dayRoster.nightShiftGuard,
      shiftName: 'DIA',
      referenceDate,
      dateStr
    };
  } else {
    // Si estamos en noche, la activa es nightShiftGuard y la siguiente es la del día siguiente
    const nextDay = new Date(referenceDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextRoster = getRosterForDate(nextDay);
    return {
      activeGuard: dayRoster.nightShiftGuard,
      nextGuard: nextRoster.dayShiftGuard,
      shiftName: 'NOCHE',
      referenceDate,
      dateStr
    };
  }
}
