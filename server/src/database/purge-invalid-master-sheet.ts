import path from 'node:path';
import fs from 'node:fs';
import { db, dbFilePath } from './db.js';
import { validateMasterSheetRecord } from '../utils/master-sheet-validation.js';

/**
 * Depura registros de la Planilla Maestra con cotas / borde libre físicamente imposibles
 * (las mismas reglas que rechaza POST /dashboard/master-sheet).
 *
 * Uso:
 *   npm run purge:master-sheet            → simulación: solo lista lo que se borraría
 *   npm run purge:master-sheet -- --apply → respalda la base y borra los registros inválidos
 *
 * Recomendado: reimportar primero la planilla original con el importador corregido,
 * para que solo queden inválidos los días que el Excel no reemplaza.
 */

const apply = process.argv.includes('--apply');

const rows = db.prepare('SELECT id, report_date, data_json FROM master_sheet_entries ORDER BY report_date').all() as {
  id: string;
  report_date: string;
  data_json: string;
}[];

const invalid: { id: string; date: string; reason: string }[] = [];
for (const row of rows) {
  let reasons: string[];
  try {
    reasons = validateMasterSheetRecord(JSON.parse(row.data_json));
  } catch {
    reasons = ['data_json corrupto'];
  }
  if (reasons.length > 0) invalid.push({ id: row.id, date: row.report_date, reason: reasons[0] });
}

console.log(`[Planilla] Base: ${dbFilePath}`);
console.log(`[Planilla] Registros: ${rows.length} | válidos: ${rows.length - invalid.length} | inválidos: ${invalid.length}`);

const byYear: Record<string, number> = {};
for (const item of invalid) byYear[item.date.slice(0, 4)] = (byYear[item.date.slice(0, 4)] || 0) + 1;
if (invalid.length > 0) {
  console.log('[Planilla] Inválidos por año:', byYear);
  for (const item of invalid.slice(0, 5)) console.log(`  - ${item.date}: ${item.reason}`);
  if (invalid.length > 10) console.log(`  ... ${invalid.length - 10} más ...`);
  for (const item of invalid.slice(Math.max(5, invalid.length - 5))) console.log(`  - ${item.date}: ${item.reason}`);
}

if (!apply) {
  console.log('[Planilla] Simulación: no se borró nada. Ejecute con --apply para depurar.');
  process.exit(0);
}

if (invalid.length === 0) {
  console.log('[Planilla] No hay registros inválidos que depurar.');
  process.exit(0);
}

// Respaldo atómico previo (mismo mecanismo que backup.ts)
const backupsDir = path.join(path.dirname(dbFilePath), 'backups');
fs.mkdirSync(backupsDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupsDir, `basetrack_backup_pre_purge_planilla_${stamp}.db`);
db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}';`);
console.log(`[Planilla] Respaldo previo: ${backupPath}`);

const del = db.prepare('DELETE FROM master_sheet_entries WHERE id = ?');
db.exec('BEGIN');
try {
  let deleted = 0;
  for (const item of invalid) deleted += Number((del.run(item.id) as { changes?: number }).changes || 0);
  db.exec('COMMIT');
  const left = db.prepare('SELECT count(*) AS c FROM master_sheet_entries').get() as { c: number };
  console.log(`[Planilla] Borrados: ${deleted} | quedan: ${left.c}`);
} catch (error) {
  db.exec('ROLLBACK');
  console.error('[Planilla] Error: no se borró nada (rollback).', error);
  process.exit(1);
}
