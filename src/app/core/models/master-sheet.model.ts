export interface MasterSheetEntry {
  id?: string;
  fecha: string;        // DD/MM/YYYY
  isoDate: string;     // YYYY-MM-DD for sorting/indexing

  // 1. Flujo Vertedero - Aforo
  vertederoTurnoALs: number;
  vertederoTurnoAM3: number;
  vertederoTurnoBLs: number;
  vertederoTurnoBM3: number;
  vertederoTotalDiaM3: number;
  vertederoPromLs: number;

  // 2. Relave Enviado a Presa
  relaveFlujoAM3h: number;
  relaveHorasA: number;
  relaveVolAM3: number;
  relaveFlujoBM3h: number;
  relaveHorasB: number;
  relaveVolBM3: number;
  relaveTotalHoras: number;
  relaveTotalVolDiaM3: number;
  relaveAcumuladoEmbalseM3: number;

  // 3. Topografía & Borde Libre (GISTM)
  cotaCoronaMsnm: number;
  elevacionCotaMsnm: number;
  crecimientoPresaM: number;
  cotaEmbalseMsnm: number;
  bordeLibreM: number;
  volAguaRealAcumuladoM3: number;
  alturaLibreOperacionalM: number;

  // 4. Sentina Drenes
  sentinaHorasA: number;
  sentinaVolAM3: number;
  sentinaHorasB: number;
  sentinaVolBM3: number;
  sentinaBombeadoTotalM3: number;
  sentinaPo001NivelAPct: number;
  sentinaPo001NivelBPct: number;

  // 5. Estación Intermedia (EI)
  eiHorasA: number;
  eiVolAM3: number;
  eiHorasB: number;
  eiVolBM3: number;
  eiTotalM3: number;
  eiCaudalPromLs: number;

  // 6. Control de pH
  phEmbalseA: number;
  phEmbalseB: number;
  phVertederoA: number;
  phVertederoB: number;
  phSentina: number;

  // 7. Torre de Captación / Torre 5 (Agua Recuperada)
  torre5HorasA: number;
  torre5VolAM3: number;
  torre5HorasB: number;
  torre5VolBM3: number;
  torre5VolDiaM3: number;
  torre5VolAcumuladoM3: number;

  // 8. Espejos & Tirantes
  espejoLibreAM: number;
  espejoLibreBM: number;
  tiranteCaptacionTAM: number;
  tiranteCaptacionTBM: number;

  // 9. Ciclones 1ra y 2da Estación
  ciclones1raMalla200APct: number;
  ciclones1raMalla200BPct: number;
  ciclones1raMalla200PromPct: number;
  ciclones1raSolidosAPct: number;
  ciclones1raSolidosBPct: number;
  ciclones1raSolidosPromPct: number;
  ciclones2daMalla200APct: number;
  ciclones2daMalla200BPct: number;
  ciclones2daMalla200PromPct: number;
  ciclones2daSolidosAPct: number;
  ciclones2daSolidosBPct: number;
  ciclones2daSolidosPromPct: number;
  ciclonesPresionPsi: number;

  // 10. Disposición de Arenas & Talud
  descargaTaludHorasA: number;
  descargaTaludHorasB: number;
  descargaCoronaM3: number;
  drenBasalM3: number;
  descargaHidraulicaM3: number;

  // 11. Descarga en Embalse
  lineasActivas: string;
  spigotsActivosTotal: number;
  zonaOperativa: string;
  cola16PulgActiva: boolean;

  // 12. Diques & Almacenamiento
  reglasAlmacenamiento: string;
  longitudPlayaM: number;
  cotaDiqueSecundarioMsnm: number;

  // 13. Agua Fresca a Planta
  aguaFrescaVolAM3: number;
  aguaFrescaVolBM3: number;
  aguaFrescaTotalDiaM3: number;
  ratioAguaTon: number;

  // 14. Arenas a Paddocks
  arenasFlujometroAM3: number;
  arenasFlujometroBM3: number;
  arenasTotalAcumM3: number;

  // 15. Descarga Lamas
  lamasSpigotsInfo: string;

  // 16. Densidad de Pulpa Arenas
  densidadPulpaA: number;
  densidadPulpaB: number;
  densidadPulpaProm: number;

  // 17. Producción Arenas Compactadas
  arenasProdFlujometroM3: number;
  arenasProdTopografiaM3: number;
  factorCorreccion: number;
  compactacionPct: number;

  // 18. Filtraciones Fuera de Vertedero
  filtracionesDrenesLs: number;
  filtracionesSentinaSubdrenLs: number;
  filtracionesTotalLs: number;
  filtracionesTotalM3Dia: number;
  balanceFactor: number;

  // Columnas adicionales / raw
  rawCols?: Record<string, any>;
  // Observaciones de rango no críticas detectadas al importar (la fila se aceptó pero requiere revisión)
  validationWarnings?: string[];
  updatedAt?: string;
}

/** Campos numéricos de un registro de planilla. */
export type MasterSheetNumericField = {
  [K in keyof MasterSheetEntry]-?: MasterSheetEntry[K] extends number ? K : never;
}[keyof MasterSheetEntry];

/** Campos de texto libre de un registro de planilla. */
export type MasterSheetStringField = 'lineasActivas' | 'zonaOperativa' | 'reglasAlmacenamiento' | 'lamasSpigotsInfo';

// INVALID: el registro tiene cotas / borde libre físicamente imposibles y no puede evaluarse
export type FreeboardStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'INVALID';

export interface FreeboardEvaluation {
  status: FreeboardStatus;
  badgeLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  message: string;
  /** Motivos por los que el registro no es evaluable (solo con status INVALID). */
  errors?: string[];
}

export interface SheetSummary {
  name: string;
  rowCount: number;
  hasDates: boolean;
  isRecommended: boolean;
  score: number;
}
