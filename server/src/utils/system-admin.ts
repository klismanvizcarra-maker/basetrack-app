import { db } from '../database/db.js';

const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * true si el nombre o usuario corresponde a una cuenta ADMIN de sistema (Marckv).
 * El administrador raíz es un usuario fantasma: nunca puede figurar como supervisor de guardia,
 * operador ni chofer de camioneta (CLAUDE.md §3.1).
 */
export function isSystemAdminIdentity(nameOrUsername: unknown): boolean {
  const target = normalize(nameOrUsername);
  if (!target) return false;
  const admins = db.prepare("SELECT username, full_name FROM users WHERE role = 'ADMIN'").all() as Array<{ username: string; full_name: string }>;
  return admins.some(a => normalize(a.username) === target || normalize(a.full_name) === target);
}
