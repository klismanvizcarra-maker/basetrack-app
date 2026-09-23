import { db, initDatabase } from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const OFFICIAL_STAFF = [
  // Guardia A (10 operators)
  {
    username: 'KlismanV',
    full_name: 'VIZCARRA CORI MANLEY KLISMAN',
    email: 'klismanvizcarra@basetrack.com',
    password: 'Password123!', // also can login with DNI 71209033
    document_id: '71209033',
    role: 'ADMIN',
    primary_role: 'OPERADOR_BOMBAS',
    shift: 'G1',
    radio_channel: 'Canal 3 Bombas',
    phone_extension: 'Ext. 4125',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'CarlosP',
    full_name: 'PILCO APAZA CARLOS EDUARDO',
    email: 'carlospilco@basetrack.com',
    password: 'Password123!',
    document_id: '42324277',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_CICLONES',
    shift: 'G1',
    radio_channel: 'Canal 2 Ciclones',
    phone_extension: 'Ext. 4122',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'JorgeV',
    full_name: 'VILCAMIZA PEVE JORGE RICARDO',
    email: 'jorgevilcamiza@basetrack.com',
    password: 'Password123!',
    document_id: '41748219',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_DESCARGA',
    shift: 'G1',
    radio_channel: 'Canal 4 Presa',
    phone_extension: 'Ext. 4124',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'VilmaR',
    full_name: 'ROSADO FALCON VILMA LUCIA',
    email: 'vilmarosado@basetrack.com',
    password: 'Password123!',
    document_id: '45564062',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_MISCELANEOS',
    shift: 'G1',
    radio_channel: 'Canal 1 Operaciones',
    phone_extension: 'Ext. 4123',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'JhoferP',
    full_name: 'PARI COAYLA JHOFER LUIS',
    email: 'jhoferpari@basetrack.com',
    password: 'Password123!',
    document_id: '74924255',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_RELEVO',
    shift: 'G1',
    radio_channel: 'Canal 5 Relevo/Móvil',
    phone_extension: 'Ext. 4121',
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'DiegoM',
    full_name: 'MONTES RODRIGUEZ DIEGO ALEXANDER',
    email: 'diegomontes@basetrack.com',
    password: 'Password123!',
    document_id: '45437279',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_BOMBAS',
    shift: 'G1',
    radio_channel: 'Canal 3 Bombas',
    phone_extension: 'Ext. 4120',
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'RonalM',
    full_name: 'MAMANI MIRANDA RONAL',
    email: 'ronalmamani@basetrack.com',
    password: 'Password123!',
    document_id: '72958467',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_CICLONES',
    shift: 'G1',
    radio_channel: 'Canal 2 Ciclones',
    phone_extension: 'Ext. 4119',
    avatar_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'AnthonyJ',
    full_name: 'MAMANI CUTIPA ANTHONY JESUS SMIT',
    email: 'anthonymamani@basetrack.com',
    password: 'Password123!',
    document_id: '72297288',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_DESCARGA',
    shift: 'G1',
    radio_channel: 'Canal 4 Presa',
    phone_extension: 'Ext. 4118',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'VictorA',
    full_name: 'LLERENA CALLE-BRACAMONTE VICTOR ALEJANDRO II',
    email: 'victorllerena@basetrack.com',
    password: 'Password123!',
    document_id: '71491945',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_MISCELANEOS',
    shift: 'G1',
    radio_channel: 'Canal 1 Operaciones',
    phone_extension: 'Ext. 4117',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'EdsonH',
    full_name: 'HILARI CABRERA EDSON EUSEBIO',
    email: 'edsonhilari@basetrack.com',
    password: 'Password123!',
    document_id: '40824273',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_RELEVO',
    shift: 'G1',
    radio_channel: 'Canal 5 Relevo/Móvil',
    phone_extension: 'Ext. 4116',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=250&q=80'
  },

  // Guardia B (5 operators)
  {
    username: 'EmilioA',
    full_name: 'ALIAGA CASTAÑEDA EMILIO URIEL',
    email: 'Emilioaliaga@basetrack.com',
    password: 'Password123!',
    document_id: '46593500',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_BOMBAS',
    shift: 'G2',
    radio_channel: 'Canal 3 Bombas',
    phone_extension: 'Ext. 4102',
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'LuisA',
    full_name: 'CASCASI FLORES LUIS ANTONIO',
    email: 'Luiscascasi@basetrack.com',
    password: 'Password123!',
    document_id: '43132072',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_CICLONES',
    shift: 'G2',
    radio_channel: 'Canal 2 Ciclones',
    phone_extension: 'Ext. 4105',
    avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'ValerieC',
    full_name: 'CAYO GOMEZ VALERIE JAZMINE',
    email: 'valeriecayo@basetrack.com',
    password: 'Password123!',
    document_id: '71719330',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_DESCARGA',
    shift: 'G2',
    radio_channel: 'Canal 4 Presa',
    phone_extension: 'Ext. 4109',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'PedroI',
    full_name: 'CHOQUE MANZANO PEDRO IVAN',
    email: 'pedrochoque@basetrack.com',
    password: 'Password123!',
    document_id: '75555937',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_MISCELANEOS',
    shift: 'G2',
    radio_channel: 'Canal 1 Operaciones',
    phone_extension: 'Ext. 4112',
    avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=250&q=80'
  },
  {
    username: 'PaulC',
    full_name: 'CRUZ APAZA PAUL',
    email: 'paulcruz@basetrack.com',
    password: 'Password123!',
    document_id: '44428468',
    role: 'OPERATOR',
    primary_role: 'OPERADOR_RELEVO',
    shift: 'G2',
    radio_channel: 'Canal 5 Relevo/Móvil',
    phone_extension: 'Ext. 4115',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80'
  }
];

