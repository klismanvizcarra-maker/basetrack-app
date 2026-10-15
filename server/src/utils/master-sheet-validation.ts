/**
 * Validación de rangos físicos críticos para registros de la Planilla Maestra (presa de relaves).
 * Espejo de las reglas críticas de `src/app/core/models/master-sheet.validation.ts` (frontend):
 * mantener ambas sincronizadas.
 *
 * Un registro que no cumple estas reglas no puede evaluar el borde libre GISTM y no se persiste.
 */

interface CriticalRule {
  field: string;
  label: string;
  min: number;
  max: number;
  unit: string;
  required: boolean;
}

const CRITICAL_RULES: CriticalRule[] = [
  { field: 'cotaCoronaMsnm', label: 'Cota Corona', min: 3000, max: 5000, unit: 'msnm', required: true },
  { field: 'cotaEmbalseMsnm', label: 'Cota Embalse', min: 3000, max: 5000, unit: 'msnm', required: true },
  { field: 'bordeLibreM', label: 'Borde Libre', min: 0, max: 50, unit: 'm', required: true },
  { field: 'elevacionCotaMsnm', label: 'Elevación Cota', min: 3000, max: 5000, unit: 'msnm', required: false }
];

/** Devuelve los motivos por los que el registro es físicamente imposible (vacío si es válido). */
export function validateMasterSheetRecord(item: any): string[] {
  const errors: string[] = [];

  for (const rule of CRITICAL_RULES) {
    const raw = item?.[rule.field];
    // En campos opcionales el importador deja 0 cuando la planilla no trae la columna: equivale a "sin dato"
    const absent = raw === undefined || raw === null || raw === '' || (!rule.required && Number(raw) === 0);
    if (absent) {
      if (rule.required) errors.push(`${rule.label}: sin dato`);
      continue;
    }
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value)) {
      errors.push(`${rule.label}: valor no numérico (${String(raw)})`);
    } else if (value < rule.min || value > rule.max) {
      errors.push(`${rule.label} = ${value} ${rule.unit} fuera de rango físico [${rule.min}, ${rule.max}]`);
    }
  }

  const corona = Number(item?.cotaCoronaMsnm);
  const embalse = Number(item?.cotaEmbalseMsnm);
  if (Number.isFinite(corona) && Number.isFinite(embalse) && embalse > corona) {
    errors.push(`Cota Embalse (${embalse}) superior a Cota Corona (${corona})`);
  }

  return errors;
}
