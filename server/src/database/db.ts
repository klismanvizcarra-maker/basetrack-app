import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || './data/basetrack.db';
const resolvedPath = path.resolve(process.cwd(), dbPath);
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
      shift TEXT NOT NULL CHECK(shift IN ('GUARDIA_A', 'GUARDIA_B', 'GUARDIA_C')),
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
      shift_code TEXT NOT NULL DEFAULT 'GUARDIA_A',
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
      shift_code TEXT NOT NULL DEFAULT 'GUARDIA_A',
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

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_pumps_tag ON pump_reports(tag);
    CREATE INDEX IF NOT EXISTS idx_pumps_created ON pump_reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_cyclones_battery ON cyclone_reports(battery_tag);
    CREATE INDEX IF NOT EXISTS idx_tailings_created ON tailings_reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(username);
  `);

  console.log('[Database] Tables and indexes initialized successfully.');
}
