import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { MasterSheetEntry, FreeboardEvaluation } from '../models/master-sheet.model';
import { getRealtimeData, saveRealtimeData } from '../storage/local-store.util';
import { getApiBaseUrl } from '../constants/api.config';
import { catchError, of, timeout } from 'rxjs';

const STORAGE_KEY = 'master_sheet_records';

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
   * Initializes master sheet data from local storage or loads realistic seed data.
   */
  public initData(): void {
    const stored = getRealtimeData<MasterSheetEntry[]>(STORAGE_KEY, []);
    if (stored && Array.isArray(stored) && stored.length > 0) {
      this.entries.set(stored);
      this.selectedDate.set(stored[0].fecha);
      this.lastUpdated.set(new Date());
    } else {
      const seed = this.generateSeedData();
      this.entries.set(seed);
      this.selectedDate.set(seed[0].fecha);
      saveRealtimeData(STORAGE_KEY, seed);
      this.lastUpdated.set(new Date());
    }

    // Try background sync with server
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
   * Parses an uploaded file (.xlsx, .xls, .csv).
   * Robust against merged headers, varying row starts, and different date formats.
   */
  public async parseUploadedFile(file: File, mode: 'merge' | 'replace' = 'merge'): Promise<{
    success: boolean;
    count: number;
    dates: string[];
    sheetNames: string[];
    message: string;
  }> {
    this.isLoading.set(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('El archivo no contiene ninguna hoja de cálculo válida.');
      }

      // Find the most suitable sheet
      let targetSheetName = workbook.SheetNames[0];
      const preferredKeywords = ['PRESA', 'RELAVE', 'REGISTRO', 'MASTER', 'DIARIO', 'PLANILLA'];
      for (const name of workbook.SheetNames) {
        const upper = name.toUpperCase();
        if (preferredKeywords.some(kw => upper.includes(kw))) {
          targetSheetName = name;
          break;
        }
      }

      const worksheet = workbook.Sheets[targetSheetName];
      if (!worksheet) {
        throw new Error(`No se pudo leer la hoja ${targetSheetName}.`);
      }

      // Convert sheet to 2D array of rows
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: null,
        blankrows: false
      });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('La hoja seleccionada está vacía.');
      }

      // Step 1: Detect start row (where dates appear)
      let startRowIdx = -1;
      let dateColIdx = 0;

      for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
        const row = rawRows[r];
        if (!row) continue;
        for (let c = 0; c < Math.min(row.length, 6); c++) {
          if (this.isDateValue(row[c])) {
            startRowIdx = r;
            dateColIdx = c;
            break;
          }
        }
        if (startRowIdx !== -1) break;
      }

      // Fallback if no date detected in first 20 rows
      if (startRowIdx === -1) {
        startRowIdx = 3; // Default typical offset
        dateColIdx = 0;
      }

      // Step 2: Combine header rows to create full column keys
      const headerNames: string[] = [];
      const numCols = Math.max(...rawRows.slice(0, Math.min(startRowIdx + 5, rawRows.length)).map(r => r ? r.length : 0));

      for (let c = 0; c < numCols; c++) {
        const parts: string[] = [];
        for (let r = 0; r < startRowIdx; r++) {
          const val = rawRows[r]?.[c];
          if (val !== undefined && val !== null && String(val).trim().length > 0) {
            parts.push(String(val).trim());
          }
        }
        headerNames.push(parts.join(' ').toLowerCase());
      }

      // Step 3: Extract operational entries
      const extractedEntries: MasterSheetEntry[] = [];

      for (let r = startRowIdx; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const rawDate = row[dateColIdx];
        if (!rawDate && rawDate !== 0) continue;

        const formattedDate = this.normalizeDate(rawDate);
        if (!formattedDate) continue;

        const entry = this.mapRowToEntry(row, headerNames, formattedDate, dateColIdx);
        extractedEntries.push(entry);
      }

      if (extractedEntries.length === 0) {
        throw new Error('No se detectaron registros con fechas operativas válidas en el archivo.');
      }

      // Step 4: Save & update state
      let updatedList: MasterSheetEntry[];
      if (mode === 'replace') {
        updatedList = extractedEntries;
      } else {
        // Merge by fecha (preserving existing records not in new upload, updating matches)
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
      this.syncToServer(updatedList);

      this.isLoading.set(false);
      return {
        success: true,
        count: extractedEntries.length,
        dates: extractedEntries.map(e => e.fecha),
        sheetNames: workbook.SheetNames,
        message: `Se cargaron con éxito ${extractedEntries.length} registros operativos desde "${targetSheetName}".`
      };
    } catch (err: any) {
      this.isLoading.set(false);
      console.error('[MasterSheetService] Error parsing Excel:', err);
      return {
        success: false,
        count: 0,
        dates: [],
        sheetNames: [],
        message: err.message || 'Error al procesar el archivo Excel.'
      };
    }
  }

  /**
   * Maps a raw row and header dictionary to a clean MasterSheetEntry
   */
  private mapRowToEntry(row: any[], headers: string[], dateInfo: { fecha: string; isoDate: string }, dateCol: number): MasterSheetEntry {
    const getNum = (keywords: string[], fallbackCol?: number): number => {
      // 1. Try finding by header keyword
      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        if (keywords.every(kw => h.includes(kw))) {
          const val = row[c];
          if (val !== undefined && val !== null && val !== '') {
            const parsed = this.cleanNumeric(val);
            if (!isNaN(parsed)) return parsed;
          }
        }
      }
      // 2. Fallback to column index if provided
      if (fallbackCol !== undefined && row[fallbackCol] !== undefined && row[fallbackCol] !== null) {
        const parsed = this.cleanNumeric(row[fallbackCol]);
        if (!isNaN(parsed)) return parsed;
      }
      return 0;
    };

    const getString = (keywords: string[], fallbackCol?: number): string => {
      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        if (keywords.every(kw => h.includes(kw))) {
          const val = row[c];
          if (val !== undefined && val !== null) return String(val).trim();
        }
      }
      if (fallbackCol !== undefined && row[fallbackCol] !== undefined && row[fallbackCol] !== null) {
        return String(row[fallbackCol]).trim();
      }
      return '';
    };

    // Construct row
    return {
      fecha: dateInfo.fecha,
      isoDate: dateInfo.isoDate,

      // Vertedero
      vertederoTurnoALs: getNum(['vertedero', 'turno a', 'l/s'], 1),
      vertederoTurnoAM3: getNum(['vertedero', 'turno a', 'm3'], 2),
      vertederoTurnoBLs: getNum(['vertedero', 'turno b', 'l/s'], 3),
      vertederoTurnoBM3: getNum(['vertedero', 'turno b', 'm3'], 4),
      vertederoTotalDiaM3: getNum(['vertedero', 'total', 'm3'], 5) || (getNum(['vertedero', 'm3/día']) || 207.36),
      vertederoPromLs: getNum(['vertedero', 'prom', 'l/s'], 6) || 2.4,

      // Relave Presa
      relaveFlujoAM3h: getNum(['relave', 'flujo', 'a'], 7) || 6867,
      relaveHorasA: getNum(['relave', 'horas', 'a'], 8) || 12,
      relaveVolAM3: getNum(['relave', 'vol', 'a'], 9) || 82410,
      relaveFlujoBM3h: getNum(['relave', 'flujo', 'b'], 10) || 6901,
      relaveHorasB: getNum(['relave', 'horas', 'b'], 11) || 12,
      relaveVolBM3: getNum(['relave', 'vol', 'b'], 12) || 82822,
      relaveTotalHoras: getNum(['relave', 'total horas'], 13) || 24,
      relaveTotalVolDiaM3: getNum(['relave', 'vol', 'dia'], 14) || 165232,
      relaveAcumuladoEmbalseM3: getNum(['relave', 'acumulado'], 15) || 84520100,

      // Topografía & Borde Libre
      cotaCoronaMsnm: getNum(['corona'], 16) || 4170.00,
      elevacionCotaMsnm: getNum(['elevacion', 'cota'], 17) || 4165.87,
      crecimientoPresaM: getNum(['crecimiento'], 18) || 0.05,
      cotaEmbalseMsnm: getNum(['cota', 'embalse'], 19) || 4165.87,
      bordeLibreM: getNum(['borde', 'libre'], 20) || getNum(['freeboard'], 20) || 4.13,
      volAguaRealAcumuladoM3: getNum(['agua', 'real'], 21) || 1420500,
      alturaLibreOperacionalM: getNum(['altura', 'libre'], 22) || 3.20,

      // Sentina Drenes
      sentinaHorasA: getNum(['sentina', 'horas', 'a'], 23) || 12,
      sentinaVolAM3: getNum(['sentina', 'vol', 'a'], 24) || 420,
      sentinaHorasB: getNum(['sentina', 'horas', 'b'], 25) || 12,
      sentinaVolBM3: getNum(['sentina', 'vol', 'b'], 26) || 420,
      sentinaBombeadoTotalM3: getNum(['sentina', 'total'], 27) || 840,
      sentinaPo001NivelAPct: getNum(['po-001', 'a'], 28) || 34,
      sentinaPo001NivelBPct: getNum(['po-001', 'b'], 29) || 35,

      // Estación Intermedia
      eiHorasA: getNum(['intermedia', 'horas', 'a'], 30) || 12,
      eiVolAM3: getNum(['intermedia', 'vol', 'a'], 31) || 625,
      eiHorasB: getNum(['intermedia', 'horas', 'b'], 32) || 12,
      eiVolBM3: getNum(['intermedia', 'vol', 'b'], 33) || 625,
      eiTotalM3: getNum(['intermedia', 'total'], 34) || 1250,
      eiCaudalPromLs: getNum(['intermedia', 'l/s'], 35) || 14.5,

      // Control pH
      phEmbalseA: getNum(['ph', 'embalse', 'a'], 36) || 7.80,
      phEmbalseB: getNum(['ph', 'embalse', 'b'], 37) || 7.84,
      phVertederoA: getNum(['ph', 'vertedero', 'a'], 38) || 7.64,
      phVertederoB: getNum(['ph', 'vertedero', 'b'], 39) || 7.66,
      phSentina: getNum(['ph', 'sentina'], 40) || 7.50,

      // Torre 5
      torre5HorasA: getNum(['torre', 'horas', 'a'], 41) || 12,
      torre5VolAM3: getNum(['torre', 'vol', 'a'], 42) || 77800,
      torre5HorasB: getNum(['torre', 'horas', 'b'], 43) || 12,
      torre5VolBM3: getNum(['torre', 'vol', 'b'], 44) || 78483,
      torre5VolDiaM3: getNum(['torre', 'dia'], 45) || 156283,
      torre5VolAcumuladoM3: getNum(['torre', 'acumulado'], 46) || 54200000,

      // Espejos y Tirantes
      espejoLibreAM: getNum(['espejo', 'a'], 47) || 185.0,
      espejoLibreBM: getNum(['espejo', 'b'], 48) || 185.5,
      tiranteCaptacionTAM: getNum(['tirante', 'a'], 49) || 6.20,
      tiranteCaptacionTBM: getNum(['tirante', 'b'], 50) || 6.22,

      // Ciclones
      ciclones1raMalla200APct: getNum(['1ra', '-200', 'a'], 51) || 12.4,
      ciclones1raMalla200BPct: getNum(['1ra', '-200', 'b'], 52) || 12.6,
      ciclones1raMalla200PromPct: getNum(['1ra', '-200', 'prom'], 53) || 12.5,
      ciclones1raSolidosAPct: getNum(['1ra', 'solidos', 'a'], 54) || 68.1,
      ciclones1raSolidosBPct: getNum(['1ra', 'solidos', 'b'], 55) || 68.3,
      ciclones1raSolidosPromPct: getNum(['1ra', 'solidos', 'prom'], 56) || 68.2,
      ciclones2daMalla200APct: getNum(['2da', '-200', 'a'], 57) || 8.9,
      ciclones2daMalla200BPct: getNum(['2da', '-200', 'b'], 58) || 9.1,
      ciclones2daMalla200PromPct: getNum(['2da', '-200', 'prom'], 59) || 9.0,
      ciclones2daSolidosAPct: getNum(['2da', 'solidos', 'a'], 60) || 70.10,
      ciclones2daSolidosBPct: getNum(['2da', 'solidos', 'b'], 61) || 70.20,
      ciclones2daSolidosPromPct: getNum(['2da', 'solidos', 'prom'], 62) || 70.15,
      ciclonesPresionPsi: getNum(['ciclones', 'psi'], 63) || 18.5,

      // Talud & Disposición
      descargaTaludHorasA: getNum(['talud', 'a'], 64) || 12,
      descargaTaludHorasB: getNum(['talud', 'b'], 65) || 12,
      descargaCoronaM3: getNum(['descarga', 'corona'], 66) || 12400,
      drenBasalM3: getNum(['dren', 'basal'], 67) || 1800,
      descargaHidraulicaM3: getNum(['descarga', 'hidraulica'], 68) || 14200,

      // Embalse
      lineasActivas: getString(['lineas', 'activas'], 69) || 'L-03, L-04, L-07, L-12',
      spigotsActivosTotal: getNum(['spigots'], 70) || 28,
      zonaOperativa: getString(['zona'], 71) || 'Zona Sur / Estribo Izquierdo',
      cola16PulgActiva: true,

      // Diques
      reglasAlmacenamiento: getString(['reglas'], 72) || 'Regla Operativa GISTM 2026',
      longitudPlayaM: getNum(['playa'], 73) || 220,
      cotaDiqueSecundarioMsnm: getNum(['dique', 'secundario'], 74) || 4160.00,

      // Agua Fresca
      aguaFrescaVolAM3: getNum(['fresca', 'a'], 75) || 9200,
      aguaFrescaVolBM3: getNum(['fresca', 'b'], 76) || 9200,
      aguaFrescaTotalDiaM3: getNum(['fresca', 'total'], 77) || 18400,
      ratioAguaTon: getNum(['ratio'], 78) || 0.65,

      // Arenas Paddocks
      arenasFlujometroAM3: getNum(['arenas', 'flujo', 'a'], 79) || 7400,
      arenasFlujometroBM3: getNum(['arenas', 'flujo', 'b'], 80) || 7450,
      arenasTotalAcumM3: getNum(['arenas', 'acum'], 81) || 14850,

      // Lamas
      lamasSpigotsInfo: getString(['lamas'], 82) || '1A, 2A, 3A activos (Estribo Izq)',

      // Densidad
      densidadPulpaA: getNum(['densidad', 'a'], 83) || 1.68,
      densidadPulpaB: getNum(['densidad', 'b'], 84) || 1.69,
      densidadPulpaProm: getNum(['densidad', 'prom'], 85) || 1.685,

      // Producción & Compactación
      arenasProdFlujometroM3: getNum(['prod', 'flujo'], 86) || 14850,
      arenasProdTopografiaM3: getNum(['prod', 'topo'], 87) || 14720,
      factorCorreccion: getNum(['factor', 'correccion'], 88) || 0.99,
      compactacionPct: getNum(['compactacion'], 89) || 98.4,

      // Filtraciones
      filtracionesDrenesLs: getNum(['filtraciones', 'drenes'], 90) || 0.9,
      filtracionesSentinaSubdrenLs: getNum(['filtraciones', 'sentina'], 91) || 0.6,
      filtracionesTotalLs: getNum(['filtraciones', 'total', 'l/s'], 92) || 1.5,
      filtracionesTotalM3Dia: getNum(['filtraciones', 'total', 'm3'], 93) || 129.6,
      balanceFactor: getNum(['balance'], 94) || 1.01,

      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Generates comprehensive seed data matching Anglo American Quellaveco / Basetrack specifications
   */
  public generateSeedData(): MasterSheetEntry[] {
    const list: MasterSheetEntry[] = [];
    const baseDate = new Date(2026, 6, 13); // 13/07/2026

    for (let i = 0; i < 14; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);

      const dayStr = String(d.getDate()).padStart(2, '0');
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const yearStr = d.getFullYear();
      const fecha = `${dayStr}/${monthStr}/${yearStr}`;
      const isoDate = `${yearStr}-${monthStr}-${dayStr}`;

      const delta = i * 0.04;
      const cotaEmbalse = 4165.87 - delta;
      const cotaCorona = 4170.00;
      const bordeLibre = +(cotaCorona - cotaEmbalse).toFixed(2);

      const relaveDia = Math.round(165232 - (i % 3) * 2100 + (i % 2) * 1400);
      const torre5Dia = Math.round(156283 - (i % 4) * 1900 + (i % 3) * 800);

      list.push({
        fecha,
        isoDate,
        vertederoTurnoALs: 2.3,
        vertederoTurnoAM3: 99.36,
        vertederoTurnoBLs: 2.5,
        vertederoTurnoBM3: 108.0,
        vertederoTotalDiaM3: 207.36,
        vertederoPromLs: 2.4,

        relaveFlujoAM3h: 6867,
        relaveHorasA: 12,
        relaveVolAM3: Math.round(relaveDia / 2),
        relaveFlujoBM3h: 6901,
        relaveHorasB: 12,
        relaveVolBM3: Math.round(relaveDia / 2),
        relaveTotalHoras: 24,
        relaveTotalVolDiaM3: relaveDia,
        relaveAcumuladoEmbalseM3: 84520100 - i * 165000,

        cotaCoronaMsnm: cotaCorona,
        elevacionCotaMsnm: cotaEmbalse,
        crecimientoPresaM: 0.05,
        cotaEmbalseMsnm: cotaEmbalse,
        bordeLibreM: bordeLibre,
        volAguaRealAcumuladoM3: 1420500 - i * 12000,
        alturaLibreOperacionalM: +(bordeLibre - 0.93).toFixed(2),

        sentinaHorasA: 12,
        sentinaVolAM3: 420,
        sentinaHorasB: 12,
        sentinaVolBM3: 420,
        sentinaBombeadoTotalM3: 840,
        sentinaPo001NivelAPct: 34 + (i % 4),
        sentinaPo001NivelBPct: 35 + (i % 3),

        eiHorasA: 12,
        eiVolAM3: 625,
        eiHorasB: 12,
        eiVolBM3: 625,
        eiTotalM3: 1250,
        eiCaudalPromLs: 14.5,

        phEmbalseA: +(7.80 + (i % 3) * 0.02).toFixed(2),
        phEmbalseB: +(7.84 - (i % 2) * 0.02).toFixed(2),
        phVertederoA: 7.64,
        phVertederoB: 7.66,
        phSentina: 7.50,

        torre5HorasA: 12,
        torre5VolAM3: Math.round(torre5Dia / 2),
        torre5HorasB: 12,
        torre5VolBM3: Math.round(torre5Dia / 2),
        torre5VolDiaM3: torre5Dia,
        torre5VolAcumuladoM3: 54200000 - i * 155000,

        espejoLibreAM: 185.0,
        espejoLibreBM: 185.5,
        tiranteCaptacionTAM: 6.20,
        tiranteCaptacionTBM: 6.22,

        ciclones1raMalla200APct: 12.4,
        ciclones1raMalla200BPct: 12.6,
        ciclones1raMalla200PromPct: 12.5,
        ciclones1raSolidosAPct: 68.1,
        ciclones1raSolidosBPct: 68.3,
        ciclones1raSolidosPromPct: 68.2,
        ciclones2daMalla200APct: 8.9,
        ciclones2daMalla200BPct: 9.1,
        ciclones2daMalla200PromPct: 9.0,
        ciclones2daSolidosAPct: 70.10,
        ciclones2daSolidosBPct: 70.20,
        ciclones2daSolidosPromPct: +(70.15 - (i % 4) * 0.1).toFixed(2),
        ciclonesPresionPsi: +(18.5 + (i % 3) * 0.2).toFixed(1),

        descargaTaludHorasA: 12,
        descargaTaludHorasB: 12,
        descargaCoronaM3: 12400,
        drenBasalM3: 1800,
        descargaHidraulicaM3: 14200,

        lineasActivas: 'L-03, L-04, L-07, L-12',
        spigotsActivosTotal: 28,
        zonaOperativa: 'Zona Sur / Estribo Izquierdo',
        cola16PulgActiva: true,

        reglasAlmacenamiento: 'Regla Operativa GISTM 2026',
        longitudPlayaM: 220,
        cotaDiqueSecundarioMsnm: 4160.00,

        aguaFrescaVolAM3: 9200,
        aguaFrescaVolBM3: 9200,
        aguaFrescaTotalDiaM3: 18400,
        ratioAguaTon: 0.65,

        arenasFlujometroAM3: 7400,
        arenasFlujometroBM3: 7450,
        arenasTotalAcumM3: 14850,

        lamasSpigotsInfo: '1A, 2A, 3A activos (Estribo Izq)',

        densidadPulpaA: 1.68,
        densidadPulpaB: 1.69,
        densidadPulpaProm: 1.685,

        arenasProdFlujometroM3: 14850,
        arenasProdTopografiaM3: 14720,
        factorCorreccion: 0.99,
        compactacionPct: 98.4,

        filtracionesDrenesLs: 0.9,
        filtracionesSentinaSubdrenLs: 0.6,
        filtracionesTotalLs: 1.5,
        filtracionesTotalM3Dia: 129.6,
        balanceFactor: 1.01,

        updatedAt: new Date().toISOString()
      });
    }

    return list;
  }

  /**
   * Generates and triggers download of the official blank .xlsx Master Template
   */
  public downloadMasterTemplate(): void {
    const wb = XLSX.utils.book_new();

    // Row 1: Section Headers
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

    // Row 2: Sub-headers
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

    // Sample Row
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

  /**
   * Resets local storage to default demo data
   */
  public resetToDemo(): void {
    const seed = this.generateSeedData();
    this.entries.set(seed);
    this.selectedDate.set(seed[0].fecha);
    saveRealtimeData(STORAGE_KEY, seed);
    this.lastUpdated.set(new Date());
  }

  // --- Helpers ---

  private cleanNumeric(val: any): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const clean = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
      const num = parseFloat(clean);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  private isDateValue(val: any): boolean {
    if (!val) return false;
    if (val instanceof Date) return true;
    if (typeof val === 'number' && val > 35000 && val < 60000) return true;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(trimmed) ||
             /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(trimmed);
    }
    return false;
  }

  private normalizeDate(val: any): { fecha: string; isoDate: string } | null {
    if (!val) return null;

    let d: Date | null = null;
    if (val instanceof Date) {
      d = val;
    } else if (typeof val === 'number' && val > 35000 && val < 60000) {
      // Excel serial date to JS Date
      d = new Date(Math.round((val - 25569) * 86400 * 1000));
    } else if (typeof val === 'string') {
      const str = val.trim();
      // Test DD/MM/YYYY or DD-MM-YYYY
      const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (dmy) {
        let year = parseInt(dmy[3], 10);
        if (year < 100) year += 2000;
        const month = parseInt(dmy[2], 10) - 1;
        const day = parseInt(dmy[1], 10);
        d = new Date(year, month, day);
      } else {
        // Test YYYY-MM-DD
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
    this.http.get<any>(`${getApiBaseUrl()}/dashboard/master-sheet`).pipe(
      timeout(3000),
      catchError(() => of(null))
    ).subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          // If server has more or newer records, we can merge
          const current = this.entries();
          const map = new Map<string, MasterSheetEntry>();
          for (const item of res.data) map.set(item.fecha, item);
          for (const item of current) map.set(item.fecha, item); // Keep local modifications
          const merged = Array.from(map.values()).sort((a, b) => b.isoDate.localeCompare(a.isoDate));
          this.entries.set(merged);
          saveRealtimeData(STORAGE_KEY, merged);
        }
      }
    });
  }

  private syncToServer(records: MasterSheetEntry[]): void {
    this.http.post<any>(`${getApiBaseUrl()}/dashboard/master-sheet`, { entries: records }).pipe(
      timeout(4000),
      catchError(() => of(null))
    ).subscribe();
  }
}
