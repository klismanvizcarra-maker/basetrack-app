import { initDatabase } from './db.js';

/**
 * Migration Script: Synchronizes the official 36 plant staff and sole administrator Marckv.
 * All logic is centralized in initDatabase() within db.ts.
 */
export function applyOfficialStaff() {
  console.log('[Migration] Initializing official database state (Sole Admin Marckv + 36 Staff)...');
  initDatabase();
  console.log('[Migration] SUCCESS: Official staff and sole administrator Marckv synchronized.');
}

if (process.argv[1] && process.argv[1].endsWith('apply_official_staff.ts')) {
  applyOfficialStaff();
}
