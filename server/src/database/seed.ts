import { db, initDatabase } from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export function seed() {
  initDatabase();

  // 1. Users
  const usersCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (usersCount === 0) {
    console.log('[Seed] Seeding users...');
    const passwordHash = bcrypt.hashSync('admin123', 10);
    const opPasswordHash = bcrypt.hashSync('operador123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      crypto.randomUUID(),
      'admin',
      'admin@basetrack.mining.com',
      passwordHash,
      'Ing. Carlos Mendoza (Jefe de Planta)',
      'ADMIN',
      'GUARDIA_A',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
    );

    insertUser.run(
      crypto.randomUUID(),
      'supervisor_a',
      'supervisor.a@basetrack.mining.com',
      passwordHash,
      'Ing. Roberto Quispe (Supervisor Turno A)',
      'SUPERVISOR',
      'GUARDIA_A',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80'
    );

    insertUser.run(
      crypto.randomUUID(),
      'operador_bombas',
      'juan.perez@basetrack.mining.com',
      opPasswordHash,
      'Juan Pérez (Operador Sala de Bombas)',
      'OPERATOR',
      'GUARDIA_A',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'
    );
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
  if (stationSamplesCount === 0) {
    console.log('[Seed] Seeding cyclone station samples (2da Estación Ciclones)...');
    const insertSample = db.prepare(`
      INSERT INTO cyclone_station_samples (
        id, station, sample_time, battery_tag,
        solids_feed, solids_of, solids_uf,
        mesh200_feed, mesh200_of, mesh200_uf,
        shift_code, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const samples = [
      { time: '20:00', battery: 'CY3', s_feed: 45.30, s_of: 28.60, s_uf: 69.40, m_feed: 54.60, m_of: 22.40, m_uf: 23.40 },
      { time: '20:00', battery: 'CY4', s_feed: 43.20, s_of: 30.10, s_uf: 68.60, m_feed: 54.10, m_of: 19.80, m_uf: 23.60 },
      { time: '23:00', battery: 'CY3', s_feed: 48.60, s_of: 32.40, s_uf: 72.10, m_feed: 58.20, m_of: 24.10, m_uf: 25.80 },
      { time: '23:00', battery: 'CY4', s_feed: 47.10, s_of: 31.80, s_uf: 71.50, m_feed: 57.40, m_of: 23.50, m_uf: 25.20 },
      { time: '02:00', battery: 'CY3', s_feed: 42.10, s_of: 27.20, s_uf: 67.80, m_feed: 51.50, m_of: 20.80, m_uf: 22.10 },
      { time: '02:00', battery: 'CY4', s_feed: 41.50, s_of: 26.80, s_uf: 67.20, m_feed: 50.90, m_of: 20.10, m_uf: 21.80 },
      { time: '05:00', battery: 'CY3', s_feed: 46.80, s_of: 29.80, s_uf: 70.80, m_feed: 56.10, m_of: 22.90, m_uf: 24.30 },
      { time: '05:00', battery: 'CY4', s_feed: 45.90, s_of: 29.20, s_uf: 70.10, m_feed: 55.40, m_of: 22.20, m_uf: 23.90 }
    ];

    const today = new Date().toISOString().split('T')[0];
    for (const s of samples) {
      insertSample.run(
        crypto.randomUUID(),
        '2DA ESTACIÓN CICLONES',
        s.time,
        s.battery,
        s.s_feed,
        s.s_of,
        s.s_uf,
        s.m_feed,
        s.m_of,
        s.m_uf,
        'GUARDIA_A',
        today
      );
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

  // 7. Audit Log
  const auditCount = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }).count;
  if (auditCount === 0) {
    console.log('[Seed] Seeding audit logs...');
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAudit.run(
      crypto.randomUUID(),
      'system',
      'admin',
      'SYSTEM_INIT',
      'DATABASE',
      'GLOBAL',
      'Inicialización exitosa del sistema BASETRACK APP con seeds operacionales.',
      '127.0.0.1'
    );
  }

  console.log('[Seed] Database seeded successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seed();
}
