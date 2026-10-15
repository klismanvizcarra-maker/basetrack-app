import { MasterSheetEntry, MasterSheetNumericField } from './master-sheet.model';

/**
 * Validación de rangos físicos para registros de la Planilla Maestra (presa de relaves).
 *
 * - Reglas CRÍTICAS (topografía / borde libre): definen el estado GISTM del dashboard.
 *   Si fallan o faltan, la fila se RECHAZA y no se importa.
 * - Reglas de OBSERVACIÓN (caudales, volúmenes, horas, pH, %): la fila se importa,
 *   pero queda marcada en `validationWarnings` y se informa al usuario.
 *
 * Mantener sincronizado con `server/src/utils/master-sheet-validation.ts` (reglas críticas).
 */

export interface RangeRule {
  field: MasterSheetNumericField;
  label: string;
  min: number;
  max: number;
  unit: string;
  /** Campo opcional: un 0 significa que la planilla no trajo la columna (no se valida). */
  optional?: boolean;
}

/** Campos críticos obligatorios: sin ellos el registro no sirve para evaluar el borde libre. */
export const MASTER_SHEET_REQUIRED_FIELDS: { field: MasterSheetNumericField; label: string }[] = [
  { field: 'cotaCoronaMsnm', label: 'Cota Corona' },
  { field: 'cotaEmbalseMsnm', label: 'Cota Embalse' },
  { field: 'bordeLibreM', label: 'Borde Libre' }
];

export const MASTER_SHEET_CRITICAL_RULES: RangeRule[] = [
  { field: 'cotaCoronaMsnm', label: 'Cota Corona', min: 3000, max: 5000, unit: 'msnm' },
  { field: 'cotaEmbalseMsnm', label: 'Cota Embalse', min: 3000, max: 5000, unit: 'msnm' },
  { field: 'elevacionCotaMsnm', label: 'Elevación Cota', min: 3000, max: 5000, unit: 'msnm', optional: true },
  { field: 'bordeLibreM', label: 'Borde Libre', min: 0, max: 50, unit: 'm' }
];

const HOURS = { min: 0, max: 24, unit: 'h' };
const PCT = { min: 0, max: 100, unit: '%' };
const PH = { min: 0, max: 14, unit: 'pH' };
const VOL_DAY = { min: 0, max: 1_000_000, unit: 'm³' };
const VOL_ACUM = { min: 0, max: 2_000_000_000, unit: 'm³' };
const FLOW_LS = { min: 0, max: 5_000, unit: 'L/s' };
const FLOW_M3H = { min: 0, max: 50_000, unit: 'm³/h' };

