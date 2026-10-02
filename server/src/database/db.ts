import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.resolve(__dirname, '../../data/basetrack.db');
const resolvedPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath;
const dbDir = path.dirname(resolvedPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(resolvedPath);

// Enable Foreign Keys and WAL mode for high concurrency
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function initDatabase() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'SUPERVISOR', 'OPERATOR')),
      shift TEXT NOT NULL DEFAULT 'G1',
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Shift Handovers (Bitácora de Relevo)
    CREATE TABLE IF NOT EXISTS shift_handovers (
      id TEXT PRIMARY KEY,
      shift_code TEXT NOT NULL,
      date TEXT NOT NULL,
      shift_type TEXT NOT NULL CHECK(shift_type IN ('DIA', 'NOCHE')),
      outgoing_supervisor TEXT NOT NULL,
      incoming_supervisor TEXT NOT NULL,
      plant_status TEXT NOT NULL,
      tonnage_processed REAL NOT NULL DEFAULT 0,
      safety_incidents TEXT,
      operational_highlights TEXT,
      pending_tasks TEXT,
      status TEXT NOT NULL CHECK(status IN ('DRAFT', 'SUBMITTED', 'ACCEPTED')) DEFAULT 'SUBMITTED',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Pumps Telemetry & Reports
    CREATE TABLE IF NOT EXISTS pump_reports (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL,
      name TEXT NOT NULL,
      system TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('OPERATING', 'STANDBY', 'MAINTENANCE', 'FAULT')),
      flow_rate_m3h REAL NOT NULL DEFAULT 0,
      pressure_bar REAL NOT NULL DEFAULT 0,
      rpm REAL NOT NULL DEFAULT 0,
      bearing_temp_c REAL NOT NULL DEFAULT 0,
      vibration_mms REAL NOT NULL DEFAULT 0,
      current_amps REAL NOT NULL DEFAULT 0,
      shift_code TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Pump Station Operational Sheets (Secciones A, B, C, D, E)
    CREATE TABLE IF NOT EXISTS pump_station_sheets (
      id TEXT PRIMARY KEY,
      report_date TEXT NOT NULL,
      shift_code TEXT NOT NULL DEFAULT 'G1',
      operator_name TEXT NOT NULL DEFAULT 'Operador Central',
      sentina_pumps_json TEXT NOT NULL,
      intermedia_pumps_json TEXT NOT NULL,
      torre5_pumps_json TEXT NOT NULL,
      levels_json TEXT NOT NULL,
      main_indicators_json TEXT NOT NULL,
      pozas_sentina_json TEXT NOT NULL,
      additional_obs_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cyclone Clusters Reports
    CREATE TABLE IF NOT EXISTS cyclone_reports (
      id TEXT PRIMARY KEY,
      battery_tag TEXT NOT NULL,
      total_cyclones INTEGER NOT NULL DEFAULT 12,
      active_cyclones INTEGER NOT NULL DEFAULT 10,
      feed_pressure_psi REAL NOT NULL DEFAULT 0,
      feed_density_kgm3 REAL NOT NULL DEFAULT 0,
      p80_microns REAL NOT NULL DEFAULT 0,
      overflow_density REAL NOT NULL DEFAULT 0,
      underflow_density REAL NOT NULL DEFAULT 0,
      flocculant_ppm REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('OPTIMAL', 'ATTENTION', 'CRITICAL')),
      shift_code TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cyclone Station Samples (Granulometry & Metallurgical Balance)
    CREATE TABLE IF NOT EXISTS cyclone_station_samples (
      id TEXT PRIMARY KEY,
      station TEXT NOT NULL DEFAULT '2DA ESTACIÓN CICLONES',
      sample_time TEXT NOT NULL,
      battery_tag TEXT NOT NULL,
      solids_feed REAL NOT NULL DEFAULT 0,
      solids_of REAL NOT NULL DEFAULT 0,
      solids_uf REAL NOT NULL DEFAULT 0,
      mesh200_feed REAL NOT NULL DEFAULT 0,
      mesh200_of REAL NOT NULL DEFAULT 0,
      mesh200_uf REAL NOT NULL DEFAULT 0,
      shift_code TEXT NOT NULL DEFAULT 'G1',
      date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Tailings & Dam Reports (Relaves)
    CREATE TABLE IF NOT EXISTS tailings_reports (
      id TEXT PRIMARY KEY,
      station_tag TEXT NOT NULL,
      flow_rate_m3h REAL NOT NULL DEFAULT 0,
      solids_percentage REAL NOT NULL DEFAULT 0,
      dam_level_meters REAL NOT NULL DEFAULT 0,
      freeboard_meters REAL NOT NULL DEFAULT 0,
      piezometer_kpa REAL NOT NULL DEFAULT 0,
      turbidity_ntu REAL NOT NULL DEFAULT 0,
      pumping_line_status TEXT NOT NULL CHECK(pumping_line_status IN ('NORMAL', 'ALERT', 'RESTRICTED')),
      operator_name TEXT NOT NULL,
      shift_code TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Maintenance Requests & Photos
    CREATE TABLE IF NOT EXISTS maintenance_requests (
      id TEXT PRIMARY KEY,
      ticket_number TEXT UNIQUE NOT NULL,
      equipment_tag TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY')),
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')) DEFAULT 'PENDING',
      requester_name TEXT NOT NULL,
      assigned_to TEXT,
      photo_url TEXT,
      estimated_hours REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Crew Members (Personal de Cuadrilla de Planta)
    CREATE TABLE IF NOT EXISTS crew_members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      document_id TEXT UNIQUE NOT NULL,
      primary_role TEXT NOT NULL DEFAULT 'OPERADOR_BOMBAS',
      shift_code TEXT NOT NULL DEFAULT 'G1',
      radio_channel TEXT NOT NULL DEFAULT 'Canal 1 Operaciones',
      phone_extension TEXT,
      status TEXT NOT NULL CHECK(status IN ('EN_TURNO', 'DESCANSO', 'VACACIONES', 'PERMISO', 'CAPACITACION')) DEFAULT 'EN_TURNO',
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Crew Area Assignments (Asignación en Tiempo Real por Área de Planta)
    CREATE TABLE IF NOT EXISTS crew_area_assignments (
      id TEXT PRIMARY KEY,
      shift_code TEXT NOT NULL,
      shift_date TEXT NOT NULL,
      shift_type TEXT NOT NULL CHECK(shift_type IN ('DIA', 'NOCHE')),
      position_key TEXT NOT NULL,
      position_title TEXT NOT NULL,
      operator_id TEXT,
      backup_operator_id TEXT,
      epp_verified INTEGER NOT NULL DEFAULT 1,
      safety_talk_completed INTEGER NOT NULL DEFAULT 1,
      radio_channel TEXT,
      station_location TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(operator_id) REFERENCES crew_members(id),
      FOREIGN KEY(backup_operator_id) REFERENCES crew_members(id)
    );

    -- Operational Plant Positions (Standard and Custom Areas)
    CREATE TABLE IF NOT EXISTS crew_positions (
      key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      default_location TEXT,
      default_radio TEXT,
      badge_class TEXT,
      route_link TEXT,
      route_label TEXT,
      icon_svg TEXT,
      description TEXT,
      is_custom INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cloud Realtime Sync Events (Sincronización Multi-Dispositivo)
    CREATE TABLE IF NOT EXISTS sync_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      user_id TEXT,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Connected Devices & Realtime Fleet Sessions
    CREATE TABLE IF NOT EXISTS connected_devices (
      device_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      user_id TEXT,
      username TEXT,
      ip_address TEXT,
      user_agent TEXT,
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      is_revoked INTEGER NOT NULL DEFAULT 0
    );

    -- Vehicle Pre-Use Checklists (Camionetas Mineras 4x4)
    CREATE TABLE IF NOT EXISTS vehicle_checklists (
      id TEXT PRIMARY KEY,
      vehicle_plate TEXT NOT NULL CHECK(vehicle_plate IN ('BMC715', 'BKS921', 'BKS913', 'BPS747')),
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      shift TEXT NOT NULL CHECK(shift IN ('G1', 'G2', 'G3', 'G4')),
      shift_type TEXT NOT NULL CHECK(shift_type IN ('DIA', 'NOCHE')),
      driver_name TEXT NOT NULL,
      driver_dni TEXT NOT NULL,
      driver_license TEXT,
      odometer INTEGER NOT NULL,
      items_json TEXT NOT NULL,
      has_observations INTEGER NOT NULL DEFAULT 0,
      observation_notes TEXT,
      photo_url TEXT,
      operational_status TEXT NOT NULL CHECK(operational_status IN ('APTO', 'OBSERVADO', 'NO_APTO')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Supervisor - Operators Assignment (Cuadrilla por Supervisor)
    CREATE TABLE IF NOT EXISTS supervisor_operators (
      id TEXT PRIMARY KEY,
      supervisor_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      shift_code TEXT NOT NULL DEFAULT 'G1',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(supervisor_id, operator_id)
    );

    -- Role Permissions & User Overrides
    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT PRIMARY KEY,
      permissions TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_permission_overrides (
      user_id TEXT PRIMARY KEY,
      permissions TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Plant Operational Parameters & Metallurgical Targets
    CREATE TABLE IF NOT EXISTS plant_parameters (
      id TEXT PRIMARY KEY DEFAULT 'current',
      parameters_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT NOT NULL DEFAULT 'SYSTEM'
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_pumps_tag ON pump_reports(tag);
    CREATE INDEX IF NOT EXISTS idx_pumps_created ON pump_reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_cyclones_battery ON cyclone_reports(battery_tag);
    CREATE INDEX IF NOT EXISTS idx_tailings_created ON tailings_reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(username);
    CREATE INDEX IF NOT EXISTS idx_crew_shift ON crew_members(shift_code);
    CREATE INDEX IF NOT EXISTS idx_crew_assignments ON crew_area_assignments(shift_date, shift_code, shift_type);
    CREATE INDEX IF NOT EXISTS idx_sync_events_timestamp ON sync_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sync_events_device ON sync_events(device_id);
    CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON connected_devices(last_seen);
    CREATE INDEX IF NOT EXISTS idx_vehicle_checklists_plate ON vehicle_checklists(vehicle_plate, date DESC);
    CREATE INDEX IF NOT EXISTS idx_sup_op_supervisor ON supervisor_operators(supervisor_id);
    CREATE INDEX IF NOT EXISTS idx_sup_op_operator ON supervisor_operators(operator_id);
  `);

  // Safe migration: remove CHECK constraint from existing crew_area_assignments if present
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='crew_area_assignments'").get() as { sql: string } | undefined;
    if (tableInfo && tableInfo.sql && tableInfo.sql.includes('CHECK(position_key IN')) {
      db.exec(`
        PRAGMA foreign_keys=off;
        CREATE TABLE IF NOT EXISTS crew_area_assignments_v2 (
          id TEXT PRIMARY KEY,
          shift_code TEXT NOT NULL,
          shift_date TEXT NOT NULL,
          shift_type TEXT NOT NULL CHECK(shift_type IN ('DIA', 'NOCHE')),
          position_key TEXT NOT NULL,
          position_title TEXT NOT NULL,
          operator_id TEXT NOT NULL,
          backup_operator_id TEXT,
          epp_verified INTEGER NOT NULL DEFAULT 1,
          safety_talk_completed INTEGER NOT NULL DEFAULT 1,
          radio_channel TEXT,
          station_location TEXT,
          notes TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(operator_id) REFERENCES crew_members(id),
          FOREIGN KEY(backup_operator_id) REFERENCES crew_members(id)
        );
        INSERT OR IGNORE INTO crew_area_assignments_v2 SELECT * FROM crew_area_assignments;
        DROP TABLE crew_area_assignments;
        ALTER TABLE crew_area_assignments_v2 RENAME TO crew_area_assignments;
        CREATE INDEX IF NOT EXISTS idx_crew_assignments ON crew_area_assignments(shift_date, shift_code, shift_type);
        PRAGMA foreign_keys=on;
      `);
      console.log('[Database] Migrated crew_area_assignments to support dynamic custom positions.');
    }
  } catch (e) {
    console.warn('[Database] crew_area_assignments migration check:', e);
  }

  // Safe migration: make operator_id nullable in crew_area_assignments if it was previously NOT NULL
  try {
    const cols = db.prepare("PRAGMA table_info(crew_area_assignments)").all() as any[];
    const opCol = cols.find(c => c.name === 'operator_id');
    if (opCol && opCol.notnull === 1) {
      db.exec(`
        PRAGMA foreign_keys=off;
        CREATE TABLE IF NOT EXISTS crew_area_assignments_v3 (
          id TEXT PRIMARY KEY,
          shift_code TEXT NOT NULL,
          shift_date TEXT NOT NULL,
          shift_type TEXT NOT NULL CHECK(shift_type IN ('DIA', 'NOCHE')),
          position_key TEXT NOT NULL,
          position_title TEXT NOT NULL,
          operator_id TEXT,
          backup_operator_id TEXT,
          epp_verified INTEGER NOT NULL DEFAULT 1,
          safety_talk_completed INTEGER NOT NULL DEFAULT 1,
          radio_channel TEXT,
          station_location TEXT,
          notes TEXT,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(operator_id) REFERENCES crew_members(id),
          FOREIGN KEY(backup_operator_id) REFERENCES crew_members(id)
        );
        INSERT OR IGNORE INTO crew_area_assignments_v3 SELECT * FROM crew_area_assignments;
        DROP TABLE crew_area_assignments;
        ALTER TABLE crew_area_assignments_v3 RENAME TO crew_area_assignments;
        CREATE INDEX IF NOT EXISTS idx_crew_assignments ON crew_area_assignments(shift_date, shift_code, shift_type);
        PRAGMA foreign_keys=on;
      `);
      console.log('[Database] Migrated crew_area_assignments to allow nullable operator_id (vacant positions).');
    }
  } catch (e) {
    console.warn('[Database] crew_area_assignments nullable migration check:', e);
  }

  // Safe migration: add is_active column to users table if not present
  try {
    const userCols = db.prepare('PRAGMA table_info(users)').all() as any[];
    if (!userCols.some((c: any) => c.name === 'is_active')) {
      db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
      console.log('[Database] Added is_active column to users table.');
    }
    if (!userCols.some((c: any) => c.name === 'document_id')) {
      db.exec("ALTER TABLE users ADD COLUMN document_id TEXT;");
      console.log('[Database] Added document_id column to users table.');
    }
    if (!userCols.some((c: any) => c.name === 'radio_channel')) {
      db.exec("ALTER TABLE users ADD COLUMN radio_channel TEXT DEFAULT 'Canal 1 Operaciones';");
      console.log('[Database] Added radio_channel column to users table.');
    }
    if (!userCols.some((c: any) => c.name === 'phone_extension')) {
      db.exec("ALTER TABLE users ADD COLUMN phone_extension TEXT;");
      console.log('[Database] Added phone_extension column to users table.');
    }
    if (!userCols.some((c: any) => c.name === 'primary_role')) {
      db.exec("ALTER TABLE users ADD COLUMN primary_role TEXT DEFAULT 'OPERADOR_BOMBAS';");
      console.log('[Database] Added primary_role column to users table.');
    }
  } catch (e) {
    console.warn('[Database] users columns migration check:', e);
  }

  // Safe migration: upgrade users table to remove restrictive shift CHECK and map to G1-G4
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined;
    if (tableInfo && tableInfo.sql && tableInfo.sql.includes('CHECK(shift IN')) {
      db.exec(`
        PRAGMA foreign_keys=off;
        CREATE TABLE IF NOT EXISTS users_v3 (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('ADMIN', 'SUPERVISOR', 'OPERATOR')),
          shift TEXT NOT NULL DEFAULT 'G1',
          avatar_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          is_active INTEGER NOT NULL DEFAULT 1,
          document_id TEXT,
          radio_channel TEXT DEFAULT 'Canal 1 Operaciones',
          phone_extension TEXT,
          primary_role TEXT DEFAULT 'OPERADOR_BOMBAS'
        );
        INSERT OR IGNORE INTO users_v3 SELECT 
          id, username, email, password_hash, full_name, role,
          CASE 
            WHEN shift = 'GUARDIA_A' THEN 'G1'
            WHEN shift = 'GUARDIA_B' THEN 'G2'
            WHEN shift = 'GUARDIA_C' THEN 'G3'
            ELSE shift 
          END as shift,
          avatar_url, created_at, 
          COALESCE(is_active, 1), document_id, radio_channel, phone_extension, primary_role 
        FROM users;
        DROP TABLE users;
        ALTER TABLE users_v3 RENAME TO users;
        PRAGMA foreign_keys=on;
      `);
      console.log('[Database] Migrated users table to support G1-G4 dynamic shifts.');
    }
  } catch (e) {
    console.warn('[Database] users migration check:', e);
  }

  // Safe migration: upgrade crew_members table to remove restrictive CHECKs and map to G1-G4
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='crew_members'").get() as { sql: string } | undefined;
    if (tableInfo && tableInfo.sql && (tableInfo.sql.includes('CHECK(shift_code IN') || tableInfo.sql.includes('CHECK(primary_role IN'))) {
      db.exec(`
        PRAGMA foreign_keys=off;
        CREATE TABLE IF NOT EXISTS crew_members_v3 (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          document_id TEXT UNIQUE NOT NULL,
          primary_role TEXT NOT NULL DEFAULT 'OPERADOR_BOMBAS',
          shift_code TEXT NOT NULL DEFAULT 'G1',
          radio_channel TEXT NOT NULL DEFAULT 'Canal 1 Operaciones',
          phone_extension TEXT,
          status TEXT NOT NULL CHECK(status IN ('EN_TURNO', 'DESCANSO', 'VACACIONES', 'PERMISO', 'CAPACITACION')) DEFAULT 'EN_TURNO',
          avatar_url TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO crew_members_v3 SELECT 
          id, name, document_id, primary_role,
          CASE 
            WHEN shift_code = 'GUARDIA_A' THEN 'G1'
            WHEN shift_code = 'GUARDIA_B' THEN 'G2'
            WHEN shift_code = 'GUARDIA_C' THEN 'G3'
            ELSE shift_code 
          END as shift_code,
          radio_channel, phone_extension, status, avatar_url, created_at
        FROM crew_members;
        DROP TABLE crew_members;
        ALTER TABLE crew_members_v3 RENAME TO crew_members;
        CREATE INDEX IF NOT EXISTS idx_crew_shift ON crew_members(shift_code);
        PRAGMA foreign_keys=on;
      `);
      console.log('[Database] Migrated crew_members table to support 8 official positions and G1-G4.');
    }
  } catch (e) {
    console.warn('[Database] crew_members migration check:', e);
  }

  // Global Migration: convert all historical GUARDIA_A/B/C/D to G1/G2/G3/G4 across all tables
  try {
    db.exec(`
      UPDATE users SET shift = 'G1' WHERE shift = 'GUARDIA_A';
      UPDATE users SET shift = 'G2' WHERE shift = 'GUARDIA_B';
      UPDATE users SET shift = 'G3' WHERE shift = 'GUARDIA_C';
      UPDATE users SET shift = 'G4' WHERE shift = 'GUARDIA_D';

      UPDATE crew_members SET shift_code = 'G1' WHERE shift_code = 'GUARDIA_A';
      UPDATE crew_members SET shift_code = 'G2' WHERE shift_code = 'GUARDIA_B';
      UPDATE crew_members SET shift_code = 'G3' WHERE shift_code = 'GUARDIA_C';
      UPDATE crew_members SET shift_code = 'G4' WHERE shift_code = 'GUARDIA_D';

      UPDATE crew_area_assignments SET shift_code = 'G1' WHERE shift_code = 'GUARDIA_A';
      UPDATE crew_area_assignments SET shift_code = 'G2' WHERE shift_code = 'GUARDIA_B';
      UPDATE crew_area_assignments SET shift_code = 'G3' WHERE shift_code = 'GUARDIA_C';
      UPDATE crew_area_assignments SET shift_code = 'G4' WHERE shift_code = 'GUARDIA_D';

      UPDATE shift_handovers SET shift_code = 'G1_DIA_01' WHERE shift_code LIKE 'GUARDIA_A%';
      UPDATE shift_handovers SET shift_code = 'G2_DIA_01' WHERE shift_code LIKE 'GUARDIA_B%';
      UPDATE shift_handovers SET shift_code = 'G3_DIA_01' WHERE shift_code LIKE 'GUARDIA_C%';

      UPDATE pump_reports SET shift_code = 'G1' WHERE shift_code = 'GUARDIA_A';
      UPDATE pump_reports SET shift_code = 'G2' WHERE shift_code = 'GUARDIA_B';
      UPDATE pump_reports SET shift_code = 'G3' WHERE shift_code = 'GUARDIA_C';

      UPDATE pump_station_sheets SET shift_code = 'G1' WHERE shift_code = 'GUARDIA_A';
      UPDATE pump_station_sheets SET shift_code = 'G2' WHERE shift_code = 'GUARDIA_B';
      UPDATE pump_station_sheets SET shift_code = 'G3' WHERE shift_code = 'GUARDIA_C';

      UPDATE cyclone_reports SET shift_code = 'G1' WHERE shift_code = 'GUARDIA_A';
      UPDATE cyclone_reports SET shift_code = 'G2' WHERE shift_code = 'GUARDIA_B';
      UPDATE cyclone_reports SET shift_code = 'G3' WHERE shift_code = 'GUARDIA_C';

      UPDATE cyclone_station_samples SET shift_code = 'G1' WHERE shift_code = 'GUARDIA_A';
      UPDATE cyclone_station_samples SET shift_code = 'G2' WHERE shift_code = 'GUARDIA_B';
      UPDATE cyclone_station_samples SET shift_code = 'G3' WHERE shift_code = 'GUARDIA_C';

      UPDATE tailings_reports SET shift_code = 'G1' WHERE shift_code = 'GUARDIA_A';
      UPDATE tailings_reports SET shift_code = 'G2' WHERE shift_code = 'GUARDIA_B';
      UPDATE tailings_reports SET shift_code = 'G3' WHERE shift_code = 'GUARDIA_C';
    `);
  } catch (e) {
    console.warn('[Database] Global shift update migration:', e);
  }

  // Migration: Add supervisor DNI and position role columns to shift_handovers
  try {
    db.prepare("ALTER TABLE shift_handovers ADD COLUMN outgoing_dni TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE shift_handovers ADD COLUMN outgoing_role TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE shift_handovers ADD COLUMN incoming_dni TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE shift_handovers ADD COLUMN incoming_role TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE shift_handovers ADD COLUMN assigned_crew TEXT").run();
  } catch {}
  try {
    db.prepare("ALTER TABLE shift_handovers ADD COLUMN checklist_data TEXT").run();
  } catch {}

  // -------------------------------------------------------------
  // SYSTEM INITIALIZATION: Ensure Admin and Positions
  // Operate ONLY with real data loaded via CSV / User Actions (Zero fake generated data)
  // -------------------------------------------------------------
  try {
    // 1. Ensure Sole Administrator: Marckv (Ghost system administrator - no operational DNI)
    const adminExists = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'ADMIN' OR username = 'Marckv'").get() as { cnt: number })?.cnt > 0;
    if (!adminExists) {
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
    } else {
      // Ensure existing admin has no operational DNI and is not in crew_members
      db.prepare("UPDATE users SET document_id = '' WHERE role = 'ADMIN' OR username = 'Marckv'").run();
      db.prepare("DELETE FROM crew_members WHERE LOWER(name) = 'marck vizcarra' OR document_id = '91209966'").run();
    }

    // 2. Default operational positions in crew_positions
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
  } catch (e) {
    console.warn('[Database] Initialization check warning:', e);
  }

  console.log('[Database] Tables and indexes initialized successfully.');
}
