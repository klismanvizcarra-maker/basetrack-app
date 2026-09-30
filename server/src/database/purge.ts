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
