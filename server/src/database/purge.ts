import { db, initDatabase } from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export function purgeAndSetSoleAdmin() {
  initDatabase();

  console.log('[Purge] Starting database purge...');

  // 1. Delete all operational assignments and relations
  db.prepare('DELETE FROM crew_area_assignments').run();
  db.prepare('DELETE FROM supervisor_operators').run();
  db.prepare('DELETE FROM crew_members').run();
  db.prepare('DELETE FROM user_permission_overrides').run();

  // 2. Delete all users except Marckv
  db.prepare("DELETE FROM users WHERE LOWER(username) != 'marckv'").run();

  // 3. Ensure Marckv exists with correct data
  const marck = db.prepare("SELECT * FROM users WHERE LOWER(username) = 'marckv'").get() as any;
  if (!marck) {
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url, is_active, document_id, primary_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'ADMIN')
    `).run(
      crypto.randomUUID(),
      'Marckv',
      'marckvizcarra@basetrack.com',
      bcrypt.hashSync('2794vizcarra', 10),
      'Marck Vizcarra',
      'ADMIN',
      'ADMIN',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
      '2794vizcarra'
    );
  } else {
    db.prepare(`
      UPDATE users 
      SET full_name = 'Marck Vizcarra',
          email = 'marckvizcarra@basetrack.com',
          password_hash = ?,
          role = 'ADMIN',
          shift = 'ADMIN',
          document_id = '2794vizcarra',
          primary_role = 'ADMIN',
          is_active = 1
      WHERE id = ?
    `).run(bcrypt.hashSync('2794vizcarra', 10), marck.id);
  }

  const remainingUsers = db.prepare('SELECT id, username, full_name, role, shift FROM users').all();
  const remainingCrew = (db.prepare('SELECT COUNT(*) as cnt FROM crew_members').get() as { cnt: number }).cnt;
  const remainingAssignments = (db.prepare('SELECT COUNT(*) as cnt FROM crew_area_assignments').get() as { cnt: number }).cnt;
  const remainingSupOps = (db.prepare('SELECT COUNT(*) as cnt FROM supervisor_operators').get() as { cnt: number }).cnt;

  console.log('[Purge] Remaining Users:', remainingUsers);
  console.log('[Purge] Remaining Crew Members:', remainingCrew);
  console.log('[Purge] Remaining Area Assignments:', remainingAssignments);
  console.log('[Purge] Remaining Supervisor-Operator Links:', remainingSupOps);
  console.log('[Purge] Purge complete! Single administrator Marckv active.');
}

if (process.argv[1] && process.argv[1].endsWith('purge.ts')) {
  purgeAndSetSoleAdmin();
}
