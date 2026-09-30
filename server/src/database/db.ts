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

  // UTF-8 Integrity repair for staff names with tildes and accents (e.g. CASTAÑEDA, RAMÍREZ, SUÁREZ)
  try {
    db.exec(`
      UPDATE crew_members SET name = 'ALIAGA CASTAÑEDA EMILIO URIEL' WHERE name LIKE '%CASTA%EDA%' AND name != 'ALIAGA CASTAÑEDA EMILIO URIEL';
      UPDATE users SET full_name = 'ALIAGA CASTAÑEDA EMILIO URIEL' WHERE full_name LIKE '%CASTA%EDA%' AND full_name != 'ALIAGA CASTAÑEDA EMILIO URIEL';
      UPDATE shift_handovers SET incoming_supervisor = 'ALIAGA CASTAÑEDA EMILIO URIEL' WHERE incoming_supervisor LIKE '%CASTA%EDA%' AND incoming_supervisor != 'ALIAGA CASTAÑEDA EMILIO URIEL';
      UPDATE shift_handovers SET outgoing_supervisor = 'ALIAGA CASTAÑEDA EMILIO URIEL' WHERE outgoing_supervisor LIKE '%CASTA%EDA%' AND outgoing_supervisor != 'ALIAGA CASTAÑEDA EMILIO URIEL';

      UPDATE crew_members SET name = 'ORTEGA RAMÍREZ CESAR' WHERE name LIKE '%ORTEGA RAM%REZ%' AND name != 'ORTEGA RAMÍREZ CESAR';
      UPDATE users SET full_name = 'ORTEGA RAMÍREZ CESAR' WHERE full_name LIKE '%ORTEGA RAM%REZ%' AND full_name != 'ORTEGA RAMÍREZ CESAR';

      UPDATE crew_members SET name = 'SUÁREZ MAMANI JULIO' WHERE name LIKE '%SU%REZ MAMANI%' AND name != 'SUÁREZ MAMANI JULIO';
      UPDATE users SET full_name = 'SUÁREZ MAMANI JULIO' WHERE full_name LIKE '%SU%REZ MAMANI%' AND full_name != 'SUÁREZ MAMANI JULIO';
    `);
  } catch (e) {
    console.warn('[Database] UTF-8 repair error:', e);
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

  // Administrator initialization: Ensure Marckv exists as sole administrator
  try {
    // Purge any old non-Marckv admin accounts or non-official staff
    db.prepare("DELETE FROM users WHERE (LOWER(username) = 'klismanv' OR document_id = '71209033' OR (role = 'ADMIN' AND LOWER(username) != 'marckv'))").run();
    db.prepare("DELETE FROM crew_members WHERE document_id = '71209033' OR name LIKE '%VIZCARRA CORI%' OR id LIKE '%klisman%'").run();

    const marckUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get('marckv') as any;
    if (!marckUser) {
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
      console.log('[Database] Sole Administrator Marckv created successfully.');
    } else {
      db.prepare(`
        UPDATE users 
        SET username = 'Marckv', full_name = 'Marck Vizcarra', role = 'ADMIN', shift = 'ADMIN', primary_role = 'ADMIN', document_id = '2794vizcarra', is_active = 1, password_hash = ?
        WHERE id = ?;
      `).run(bcrypt.hashSync('2794vizcarra', 10), marckUser.id);
      console.log('[Database] Sole Administrator Marckv refreshed.');
    }

    db.prepare(`
      UPDATE users 
      SET document_id = '2794vizcarra' 
      WHERE LOWER(username) = 'marckv' 
        AND (document_id IS NULL OR document_id = '');
    `).run();
    db.prepare(`
      UPDATE users 
      SET document_id = (SELECT document_id FROM crew_members WHERE crew_members.name = users.full_name LIMIT 1) 
      WHERE (document_id IS NULL OR document_id = '') 
        AND EXISTS (SELECT 1 FROM crew_members WHERE crew_members.name = users.full_name AND document_id IS NOT NULL AND document_id != '');
    `).run();
  } catch (e) {
    console.warn('[Database] Administrator check error:', e);
  }

  // Initialize role_permissions defaults if not populated
  try {
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM role_permissions').get() as { cnt: number })?.cnt || 0;
    if (count === 0) {
      const stmt = db.prepare("INSERT OR REPLACE INTO role_permissions (role, permissions, updated_at) VALUES (?, ?, datetime('now'))");
      stmt.run('ADMIN', JSON.stringify([
        'CAN_VIEW_OPERATIONS',
        'CAN_RECORD_DATA',
        'CAN_FILL_VEHICLES',
        'CAN_MANAGE_CREW',
        'CAN_CLOSE_SHIFT',
        'CAN_DELETE_RECORDS',
        'CAN_ACCESS_ADMIN'
      ]));
      stmt.run('SUPERVISOR', JSON.stringify([
        'CAN_VIEW_OPERATIONS',
        'CAN_RECORD_DATA',
        'CAN_FILL_VEHICLES',
        'CAN_MANAGE_CREW',
        'CAN_CLOSE_SHIFT'
      ]));
      stmt.run('OPERATOR', JSON.stringify([
        'CAN_VIEW_OPERATIONS',
        'CAN_RECORD_DATA',
        'CAN_FILL_VEHICLES'
      ]));
      console.log('[Database] Default role_permissions matrix seeded successfully.');
    }
  } catch (e) {
    console.warn('[Database] Error initializing role_permissions:', e);
  }

  // -------------------------------------------------------------
  // Mandatory Migration: Synchronize Official 4 Supervisors and 36 Staff Members
  // -------------------------------------------------------------
  try {
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

    db.exec('PRAGMA foreign_keys = OFF;');

    // 0. Clean old supervisor assignments in referencing tables
    db.prepare(`
      DELETE FROM supervisor_operators;
    `).run();
    db.prepare(`
      UPDATE crew_area_assignments 
      SET operator_id = NULL 
      WHERE operator_id IN ('op-klisman-g1', 'op-victor-g2', 'op-sup-g3', 'op-sup-g4');
    `).run();

    // 1. Remove obsolete test entries from crew_members
    db.prepare(`
      DELETE FROM crew_members 
      WHERE id LIKE '%test%' 
         OR name LIKE '%TEST%' 
         OR name LIKE '%PRUEBA%'
         OR id = 'op-klisman-g1'
         OR id = 'op-victor-g2'
         OR (id = 'op-sup-g3' AND name LIKE '%MENDOZA%')
         OR (id = 'op-sup-g4' AND name LIKE '%ORTEGA%');
    `).run();

    // 2. Demote any incorrect supervisors
    db.prepare(`
      UPDATE crew_members 
      SET primary_role = 'OPERADOR_SALA_CONTROL' 
      WHERE name LIKE '%ORTEGA RAM%REZ%' AND primary_role = 'SUPERVISOR';
    `).run();
    db.prepare(`
      UPDATE users 
      SET role = 'OPERATOR' 
      WHERE (full_name LIKE '%ORTEGA RAM%REZ%' OR full_name LIKE '%MENDOZA QUISPE%' OR full_name LIKE '%LLERENA CALLE%') 
        AND role = 'SUPERVISOR';
    `).run();

    // 3. Upsert the 4 Official Supervisors in crew_members (safe against id or document_id conflicts)
    const deleteOldCrew = db.prepare('DELETE FROM crew_members WHERE id = ? OR document_id = ?');
    const insertCrew = db.prepare(`
      INSERT INTO crew_members (id, name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'EN_TURNO', ?);
    `);

    for (const sup of OFFICIAL_SUPERVISORS_DATA) {
      deleteOldCrew.run(sup.id, sup.document_id);
      insertCrew.run(sup.id, sup.name, sup.document_id, 'SUPERVISOR', sup.shift, sup.radio, sup.phone, sup.avatar);
    }

    // 4. Upsert the 4 Official Supervisors in users
    for (const sup of OFFICIAL_SUPERVISORS_DATA) {
      const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR document_id = ?').get(sup.username, sup.document_id) as any;
      if (existingUser) {
        db.prepare(`
          UPDATE users 
          SET full_name = ?, role = 'SUPERVISOR', shift = ?, document_id = ?, avatar_url = ?, primary_role = 'SUPERVISOR'
          WHERE id = ?;
        `).run(sup.name, sup.shift, sup.document_id, sup.avatar, existingUser.id);
      } else {
        db.prepare(`
          INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url, is_active, document_id, primary_role)
          VALUES (?, ?, ?, ?, ?, 'SUPERVISOR', ?, ?, 1, ?, 'SUPERVISOR');
        `).run(crypto.randomUUID(), sup.username, sup.email, bcrypt.hashSync(sup.document_id, 10), sup.name, sup.shift, sup.avatar, sup.document_id);
      }
    }

    // 5. Upsert the 32 Operators in crew_members and users table
    for (const op of ALL_32_OPERATORS) {
      deleteOldCrew.run(op.id, op.document_id);
      insertCrew.run(op.id, op.name, op.document_id, op.primary_role, op.shift_code, op.radio, op.phone, op.avatar);

      // Also ensure operator account exists in users table for DNI login
      const existingOpUser = db.prepare('SELECT id FROM users WHERE document_id = ?').get(op.document_id) as any;
      if (existingOpUser) {
        db.prepare(`
          UPDATE users 
          SET full_name = ?, role = 'OPERATOR', shift = ?, primary_role = ?, avatar_url = ?, password_hash = ?
          WHERE id = ?;
        `).run(op.name, op.shift_code, op.primary_role, op.avatar, bcrypt.hashSync(op.document_id, 10), existingOpUser.id);
      } else {
        const username = op.name.split(' ')[0] + op.document_id.slice(-4);
        db.prepare(`
          INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url, is_active, document_id, primary_role)
          VALUES (?, ?, ?, ?, ?, 'OPERATOR', ?, ?, 1, ?, ?);
        `).run(crypto.randomUUID(), username, `${op.document_id}@basetrack.com`, bcrypt.hashSync(op.document_id, 10), op.name, op.shift_code, op.avatar, op.document_id, op.primary_role);
      }
    }

    // 6. Purge any test accounts or leftover mock entries
    db.prepare("DELETE FROM users WHERE username LIKE 'op_test_%' OR username LIKE '%test%' OR full_name LIKE '%TEST%' OR full_name LIKE '%PRUEBA%' OR email LIKE '%@test.com'").run();
    db.prepare("DELETE FROM crew_members WHERE id LIKE 'op_test_%' OR name LIKE '%TEST%' OR name LIKE '%PRUEBA%'").run();
    db.prepare("DELETE FROM supervisor_operators WHERE supervisor_id LIKE 'op_test_%' OR operator_id LIKE 'op_test_%'").run();

    // 7. Auto-link 8 operators to each official supervisor in supervisor_operators
    db.prepare('DELETE FROM supervisor_operators').run();
    const insertSupOp = db.prepare(`
      INSERT OR IGNORE INTO supervisor_operators (id, supervisor_id, operator_id, shift_code)
      VALUES (?, ?, ?, ?);
    `);
    for (const op of ALL_32_OPERATORS) {
      const supCode = `op-${op.shift_code.toLowerCase()}-sup`;
      const supData = OFFICIAL_SUPERVISORS_DATA.find(s => s.shift === op.shift_code);
      const userSup = supData ? db.prepare('SELECT id, username FROM users WHERE document_id = ?').get(supData.document_id) as any : null;

      // Link by crew supervisor id (e.g. op-g1-sup)
      insertSupOp.run(crypto.randomUUID(), supCode, op.id, op.shift_code);
      // Link by user id (UUID)
      if (userSup?.id) {
        insertSupOp.run(crypto.randomUUID(), userSup.id, op.id, op.shift_code);
      }
      // Link by username (e.g. MiguelG)
      if (userSup?.username) {
        insertSupOp.run(crypto.randomUUID(), userSup.username, op.id, op.shift_code);
      }
    }

    // 8. Strict Whitelist Purge: Delete any account in users/crew_members that is not Marckv and not among the 36 CSV staff
    const validStaffDnis = [
      ...OFFICIAL_SUPERVISORS_DATA.map(s => s.document_id),
      ...ALL_32_OPERATORS.map(o => o.document_id)
    ];
    const userPlaceholders = ['2794vizcarra', ...validStaffDnis].map(() => '?').join(',');
    db.prepare(`
      DELETE FROM users 
      WHERE document_id NOT IN (${userPlaceholders}) 
        AND LOWER(username) != 'marckv';
    `).run('2794vizcarra', ...validStaffDnis);

    const crewPlaceholders = validStaffDnis.map(() => '?').join(',');
    db.prepare(`
      DELETE FROM crew_members 
      WHERE document_id NOT IN (${crewPlaceholders});
    `).run(...validStaffDnis);

    // Clean up any orphan assignments whose operator_id or backup_operator_id is not in crew_members
    db.prepare(`
      UPDATE crew_area_assignments 
      SET operator_id = NULL 
      WHERE operator_id IS NOT NULL 
        AND operator_id NOT IN (SELECT id FROM crew_members);
    `).run();
    db.prepare(`
      UPDATE crew_area_assignments 
      SET backup_operator_id = NULL 
      WHERE backup_operator_id IS NOT NULL 
        AND backup_operator_id NOT IN (SELECT id FROM crew_members);
    `).run();

    db.exec('PRAGMA foreign_keys = ON;');
    console.log('[Database] Synchronized: exactly 1 Administrator (Marckv) and 36 Plant Staff.');
  } catch (e) {
    console.warn('[Database] Official staff synchronization warning:', e);
  }

  console.log('[Database] Tables and indexes initialized successfully.');
}