export function applyOfficialStaff() {
  initDatabase();

  console.log('[Migration] Cleaning test data and seeding official 15 staff members...');

  // 1. Clean test operators and test assignments
  db.exec(`
    DELETE FROM crew_area_assignments;
    DELETE FROM crew_members;
    DELETE FROM users;
  `);

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, full_name, role, shift, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCrew = db.prepare(`
    INSERT INTO crew_members (id, name, document_id, primary_role, shift_code, radio_channel, phone_extension, status, avatar_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const operatorMap = new Map();

  for (const staff of OFFICIAL_STAFF) {
    const userId = crypto.randomUUID();
    const crewId = crypto.randomUUID();
    const hash = bcrypt.hashSync(staff.document_id, 10); // Login with DNI as password

    insertUser.run(
      userId,
      staff.username,
      staff.email,
      hash,
      staff.full_name,
      staff.role,
      staff.shift,
      staff.avatar_url
    );

    insertCrew.run(
      crewId,
      staff.full_name,
      staff.document_id,
      staff.primary_role,
      staff.shift,
      staff.radio_channel,
      staff.phone_extension,
      'EN_TURNO',
      staff.avatar_url
    );

    operatorMap.set(staff.username, crewId);
  }

  // Initial assignments for today
  const today = new Date().toISOString().split('T')[0];
  const insertAssign = db.prepare(`
    INSERT INTO crew_area_assignments (
      id, shift_code, shift_date, shift_type, position_key, position_title,
      operator_id, backup_operator_id, epp_verified, safety_talk_completed,
      radio_channel, station_location, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Guardia A Assignments
  const klismanId = operatorMap.get('KlismanV');
  const carlosId = operatorMap.get('CarlosP');
  const jorgeId = operatorMap.get('JorgeV');
  const vilmaId = operatorMap.get('VilmaR');
  const jhoferId = operatorMap.get('JhoferP');

  insertAssign.run(crypto.randomUUID(), 'G1', today, 'DIA', 'BOMBAS', 'Operador de Bombas', klismanId, jhoferId, 1, 1, 'Canal 3 Bombas', 'Sala de Bombas Slurry & Sentina Principal', 'Control de flujo en bombas PP-101 a PP-104 y monitoreo de pozas de drenaje');
  insertAssign.run(crypto.randomUUID(), 'G1', today, 'DIA', 'CICLONES', 'Operador de Ciclones', carlosId, jhoferId, 1, 1, 'Canal 2 Ciclones', '1ra y 2da Estación Baterías de Ciclones', 'Muestreo horario de sólidos y granulometría de mallas -200');
  insertAssign.run(crypto.randomUUID(), 'G1', today, 'DIA', 'DESCARGA', 'Operador de descarga', jorgeId, jhoferId, 1, 1, 'Canal 4 Presa', 'Línea de Impulsión & Presa de Relaves Principal', 'Inspección de vertedero, borde libre y lecturas de piezómetros');
  insertAssign.run(crypto.randomUUID(), 'G1', today, 'DIA', 'MISCELANEOS', 'Operador Misceláneos', vilmaId, jhoferId, 1, 1, 'Canal 1 Operaciones', 'Planta General & Muestreo Auxiliar', 'Preparación de reactivos, control de floculante y apoyo en campo');
  insertAssign.run(crypto.randomUUID(), 'G1', today, 'DIA', 'RELEVO', 'Operador de Relevo', jhoferId, null, 1, 1, 'Canal 5 Relevo/Móvil', 'Cobertura Volante Móvil en Planta', 'Relevo de pausas activas, refrigerios y emergencias');

  // Guardia B Assignments
  const emilioId = operatorMap.get('EmilioA');
  const luisId = operatorMap.get('LuisA');
  const valerieId = operatorMap.get('ValerieC');
  const pedroId = operatorMap.get('PedroI');
  const paulId = operatorMap.get('PaulC');

  insertAssign.run(crypto.randomUUID(), 'G2', today, 'DIA', 'BOMBAS', 'Operador de Bombas', emilioId, paulId, 1, 1, 'Canal 3 Bombas', 'Sala de Bombas Slurry & Sentina Principal', 'Monitoreo preventivo y presiones de descarga');
  insertAssign.run(crypto.randomUUID(), 'G2', today, 'DIA', 'CICLONES', 'Operador de Ciclones', luisId, paulId, 1, 1, 'Canal 2 Ciclones', '1ra y 2da Estación Baterías de Ciclones', 'Control granulométrico de mallas');
  insertAssign.run(crypto.randomUUID(), 'G2', today, 'DIA', 'DESCARGA', 'Operador de descarga', valerieId, paulId, 1, 1, 'Canal 4 Presa', 'Línea de Impulsión & Presa de Relaves Principal', 'Supervisión de bordes libres y piezómetros');
  insertAssign.run(crypto.randomUUID(), 'G2', today, 'DIA', 'MISCELANEOS', 'Operador Misceláneos', pedroId, paulId, 1, 1, 'Canal 1 Operaciones', 'Planta General & Sistemas Auxiliares', 'Dosificación y muestreo');
  insertAssign.run(crypto.randomUUID(), 'G2', today, 'DIA', 'RELEVO', 'Operador de Relevo', paulId, null, 1, 1, 'Canal 5 Relevo/Móvil', 'Cobertura Volante Móvil en Planta', 'Relevo activo transversal');

  console.log(`[Migration] SUCCESS: 15 official operators registered in both users and crew_members tables.`);
}

applyOfficialStaff();
