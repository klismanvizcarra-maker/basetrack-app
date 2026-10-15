import { MasterSheetNumericField, MasterSheetStringField } from './master-sheet.model';

/**
 * Alias de cabeceras para la planilla horizontal (una fila por día).
 *
 * Cada campo lista alternativas en orden de prioridad; una alternativa es un conjunto de
 * palabras/frases que deben aparecer TODAS como palabras completas en la cabecera normalizada
 * (minúsculas, sin tildes ni comillas, con el título de grupo combinado antepuesto).
 * La columna se resuelve UNA vez por hoja: si una alternativa encuentra cabecera, esa columna
 * es la del campo aunque en alguna fila esté vacía (así no se salta a otra columna distinta).
 *
 * Cubre la plantilla oficial de BASETRACK (`downloadMasterTemplate`) y la hoja
 * "Ingreso de Datos" de la matriz operativa de la presa.
 */
export type ColumnAliases = string[][];

export const NUMERIC_COLUMN_ALIASES: Record<MasterSheetNumericField, ColumnAliases> = {
  // 1. Vertedero
  vertederoTurnoALs: [['vertedero', 'turno a', 'l/s']],
  vertederoTurnoAM3: [['vertedero', 'turno a', 'm3']],
  vertederoTurnoBLs: [['vertedero', 'turno b', 'l/s']],
  vertederoTurnoBM3: [['vertedero', 'turno b', 'm3']],
  vertederoTotalDiaM3: [['vertedero', 'total dia'], ['volumen diario acumulado']],
  vertederoPromLs: [['vertedero', 'promedio'], ['flujo turno', 'l/s']],

  // 2. Relave enviado a presa
  relaveFlujoAM3h: [['relave', 'flujo a']],
  relaveHorasA: [['relave', 'horas a'], ['relave', 'hrs a']],
  relaveVolAM3: [['relave', 'vol a']],
  relaveFlujoBM3h: [['relave', 'flujo b']],
  relaveHorasB: [['relave', 'horas b'], ['relave', 'hrs b']],
  relaveVolBM3: [['relave', 'vol b']],
  relaveTotalHoras: [['relave', 'horas dia']],
  relaveTotalVolDiaM3: [['relave', 'vol dia'], ['relave', 'recibido dia']],
  relaveAcumuladoEmbalseM3: [['relave', 'acumulado en el embalse'], ['relave', 'acumulado']],

  // 3. Topografía & borde libre (campos críticos GISTM)
  cotaCoronaMsnm: [['cota corona'], ['nivel de la corona']],
  elevacionCotaMsnm: [['elevacion cota'], ['elevacion vaso']],
  // Si la hoja no trae "Cota Embalse" explícita, la cota del espejo es la "Elevación vaso Cotas"
  cotaEmbalseMsnm: [['cota embalse'], ['elevacion vaso'], ['elevacion cota']],
  crecimientoPresaM: [['crecimiento']],
  // "freeboard" primero: la matriz también tiene "Altura libre para llegar al borde libre operacional".
  // "borde libre (m)" antes que "borde libre": el título de grupo "TOPOGRAFÍA & BORDE LIBRE" de la
  // plantilla se antepone a todas sus columnas (incluida Cota Corona).
  bordeLibreM: [['freeboard'], ['borde libre (m)'], ['borde libre']],
  volAguaRealAcumuladoM3: [['agua real']],
  alturaLibreOperacionalM: [['altura libre']],

  // 4. Sentina drenes
  sentinaHorasA: [['sentina', 'horas a'], ['sentina', 'horas', 'turno a']],
  sentinaVolAM3: [['sentina', 'vol a'], ['sentina', 'volumen', 'turno a']],
  sentinaHorasB: [['sentina', 'horas b'], ['sentina', 'horas', 'turno b']],
  sentinaVolBM3: [['sentina', 'vol b'], ['sentina', 'volumen', 'turno b']],
  sentinaBombeadoTotalM3: [['sentina', 'bombeado total'], ['volumen bombeado sentina']],
  sentinaPo001NivelAPct: [['po-001 a'], ['po-001', 'turno a']],
  sentinaPo001NivelBPct: [['po-001 b'], ['po-001', 'turno b']],

  // 5. Estación intermedia
  eiHorasA: [['intermedia', 'horas a'], ['intermedia', 'horas', 'turno a']],
  eiVolAM3: [['intermedia', 'vol a'], ['intermedia', 'volumen', 'turno a']],
  eiHorasB: [['intermedia', 'horas b'], ['intermedia', 'horas', 'turno b']],
  eiVolBM3: [['intermedia', 'vol b'], ['intermedia', 'volumen', 'turno b']],
  eiTotalM3: [['total ei'], ['volumen bombeado estacion intermedia']],
  eiCaudalPromLs: [['intermedia', 'caudal']],

  // 6. pH
  phEmbalseA: [['ph embalse a'], ['ph embalse turno a']],
  phEmbalseB: [['ph embalse b'], ['ph embalse turno b']],
  phVertederoA: [['ph vertedero a'], ['ph vertedero turno a']],
  phVertederoB: [['ph vertedero b'], ['ph vertedero turno b']],
  phSentina: [['ph sentina']],

  // 7. Torre de captación
  torre5HorasA: [['torre', 'horas a'], ['torre', 'hr op', 'turno a']],
  torre5VolAM3: [['torre', 'vol a'], ['torre', 'volumen bombeado', 'turno a']],
  torre5HorasB: [['torre', 'horas b'], ['torre', 'hr op', 'turno b']],
  torre5VolBM3: [['torre', 'vol b'], ['torre', 'volumen bombeado', 'turno b']],
  torre5VolDiaM3: [['torre', 'vol dia'], ['torre', 'm3/dia']],
  torre5VolAcumuladoM3: [['torre', 'acumulado']],

  // 8. Espejos & tirantes
  espejoLibreAM: [['espejo', 'turno a'], ['espejo libre a']],
  espejoLibreBM: [['espejo', 'turno b'], ['espejo libre b']],
  tiranteCaptacionTAM: [['tirante', 'ta'], ['tirante', 'a']],
  tiranteCaptacionTBM: [['tirante', 'tb'], ['tirante', 'b']],

  // 9. Ciclones
  ciclones1raMalla200APct: [['1ra', '-200', 'a']],
  ciclones1raMalla200BPct: [['1ra', '-200', 'b']],
  ciclones1raMalla200PromPct: [['1ra', '-200', 'prom']],
  ciclones1raSolidosAPct: [['1ra', 'solidos', 'a']],
  ciclones1raSolidosBPct: [['1ra', 'solidos', 'b']],
  ciclones1raSolidosPromPct: [['1ra', 'solidos', 'prom']],
  ciclones2daMalla200APct: [['2da', '-200', 'a']],
  ciclones2daMalla200BPct: [['2da', '-200', 'b']],
  ciclones2daMalla200PromPct: [['2da', '-200', 'prom']],
  ciclones2daSolidosAPct: [['2da', 'solidos', 'a']],
  ciclones2daSolidosBPct: [['2da', 'solidos', 'b']],
  ciclones2daSolidosPromPct: [['2da', 'solidos', 'prom'], ['sol promedio']],
  ciclonesPresionPsi: [['psi']],

  // 10. Talud & disposición
  descargaTaludHorasA: [['talud', 'horas a'], ['descarga (hrs) a']],
  descargaTaludHorasB: [['talud', 'horas b'], ['descarga (hrs) b']],
  descargaCoronaM3: [['descarga corona']],
  drenBasalM3: [['dren basal', 'm3']],
  descargaHidraulicaM3: [['descarga hidraulica', 'm3']],

  // 11-12. Embalse & diques
  spigotsActivosTotal: [['spigots activos']],
  longitudPlayaM: [['playa']],
  cotaDiqueSecundarioMsnm: [['dique secundario']],

  // 13. Agua fresca
  aguaFrescaVolAM3: [['fresca', 'turno a']],
  aguaFrescaVolBM3: [['fresca', 'turno b']],
  aguaFrescaTotalDiaM3: [['fresca', 'total']],
  ratioAguaTon: [['ratio']],

  // 14. Arenas a paddocks
  arenasFlujometroAM3: [['arenas', 'flujometro', 'turno a']],
  arenasFlujometroBM3: [['arenas', 'flujometro', 'turno b']],
  arenasTotalAcumM3: [['arenas', 'total acumulado']],

  // 16. Densidad de pulpa
  densidadPulpaA: [['densidad', 'turno a']],
  densidadPulpaB: [['densidad', 'turno b']],
  densidadPulpaProm: [['densidad', 'prom']],

  // 17. Producción de arenas compactadas
  arenasProdFlujometroM3: [['produccion', 'flujometro']],
  arenasProdTopografiaM3: [['produccion', 'topografia']],
  factorCorreccion: [['factor correccion']],
  compactacionPct: [['% compactacion']],

  // 18. Filtraciones fuera del vertedero
  filtracionesDrenesLs: [['filtraciones', 'drenes']],
  filtracionesSentinaSubdrenLs: [['filtraciones', 'subdrenaje']],
  filtracionesTotalLs: [['filtraciones', 'total', 'l/s'], ['filtraciones', 'lps']],
  filtracionesTotalM3Dia: [['filtraciones', 'total dia'], ['filtraciones', 'm3/dia']],
  balanceFactor: [['balance']]
};