export const MASTER_SHEET_WARNING_RULES: RangeRule[] = [
  { field: 'vertederoTurnoALs', label: 'Vertedero Turno A', ...FLOW_LS },
  { field: 'vertederoTurnoBLs', label: 'Vertedero Turno B', ...FLOW_LS },
  { field: 'vertederoPromLs', label: 'Vertedero Promedio', ...FLOW_LS },
  { field: 'vertederoTurnoAM3', label: 'Vertedero Vol. Turno A', ...VOL_DAY },
  { field: 'vertederoTurnoBM3', label: 'Vertedero Vol. Turno B', ...VOL_DAY },
  { field: 'vertederoTotalDiaM3', label: 'Vertedero Total Día', ...VOL_DAY },

  { field: 'relaveFlujoAM3h', label: 'Relave Flujo A', ...FLOW_M3H },
  { field: 'relaveFlujoBM3h', label: 'Relave Flujo B', ...FLOW_M3H },
  { field: 'relaveHorasA', label: 'Relave Horas A', ...HOURS },
  { field: 'relaveHorasB', label: 'Relave Horas B', ...HOURS },
  { field: 'relaveTotalHoras', label: 'Relave Horas Día', ...HOURS },
  { field: 'relaveVolAM3', label: 'Relave Vol. A', ...VOL_DAY },
  { field: 'relaveVolBM3', label: 'Relave Vol. B', ...VOL_DAY },
  { field: 'relaveTotalVolDiaM3', label: 'Relave Vol. Día', ...VOL_DAY },
  { field: 'relaveAcumuladoEmbalseM3', label: 'Relave Acumulado Embalse', ...VOL_ACUM },
  { field: 'crecimientoPresaM', label: 'Crecimiento diario', min: -5, max: 5, unit: 'm' },
  { field: 'volAguaRealAcumuladoM3', label: 'Vol. Agua Real (variación diaria)', min: -100_000_000, max: 100_000_000, unit: 'm³' },
  { field: 'alturaLibreOperacionalM', label: 'Altura Libre Operacional', min: -50, max: 50, unit: 'm' },

  { field: 'sentinaHorasA', label: 'Sentina Horas A', ...HOURS },
  { field: 'sentinaHorasB', label: 'Sentina Horas B', ...HOURS },
  { field: 'sentinaVolAM3', label: 'Sentina Vol. A', ...VOL_DAY },
  { field: 'sentinaVolBM3', label: 'Sentina Vol. B', ...VOL_DAY },
  { field: 'sentinaBombeadoTotalM3', label: 'Sentina Bombeado Total', ...VOL_DAY },
  { field: 'sentinaPo001NivelAPct', label: 'Nivel PO-001 A', ...PCT },
  { field: 'sentinaPo001NivelBPct', label: 'Nivel PO-001 B', ...PCT },

  { field: 'eiHorasA', label: 'Est. Intermedia Horas A', ...HOURS },
  { field: 'eiHorasB', label: 'Est. Intermedia Horas B', ...HOURS },
  { field: 'eiVolAM3', label: 'Est. Intermedia Vol. A', ...VOL_DAY },
  { field: 'eiVolBM3', label: 'Est. Intermedia Vol. B', ...VOL_DAY },
  { field: 'eiTotalM3', label: 'Est. Intermedia Total', ...VOL_DAY },
  { field: 'eiCaudalPromLs', label: 'Est. Intermedia Caudal', ...FLOW_LS },

  { field: 'phEmbalseA', label: 'pH Embalse A', ...PH },
  { field: 'phEmbalseB', label: 'pH Embalse B', ...PH },
  { field: 'phVertederoA', label: 'pH Vertedero A', ...PH },
  { field: 'phVertederoB', label: 'pH Vertedero B', ...PH },
  { field: 'phSentina', label: 'pH Sentina', ...PH },

  { field: 'torre5HorasA', label: 'Torre 5 Horas A', ...HOURS },
  { field: 'torre5HorasB', label: 'Torre 5 Horas B', ...HOURS },
  { field: 'torre5VolAM3', label: 'Torre 5 Vol. A', ...VOL_DAY },
  { field: 'torre5VolBM3', label: 'Torre 5 Vol. B', ...VOL_DAY },
  { field: 'torre5VolDiaM3', label: 'Torre 5 Vol. Día', ...VOL_DAY },
  { field: 'torre5VolAcumuladoM3', label: 'Torre 5 Acumulado', ...VOL_ACUM },

  { field: 'ciclones1raMalla200APct', label: '1ra Est. % -200M A', ...PCT },
  { field: 'ciclones1raMalla200BPct', label: '1ra Est. % -200M B', ...PCT },
  { field: 'ciclones1raMalla200PromPct', label: '1ra Est. % -200M Prom', ...PCT },
  { field: 'ciclones1raSolidosAPct', label: '1ra Est. % Sólidos A', ...PCT },
  { field: 'ciclones1raSolidosBPct', label: '1ra Est. % Sólidos B', ...PCT },
  { field: 'ciclones1raSolidosPromPct', label: '1ra Est. % Sólidos Prom', ...PCT },
  { field: 'ciclones2daMalla200APct', label: '2da Est. % -200M A', ...PCT },
  { field: 'ciclones2daMalla200BPct', label: '2da Est. % -200M B', ...PCT },
  { field: 'ciclones2daMalla200PromPct', label: '2da Est. % -200M Prom', ...PCT },
  { field: 'ciclones2daSolidosAPct', label: '2da Est. % Sólidos A', ...PCT },
  { field: 'ciclones2daSolidosBPct', label: '2da Est. % Sólidos B', ...PCT },
  { field: 'ciclones2daSolidosPromPct', label: '2da Est. % Sólidos Prom', ...PCT },
  { field: 'ciclonesPresionPsi', label: 'Presión Ciclones', min: 0, max: 200, unit: 'psi' },

  { field: 'descargaTaludHorasA', label: 'Descarga Talud Horas A', ...HOURS },
  { field: 'descargaTaludHorasB', label: 'Descarga Talud Horas B', ...HOURS },
  { field: 'descargaCoronaM3', label: 'Descarga Corona', ...VOL_DAY },
  { field: 'drenBasalM3', label: 'Dren Basal', ...VOL_DAY },
  { field: 'descargaHidraulicaM3', label: 'Descarga Hidráulica', ...VOL_DAY },

  { field: 'aguaFrescaVolAM3', label: 'Agua Fresca Turno A', ...VOL_DAY },
  { field: 'aguaFrescaVolBM3', label: 'Agua Fresca Turno B', ...VOL_DAY },
  { field: 'aguaFrescaTotalDiaM3', label: 'Agua Fresca Total Día', ...VOL_DAY },
  { field: 'ratioAguaTon', label: 'Ratio Agua/Ton', min: 0, max: 20, unit: 'm³/t' },

  { field: 'arenasFlujometroAM3', label: 'Arenas Flujómetro A', ...VOL_DAY },
  { field: 'arenasFlujometroBM3', label: 'Arenas Flujómetro B', ...VOL_DAY },
  { field: 'arenasTotalAcumM3', label: 'Arenas Total Día', ...VOL_DAY },
  { field: 'densidadPulpaA', label: 'Densidad Pulpa A', min: 0, max: 3, unit: 't/m³' },
  { field: 'densidadPulpaB', label: 'Densidad Pulpa B', min: 0, max: 3, unit: 't/m³' },
  { field: 'densidadPulpaProm', label: 'Densidad Pulpa Prom', min: 0, max: 3, unit: 't/m³' },
  { field: 'arenasProdFlujometroM3', label: 'Producción Arenas (Flujómetro)', ...VOL_DAY },
  { field: 'arenasProdTopografiaM3', label: 'Producción Arenas (Topografía)', ...VOL_DAY },
  { field: 'compactacionPct', label: '% Compactación', min: 0, max: 110, unit: '%' },

  { field: 'filtracionesDrenesLs', label: 'Filtraciones Drenes', ...FLOW_LS },
  { field: 'filtracionesSentinaSubdrenLs', label: 'Filtraciones Subdrenaje', ...FLOW_LS },
  { field: 'filtracionesTotalLs', label: 'Filtraciones Total', ...FLOW_LS },
  { field: 'filtracionesTotalM3Dia', label: 'Filtraciones Total Día', ...VOL_DAY }
];

