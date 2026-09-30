import { db, initDatabase } from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export function purgeAndSetSoleAdmin() {
  initDatabase();

  console.log('[Purge] Starting complete database clean slate...');

  db.exec('PRAGMA foreign_keys = OFF;');

  // 1. Wipe all generated reports, handovers, samples, checklists and assignments
  db.prepare('DELETE FROM shift_handovers').run();
  db.prepare('DELETE FROM pump_reports').run();
  db.prepare('DELETE FROM pump_station_sheets').run();
  db.prepare('DELETE FROM cyclone_reports').run();
  db.prepare('DELETE FROM cyclone_station_samples').run();
  db.prepare('DELETE FROM tailings_reports').run();
  db.prepare('DELETE FROM maintenance_requests').run();
  db.prepare('DELETE FROM vehicle_checklists').run();
  db.prepare('DELETE FROM crew_area_assignments').run();
  db.prepare('DELETE FROM supervisor_operators').run();
  db.prepare('DELETE FROM crew_members').run();
  db.prepare('DELETE FROM user_permission_overrides').run();
  db.prepare('DELETE FROM audit_logs').run();
  db.prepare('DELETE FROM sync_events').run();
  db.prepare('DELETE FROM connected_devices').run();

  // 2. Delete all users
  db.prepare('DELETE FROM users').run();

  // 3. Insert Sole Administrator: Marck Vizcarra (DNI: 91209966, Pass: 91209966)
  const adminId = crypto.randomUUID();
  const adminHash = bcrypt.hashSync('91209966', 10);
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url, is_active, document_id, primary_role)
    VALUES (?, ?, ?, ?, ?, 'ADMIN', 'ADMIN', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80', 1, ?, 'ADMIN')
  `).run(
    adminId,
    'Marckv',
    'marckvizcarra@basetrack.com',
    adminHash,
    'Marck Vizcarra',
    '91209966'
  );

  // 4. Seed initial active operational shift handover for current shift
  db.prepare(`
    INSERT INTO shift_handovers (
      id, shift_code, date, shift_type, outgoing_supervisor, outgoing_dni, outgoing_role,
      incoming_supervisor, incoming_dni, incoming_role,
      plant_status, tonnage_processed, safety_incidents, operational_highlights, pending_tasks, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'sh-active-g4-dia',
    'G4_DIA_20260930',
    '2026-09-30',
    'DIA',
    'Marck Vizcarra',
    '91209966',
    'Administrador de Planta',
    'En espera de relevo de guardia',
    '---',
    'Supervisor de guardia',
    'Operación continua en condiciones estables de proceso. Circuitos de molienda SAG, flotación y espesamiento operando según parámetros de diseño.',
    24500,
    'Cero accidentes laborales (LTI: 0). Charla de seguridad de 5 minutos dictada.',
    'Monitoreo continuo de presiones y densidades en ciclones y bombeo de pulpa.',
    'Mantener control de nivel en presa de relaves y dosificación en planta de reactivos.',
    'SUBMITTED'
  );

  db.exec('PRAGMA foreign_keys = ON;');

  const remainingUsers = db.prepare('SELECT id, username, full_name, role, shift, document_id FROM users').all();
  const remainingCrew = (db.prepare('SELECT COUNT(*) as cnt FROM crew_members').get() as { cnt: number }).cnt;
  const remainingAssignments = (db.prepare('SELECT COUNT(*) as cnt FROM crew_area_assignments').get() as { cnt: number }).cnt;
  const remainingSupOps = (db.prepare('SELECT COUNT(*) as cnt FROM supervisor_operators').get() as { cnt: number }).cnt;

  console.log('[Purge] Remaining Users:', remainingUsers);
  console.log('[Purge] Remaining Crew Members:', remainingCrew);
  console.log('[Purge] Remaining Area Assignments:', remainingAssignments);
  console.log('[Purge] Remaining Supervisor-Operator Links:', remainingSupOps);
  console.log('[Purge] Clean slate complete! Exclusively 1 Administrator Marck Vizcarra (DNI: 91209966).');
}

if (process.argv[1]?.includes('purge.ts') || process.argv[1]?.includes('purge.js')) {
  purgeAndSetSoleAdmin();
}