export const STRING_COLUMN_ALIASES: Record<MasterSheetStringField, ColumnAliases> = {
  lineasActivas: [['lineas activas']],
  zonaOperativa: [['zona operativa']],
  reglasAlmacenamiento: [['reglas']],
  lamasSpigotsInfo: [['lamas', 'spigots']]
};

/** Normaliza una cabecera: minúsculas, sin tildes, sin comillas, espacios colapsados. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/["'´`’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const keywordRegexCache = new Map<string, RegExp>();

/** true si `keyword` aparece en `header` como palabra/frase completa (no como subcadena de otra palabra). */
export function headerHasKeyword(header: string, keyword: string): boolean {
  let re = keywordRegexCache.get(keyword);
  if (!re) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&');
    re = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`);
    keywordRegexCache.set(keyword, re);
  }
  return re.test(header);
}

/** Resuelve, para cada campo, el índice de columna que le corresponde según las cabeceras. */
export function resolveColumns<F extends string>(
  headers: string[],
  aliases: Record<F, ColumnAliases>,
  excludeCol: number
): Map<F, number> {
  const resolved = new Map<F, number>();
  for (const [field, alternatives] of Object.entries(aliases) as [F, ColumnAliases][]) {
    for (const keywords of alternatives) {
      const col = headers.findIndex((h, c) => c !== excludeCol && h.length > 0 && keywords.every(kw => headerHasKeyword(h, kw)));
      if (col !== -1) {
        resolved.set(field, col);
        break;
      }
    }
  }
  return resolved;
}

/**
 * Etiquetas para el reporte diario vertical (un parámetro por fila, etiqueta en la columna A).
 * Coincidencia por subcadena sobre la etiqueta normalizada; alternativas en orden de prioridad.
 * Los campos no listados quedan "sin dato".
 */
export const VERTICAL_NUMERIC_LABELS: Partial<Record<MasterSheetNumericField, ColumnAliases>> = {
  bordeLibreM: [['borde', 'libre'], ['freeboard']],
  cotaCoronaMsnm: [['cota', 'corona'], ['nivel', 'corona']],
  cotaEmbalseMsnm: [['cota', 'embalse'], ['elevacion']],
  elevacionCotaMsnm: [['elevacion']],
  crecimientoPresaM: [['crecimiento']],
  volAguaRealAcumuladoM3: [['agua', 'real']],

  relaveTotalVolDiaM3: [['relave', 'dia'], ['relave', 'total']],
  relaveAcumuladoEmbalseM3: [['relave', 'acumulado']],

  torre5VolDiaM3: [['torre', 'dia'], ['torre', 'total']],
  torre5VolAcumuladoM3: [['torre', 'acumulado']],

  ciclones2daSolidosPromPct: [['2da', 'solidos']],
  ciclones2daMalla200PromPct: [['2da', '-200']],
  ciclones1raSolidosPromPct: [['1ra', 'solidos']],
  ciclones1raMalla200PromPct: [['1ra', '-200']],
  ciclonesPresionPsi: [['psi'], ['presion']],

  filtracionesTotalLs: [['filtraciones', 'l/s']],
  filtracionesTotalM3Dia: [['filtraciones', 'm3']],
  filtracionesDrenesLs: [['drenes', 'l/s']],
  filtracionesSentinaSubdrenLs: [['subdrenaje']],

  sentinaBombeadoTotalM3: [['sentina', 'total'], ['volumen bombeado sentina']],
  sentinaPo001NivelAPct: [['po-001', ' a']],
  sentinaPo001NivelBPct: [['po-001', ' b']],

  eiTotalM3: [['intermedia', 'total'], ['volumen bombeado estacion intermedia']],
  eiCaudalPromLs: [['intermedia', 'l/s']],

  vertederoPromLs: [['vertedero', 'l/s']],
  vertederoTotalDiaM3: [['vertedero', 'm3']],

  phEmbalseA: [['ph', 'embalse']],
  phVertederoA: [['ph', 'vertedero']],
  phSentina: [['ph', 'sentina']],

  espejoLibreAM: [['espejo']],
  tiranteCaptacionTAM: [['tirante']],

  descargaCoronaM3: [['descarga', 'corona', 'm3']],
  drenBasalM3: [['dren', 'basal']],
  descargaHidraulicaM3: [['descarga', 'hidraulica']],

  spigotsActivosTotal: [['spigots']],
  longitudPlayaM: [['playa']],
  cotaDiqueSecundarioMsnm: [['dique', 'secundario']],

  aguaFrescaTotalDiaM3: [['fresca', 'total'], ['fresca']],
  ratioAguaTon: [['ratio']],
  arenasTotalAcumM3: [['arenas', 'acum']],
  densidadPulpaProm: [['densidad']],
  arenasProdTopografiaM3: [['prod', 'topo'], ['compactad']],
  compactacionPct: [['% compactacion']]
};

export const VERTICAL_STRING_LABELS: Partial<Record<MasterSheetStringField, ColumnAliases>> = {
  lineasActivas: [['lineas', 'activas']],
  zonaOperativa: [['zona', 'operativa']],
  reglasAlmacenamiento: [['reglas']],
  lamasSpigotsInfo: [['lamas']]
};
