import { MasterSheetNumericField, MasterSheetStringField } from '../../core/models/master-sheet.model';

/**
 * Catálogo de todos los campos de la Planilla Maestra agrupados por área operativa.
 * Cada campo del modelo aparece en exactamente un área para que el dashboard muestre
 * toda la información importada (y marque "Sin dato" lo que la planilla no trae).
 */
export interface MasterAreaRow {
  label: string;
  /** Campo numérico principal (valor del día). */
  field?: MasterSheetNumericField;
  /** Campo de texto (líneas activas, zona, etc.). */
  text?: MasterSheetStringField;
  unit?: string;
  decimals?: number;
  /** Desglose por turno A / B. */
  a?: MasterSheetNumericField;
  b?: MasterSheetNumericField;
  note?: string;
  /** Cota / borde libre: se oculta como "Dato inválido" si el registro no es evaluable. */
  dam?: boolean;
}

export interface MasterArea {
  id: string;
  title: string;
  caption: string;
  color: string;
  rows: MasterAreaRow[];
}

export const MASTER_AREAS: MasterArea[] = [
  {
    id: 'topografia',
    title: 'Topografía, Dique & Borde Libre',
    caption: 'Cotas, crecimiento y revancha según GISTM',
    color: '#031795',
    rows: [
      { label: 'Cota Corona Dique', field: 'cotaCoronaMsnm', unit: 'msnm', decimals: 2, dam: true },
      { label: 'Cota Embalse / Espejo', field: 'cotaEmbalseMsnm', unit: 'msnm', decimals: 2, dam: true },
      { label: 'Elevación Vaso', field: 'elevacionCotaMsnm', unit: 'msnm', decimals: 2 },
      { label: 'Borde Libre (Freeboard)', field: 'bordeLibreM', unit: 'm', decimals: 2, dam: true, note: 'Mínimo GISTM: 2.00 m' },
      { label: 'Crecimiento Diario', field: 'crecimientoPresaM', unit: 'm', decimals: 3 },
      { label: 'Altura Libre Operacional', field: 'alturaLibreOperacionalM', unit: 'm', decimals: 2 },
      { label: 'Volumen Agua Real', field: 'volAguaRealAcumuladoM3', unit: 'm³', decimals: 0 },
      { label: 'Espejo Libre', a: 'espejoLibreAM', b: 'espejoLibreBM', unit: 'm', decimals: 2 },
      { label: 'Longitud de Playa', field: 'longitudPlayaM', unit: 'm', decimals: 1 },
      { label: 'Cota Dique Secundario', field: 'cotaDiqueSecundarioMsnm', unit: 'msnm', decimals: 2 }
    ]
  },
  {
    id: 'relave',
    title: 'Relave Enviado a Presa',
    caption: 'Flujo, horas de bombeo y volumen por turno',
    color: '#10b981',
    rows: [
      { label: 'Volumen del Día', field: 'relaveTotalVolDiaM3', a: 'relaveVolAM3', b: 'relaveVolBM3', unit: 'm³', decimals: 0 },
      { label: 'Flujo', a: 'relaveFlujoAM3h', b: 'relaveFlujoBM3h', unit: 'm³/h', decimals: 1 },
      { label: 'Horas de Bombeo', field: 'relaveTotalHoras', a: 'relaveHorasA', b: 'relaveHorasB', unit: 'h', decimals: 1 },
      { label: 'Acumulado en Embalse', field: 'relaveAcumuladoEmbalseM3', unit: 'm³', decimals: 0 }
    ]
  },
  {
    id: 'vertedero',
    title: 'Vertedero (Aforo)',
    caption: 'Caudal y volumen descargado por turno',
    color: '#06b6d4',
    rows: [
      { label: 'Caudal Promedio', field: 'vertederoPromLs', a: 'vertederoTurnoALs', b: 'vertederoTurnoBLs', unit: 'L/s', decimals: 2 },
      { label: 'Volumen del Día', field: 'vertederoTotalDiaM3', a: 'vertederoTurnoAM3', b: 'vertederoTurnoBM3', unit: 'm³', decimals: 1 }
    ]
  },
  {
    id: 'torre5',
    title: 'Torre 5 · Agua Recuperada',
    caption: 'Bombeo de captación a planta concentradora',
    color: '#0284c7',
    rows: [
      { label: 'Volumen del Día', field: 'torre5VolDiaM3', a: 'torre5VolAM3', b: 'torre5VolBM3', unit: 'm³', decimals: 0 },
      { label: 'Horas de Operación', a: 'torre5HorasA', b: 'torre5HorasB', unit: 'h', decimals: 1 },
      { label: 'Acumulado Recirculado', field: 'torre5VolAcumuladoM3', unit: 'm³', decimals: 0 },
      { label: 'Tirante de Captación', a: 'tiranteCaptacionTAM', b: 'tiranteCaptacionTBM', unit: 'm', decimals: 2 }
    ]
  },
  {
    id: 'sentina',
    title: 'Sentina de Drenes (PO-001)',
    caption: 'Bombeo de subdrenaje y nivel de poza',
    color: '#8b5cf6',
    rows: [
      { label: 'Bombeado del Día', field: 'sentinaBombeadoTotalM3', a: 'sentinaVolAM3', b: 'sentinaVolBM3', unit: 'm³', decimals: 1 },
      { label: 'Horas de Bombeo', a: 'sentinaHorasA', b: 'sentinaHorasB', unit: 'h', decimals: 1 },
      { label: 'Nivel PO-001', a: 'sentinaPo001NivelAPct', b: 'sentinaPo001NivelBPct', unit: '%', decimals: 1 }
    ]
  },
  {
    id: 'ei',
    title: 'Estación Intermedia',
    caption: 'Rebombeo intermedio por turno',
    color: '#6366f1',
    rows: [
      { label: 'Volumen del Día', field: 'eiTotalM3', a: 'eiVolAM3', b: 'eiVolBM3', unit: 'm³', decimals: 1 },
      { label: 'Horas de Bombeo', a: 'eiHorasA', b: 'eiHorasB', unit: 'h', decimals: 1 },
      { label: 'Caudal Promedio', field: 'eiCaudalPromLs', unit: 'L/s', decimals: 2 }
    ]
  },
  {
    id: 'agua',
    title: 'Agua Fresca & Calidad (pH)',
    caption: 'Consumo de agua fresca y control ambiental',
    color: '#059669',
    rows: [
      { label: 'Agua Fresca del Día', field: 'aguaFrescaTotalDiaM3', a: 'aguaFrescaVolAM3', b: 'aguaFrescaVolBM3', unit: 'm³', decimals: 0 },
      { label: 'Ratio Agua / Tonelada', field: 'ratioAguaTon', unit: 'm³/t', decimals: 2 },
      { label: 'pH Embalse', a: 'phEmbalseA', b: 'phEmbalseB', unit: 'pH', decimals: 2 },
      { label: 'pH Vertedero', a: 'phVertederoA', b: 'phVertederoB', unit: 'pH', decimals: 2 },
      { label: 'pH Sentina', field: 'phSentina', unit: 'pH', decimals: 2 }
    ]
  },
  {
    id: 'ciclones',
    title: 'Ciclones & Granulometría',
    caption: '1ra y 2da estación: % sólidos y % malla -200',
    color: '#7c3aed',
    rows: [
      { label: '1ra Est. · % Sólidos', field: 'ciclones1raSolidosPromPct', a: 'ciclones1raSolidosAPct', b: 'ciclones1raSolidosBPct', unit: '%', decimals: 2 },
      { label: '1ra Est. · % Malla -200', field: 'ciclones1raMalla200PromPct', a: 'ciclones1raMalla200APct', b: 'ciclones1raMalla200BPct', unit: '%', decimals: 2 },
      { label: '2da Est. · % Sólidos', field: 'ciclones2daSolidosPromPct', a: 'ciclones2daSolidosAPct', b: 'ciclones2daSolidosBPct', unit: '%', decimals: 2 },
      { label: '2da Est. · % Malla -200', field: 'ciclones2daMalla200PromPct', a: 'ciclones2daMalla200APct', b: 'ciclones2daMalla200BPct', unit: '%', decimals: 2, note: 'Control de finos del muro' },
      { label: 'Presión de Baterías', field: 'ciclonesPresionPsi', unit: 'psi', decimals: 1 },
      { label: 'Densidad de Pulpa', field: 'densidadPulpaProm', a: 'densidadPulpaA', b: 'densidadPulpaB', unit: 't/m³', decimals: 3 }
    ]
  },
  {
    id: 'arenas',
    title: 'Arenas, Talud & Compactación',
    caption: 'Producción de arenas a paddocks y descarga en talud',
    color: '#d97706',
    rows: [
      { label: 'Arenas por Flujómetro', a: 'arenasFlujometroAM3', b: 'arenasFlujometroBM3', unit: 'm³', decimals: 0 },
      { label: 'Arenas Total del Día', field: 'arenasTotalAcumM3', unit: 'm³', decimals: 0 },
      { label: 'Producción (Flujómetro)', field: 'arenasProdFlujometroM3', unit: 'm³', decimals: 0 },
      { label: 'Producción (Topografía)', field: 'arenasProdTopografiaM3', unit: 'm³', decimals: 0 },
      { label: 'Factor de Corrección', field: 'factorCorreccion', decimals: 3 },
      { label: '% Compactación', field: 'compactacionPct', unit: '%', decimals: 1 },
      { label: 'Descarga en Talud', a: 'descargaTaludHorasA', b: 'descargaTaludHorasB', unit: 'h', decimals: 1 },
      { label: 'Descarga en Corona', field: 'descargaCoronaM3', unit: 'm³', decimals: 0 },
      { label: 'Dren Basal', field: 'drenBasalM3', unit: 'm³', decimals: 0 },
      { label: 'Descarga Hidráulica', field: 'descargaHidraulicaM3', unit: 'm³', decimals: 0 }
    ]
  },
  {
    id: 'filtraciones',
    title: 'Filtraciones & Balance',
    caption: 'Filtraciones fuera del vertedero',
    color: '#ef4444',
    rows: [
      { label: 'Filtraciones Totales', field: 'filtracionesTotalLs', unit: 'L/s', decimals: 2 },
      { label: 'Filtraciones del Día', field: 'filtracionesTotalM3Dia', unit: 'm³', decimals: 0 },
      { label: 'Drenes', field: 'filtracionesDrenesLs', unit: 'L/s', decimals: 2 },
      { label: 'Sentina / Subdrenaje', field: 'filtracionesSentinaSubdrenLs', unit: 'L/s', decimals: 2 },
      { label: 'Factor de Balance', field: 'balanceFactor', decimals: 3 }
    ]
  },
  {
    id: 'disposicion',
    title: 'Disposición en Embalse',
    caption: 'Líneas, spigots y reglas de almacenamiento',
    color: '#334155',
    rows: [
      { label: 'Líneas Activas', text: 'lineasActivas' },
      { label: 'Spigots Activos', field: 'spigotsActivosTotal', decimals: 0 },
      { label: 'Zona Operativa', text: 'zonaOperativa' },
      { label: 'Lamas / Spigots', text: 'lamasSpigotsInfo' },
      { label: 'Reglas de Almacenamiento', text: 'reglasAlmacenamiento' }
    ]
  }
];
