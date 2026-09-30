import { db, initDatabase } from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export function seed() {
  initDatabase();

  // 1. Users - Idempotent Seeding
  const checkUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)');
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const staffUsers = [
    {
      username: 'Marckv',
      fullName: 'Marck Vizcarra',
      dni: '2794vizcarra',
      role: 'ADMIN',
      shift: 'ADMIN',
      email: 'marckvizcarra@basetrack.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80'
    }
  ];

  for (const u of staffUsers) {
    const existing = checkUser.get(u.username, u.email);
    if (!existing) {
      insertUser.run(
        crypto.randomUUID(),
        u.username,
        u.email,
        bcrypt.hashSync(u.dni, 10),
        u.fullName,
        u.role,
        u.shift,
        u.avatar
      );
    }
  }

  // 2. Shift Handovers - Clean obsolete test records
  db.prepare(`
    DELETE FROM shift_handovers 
    WHERE outgoing_supervisor LIKE '%Roberto Quispe%' 
       OR outgoing_supervisor LIKE '%VIZCARRA CORI%' 
       OR incoming_supervisor LIKE '%Marco Vel%' 
       OR incoming_supervisor LIKE '%LLERENA CALLE%'
       OR date < '2026-09-26'
  `).run();

  const shiftCount = (db.prepare('SELECT COUNT(*) as count FROM shift_handovers').get() as { count: number }).count;
  if (shiftCount === 0) {
    console.log('[Seed] Seeding shift handovers with official 8x8 rotation (G4 entrega a G2)...');
    const insertShift = db.prepare(`
      INSERT INTO shift_handovers (
        id, shift_code, date, shift_type,
        outgoing_supervisor, outgoing_dni, outgoing_role,
        incoming_supervisor, incoming_dni, incoming_role,
        plant_status, tonnage_processed, safety_incidents,
        operational_highlights, pending_tasks, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Rotación oficial de hoy 29-Sep-2026: Bloque 3 día 4 -> G4 (Turno Día) entrega a G2 (Turno Noche)
    insertShift.run(
      crypto.randomUUID(),
      'G4_DIA_0929',
      '2026-09-29',
      'DIA',
      'FERNANDEZ ASCURRA DANTE PACO',
      '18110964',
      'Supervisor de guardia',
      'ALIAGA CASTAÑEDA EMILIO URIEL',
      '46593500',
      'Supervisor de guardia',
      'Planta Concentradora operando en régimen continuo normal. Circuitos de molienda SAG y flotación estables sin anomalías.',
      24500,
      'Cero accidentes laborales (LTI: 0). Charla de seguridad de 5 minutos completada al inicio de turno.',
      'Caudal sostenido de pulpa hacia baterías de ciclones. Presión de manifold en rango operativo óptimo (18.5 PSI).',
      'Inspección programada de bombas de alimentación e impulsor en siguiente relevo.',
      'ACCEPTED'
    );
  }

  // 3. Pump Reports
  const pumpsCount = (db.prepare('SELECT COUNT(*) as count FROM pump_reports').get() as { count: number }).count;
  if (pumpsCount === 0) {
    console.log('[Seed] Seeding pumps reports...');
    const insertPump = db.prepare(`
      INSERT INTO pump_reports (id, tag, name, system, status, flow_rate_m3h, pressure_bar, rpm, bearing_temp_c, vibration_mms, current_amps, shift_code, operator_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const pumpsData = [
      { tag: 'PP-101', name: 'Bomba Slurry Alimentación Ciclones 01', system: 'ALIMENTACION_CICLONES', status: 'OPERATING', flow: 1850, press: 4.8, rpm: 580, temp: 62.4, vib: 2.3, amps: 310, notes: 'Operando en parámetros nominales.' },
      { tag: 'PP-102', name: 'Bomba Slurry Alimentación Ciclones 02', system: 'ALIMENTACION_CICLONES', status: 'STANDBY', flow: 0, press: 0.1, rpm: 0, temp: 34.0, vib: 0.2, amps: 0, notes: 'Unidad de respaldo lista para transferencia.' },
      { tag: 'TL-201', name: 'Bomba de Pulpa Relaves Espesados', system: 'TRANSPORTE_RELAVES', status: 'OPERATING', flow: 2150, press: 6.2, rpm: 720, temp: 68.1, vib: 3.1, amps: 420, notes: 'Presión estable hacia presa principal.' },
      { tag: 'TL-202', name: 'Bomba de Pulpa Relaves Auxiliar', system: 'TRANSPORTE_RELAVES', status: 'MAINTENANCE', flow: 0, press: 0, rpm: 0, temp: 28.5, vib: 0, amps: 0, notes: 'Cambio programado de sellos mecánicos y prensaestopas.' },
      { tag: 'CY-301', name: 'Bomba Sumidero Molienda SAG', system: 'DESCARGA_MOLIENDA', status: 'OPERATING', flow: 980, press: 3.2, rpm: 640, temp: 58.0, vib: 1.8, amps: 195, notes: 'Nivel de sumidero controlado al 55%.' },
      { tag: 'RW-401', name: 'Bomba Agua Clarificada Recuperada', system: 'AGUA_RECUPERADA', status: 'OPERATING', flow: 1420, press: 5.5, rpm: 1180, temp: 51.2, vib: 1.4, amps: 260, notes: 'Retorno continuo a cabecera de molienda.' }
    ];

    for (const p of pumpsData) {
      insertPump.run(
        crypto.randomUUID(),
        p.tag,
        p.name,
        p.system,
        p.status,
        p.flow,
        p.press,
        p.rpm,
        p.temp,
        p.vib,
        p.amps,
        'G4',
        'MONTES RODRIGUEZ DIEGO ALEXANDER',
        p.notes
      );
    }
  }

  // 4. Cyclone Reports
  const cyclonesCount = (db.prepare('SELECT COUNT(*) as count FROM cyclone_reports').get() as { count: number }).count;
  if (cyclonesCount === 0) {
    console.log('[Seed] Seeding cyclone reports...');
    const insertCyclone = db.prepare(`
      INSERT INTO cyclone_reports (id, battery_tag, total_cyclones, active_cyclones, feed_pressure_psi, feed_density_kgm3, p80_microns, overflow_density, underflow_density, flocculant_ppm, status, shift_code, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCyclone.run(
      crypto.randomUUID(),
      'CYCLOPAC-BATERIA-01',
      12,
      10,
      18.5,
      1650,
      148,
      1280,
      1980,
      14.2,
      'OPTIMAL',
      'G1',
      'Ciclones 03 y 07 en standby. Granulometría P80 en 148 µm cumpliendo objetivo de flotación.'
    );

    insertCyclone.run(
      crypto.randomUUID(),
      'CYCLOPAC-BATERIA-02',
      12,
      9,
      17.2,
      1640,
      155,
      1295,
      1960,
      13.8,
      'ATTENTION',
      'G1',
      'Ligera pérdida de presión en manifold. Ciclón 11 cerrado por arenado en ápice (Apex).'
    );
  }

  // 4.1 Cyclone Station Samples (Granulometry & Metallurgical Balance)
  const stationSamplesCount = (db.prepare('SELECT COUNT(*) as count FROM cyclone_station_samples').get() as { count: number }).count;
  if (stationSamplesCount <= 8) {
    console.log('[Seed] Seeding complete cyclone station samples (1ra & 2da Estación Ciclones)...');
    const insertSample = db.prepare(`
      INSERT INTO cyclone_station_samples (
        id, station, sample_time, battery_tag,
        solids_feed, solids_of, solids_uf,
        mesh200_feed, mesh200_of, mesh200_uf,
        shift_code, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 2DA ESTACION - GUARDIA A (Valores de la imagen del usuario)
    const samples2daA = [
      { time: '20:00', battery: 'CY3', s_feed: 45.30, s_of: 28.60, s_uf: 69.40, m_feed: 54.60, m_of: 22.40, m_uf: 23.40 },
      { time: '20:00', battery: 'CY4', s_feed: 43.20, s_of: 30.10, s_uf: 68.60, m_feed: 54.10, m_of: 19.80, m_uf: 23.60 },
      { time: '23:00', battery: 'CY3', s_feed: 48.60, s_of: 32.40, s_uf: 72.10, m_feed: 58.20, m_of: 24.10, m_uf: 25.80 },
      { time: '23:00', battery: 'CY4', s_feed: 47.10, s_of: 31.80, s_uf: 71.50, m_feed: 57.40, m_of: 23.50, m_uf: 25.20 },
      { time: '02:00', battery: 'CY3', s_feed: 42.10, s_of: 27.20, s_uf: 67.80, m_feed: 51.50, m_of: 20.80, m_uf: 22.10 },
      { time: '02:00', battery: 'CY4', s_feed: 41.50, s_of: 26.80, s_uf: 67.20, m_feed: 50.90, m_of: 20.10, m_uf: 21.80 },
      { time: '05:00', battery: 'CY3', s_feed: 46.80, s_of: 29.80, s_uf: 70.80, m_feed: 56.10, m_of: 22.90, m_uf: 24.30 },
      { time: '05:00', battery: 'CY4', s_feed: 45.90, s_of: 29.20, s_uf: 70.10, m_feed: 55.40, m_of: 22.20, m_uf: 23.90 }
    ];

    // 2DA ESTACION - GUARDIA B (Turno Día)
    const samples2daB = [
      { time: '08:00', battery: 'CY3', s_feed: 46.10, s_of: 29.10, s_uf: 70.20, m_feed: 55.20, m_of: 22.80, m_uf: 24.10 },
      { time: '08:00', battery: 'CY4', s_feed: 44.50, s_of: 28.90, s_uf: 69.80, m_feed: 54.80, m_of: 21.50, m_uf: 23.90 },
      { time: '11:00', battery: 'CY3', s_feed: 47.30, s_of: 30.50, s_uf: 71.40, m_feed: 56.70, m_of: 23.20, m_uf: 24.80 },
      { time: '11:00', battery: 'CY4', s_feed: 46.80, s_of: 30.10, s_uf: 70.90, m_feed: 55.90, m_of: 22.70, m_uf: 24.40 },
      { time: '14:00', battery: 'CY3', s_feed: 45.00, s_of: 28.40, s_uf: 69.10, m_feed: 53.90, m_of: 21.40, m_uf: 23.50 },
      { time: '14:00', battery: 'CY4', s_feed: 43.80, s_of: 27.90, s_uf: 68.50, m_feed: 52.80, m_of: 20.90, m_uf: 23.00 },
      { time: '17:00', battery: 'CY3', s_feed: 47.90, s_of: 31.20, s_uf: 71.80, m_feed: 57.10, m_of: 23.80, m_uf: 25.10 },
      { time: '17:00', battery: 'CY4', s_feed: 46.50, s_of: 30.40, s_uf: 70.60, m_feed: 56.30, m_of: 23.10, m_uf: 24.50 }
    ];

    // 1RA ESTACION - CY1 / CY2
    const samples1ra = [
      { time: '20:00', battery: 'CY1', s_feed: 44.80, s_of: 27.90, s_uf: 68.90, m_feed: 53.80, m_of: 21.90, m_uf: 23.10 },
      { time: '20:00', battery: 'CY2', s_feed: 43.90, s_of: 28.50, s_uf: 68.20, m_feed: 53.20, m_of: 20.40, m_uf: 23.00 },
      { time: '23:00', battery: 'CY1', s_feed: 47.50, s_of: 31.00, s_uf: 71.20, m_feed: 57.00, m_of: 23.50, m_uf: 25.10 },
      { time: '23:00', battery: 'CY2', s_feed: 46.20, s_of: 30.80, s_uf: 70.80, m_feed: 56.40, m_of: 22.90, m_uf: 24.70 },
      { time: '02:00', battery: 'CY1', s_feed: 41.80, s_of: 26.50, s_uf: 67.20, m_feed: 50.80, m_of: 20.20, m_uf: 21.90 },
      { time: '02:00', battery: 'CY2', s_feed: 41.00, s_of: 26.10, s_uf: 66.80, m_feed: 50.10, m_of: 19.80, m_uf: 21.50 },
      { time: '05:00', battery: 'CY1', s_feed: 45.90, s_of: 29.00, s_uf: 70.10, m_feed: 55.40, m_of: 22.30, m_uf: 23.80 },
      { time: '05:00', battery: 'CY2', s_feed: 45.10, s_of: 28.70, s_uf: 69.50, m_feed: 54.90, m_of: 21.80, m_uf: 23.40 }
    ];

    const today = new Date().toISOString().split('T')[0];
    // Eliminar previos incompletos si hay menos de 24
    if (stationSamplesCount > 0 && stationSamplesCount <= 8) {
      db.prepare('DELETE FROM cyclone_station_samples').run();
    }

    for (const s of samples2daA) {
      insertSample.run(crypto.randomUUID(), '2DA ESTACIÓN CICLONES', s.time, s.battery, s.s_feed, s.s_of, s.s_uf, s.m_feed, s.m_of, s.m_uf, 'G1', today);
    }
    for (const s of samples2daB) {
      insertSample.run(crypto.randomUUID(), '2DA ESTACIÓN CICLONES', s.time, s.battery, s.s_feed, s.s_of, s.s_uf, s.m_feed, s.m_of, s.m_uf, 'G2', today);
    }
    for (const s of samples1ra) {
      insertSample.run(crypto.randomUUID(), '1RA ESTACIÓN CICLONES', s.time, s.battery, s.s_feed, s.s_of, s.s_uf, s.m_feed, s.m_of, s.m_uf, 'G1', today);
    }
  }

  // 5. Tailings Reports
  const tailingsCount = (db.prepare('SELECT COUNT(*) as count FROM tailings_reports').get() as { count: number }).count;
  if (tailingsCount === 0) {
    console.log('[Seed] Seeding tailings reports...');
    const insertTailings = db.prepare(`
      INSERT INTO tailings_reports (id, station_tag, flow_rate_m3h, solids_percentage, dam_level_meters, freeboard_meters, piezometer_kpa, turbidity_ntu, pumping_line_status, operator_name, shift_code, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTailings.run(
      crypto.randomUUID(),
      'PRESA-SECTOR-NORTE',
      2150,
      64.8,
      4120.4,
      3.8,
      142.6,
      12.4,
      'NORMAL',
      'MONTES RODRIGUEZ DIEGO ALEXANDER',
      'G4',
      'Espesador de relaves con torque al 48%. Nivel freático en muro dentro de rango seguro.'
    );

    insertTailings.run(
      crypto.randomUUID(),
      'ESP-RELAVES-01',
      1980,
      63.5,
      4119.8,
      4.2,
      138.0,
      10.1,
      'NORMAL',
      'PILCO APAZA CARLOS EDUARDO',
      'G4',
      'Dosificación de floculante aniónico optimizada. Sobrenadante clarificado.'
    );
  }

  // 6. Maintenance Requests
  const maintCount = (db.prepare('SELECT COUNT(*) as count FROM maintenance_requests').get() as { count: number }).count;
  if (maintCount === 0) {
    console.log('[Seed] Seeding maintenance requests...');
    const insertMaint = db.prepare(`
      INSERT INTO maintenance_requests (id, ticket_number, equipment_tag, title, description, priority, status, requester_name, assigned_to, photo_url, estimated_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertMaint.run(
      crypto.randomUUID(),
      'OT-2026-0041',
      'PP-102',
      'Vibración anormal en rodamiento lado acople',
      'Durante la inspección de rutina se detectó vibración de 4.8 mm/s en rodamiento DE. Requiere análisis espectral y re-engrase.',
      'HIGH',
      'IN_PROGRESS',
      'MONTES RODRIGUEZ DIEGO ALEXANDER',
      'Ing. Mantenimiento Mecánico (Taller Central)',
      'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=400&q=80',
      4.5
    );

    insertMaint.run(
      crypto.randomUUID(),
      'OT-2026-0042',
      'CYCLOPAC-BATERIA-02',
      'Reemplazo de Liner de Vortex Finder ciclón 04',
      'Desgaste severo por abrasión de pulpa en vortex. Pérdida de eficiencia en corte de finos.',
      'MEDIUM',
      'PENDING',
      'PILCO APAZA CARLOS EDUARDO',
      'Equipo Mantenimiento Planta',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80',
      3.0
    );

    insertMaint.run(
      crypto.randomUUID(),
      'OT-2026-0038',
      'PP-101',
      'Reemplazo preventivo de sello mecánico',
      'Desgaste regular tras 4,200 horas continuas de bombeo de pulpa abrasiva. Se programa cambio de camisas y sello.',
      'HIGH',
      'IN_PROGRESS',
      'VILCAMIZA PEVE JORGE RICARDO',
      'Taller Mecánico Concentradora',
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80',
      4.0
    );

    insertMaint.run(
      crypto.randomUUID(),
      'OT-2026-0039',
      'TL-201',
      'Fuga en empaquetadura de prensaestopas',
      'Goteo de pulpa de relaves sobre canaleta de drenaje. Ajuste de empaquetadura completado satisfactoriamente.',
      'LOW',
      'RESOLVED',
      'ROSADO FALCON VILMA LUCIA',
      'Técnico Lubricador',
      'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=400&q=80',
      1.5
    );
  }

  // 6.1 Pump Station Operational Sheet (Planta)
  const sheetCount = (db.prepare('SELECT COUNT(*) as count FROM pump_station_sheets').get() as { count: number }).count;
  if (sheetCount === 0) {
    console.log('[Seed] Seeding pump station operational sheets...');
    const insertSheet = db.prepare(`
      INSERT INTO pump_station_sheets (
        id, report_date, shift_code, operator_name, sentina_pumps_json, intermedia_pumps_json,
        torre5_pumps_json, levels_json, main_indicators_json, pozas_sentina_json, additional_obs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sentina = ['PU001', 'PU002', 'PU003', 'PU004', 'PU005', 'PU006', 'PU007', 'PU008'].map(tag => ({ tag, status: 'Operativo' }));
    const intermedia = ['PU011', 'PU012', 'PU013', 'PU014', 'PU015', 'PU016'].map(tag => ({ tag, status: 'Operativo' }));
    const torre5 = ['PU021', 'PU022', 'PU023', 'PU024', 'PU025', 'PU026', 'PU027', 'PU028', 'PU029', 'PU030'].map(tag => ({ tag, status: 'Operativo' }));

    insertSheet.run(
      crypto.randomUUID(),
      new Date().toISOString().split('T')[0],
      'G4',
      'MONTES RODRIGUEZ DIEGO ALEXANDER',
      JSON.stringify(sentina),
      JSON.stringify(intermedia),
      JSON.stringify(torre5),
      JSON.stringify({ orca: '', espejo: '', captacion: '' }),
      JSON.stringify({
        nivel_sentina: '', bombeo_turno_intermedia: '', nivel_tko02: '', aforador: '',
        cortafugas: '', ph_aforador: '', ph_cortafugas: '', h_embalas: '',
        dique_almacenamiento: '', drenaje_dique: '', agua_a_car: '', anticrustante: '',
        torre5_cortafugas: '', torre5_status1: 'Stand by', torre5_status2: 'Stand by'
      }),
      JSON.stringify([
        { poza: 'S-QCOR.R_02', medida_ini: '', flujo_ini: '', medida_fin: '', flujo_fin: '', horas: '', acc: '' },
        { poza: 'S-QCOR.R_03', medida_ini: '', flujo_ini: '', medida_fin: '', flujo_fin: '', horas: '', acc: '' }
      ]),
      JSON.stringify({
        notas: '', af_cantera: '', escorrentia: '', ph_c5_1: '', ph_c5_2: ''
      })
    );
  }

  // 7. Audit Log
  const auditCount = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }).count;
  if (auditCount === 0) {
    console.log('[Seed] Seeding audit logs...');
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialLogs = [
      { user: 'admin', action: 'LOGIN', entity: 'AUTH', id: 'AUTH-01', details: 'Inicio de sesión administrativo verificado con éxito', ip: '192.168.1.104' },
      { user: 'supervisor_a', action: 'SHIFT_HANDOVER', entity: 'OPERATIONS', id: 'SH-01', details: 'Aprobación formal relevo de guardia Turno A a Turno B', ip: '192.168.1.112' },
      { user: 'operador_bombas', action: 'PUMP_STATUS', entity: 'SLURRY_PUMPS', id: 'PP-102', details: 'Transición bomba PP-102 a modo STANDBY preventivo', ip: '192.168.1.120' },
      { user: 'admin', action: 'BACKUP_EXPORT', entity: 'DATABASE', id: 'DB-SNAP', details: 'Exportación manual de snapshot seguro SQLite', ip: '192.168.1.104' },
      { user: 'supervisor_b', action: 'CYCLONES_SAMPLE', entity: 'STATION_02', id: 'CY-02', details: 'Registro de muestra metalúrgica: OF 18.2% / UF 72.4%', ip: '192.168.1.115' },
      { user: 'system', action: 'SYSTEM_INIT', entity: 'DATABASE', id: 'GLOBAL', details: 'Inicialización exitosa del sistema BASETRACK con seeds operacionales', ip: '127.0.0.1' }
    ];

    for (const log of initialLogs) {
      insertAudit.run(crypto.randomUUID(), 'system', log.user, log.action, log.entity, log.id, log.details, log.ip);
    }
  }

  // Insert 9 Official Plant Positions
  const insertPos = db.prepare(`
    INSERT OR REPLACE INTO crew_positions (key, title, default_location, default_radio, is_custom)
    VALUES (?, ?, ?, ?, ?)
  `);

  const OFFICIAL_POSITIONS = [
    { key: 'SUPERVISOR', title: 'Supervisor de guardia', default_location: 'Supervisión de Turno / Gestión Operativa', default_radio: 'Canal 1 Operaciones / Control', is_custom: 0 },
    { key: 'SALA_CONTROL', title: 'Operador sala de control', default_location: 'Sala de Control DCS / SCADA', default_radio: 'Canal 1 Operaciones / Control', is_custom: 0 },
    { key: 'BOMBAS', title: 'Operador de bombas', default_location: 'Sala de Bombas Slurry PP-101 a PP-104 & Sentinas', default_radio: 'Canal 3 Bombas', is_custom: 0 },
    { key: 'CICLONES_1', title: 'Operador de ciclones 1', default_location: '1ra Estación Baterías de Ciclones D-10', default_radio: 'Canal 2 Ciclones', is_custom: 0 },
    { key: 'CICLONES_2', title: 'Operador de ciclones 2', default_location: '2da Estación Baterías de Ciclones D-10', default_radio: 'Canal 2 Ciclones', is_custom: 0 },
    { key: 'DISTRIBUIDOR', title: 'Operador de distribuidor', default_location: 'Cajón Distribuidor & Repartición de Carga', default_radio: 'Canal 6 Distribuidor / Flujo', is_custom: 0 },
    { key: 'DESCARGA_1', title: 'Operador de descarga 1', default_location: 'Línea HDPE de Impulsión & Estación Relaves', default_radio: 'Canal 4 Presa / Descarga', is_custom: 0 },
    { key: 'DESCARGA_2', title: 'Operador de descarga 2', default_location: 'Presa Principal de Relaves & Muro de Contención', default_radio: 'Canal 4 Presa / Descarga', is_custom: 0 },
    { key: 'MISCELANEOS', title: 'Operador de misceláneos', default_location: 'Planta de Reactivos, Floculante & Servicios Auxiliares', default_radio: 'Canal 5 Auxiliares / Planta', is_custom: 0 }
  ];

  for (const p of OFFICIAL_POSITIONS) {
    insertPos.run(p.key, p.title, p.default_location, p.default_radio, p.is_custom);
  }

    // 7. Vehicle Checklists - Idempotent Seeding for previous days
    const checkVehicleChecklist = db.prepare('SELECT id FROM vehicle_checklists WHERE vehicle_plate = ? AND date = ?');
    const insertVehicleChecklist = db.prepare(`
      INSERT INTO vehicle_checklists (
        id, vehicle_plate, date, time, shift, shift_type,
        driver_name, driver_dni, driver_license, odometer, items_json,
        has_observations, observation_notes, photo_url, operational_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().slice(0, 10);

    const initialChecklists = [
      { plate: 'BMC715', date: yesterday, time: '06:45', shift: 'G1', shift_type: 'DIA', driver: 'VIZCARRA CORI MANLEY KLISMAN', dni: '71209033', lic: 'Q71209033', odo: 48250, hasObs: 0, notes: null, photo: null, status: 'APTO' },
      { plate: 'BMC715', date: twoDaysAgo, time: '18:50', shift: 'G4', shift_type: 'NOCHE', driver: 'ORTEGA RAMÍREZ CESAR', dni: '40918239', lic: 'Q40918239', odo: 48190, hasObs: 0, notes: null, photo: null, status: 'APTO' },
      { plate: 'BKS921', date: yesterday, time: '07:05', shift: 'G1', shift_type: 'DIA', driver: 'PILCO APAZA CARLOS EDUARDO', dni: '42324277', lic: 'Q42324277', odo: 53120, hasObs: 1, notes: 'Leve desgaste en plumilla limpiaparabrisas derecha. Operativo.', photo: null, status: 'OBSERVADO' },
      { plate: 'BKS921', date: twoDaysAgo, time: '06:50', shift: 'G4', shift_type: 'DIA', driver: 'CAMPOS ZEA OSWALDO', dni: '72910394', lic: 'Q72910394', odo: 53040, hasObs: 0, notes: null, photo: null, status: 'APTO' },
      { plate: 'BKS913', date: yesterday, time: '06:55', shift: 'G1', shift_type: 'DIA', driver: 'VILCAMIZA PEVE JORGE RICARDO', dni: '41748219', lic: 'Q41748219', odo: 39800, hasObs: 0, notes: null, photo: null, status: 'APTO' },
      { plate: 'BKS913', date: twoDaysAgo, time: '19:10', shift: 'G4', shift_type: 'NOCHE', driver: 'SUÁREZ MAMANI JULIO', dni: '44819203', lic: 'Q44819203', odo: 39710, hasObs: 0, notes: null, photo: null, status: 'APTO' },
      { plate: 'BPS747', date: yesterday, time: '07:15', shift: 'G1', shift_type: 'DIA', driver: 'MONTES RODRIGUEZ DIEGO ALEXANDER', dni: '45437279', lic: 'Q45437279', odo: 61400, hasObs: 0, notes: null, photo: null, status: 'APTO' },
      { plate: 'BPS747', date: twoDaysAgo, time: '07:00', shift: 'G4', shift_type: 'DIA', driver: 'CORNEJO NINA ALONSO', dni: '75910293', lic: 'Q75910293', odo: 61310, hasObs: 1, notes: 'Presión de neumático calibrada de 28 a 35 PSI.', photo: null, status: 'OBSERVADO' }
    ];

    const standardItemsJson = JSON.stringify([
      { id: 'luces_principales', category: 'Luces y Eléctrico', name: 'Luces altas, bajas y de posición', status: 'B' },
      { id: 'luces_freno_retro', category: 'Luces y Eléctrico', name: 'Luces de freno y marcha atrás (retro)', status: 'B' },
      { id: 'freno_servicio', category: 'Cabina y Frenos', name: 'Eficacia del freno de servicio', status: 'B' },
      { id: 'extintor_pqs', category: 'Equipo Emergencia', name: 'Extintor PQS 6kg vigente en verde', status: 'B' },
      { id: 'tacos_seguridad', category: 'Equipo Emergencia', name: '2 cuñas o tacos de seguridad', status: 'B' }
    ]);

    for (const c of initialChecklists) {
      if (!checkVehicleChecklist.get(c.plate, c.date)) {
        insertVehicleChecklist.run(
          crypto.randomUUID(),
          c.plate,
          c.date,
          c.time,
          c.shift,
          c.shift_type,
          c.driver,
          c.dni,
          c.lic,
          c.odo,
          standardItemsJson,
          c.hasObs,
          c.notes,
          c.photo,
          c.status
        );
      }
    }

  console.log('[Seed] Database seeded successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed();
}
