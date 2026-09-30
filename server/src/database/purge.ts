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

  // 5. Upsert the 4 Official Supervisors in crew_members
  const OFFICIAL_SUPERVISORS_DATA = [
    { id: 'op-g1-sup', username: 'MiguelG', name: 'GONGORA ROJAS MIGUEL ALONSO', document_id: '41833717', shift: 'G1', email: 'miguelgongora@basetrack.com', radio: 'Canal 1 Operaciones / Control', phone: 'Ext. 4101', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=MIGUELG' },
    { id: 'op-g2-sup', username: 'EmilioA', name: 'ALIAGA CASTAÑEDA EMILIO URIEL', document_id: '46593500', shift: 'G2', email: 'emilioaliaga@basetrack.com', radio: 'Canal 1 Operaciones / Control', phone: 'Ext. 4102', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=EMILIOA' },
    { id: 'op-g3-sup', username: 'HugoA', name: 'ARI MAMANI HUGO ANDRES', document_id: '40132660', shift: 'G3', email: 'hugoari@basetrack.com', radio: 'Canal 1 Operaciones / Control', phone: 'Ext. 4103', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=HUGOA' },
    { id: 'op-g4-sup', username: 'DanteF', name: 'FERNANDEZ ASCURRA DANTE PACO', document_id: '18110964', shift: 'G4', email: 'dantefernandez@basetrack.com', radio: 'Canal 1 Operaciones / Control', phone: 'Ext. 4104', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=DANTEF' }
  ];

  const ALL_32_OPERATORS = [
    // G1
    { id: 'op-g1-ctrl', name: 'PARI COAYLA JHOFER LUIS', document_id: '74924255', primary_role: 'OPERADOR_SALA_CONTROL', shift_code: 'G1', radio: 'Canal 1 Operaciones / Control', phone: 'Ext. 4121', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g1-bombas', name: 'MONTES RODRIGUEZ DIEGO ALEXANDER', document_id: '45437279', primary_role: 'OPERADOR_BOMBAS', shift_code: 'G1', radio: 'Canal 3 Bombas', phone: 'Ext. 4120', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g1-cyc1', name: 'PILCO APAZA CARLOS EDUARDO', document_id: '42324277', primary_role: 'OPERADOR_CICLONES_1', shift_code: 'G1', radio: 'Canal 2 Ciclones', phone: 'Ext. 4122', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g1-cyc2', name: 'MAMANI MIRANDA RONAL', document_id: '72958467', primary_role: 'OPERADOR_CICLONES_2', shift_code: 'G1', radio: 'Canal 2 Ciclones', phone: 'Ext. 4119', avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g1-dist', name: 'HILARI CABRERA EDSON EUSEBIO', document_id: '40824273', primary_role: 'OPERADOR_DISTRIBUIDOR', shift_code: 'G1', radio: 'Canal 6 Distribuidor / Flujo', phone: 'Ext. 4116', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g1-desc1', name: 'VILCAMIZA PEVE JORGE RICARDO', document_id: '41748219', primary_role: 'OPERADOR_DESCARGA_1', shift_code: 'G1', radio: 'Canal 4 Presa / Descarga', phone: 'Ext. 4124', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g1-desc2', name: 'MAMANI CUTIPA ANTHONY JESUS SMIT', document_id: '72297288', primary_role: 'OPERADOR_DESCARGA_2', shift_code: 'G1', radio: 'Canal 4 Presa / Descarga', phone: 'Ext. 4118', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g1-misc', name: 'ROSADO FALCON VILMA LUCIA', document_id: '45564062', primary_role: 'OPERADOR_MISCELANEOS', shift_code: 'G1', radio: 'Canal 5 Auxiliares / Planta', phone: 'Ext. 4123', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80' },

    // G2
    { id: 'op-g2-ctrl', name: 'CRUZ APAZA PAUL', document_id: '44428468', primary_role: 'OPERADOR_SALA_CONTROL', shift_code: 'G2', radio: 'Canal 1 Operaciones / Control', phone: 'Ext. 4115', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g2-bombas', name: 'CASCASI FLORES LUIS ANTONIO', document_id: '43132072', primary_role: 'OPERADOR_BOMBAS', shift_code: 'G2', radio: 'Canal 3 Bombas', phone: 'Ext. 4105', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g2-cyc1', name: 'CHOQUE MANZANO PEDRO IVAN', document_id: '75555937', primary_role: 'OPERADOR_CICLONES_1', shift_code: 'G2', radio: 'Canal 2 Ciclones', phone: 'Ext. 4112', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g2-cyc2', name: 'CAYO GOMEZ VALERIE JAZMINE', document_id: '71719330', primary_role: 'OPERADOR_CICLONES_2', shift_code: 'G2', radio: 'Canal 2 Ciclones', phone: 'Ext. 4109', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g2-dist', name: 'MAMANI CONDORI MARCOS', document_id: '44921034', primary_role: 'OPERADOR_DISTRIBUIDOR', shift_code: 'G2', radio: 'Canal 6 Distribuidor / Flujo', phone: 'Ext. 4113', avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g2-desc1', name: 'QUISPE FLORES ALBERTO', document_id: '45129038', primary_role: 'OPERADOR_DESCARGA_1', shift_code: 'G2', radio: 'Canal 4 Presa / Descarga', phone: 'Ext. 4114', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g2-desc2', name: 'TICONA NINA SERGIO', document_id: '46719203', primary_role: 'OPERADOR_DESCARGA_2', shift_code: 'G2', radio: 'Canal 4 Presa / Descarga', phone: 'Ext. 4110', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g2-misc', name: 'FLORES HUAMAN DANIEL', document_id: '71829340', primary_role: 'OPERADOR_MISCELANEOS', shift_code: 'G2', radio: 'Canal 5 Auxiliares / Planta', phone: 'Ext. 4111', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },

    // G3
    { id: 'op-g3-ctrl', name: 'ZEA MAMANI WALTER', document_id: '41920384', primary_role: 'OPERADOR_SALA_CONTROL', shift_code: 'G3', radio: 'Canal 1 Operaciones / Control', phone: 'Ext. 4131', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g3-bombas', name: 'CHURA MAMANI JORGE LUIS', document_id: '42910293', primary_role: 'OPERADOR_BOMBAS', shift_code: 'G3', radio: 'Canal 3 Bombas', phone: 'Ext. 4132', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g3-cyc1', name: 'SUCA APAZA MARIO', document_id: '43819204', primary_role: 'OPERADOR_CICLONES_1', shift_code: 'G3', radio: 'Canal 2 Ciclones', phone: 'Ext. 4133', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g3-cyc2', name: 'HUANCA QUISPE ELVIS', document_id: '72109283', primary_role: 'OPERADOR_CICLONES_2', shift_code: 'G3', radio: 'Canal 2 Ciclones', phone: 'Ext. 4134', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g3-dist', name: 'CALISAYA CONDORI NESTOR', document_id: '40918204', primary_role: 'OPERADOR_DISTRIBUIDOR', shift_code: 'G3', radio: 'Canal 6 Distribuidor / Flujo', phone: 'Ext. 4135', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g3-desc1', name: 'MAMANI QUISPE VICTOR', document_id: '44109283', primary_role: 'OPERADOR_DESCARGA_1', shift_code: 'G3', radio: 'Canal 4 Presa / Descarga', phone: 'Ext. 4136', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g3-desc2', name: 'RAMOS COAQUIRA GUIDO', document_id: '73192039', primary_role: 'OPERADOR_DESCARGA_2', shift_code: 'G3', radio: 'Canal 4 Presa / Descarga', phone: 'Ext. 4137', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g3-misc', name: 'PARI MAMANI HERNAN', document_id: '42109384', primary_role: 'OPERADOR_MISCELANEOS', shift_code: 'G3', radio: 'Canal 5 Auxiliares / Planta', phone: 'Ext. 4138', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80' },

    // G4
    { id: 'op-g4-ctrl', name: 'ORTEGA RAMÍREZ CESAR', document_id: '40918239', primary_role: 'OPERADOR_SALA_CONTROL', shift_code: 'G4', radio: 'Canal 1 Operaciones / Control', phone: 'Ext. 4141', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g4-bombas', name: 'CAMPOS ZEA OSWALDO', document_id: '72910394', primary_role: 'OPERADOR_BOMBAS', shift_code: 'G4', radio: 'Canal 3 Bombas', phone: 'Ext. 4142', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g4-cyc1', name: 'SUÁREZ MAMANI JULIO', document_id: '44819203', primary_role: 'OPERADOR_CICLONES_1', shift_code: 'G4', radio: 'Canal 2 Ciclones', phone: 'Ext. 4143', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g4-cyc2', name: 'CORNEJO NINA ALONSO', document_id: '75910293', primary_role: 'OPERADOR_CICLONES_2', shift_code: 'G4', radio: 'Canal 2 Ciclones', phone: 'Ext. 4144', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g4-dist', name: 'MAMANI YUCRA EDWIN', document_id: '43910293', primary_role: 'OPERADOR_DISTRIBUIDOR', shift_code: 'G4', radio: 'Canal 6 Distribuidor / Flujo', phone: 'Ext. 4145', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g4-desc1', name: 'CANAZA MAMANI JAIME', document_id: '42019283', primary_role: 'OPERADOR_DESCARGA_1', shift_code: 'G4', radio: 'Canal 4 Presa / Descarga', phone: 'Ext. 4146', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g4-desc2', name: 'QUISPE TICONA FREDY', document_id: '71920394', primary_role: 'OPERADOR_DESCARGA_2', shift_code: 'G4', radio: 'Canal 4 Presa / Descarga', phone: 'Ext. 4147', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },
    { id: 'op-g4-misc', name: 'ALVAREZ CHURA GABRIEL', document_id: '45192038', primary_role: 'OPERADOR_MISCELANEOS', shift_code: 'G4', radio: 'Canal 5 Auxiliares / Planta', phone: 'Ext. 4148', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80' }
  ];

  const insertCrew = db.prepare(`
    INSERT OR REPLACE INTO crew_members (id, name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'EN_TURNO', ?);
  `);

  for (const sup of OFFICIAL_SUPERVISORS_DATA) {
    insertCrew.run(sup.id, sup.name, sup.document_id, 'SUPERVISOR', sup.shift, sup.radio, sup.phone, sup.avatar);
  }
  for (const op of ALL_32_OPERATORS) {
    insertCrew.run(op.id, op.name, op.document_id, op.primary_role, op.shift_code, op.radio, op.phone, op.avatar);
  }

  // 6. Seed initial active operational shift handover for current shift (G4 Día -> G2 Noche)
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
    'FERNANDEZ ASCURRA DANTE PACO',
    '18110964',
    'Supervisor de guardia',
    'ALIAGA CASTAÑEDA EMILIO URIEL',
    '46593500',
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