export interface MasterSheetValidation {
  /** Motivos de rechazo (reglas críticas). Si hay alguno, la fila NO se importa. */
  errors: string[];
  /** Observaciones no críticas. La fila se importa marcada. */
  warnings: string[];
}

const fmt = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString('es-PE', { maximumFractionDigits: 3 }) : String(n);

const outOfRange = (rule: RangeRule, value: number): string =>
  `${rule.label} = ${fmt(value)} ${rule.unit} fuera de rango físico [${fmt(rule.min)}, ${fmt(rule.max)}]`;

/**
 * Valida un registro de planilla.
 * @param missing campos que no tenían dato en el archivo (para distinguir "vacío" de un 0 real).
 */
export function validateMasterSheetEntry(
  entry: MasterSheetEntry,
  missing: ReadonlySet<string> = new Set()
): MasterSheetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of MASTER_SHEET_REQUIRED_FIELDS) {
    if (missing.has(req.field)) errors.push(`${req.label}: sin dato`);
  }

  for (const rule of MASTER_SHEET_CRITICAL_RULES) {
    if (missing.has(rule.field)) continue;
    const value = entry[rule.field];
    if (rule.optional && value === 0) continue;
    if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
      errors.push(outOfRange(rule, value));
    }
  }

  // Coherencia geométrica: el espejo de agua no puede estar por encima de la corona del dique
  if (!missing.has('cotaEmbalseMsnm') && !missing.has('cotaCoronaMsnm') &&
      entry.cotaEmbalseMsnm > entry.cotaCoronaMsnm) {
    errors.push(`Cota Embalse (${fmt(entry.cotaEmbalseMsnm)}) superior a Cota Corona (${fmt(entry.cotaCoronaMsnm)})`);
  }

  for (const rule of MASTER_SHEET_WARNING_RULES) {
    if (missing.has(rule.field)) continue;
    const value = entry[rule.field];
    if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
      warnings.push(outOfRange(rule, value));
    }
  }

  return { errors, warnings };
}
