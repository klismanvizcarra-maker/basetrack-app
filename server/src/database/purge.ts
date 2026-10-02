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

  // 3. Insert Sole Administrator: Marckv (Ghost system administrator - no operational DNI)
  const adminId = crypto.randomUUID();
  const adminHash = bcrypt.hashSync('91209966', 10);
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url, is_active, document_id, primary_role)
    VALUES (?, ?, ?, ?, ?, 'ADMIN', 'ADMIN', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80', 1, '', 'ADMIN')
  `).run(
    adminId,
    'Marckv',
    'marckvizcarra@basetrack.com',
    adminHash,
    'Marck Vizcarra'
  );

  // 4. Default operational positions in crew_positions
  const posCount = (db.prepare('SELECT COUNT(*) as cnt FROM crew_positions').get() as { cnt: number })?.cnt || 0;
  if (posCount === 0) {
    const defaultPositions = [
      { key: 'SUPERVISOR', title: 'Supervisor de guardia', default_location: 'Supervisión de Turno / Gestión Operativa', default_radio: 'Canal 1 Operaciones / Control', badge_class: 'card-supervisor', icon_svg: '🦺', description: 'Liderazgo operativo de guardia, gestión de seguridad y supervisión general de planta' },
      { key: 'SALA_CONTROL', title: 'Operador sala de control', default_location: 'Sala de Control DCS / SCADA', default_radio: 'Canal 1 Operaciones / Control', badge_class: 'card-control', icon_svg: '🖥️', description: 'Operación de consolas DCS/SCADA, monitoreo de variables de proceso, enclavamientos y alarmas' },
      { key: 'BOMBAS', title: 'Operador de bombas', default_location: 'Sala de Bombas Slurry PP-101 a PP-104 & Sentinas', default_radio: 'Canal 3 Bombas', badge_class: 'card-bombas', icon_svg: '🌊', description: 'Monitoreo de flujo, amperaje y presión en bombas PP-101 a PP-104 y niveles de poza' },
      { key: 'CICLONES_1', title: 'Operador de ciclones 1', default_location: '1ra Estación Baterías de Ciclones D-10', default_radio: 'Canal 2 Ciclones', badge_class: 'card-ciclones', icon_svg: '🌀', description: 'Muestreo metalúrgico horario de pulpa en 1ra batería, presiones y ápex/vortex' },
      { key: 'CICLONES_2', title: 'Operador de ciclones 2', default_location: '2da Estación Baterías de Ciclones D-10', default_radio: 'Canal 2 Ciclones', badge_class: 'card-ciclones', icon_svg: '🌪️', description: 'Control de balance de sólidos y granulometría de mallas -200 en 2da estación' },
      { key: 'DISTRIBUIDOR', title: 'Operador de distribuidor', default_location: 'Cajón Distribuidor & Repartición de Carga', default_radio: 'Canal 6 Distribuidor / Flujo', badge_class: 'card-distribuidor', icon_svg: '🔀', description: 'Distribución balanceada de pulpa hacia baterías de clasificación y flotación' },
      { key: 'DESCARGA_1', title: 'Operador de descarga 1', default_location: 'Línea HDPE de Impulsión & Estación Relaves', default_radio: 'Canal 4 Presa / Descarga', badge_class: 'card-descarga', icon_svg: '🏔️', description: 'Supervisión de impulsión en tuberías HDPE y flujo de pulpa espesada' },
      { key: 'DESCARGA_2', title: 'Operador de descarga 2', default_location: 'Presa Principal de Relaves & Muro de Contención', default_radio: 'Canal 4 Presa / Descarga', badge_class: 'card-descarga', icon_svg: '🏞️', description: 'Inspección de vertedero, borde libre, muro y lecturas piezométricas' },
      { key: 'MISCELANEOS', title: 'Operador de misceláneos', default_location: 'Planta de Reactivos, Floculante & Servicios Auxiliares', default_radio: 'Canal 5 Auxiliares / Planta', badge_class: 'card-miscelaneos', icon_svg: '⚙️', description: 'Preparación de reactivos, dosificación de floculante y apoyo en campo' }
    ];
    const insertPos = db.prepare(`
      INSERT OR IGNORE INTO crew_positions (key, title, default_location, default_radio, badge_class, icon_svg, description, is_custom)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0);
    `);
    for (const p of defaultPositions) {
      insertPos.run(p.key, p.title, p.default_location, p.default_radio, p.badge_class, p.icon_svg, p.description);
    }
  }

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
