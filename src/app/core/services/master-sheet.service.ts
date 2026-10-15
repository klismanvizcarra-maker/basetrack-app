import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { MasterSheetEntry, MasterSheetNumericField, MasterSheetStringField, FreeboardEvaluation, SheetSummary } from '../models/master-sheet.model';
import { validateMasterSheetEntry } from '../models/master-sheet.validation';
import {
  NUMERIC_COLUMN_ALIASES,
  STRING_COLUMN_ALIASES,
  VERTICAL_NUMERIC_LABELS,
  VERTICAL_STRING_LABELS,
  normalizeHeader,
  resolveColumns
} from '../models/master-sheet.columns';
import { getRealtimeData, saveRealtimeData } from '../storage/local-store.util';
import { getApiBaseUrl } from '../constants/api.config';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';

const STORAGE_KEY = 'master_sheet_records';

/** Registro extraído de la planilla junto con los campos que venían vacíos en el archivo. */
interface ParsedRow {
  entry: MasterSheetEntry;
  missing: Set<string>;
}

/** Fila rechazada u observada durante la importación, con sus motivos. */
export interface ImportRowIssue {
  fecha: string;
  reasons: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MasterSheetService {
  private http = inject(HttpClient);

  // Reactive state signals
  public entries = signal<MasterSheetEntry[]>([]);
  public selectedDate = signal<string>('');
  public isLoading = signal<boolean>(false);
  public lastUpdated = signal<Date | null>(null);

  // Computed signals
  public availableDates = computed(() => {
    return this.entries().map(e => e.fecha);
  });

  public activeEntry = computed<MasterSheetEntry | null>(() => {
    const list = this.entries();
    if (list.length === 0) return null;
    const sel = this.selectedDate();
    if (!sel) return list[0];
    const found = list.find(e => e.fecha === sel);
    return found || list[0];
  });

  public activeIndex = computed(() => {
    const sel = this.selectedDate();
    const dates = this.availableDates();
    return dates.indexOf(sel);
  });

  public hasPrevDate = computed(() => {
    return this.activeIndex() > 0;
  });

  public hasNextDate = computed(() => {
    const idx = this.activeIndex();
    return idx >= 0 && idx < this.availableDates().length - 1;
  });

  /**
   * Campos que traen al menos un valor distinto de 0 en la planilla cargada.
   * Un campo que vale 0 en TODOS los días no venía en el Excel: se muestra "Sin dato", no 0.
   */
  public fieldsWithData = computed(() => {
    const set = new Set<string>();
    for (const e of this.entries()) {
      for (const [key, value] of Object.entries(e)) {
        if (set.has(key)) continue;
        if ((typeof value === 'number' && Number.isFinite(value) && value !== 0) ||
            (typeof value === 'string' && value.trim() !== '' && key !== 'fecha' && key !== 'isoDate')) {
          set.add(key);
        }
      }
    }
    return set;
  });

  /** Fechas cuyos registros tienen cotas / borde libre físicamente imposibles (no evaluables). */
  public invalidDates = computed(() => {
    const set = new Set<string>();
    for (const e of this.entries()) {
      if (validateMasterSheetEntry(e).errors.length > 0) set.add(e.fecha);
    }
    return set;
  });

  public freeboardEval = computed<FreeboardEvaluation>(() => {
    const entry = this.activeEntry();
    if (!entry) {
      return {
        status: 'NORMAL',
        badgeLabel: 'Sin Datos',
        color: '#64748b',
        bgColor: '#f1f5f9',
        borderColor: '#cbd5e1',
        message: 'No hay datos de cota cargados.'
      };
    }

    // Nunca declarar "GISTM Normal" con cotas imposibles: primero validar rangos físicos críticos
    const { errors } = validateMasterSheetEntry(entry);
    if (errors.length > 0) {
      return {
        status: 'INVALID',
        badgeLabel: 'Dato Inválido',
        color: '#b45309',
        bgColor: '#fff7ed',
        borderColor: '#fdba74',
        message: `Registro no evaluable: ${errors[0]}. Revisar y volver a cargar la planilla.`,
        errors
      };
    }

    const fb = entry.bordeLibreM;
    if (fb >= 4.0) {
      return {
        status: 'NORMAL',
        badgeLabel: 'GISTM Normal (>4.0m)',
        color: '#059669',
        bgColor: '#ecfdf5',
        borderColor: '#a7f3d0',
        message: 'Operación Segura: Borde libre dentro de parámetros GISTM de diseño.'
      };
    } else if (fb >= 2.0) {
      return {
        status: 'WARNING',
        badgeLabel: 'Alerta Operativa (2.0 - 4.0m)',
        color: '#d97706',
        bgColor: '#fffbeb',
        borderColor: '#fde68a',
        message: 'Precaución: Nivel de revancha ajustado. Monitorear bombeo de Torre 5.'
      };
    } else {
      return {
        status: 'CRITICAL',
        badgeLabel: 'Crítico GISTM (<2.0m)',
        color: '#dc2626',
        bgColor: '#fef2f2',
        borderColor: '#fecaca',
        message: 'Alerta Roja: Borde libre por debajo de cota de seguridad de presa.'
      };
    }
  });

  constructor() {
    this.initData();
  }

  /**
   * Initializes master sheet data from the local cache (real records only, never synthetic seed data).
   */
  public initData(): void {
    const stored = getRealtimeData<MasterSheetEntry[]>(STORAGE_KEY, []);
    if (stored && Array.isArray(stored) && stored.length > 0) {
      this.entries.set(stored);
      this.selectedDate.set(stored[0].fecha);
      this.lastUpdated.set(new Date());
    }

    // Background sync with server
    this.fetchServerRecords();
  }

  public selectDate(date: string): void {
    this.selectedDate.set(date);
  }

  public goToNextDate(): void {
    const dates = this.availableDates();
    const idx = this.activeIndex();
    if (idx < dates.length - 1) {
      this.selectedDate.set(dates[idx + 1]);
    }
  }

  public goToPrevDate(): void {
    const dates = this.availableDates();
    const idx = this.activeIndex();
    if (idx > 0) {
      this.selectedDate.set(dates[idx - 1]);
    }
  }

  /**
   * Inspects a file to list all sheets, their row counts, and recommends the best one.
   */
  public async inspectFile(file: File): Promise<SheetSummary[]> {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = this.readWorkbook(buffer, file);

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) return [];

      const list: SheetSummary[] = [];
      let bestScore = -1;
      let bestIndex = 0;

      for (let i = 0; i < workbook.SheetNames.length; i++) {
        const name = workbook.SheetNames[i];
        const ws = workbook.Sheets[name];
        const summary = this.scoreSheet(ws, name);
        if (summary.score > bestScore) {
          bestScore = summary.score;
          bestIndex = i;
        }
        list.push(summary);
      }

      if (list.length > 0 && bestScore > 0) {
        list[bestIndex].isRecommended = true;
      } else if (list.length > 0) {
        list[0].isRecommended = true;
      }

      return list;
    } catch (err) {
      console.warn('[MasterSheetService] Error inspecting workbook:', err);
      return [];
    }
  }

  /**
   * Evaluates and scores an Excel sheet based on data rows, dates, and operational keywords.
   */
  private scoreSheet(ws: XLSX.WorkSheet | undefined, name: string): SheetSummary {
    if (!ws) {
      return { name, rowCount: 0, hasDates: false, isRecommended: false, score: 0 };
    }

    this.ensureWorksheetRef(ws);

    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: null,
      blankrows: false
    });

    const rowCount = rawRows ? rawRows.length : 0;
    if (rowCount === 0) {
      return { name, rowCount: 0, hasDates: false, isRecommended: false, score: 0 };
    }

    let dateCount = 0;
    let opKeywordCount = 0;
    const keywords = ['borde', 'libre', 'cota', 'relave', 'torre', 'ciclones', 'filtracion', 'sentina', 'corona', 'embalse', 'ph', 'solidos', 'talud'];

    for (const r of rawRows) {
      if (!Array.isArray(r)) continue;
      for (const cell of r) {
        if (cell === null || cell === undefined) continue;
        const str = String(cell).toLowerCase().trim();
        if (/^\d{1,2}[\/\-\.]\d{1,2}/.test(str) || (typeof cell === 'number' && cell > 35000 && cell < 65000)) {
          dateCount++;
        }
        for (const kw of keywords) {
          if (str.includes(kw)) opKeywordCount++;
        }
      }
    }

    let nameBonus = 0;
    const upperName = name.toUpperCase();
    if (upperName.includes('PRESA') || upperName.includes('RELAVE') || upperName.includes('MASTER') || upperName.includes('DIARIO') || upperName.includes('OCT') || upperName.includes('26')) {
      nameBonus = 50;
    }

    const score = (rowCount * 2) + (dateCount * 10) + (opKeywordCount * 5) + nameBonus;

    return {
      name,
      rowCount,
      hasDates: dateCount > 0,
      isRecommended: false,
      score
    };
  }

  /**
   * Ensures worksheet has a valid !ref property so sheet_to_json does not return empty arrays.
   */
  private ensureWorksheetRef(ws: XLSX.WorkSheet): void {
    if (!ws['!ref']) {
      const cellKeys = Object.keys(ws).filter(k => !k.startsWith('!'));
      if (cellKeys.length > 0) {
        let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
        for (const k of cellKeys) {
          try {
            const pos = XLSX.utils.decode_cell(k);
            if (pos.c < minC) minC = pos.c;
            if (pos.c > maxC) maxC = pos.c;
            if (pos.r < minR) minR = pos.r;
            if (pos.r > maxR) maxR = pos.r;
          } catch {}
        }
        if (minC !== Infinity && maxC !== -Infinity) {
          ws['!ref'] = XLSX.utils.encode_range({ s: { c: minC, r: minR }, e: { c: maxC, r: maxR } });
        }
      }
    }
  }

  /**
   * Parses an uploaded file (.xlsx, .xls, .csv).
   * Robust against multiple sheets, empty cover pages, and both horizontal and vertical layouts.
   */
  public async parseUploadedFile(
    file: File,
    mode: 'merge' | 'replace' = 'merge',
    requestedSheetName?: string
  ): Promise<{
    success: boolean;
    count: number;
    dates: string[];
    sheetNames: string[];
    activeSheet: string;
    rejected: ImportRowIssue[];
    warnings: ImportRowIssue[];
    message: string;
  }> {
    this.isLoading.set(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = this.readWorkbook(buffer, file);

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('El archivo no contiene ninguna hoja de cálculo válida.');
      }

      // Step 1: Score all sheets in workbook
      const sheetScores = workbook.SheetNames.map(name => {
        const ws = workbook.Sheets[name];
        return this.scoreSheet(ws, name);
      });

      // Filter sheets that actually contain data
      const sheetsWithData = sheetScores.filter(s => s.rowCount > 0);
      if (sheetsWithData.length === 0) {
        throw new Error(`Ninguna de las hojas en el archivo (${workbook.SheetNames.join(', ')}) contiene datos tabulares legibles.`);
      }

      // Step 2: Determine target sheet
      let targetSheetName = requestedSheetName;
      if (!targetSheetName || !workbook.Sheets[targetSheetName] || (this.scoreSheet(workbook.Sheets[targetSheetName], targetSheetName).rowCount === 0)) {
        sheetsWithData.sort((a, b) => b.score - a.score);
        targetSheetName = sheetsWithData[0].name;
      }

      const worksheet = workbook.Sheets[targetSheetName];
      this.ensureWorksheetRef(worksheet);

      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false
      });

      if (!rawRows || rawRows.length === 0) {
        throw new Error(`La hoja "${targetSheetName}" no contiene filas con datos.`);
      }

      // Fallback date from filename if needed (e.g. 11-10-26A.xlsx -> 11/10/2026)
      const filenameDate = this.extractDateFromFilename(file.name);

      // Determine if layout is Horizontal (rows = days) or Vertical (rows = metrics)
      let parsedRows: ParsedRow[] = [];
      const horizontalResult = this.tryParseHorizontal(rawRows, filenameDate, worksheet['!merges'] || []);

      if (horizontalResult && horizontalResult.length > 0) {
        parsedRows = horizontalResult;
      } else {
        const verticalEntry = this.tryParseVertical(rawRows, filenameDate);
        if (verticalEntry) {
          parsedRows = [verticalEntry];
        }
      }

      if (parsedRows.length === 0) {
        throw new Error(`No se pudieron extraer registros con fecha válida en la hoja "${targetSheetName}".`);
      }

      // Validación de rangos físicos: las filas con topografía imposible o ausente se rechazan
      const rejected: ImportRowIssue[] = [];
      const warnings: ImportRowIssue[] = [];
      const extractedEntries: MasterSheetEntry[] = [];
      for (const { entry, missing } of parsedRows) {
        const check = validateMasterSheetEntry(entry, missing);
        if (check.errors.length > 0) {
          rejected.push({ fecha: entry.fecha, reasons: check.errors });
          continue;
        }
        if (check.warnings.length > 0) {
          entry.validationWarnings = check.warnings;
          warnings.push({ fecha: entry.fecha, reasons: check.warnings });
        }
        extractedEntries.push(entry);
      }

      if (rejected.length > 0 || warnings.length > 0) {
        console.warn('[MasterSheetService] Validación de importación:', { rejected, warnings });
      }

      if (extractedEntries.length === 0) {
        return {
          success: false,
          count: 0,
          dates: [],
          sheetNames: workbook.SheetNames,
          activeSheet: targetSheetName,
          rejected,
          warnings,
          message: `No se importó ningún registro: las ${rejected.length} filas de la hoja "${targetSheetName}" tienen valores fuera de rango físico o sin dato de cota / borde libre. Revise que las columnas correspondan a la plantilla.`
        };
      }

      // Step 3: Save & update state
      let updatedList: MasterSheetEntry[];
      if (mode === 'replace') {
        updatedList = extractedEntries;
      } else {
        const map = new Map<string, MasterSheetEntry>();
        for (const existing of this.entries()) {
          map.set(existing.fecha, existing);
        }
        for (const incoming of extractedEntries) {
          map.set(incoming.fecha, incoming);
        }
        updatedList = Array.from(map.values()).sort((a, b) => b.isoDate.localeCompare(a.isoDate));
      }

      this.entries.set(updatedList);
      this.selectedDate.set(extractedEntries[0].fecha);
      this.lastUpdated.set(new Date());

      saveRealtimeData(STORAGE_KEY, updatedList);
      // Solo se envían los registros validados de este archivo (el servidor ya tiene el resto)
      const serverResult = await this.syncToServer(extractedEntries);

      this.isLoading.set(false);
      let message = `Se importaron con éxito ${extractedEntries.length} registros operativos desde la hoja "${targetSheetName}".`;
      if (rejected.length > 0) {
        message += ` Se rechazaron ${rejected.length} filas por valores fuera de rango físico o sin dato de cota / borde libre.`;
      }
      if (warnings.length > 0) {
        message += ` ${warnings.length} registros importados quedaron marcados con observaciones de rango para revisión.`;
      }
      // Informar si el servidor no confirmó el guardado (la importación quedó solo en este dispositivo)
      if (!serverResult) {
        message += ' ADVERTENCIA: no se pudo confirmar el guardado en el servidor; los datos quedaron solo en este dispositivo.';
      } else if (Array.isArray(serverResult.rejected) && serverResult.rejected.length > 0) {
        for (const r of serverResult.rejected) {
          if (!rejected.some(x => x.fecha === r.fecha)) rejected.push({ fecha: r.fecha, reasons: r.reasons });
        }
        message += ` ADVERTENCIA: el servidor rechazó ${serverResult.rejected.length} registros (ver detalle).`;
      }
      return {
        success: true,
        count: extractedEntries.length,
        dates: extractedEntries.map(e => e.fecha),
        sheetNames: workbook.SheetNames,
        activeSheet: targetSheetName,
        rejected,
        warnings,
        message
      };
    } catch (err: any) {
      this.isLoading.set(false);
      console.error('[MasterSheetService] Error parsing Excel:', err);
      return {
        success: false,
        count: 0,
        dates: [],
        sheetNames: [],
        activeSheet: '',
        rejected: [],
        warnings: [],
        message: err.message || 'Error al procesar el archivo Excel.'
      };
    }
  }

  /**
   * Extracts date from filename e.g. "11-10-26A.xlsx" -> "11/10/2026"
   */
  private extractDateFromFilename(filename: string): { fecha: string; isoDate: string } | null {
    if (!filename) return null;
    const match = filename.match(/(\d{1,2})[-_.](\d{1,2})[-_.](\d{2,4})/);
    if (!match) return null;
    let day = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    if (day > 31 || month > 12) return null;

    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const yearStr = String(year);
    return {
      fecha: `${dayStr}/${monthStr}/${yearStr}`,
      isoDate: `${yearStr}-${monthStr}-${dayStr}`
    };
  }

  /**
   * Attempts to parse horizontal table where each row is a date
   */
  private tryParseHorizontal(
    rawRows: any[][],
    fallbackDate: { fecha: string; isoDate: string } | null,
    merges: XLSX.Range[]
  ): ParsedRow[] {
    let startRowIdx = -1;
    let dateColIdx = 0;

    for (let r = 0; r < Math.min(rawRows.length, 35); r++) {
      const row = rawRows[r];
      if (!row) continue;
      for (let c = 0; c < Math.min(row.length, 10); c++) {
        if (this.isDateValue(row[c])) {
          startRowIdx = r;
          dateColIdx = c;
          break;
        }
      }
      if (startRowIdx !== -1) break;
    }

    if (startRowIdx === -1) {
      return [];
    }

    const numCols = Math.max(...rawRows.slice(0, Math.min(startRowIdx + 5, rawRows.length)).map(r => r ? r.length : 0));
    const headerNames = this.buildHeaderNames(rawRows, startRowIdx, numCols, merges);

    // Las columnas se resuelven por nombre de cabecera, una sola vez por hoja. Ya no se usan
    // índices fijos: en planillas con otra disposición leían columnas ajenas (p. ej. un volumen
    // acumulado de ~82 millones como "Cota Embalse").
    const numericCols = resolveColumns(headerNames, NUMERIC_COLUMN_ALIASES, dateColIdx);
    const stringCols = resolveColumns(headerNames, STRING_COLUMN_ALIASES, dateColIdx);

    const entries: ParsedRow[] = [];
    for (let r = startRowIdx; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const rawDate = row[dateColIdx];
      let dateInfo = this.normalizeDate(rawDate);
      if (!dateInfo && fallbackDate && entries.length === 0) {
        dateInfo = fallbackDate;
      }
      if (!dateInfo) continue;

      entries.push(this.mapRowToEntry(row, numericCols, stringCols, dateInfo));
    }

    return entries;
  }

  /**
   * Construye el nombre normalizado de cada columna uniendo las filas de cabecera.
   * Los títulos de grupo ("RELAVE ENVIADO A PRESA", "SENTINA DRENES"...) solo existen en la
   * primera celda del grupo, así que se propagan a todas sus columnas: mediante las celdas
   * combinadas del Excel si las hay, o arrastrando el título hacia la derecha sobre celdas
   * vacías (plantilla oficial generada sin combinaciones).
   */
  private buildHeaderNames(rawRows: any[][], startRowIdx: number, numCols: number, merges: XLSX.Range[]): string[] {
    const isBlank = (v: any) => v === undefined || v === null || String(v).trim().length === 0;
    // Solo se usan como títulos las celdas de texto; los números sueltos en cabeceras no aportan
    const textOf = (v: any) => (typeof v === 'string' ? normalizeHeader(v) : '');

    const grid: string[][] = [];
    for (let r = 0; r < startRowIdx; r++) {
      grid.push(Array.from({ length: numCols }, (_, c) => textOf(rawRows[r]?.[c])));
    }

    const headerMerges = merges.filter(m => m.s.r < startRowIdx);
    if (headerMerges.length > 0) {
      for (const m of headerMerges) {
        const title = grid[m.s.r]?.[m.s.c] || '';
        if (!title) continue;
        for (let r = m.s.r; r <= Math.min(m.e.r, startRowIdx - 1); r++) {
          for (let c = m.s.c; c <= Math.min(m.e.c, numCols - 1); c++) {
            if (!grid[r][c]) grid[r][c] = title;
          }
        }
      }
    } else {
      // Todas las filas de cabecera salvo la última (la de nombres de columna) son títulos de grupo
      for (let r = 0; r < startRowIdx - 1; r++) {
        let carry = '';
        for (let c = 0; c < numCols; c++) {
          const raw = rawRows[r]?.[c];
          if (isBlank(raw)) {
            grid[r][c] = carry;
          } else {
            carry = grid[r][c];
          }
        }
      }
    }

    const headers: string[] = [];
    for (let c = 0; c < numCols; c++) {
      headers.push(grid.map(row => row[c]).filter(Boolean).join(' '));
    }
    return headers;
  }

  /**
   * Attempts to parse vertical daily report where parameters are in rows
   */
  private tryParseVertical(rawRows: any[][], fallbackDate: { fecha: string; isoDate: string } | null): ParsedRow | null {
    let dateInfo: { fecha: string; isoDate: string } | null = null;
    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (!row) continue;
      for (const cell of row) {
        const d = this.normalizeDate(cell);
        if (d) {
          dateInfo = d;
          break;
        }
      }
      if (dateInfo) break;
    }

    if (!dateInfo) {
      dateInfo = fallbackDate || {
        fecha: new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        isoDate: new Date().toISOString().slice(0, 10)
      };
    }

    // Reporte vertical: la etiqueta está en la primera columna y el valor en la primera celda con dato
    const findRaw = (alternatives: string[][], numeric: boolean): any => {
      for (const keywords of alternatives) {
        for (const r of rawRows) {
          if (!r || !r[0]) continue;
          const label = normalizeHeader(r[0]);
          if (!keywords.every(kw => label.includes(kw))) continue;
          for (let c = 1; c < r.length; c++) {
            const val = r[c];
            if (val === undefined || val === null || String(val).trim().length === 0) continue;
            if (!numeric || Number.isFinite(this.cleanNumeric(val))) return val;
          }
        }
      }
      return null;
    };

    const missing = new Set<string>();
    const values: Record<string, number | string | boolean> = {};
    for (const [field, alternatives] of Object.entries(VERTICAL_NUMERIC_LABELS) as [MasterSheetNumericField, string[][]][]) {
      const raw = findRaw(alternatives, true);
      const parsed = raw === null ? NaN : this.cleanNumeric(raw);
      if (Number.isFinite(parsed)) {
        values[field] = parsed;
      } else {
        values[field] = 0;
        missing.add(field);
      }
    }
    for (const field of Object.keys(NUMERIC_COLUMN_ALIASES) as MasterSheetNumericField[]) {
      if (!(field in values)) {
        values[field] = 0;
        missing.add(field);
      }
    }
    for (const [field, alternatives] of Object.entries(VERTICAL_STRING_LABELS) as [MasterSheetStringField, string[][]][]) {
      const raw = findRaw(alternatives, false);
      values[field] = raw === null ? '' : String(raw).trim();
    }

    // La cota del espejo puede venir solo como "embalse" o deducirse como elevación
    if (missing.has('elevacionCotaMsnm') && !missing.has('cotaEmbalseMsnm')) {
      values['elevacionCotaMsnm'] = values['cotaEmbalseMsnm'];
      missing.delete('elevacionCotaMsnm');
    }

    const entry = {
      ...values,
      fecha: dateInfo.fecha,
      isoDate: dateInfo.isoDate,
      cola16PulgActiva: true,
      updatedAt: new Date().toISOString()
    } as MasterSheetEntry;

    return { entry, missing };
  }

  /**
   * Convierte una fila en MasterSheetEntry usando las columnas ya resueltas por cabecera.
   * Una celda vacía o no numérica NO se reemplaza por un valor inventado: queda en 0 y se
   * registra en `missing` para que la validación distinga "sin dato" de un 0 medido.
   */
  private mapRowToEntry(
    row: any[],
    numericCols: Map<MasterSheetNumericField, number>,
    stringCols: Map<MasterSheetStringField, number>,
    dateInfo: { fecha: string; isoDate: string }
  ): ParsedRow {
    const missing = new Set<string>();
    const values: Record<string, number | string | boolean> = {};

    for (const field of Object.keys(NUMERIC_COLUMN_ALIASES) as MasterSheetNumericField[]) {
      const col = numericCols.get(field);
      const parsed = col === undefined ? NaN : this.cleanNumeric(row[col]);
      if (Number.isFinite(parsed)) {
        values[field] = parsed;
      } else {
        values[field] = 0;
        missing.add(field);
      }
    }

    for (const field of Object.keys(STRING_COLUMN_ALIASES) as MasterSheetStringField[]) {
      const col = stringCols.get(field);
      const raw = col === undefined ? null : row[col];
      values[field] = raw === undefined || raw === null ? '' : String(raw).trim();
    }

    const entry = {
      ...values,
      fecha: dateInfo.fecha,
      isoDate: dateInfo.isoDate,
      cola16PulgActiva: true,
      updatedAt: new Date().toISOString()
    } as MasterSheetEntry;

    return { entry, missing };
  }

  /**
   * Generates and triggers download of the official blank .xlsx Master Template
   */
  public downloadMasterTemplate(): void {
    const wb = XLSX.utils.book_new();

    const row1 = [
      'FECHA',
      'FLUJO VERTEDERO - AFORO', '', '', '', '', '',
      'RELAVE ENVIADO A PRESA', '', '', '', '', '', '', '', '',
      'TOPOGRAFÍA & BORDE LIBRE', '', '', '', '', '', '',
      'SENTINA DRENES', '', '', '', '', '', '',
      'ESTACIÓN INTERMEDIA', '', '', '', '', '',
      'CONTROL DE pH', '', '', '', '',
      'TORRE DE CAPTACIÓN / TORRE 5', '', '', '', '', '',
      'CICLONES 2DA ESTACIÓN', '', '',
      'FILTRACIONES FUERA DE VERTEDERO', '', '', ''
    ];

    const row2 = [
      'DD/MM/AAAA',
      'Turno A (L/s)', 'Turno A (m3)', 'Turno B (L/s)', 'Turno B (m3)', 'Total Día (m3)', 'Promedio (L/s)',
      'Flujo A (m3/h)', 'Horas A', 'Vol A (m3)', 'Flujo B (m3/h)', 'Horas B', 'Vol B (m3)', 'Horas Día', 'Vol Día (m3)', 'Acumulado (m3)',
      'Cota Corona (msnm)', 'Elevación Cota (msnm)', 'Crecimiento (m)', 'Cota Embalse (msnm)', 'Borde Libre (m)', 'Vol Agua Real (m3)', 'Altura Libre (m)',
      'Horas A', 'Vol A (m3)', 'Horas B', 'Vol B (m3)', 'Bombeado Total (m3)', '% PO-001 A', '% PO-001 B',
      'Horas A', 'Vol A (m3)', 'Horas B', 'Vol B (m3)', 'Total EI (m3)', 'Caudal Prom (L/s)',
      'pH Embalse A', 'pH Embalse B', 'pH Vertedero A', 'pH Vertedero B', 'pH Sentina',
      'Horas A', 'Vol A (m3)', 'Horas B', 'Vol B (m3)', 'Vol Día (m3)', 'Acumulado (m3)',
      '% -200 Malla Prom', '% Sólidos Prom', 'Presión (PSI)',
      'Drenes (L/s)', 'Subdrenaje (L/s)', 'Total (L/s)', 'Total Día (m3)'
    ];

    const row3 = [
      '13/07/2026',
      2.3, 99.36, 2.5, 108.0, 207.36, 2.4,
      6867, 12, 82410, 6901, 12, 82822, 24, 165232, 84520100,
      4170.00, 4165.87, 0.05, 4165.87, 4.13, 1420500, 3.20,
      12, 420, 12, 420, 840, 34, 35,
      12, 625, 12, 625, 1250, 14.5,
      7.80, 7.84, 7.64, 7.66, 7.50,
      12, 77800, 12, 78483, 156283, 54200000,
      9.0, 70.15, 18.5,
      0.9, 0.6, 1.5, 129.6
    ];

    const ws = XLSX.utils.aoa_to_sheet([row1, row2, row3]);
    XLSX.utils.book_append_sheet(wb, ws, 'PLANILLA_MAESTRA');
    XLSX.writeFile(wb, 'Planilla_Maestra_Presa_Relaves_BASETRACK.xlsx');
  }

  /**
   * Exports all current records to an Excel workbook
   */
  public exportCurrentRecords(): void {
    const records = this.entries();
    if (!records || records.length === 0) return;

    const exportRows = records.map(r => ({
      'Fecha': r.fecha,
      'Borde Libre (m)': r.bordeLibreM,
      'Cota Corona (msnm)': r.cotaCoronaMsnm,
      'Cota Embalse (msnm)': r.cotaEmbalseMsnm,
      'Crecimiento Presa (m)': r.crecimientoPresaM,
      'Relave Día (m3)': r.relaveTotalVolDiaM3,
      'Relave Acumulado (m3)': r.relaveAcumuladoEmbalseM3,
      'Torre 5 Vol Día (m3)': r.torre5VolDiaM3,
      'Torre 5 Acumulado (m3)': r.torre5VolAcumuladoM3,
      'Ciclones % Sólidos 2da': r.ciclones2daSolidosPromPct,
      'Ciclones % -200 2da': r.ciclones2daMalla200PromPct,
      'Filtraciones Total (L/s)': r.filtracionesTotalLs,
      'Filtraciones Día (m3)': r.filtracionesTotalM3Dia,
      'Vertedero Aforo (L/s)': r.vertederoPromLs,
      'Sentina PO-001 (m3)': r.sentinaBombeadoTotalM3,
      'Estación Intermedia (m3)': r.eiTotalM3,
      'pH Embalse': r.phEmbalseA,
      'pH Vertedero': r.phVertederoA,
      'Arenas Compactadas (m3)': r.arenasProdTopografiaM3,
      '% Compactación': r.compactacionPct,
      'Agua Fresca (m3)': r.aguaFrescaTotalDiaM3,
      'Ratio Agua/Ton': r.ratioAguaTon,
      'Líneas Activas': r.lineasActivas,
      'Spigots Activos': r.spigotsActivosTotal
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DATOS_OPERATIVOS');
    XLSX.writeFile(wb, `Reporte_Presa_BASETRACK_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // --- Helpers ---

  /**
   * Convierte una celda a número. Devuelve NaN si la celda está vacía, es un error de Excel
   * (#DIV/0!, #REF!, #N/A...) o no contiene un número: nunca se convierte en 0 silenciosamente.
   */
  private cleanNumeric(val: any): number {
    if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
    if (typeof val === 'string') {
      const raw = val.trim();
      if (raw.length === 0 || raw.startsWith('#')) return NaN;
      let str = raw.replace(/m3|m³|l\/s|msnm|kton|ton|psi|%/gi, '').trim();
      str = str.replace(/[^\d.,-]/g, '').trim();
      if (str.includes(',') && str.includes('.')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
          str = str.replace(/\./g, '').replace(',', '.');
        } else {
          str = str.replace(/,/g, '');
        }
      } else if (str.includes(',')) {
        const parts = str.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
          str = str.replace(',', '.');
        } else {
          str = str.replace(/,/g, '');
        }
      } else if ((str.match(/\./g) || []).length > 1) {
        // "1.234.567" → separador de miles con punto (parseFloat lo truncaría a 1.234)
        str = str.replace(/\./g, '');
      }
      if (!/^-?\d+(\.\d+)?$|^-?\.\d+$/.test(str)) return NaN;
      return parseFloat(str);
    }
    return NaN;
  }

  /**
   * Lee el libro. En CSV los valores se conservan como texto: SheetJS interpreta las fechas de texto
   * en formato EE. UU. (03/01/2030 → 1 de marzo) y la planilla usa día/mes/año; normalizeDate y
   * cleanNumeric ya convierten el texto correctamente.
   */
  private readWorkbook(buffer: ArrayBuffer, file: File): XLSX.WorkBook {
    const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
    return XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false,
      raw: isCsv
    });
  }

  private isDateValue(val: any): boolean {
    if (!val && val !== 0) return false;
    if (val instanceof Date) return true;
    if (typeof val === 'number' && val > 35000 && val < 65000) return true;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(trimmed) ||
             /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(trimmed);
    }
    return false;
  }

  private normalizeDate(val: any): { fecha: string; isoDate: string } | null {
    if (!val && val !== 0) return null;

    let d: Date | null = null;
    if (val instanceof Date) {
      d = val;
    } else if (typeof val === 'number' && val > 35000 && val < 65000) {
      d = new Date(Math.round((val - 25569) * 86400 * 1000));
    } else if (typeof val === 'string') {
      const str = val.trim();
      const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (dmy) {
        let year = parseInt(dmy[3], 10);
        if (year < 100) year += 2000;
        const month = parseInt(dmy[2], 10) - 1;
        const day = parseInt(dmy[1], 10);
        d = new Date(year, month, day);
      } else {
        const ymd = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
        if (ymd) {
          d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
        }
      }
    }

    if (!d || isNaN(d.getTime())) return null;

    const dayStr = String(d.getDate()).padStart(2, '0');
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const yearStr = d.getFullYear();

    return {
      fecha: `${dayStr}/${monthStr}/${yearStr}`,
      isoDate: `${yearStr}-${monthStr}-${dayStr}`
    };
  }

  private fetchServerRecords(): void {
    const initialSelection = this.selectedDate();
    this.http.get<any>(`${getApiBaseUrl()}/dashboard/master-sheet`).pipe(
      timeout(3000),
      catchError(() => of(null))
    ).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          // El servidor es la fuente de verdad: sus registros prevalecen sobre la caché local
          // (evita que una caché obsoleta oculte o reenvíe datos ya corregidos en el servidor)
          const map = new Map<string, MasterSheetEntry>();
          // Los registros solo-locales se conservan si son válidos: el servidor nunca acepta inválidos,
          // así que uno inválido en caché es un resto obsoleto (p. ej. un registro ya depurado)
          for (const item of this.entries()) {
            if (validateMasterSheetEntry(item).errors.length === 0) map.set(item.fecha, item);
          }
          for (const item of res.data) map.set(item.fecha, item);
          const merged = Array.from(map.values()).sort((a, b) => b.isoDate.localeCompare(a.isoDate));
          this.entries.set(merged);
          // Si el usuario no ha navegado aún, mostrar la fecha más reciente del servidor
          if (this.selectedDate() === initialSelection || !merged.some(e => e.fecha === this.selectedDate())) {
            this.selectedDate.set(merged[0].fecha);
          }
          this.lastUpdated.set(new Date());
          // ADR-015: cachear un GET nunca debe emitirse como cambio local
          saveRealtimeData(STORAGE_KEY, merged, { skipBroadcast: true });
        }
      }
    });
  }

  /** Envía los registros al servidor y devuelve su respuesta (incluida la de rechazo 400), o null si no respondió. */
  private syncToServer(records: MasterSheetEntry[]): Promise<{ success: boolean; count: number; rejected?: ImportRowIssue[] } | null> {
    return firstValueFrom(
      this.http.post<any>(`${getApiBaseUrl()}/dashboard/master-sheet`, { entries: records }).pipe(
        timeout(15000),
        catchError((err) => of(err?.error && typeof err.error === 'object' ? err.error : null))
      )
    );
  }
}
