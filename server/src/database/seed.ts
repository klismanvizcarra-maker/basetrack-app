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
    { username: 'KlismanV', fullName: 'VIZCARRA CORI MANLEY KLISMAN', dni: '71209033', role: 'ADMIN', shift: 'GUARDIA_A', email: 'klismanvizcarra@basetrack.com', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
    { username: 'CarlosP', fullName: 'PILCO APAZA CARLOS EDUARDO', dni: '42324277', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'carlospilco@basetrack.com', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { username: 'JorgeV', fullName: 'VILCAMIZA PEVE JORGE RICARDO', dni: '41748219', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'jorgevilcamiza@basetrack.com', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { username: 'VilmaR', fullName: 'ROSADO FALCON VILMA LUCIA', dni: '45564062', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'vilmarosado@basetrack.com', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80' },
    { username: 'JhoferP', fullName: 'PARI COAYLA JHOFER LUIS', dni: '74924255', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'jhoferpari@basetrack.com', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },
    { username: 'DiegoM', fullName: 'MONTES RODRIGUEZ DIEGO ALEXANDER', dni: '45437279', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'diegomontes@basetrack.com', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80' },
    { username: 'RonalM', fullName: 'MAMANI MIRANDA RONAL', dni: '72958467', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'ronalmamani@basetrack.com', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80' },
    { username: 'AnthonyJ', fullName: 'MAMANI CUTIPA ANTHONY JESUS SMIT', dni: '72297288', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'anthonymamani@basetrack.com', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },
    { username: 'VictorA', fullName: 'LLERENA CALLE-BRACAMONTE VICTOR ALEJANDRO II', dni: '71491945', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'victorllerena@basetrack.com', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=250&q=80' },
    { username: 'EdsonH', fullName: 'HILARI CABRERA EDSON EUSEBIO', dni: '40824273', role: 'OPERATOR', shift: 'GUARDIA_A', email: 'edsonhilari@basetrack.com', avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80' },
    { username: 'EmilioA', fullName: 'ALIAGA CASTAÑEDA EMILIO URIEL', dni: '46593500', role: 'OPERATOR', shift: 'GUARDIA_B', email: 'Emilioaliaga@basetrack.com', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80' },
    { username: 'LuisA', fullName: 'CASCASI FLORES LUIS ANTONIO', dni: '43132072', role: 'OPERATOR', shift: 'GUARDIA_B', email: 'Luiscascasi@basetrack.com', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
    { username: 'ValerieC', fullName: 'CAYO GOMEZ VALERIE JAZMINE', dni: '71719330', role: 'OPERATOR', shift: 'GUARDIA_B', email: 'valeriecayo@basetrack.com', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80' },
    { username: 'PedroI', fullName: 'CHOQUE MANZANO PEDRO IVAN', dni: '75555937', role: 'OPERATOR', shift: 'GUARDIA_B', email: 'pedrochoque@basetrack.com', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
    { username: 'PaulC', fullName: 'CRUZ APAZA PAUL', dni: '44428468', role: 'OPERATOR', shift: 'GUARDIA_B', email: 'paulcruz@basetrack.com', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' }
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

  // 2. Shift Handovers
  const shiftCount = (db.prepare('SELECT COUNT(*) as count FROM shift_handovers').get() as { count: number }).count;
  if (shiftCount === 0) {
    console.log('[Seed] Seeding shift handovers...');
    const insertShift = db.prepare(`
      INSERT INTO shift_handovers (id, shift_code, date, shift_type, outgoing_supervisor, incoming_supervisor, plant_status, tonnage_processed, safety_incidents, operational_highlights, pending_tasks, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertShift.run(
      crypto.randomUUID(),
      'GUARDIA_A_DIA_01',
      new Date().toISOString().split('T')[0],
      'DIA',
      'Ing. Roberto Quispe',
      'Ing. Marco Velásquez',
      'Planta Concentradora operando a 94.5% de capacidad de diseño. Circuito de molienda SAG en régimen estable.',
      48250,
      'Cero incidentes con tiempo perdido (LTI: 0). Charla de 5 minutos sobre bloqueo y etiquetado (LOTO) realizada.',
      'Caudal promedio de pulpa: 3,420 m³/h. Densidad de descarga de molienda en 68.5% sólidos.',
      'Inspeccionar desgaste en impelente de bomba PP-102. Calibrar densímetro nuclear en línea 2 de relaves.',
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
        'GUARDIA_A',
        'Juan Pérez',
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
      'GUARDIA_A',
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
      'GUARDIA_A',
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
      insertSample.run(crypto.randomUUID(), '2DA ESTACIÓN CICLONES', s.time, s.battery, s.s_feed, s.s_of, s.s_uf, s.m_feed, s.m_of, s.m_uf, 'GUARDIA_A', today);
    }
    for (const s of samples2daB) {
      insertSample.run(crypto.randomUUID(), '2DA ESTACIÓN CICLONES', s.time, s.battery, s.s_feed, s.s_of, s.s_uf, s.m_feed, s.m_of, s.m_uf, 'GUARDIA_B', today);
    }
    for (const s of samples1ra) {
      insertSample.run(crypto.randomUUID(), '1RA ESTACIÓN CICLONES', s.time, s.battery, s.s_feed, s.s_of, s.s_uf, s.m_feed, s.m_of, s.m_uf, 'GUARDIA_A', today);
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
      'Marcos Alanya',
      'GUARDIA_A',
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
      'Marcos Alanya',
      'GUARDIA_A',
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
      'Juan Pérez',
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
      'Roberto Quispe',
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
      'Juan Pérez',
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
      'Marcos Alanya',
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
      '2026-08-27',
      'GUARDIA_A',
      'Operador Central',
      JSON.stringify(sentina),
      JSON.stringify(intermedia),
      JSON.stringify(torre5),
      JSON.stringify({ orca: '---', espejo: '---', captacion: '---' }),
      JSON.stringify({
        nivel_sentina: '---', bombeo_turno_intermedia: '---', nivel_tko02: '---', aforador: '---',
        cortafugas: '---', ph_aforador: '---', ph_cortafugas: '---', h_embalas: '---',
        dique_almacenamiento: '---', drenaje_dique: '---', agua_a_car: '---', anticrustante: '---',
        torre5_cortafugas: '---', torre5_status1: 'Stand by', torre5_status2: 'Stand by'
      }),
      JSON.stringify([
        { poza: 'S-QCOR.R_02', medida_ini: 'n/d', flujo_ini: 'n/d', medida_fin: 'n/d', flujo_fin: 'n/d', horas: 'n/d', acc: '---' },
        { poza: 'S-QCOR.R_03', medida_ini: 'n/d', flujo_ini: 'n/d', medida_fin: 'n/d', flujo_fin: 'n/d', horas: 'n/d', acc: '---' }
      ]),
      JSON.stringify({
        notas: '---', af_cantera: '---', escorrentia: '---', ph_c5_1: '---', ph_c5_2: '---'
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

  // 8. Crew Members & Area Assignments
  const crewCount = (db.prepare('SELECT COUNT(*) as count FROM crew_members').get() as { count: number }).count;
  if (crewCount === 0) {
    console.log('[Seed] Seeding crew members & operational assignments with official staff...');
    const insertMember = db.prepare(`
      INSERT INTO crew_members (id, name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const OFFICIAL_CREW = [
      { id: 'op-klisman-a', name: 'VIZCARRA CORI MANLEY KLISMAN', dni: '71209033', role: 'OPERADOR_BOMBAS', shift: 'GUARDIA_A', radio: 'Canal 3 Bombas', phone: 'Ext. 4125', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-carlos-a', name: 'PILCO APAZA CARLOS EDUARDO', dni: '42324277', role: 'OPERADOR_CICLONES', shift: 'GUARDIA_A', radio: 'Canal 2 Ciclones', phone: 'Ext. 4122', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-jorge-a', name: 'VILCAMIZA PEVE JORGE RICARDO', dni: '41748219', role: 'OPERADOR_DESCARGA', shift: 'GUARDIA_A', radio: 'Canal 4 Presa', phone: 'Ext. 4124', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-vilma-a', name: 'ROSADO FALCON VILMA LUCIA', dni: '45564062', role: 'OPERADOR_MISCELANEOS', shift: 'GUARDIA_A', radio: 'Canal 1 Operaciones', phone: 'Ext. 4123', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-jhofer-a', name: 'PARI COAYLA JHOFER LUIS', dni: '74924255', role: 'OPERADOR_RELEVO', shift: 'GUARDIA_A', radio: 'Canal 5 Relevo/Móvil', phone: 'Ext. 4121', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-diego-a', name: 'MONTES RODRIGUEZ DIEGO ALEXANDER', dni: '45437279', role: 'OPERADOR_BOMBAS', shift: 'GUARDIA_A', radio: 'Canal 3 Bombas', phone: 'Ext. 4120', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-ronal-a', name: 'MAMANI MIRANDA RONAL', dni: '72958467', role: 'OPERADOR_CICLONES', shift: 'GUARDIA_A', radio: 'Canal 2 Ciclones', phone: 'Ext. 4119', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-anthony-a', name: 'MAMANI CUTIPA ANTHONY JESUS SMIT', dni: '72297288', role: 'OPERADOR_DESCARGA', shift: 'GUARDIA_A', radio: 'Canal 4 Presa', phone: 'Ext. 4118', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-victor-a', name: 'LLERENA CALLE-BRACAMONTE VICTOR ALEJANDRO II', dni: '71491945', role: 'OPERADOR_MISCELANEOS', shift: 'GUARDIA_A', radio: 'Canal 1 Operaciones', phone: 'Ext. 4117', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-edson-a', name: 'HILARI CABRERA EDSON EUSEBIO', dni: '40824273', role: 'OPERADOR_RELEVO', shift: 'GUARDIA_A', radio: 'Canal 5 Relevo/Móvil', phone: 'Ext. 4116', avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-emilio-b', name: 'ALIAGA CASTAÑEDA EMILIO URIEL', dni: '46593500', role: 'OPERADOR_BOMBAS', shift: 'GUARDIA_B', radio: 'Canal 3 Bombas', phone: 'Ext. 4102', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-luis-b', name: 'CASCASI FLORES LUIS ANTONIO', dni: '43132072', role: 'OPERADOR_CICLONES', shift: 'GUARDIA_B', radio: 'Canal 2 Ciclones', phone: 'Ext. 4105', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-valerie-b', name: 'CAYO GOMEZ VALERIE JAZMINE', dni: '71719330', role: 'OPERADOR_DESCARGA', shift: 'GUARDIA_B', radio: 'Canal 4 Presa', phone: 'Ext. 4109', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-pedro-b', name: 'CHOQUE MANZANO PEDRO IVAN', dni: '75555937', role: 'OPERADOR_MISCELANEOS', shift: 'GUARDIA_B', radio: 'Canal 1 Operaciones', phone: 'Ext. 4112', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80' },
      { id: 'op-paul-b', name: 'CRUZ APAZA PAUL', dni: '44428468', role: 'OPERADOR_RELEVO', shift: 'GUARDIA_B', radio: 'Canal 5 Relevo/Móvil', phone: 'Ext. 4115', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80' }
    ];

    for (const m of OFFICIAL_CREW) {
      insertMember.run(
        m.id,
        m.name,
        m.dni,
        m.role,
        m.shift,
        m.radio,
        m.phone,
        'EN_TURNO',
        m.avatar
      );
    }

    // Initial Area Assignments for Today DIA Turno Guardia A
    const today = new Date().toISOString().split('T')[0];
    const insertAssignment = db.prepare(`
      INSERT INTO crew_area_assignments (
        id, shift_code, shift_date, shift_type, position_key, position_title,
        operator_id, backup_operator_id, epp_verified, safety_talk_completed,
        radio_channel, station_location, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAssignment.run(
      crypto.randomUUID(),
      'GUARDIA_A',
      today,
      'DIA',
      'BOMBAS',
      'Operador de Bombas',
      'op-klisman-a',
      'op-jhofer-a',
      1,
      1,
      'Canal 3 Bombas',
      'Sala de Bombas Slurry & Sentina Principal',
      'Control de flujo en bombas PP-101/102 y monitoreo de pozas de drenaje'
    );

    insertAssignment.run(
      crypto.randomUUID(),
      'GUARDIA_A',
      today,
      'DIA',
      'CICLONES',
      'Operador de Ciclones',
      'op-carlos-a',
      'op-jhofer-a',
      1,
      1,
      'Canal 2 Ciclones',
      '1ra y 2da Estación Baterías de Ciclones',
      'Muestreo horario de sólidos y granulometría de mallas -200'
    );

    insertAssignment.run(
      crypto.randomUUID(),
      'GUARDIA_A',
      today,
      'DIA',
      'DESCARGA',
      'Operador de descarga',
      'op-jorge-a',
      'op-jhofer-a',
      1,
      1,
      'Canal 4 Presa',
      'Línea de Impulsión & Presa de Relaves Principal',
      'Inspección de vertedero, borde libre y lecturas de piezómetros'
    );

    insertAssignment.run(
      crypto.randomUUID(),
      'GUARDIA_A',
      today,
      'DIA',
      'MISCELANEOS',
      'Operador Misceláneos',
      'op-vilma-a',
      'op-jhofer-a',
      1,
      1,
      'Canal 1 Operaciones',
      'Planta General & Sistemas Auxiliares',
      'Preparación de floculante, apoyo a espesadores e inspección de compresores'
    );

    insertAssignment.run(
      crypto.randomUUID(),
      'GUARDIA_A',
      today,
      'DIA',
      'RELEVO',
      'Operador de Relevo',
      'op-jhofer-a',
      null,
      1,
      1,
      'Canal 5 Relevo/Móvil',
      'Cobertura Volante Móvil en Planta',
      'Relevo de pausas activas, colaciones y atención inmediata de alarmas SCADA'
    );
  }

  console.log('[Seed] Database seeded successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed();
}
