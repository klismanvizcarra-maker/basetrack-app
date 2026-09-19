import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { apiRouter } from '../src/routes/index.js';
import { initDatabase } from '../src/database/db.js';
import { seed } from '../src/database/seed.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';

const app = express();
app.use(cors());
app.use(express.json());
initDatabase();
seed();
app.use('/api', apiRouter);
app.use(errorHandler);

let server: http.Server;
let baseUrl: string;
let authToken: string;

test.before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://localhost:${addr.port}/api`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test('1. GET /api/health should return online status', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json() as any;
  assert.strictEqual(data.status, 'online');
  assert.ok(data.database.includes('node:sqlite'));
});

test('2. POST /api/auth/login should authenticate admin and return JWT', async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'KlismanV', password: '71209033' })
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json() as any;
  assert.strictEqual(data.success, true);
  assert.ok(data.token);
  assert.strictEqual(data.user.role, 'ADMIN');
  authToken = data.token;
});

test('3. GET /api/auth/me should return current user with valid token', async () => {
  const res = await fetch(`${baseUrl}/auth/me`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  assert.strictEqual(res.status, 200);
  const data = await res.json() as any;
  assert.ok(['admin', 'KlismanV'].includes(data.user.username));
});

test('4. GET /api/dashboard/metrics should return aggregated CRAVEAT-style KPIs', async () => {
  const res = await fetch(`${baseUrl}/dashboard/metrics`);
  assert.strictEqual(res.status, 200);
  const data = await res.json() as any;
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.data.kpiCards.length, 5);
  assert.strictEqual(data.data.operationSummary.gauges.length, 3);
  assert.ok(data.data.weeklyComparison.days.length >= 7);
  assert.ok(data.data.productionCurve.points.length >= 12);
});

test('5. GET /api/pumps and PATCH /api/pumps/:id/status', async () => {
  const listRes = await fetch(`${baseUrl}/pumps`);
  assert.strictEqual(listRes.status, 200);
  const listData = await listRes.json() as any;
  assert.ok(listData.count > 0);

  const firstPump = listData.data[0];
  const patchRes = await fetch(`${baseUrl}/pumps/${firstPump.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ status: 'OPERATING', notes: 'Prueba unitaria exitosa' })
  });

  assert.strictEqual(patchRes.status, 200);
});

test('6. POST /api/maintenance should create ticket with photo', async () => {
  const res = await fetch(`${baseUrl}/maintenance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      equipment_tag: 'PP-101',
      title: 'Alineación de acople flexible',
      description: 'Chequeo por vibración en prueba automatizada',
      priority: 'MEDIUM'
    })
  });

  assert.strictEqual(res.status, 201);
  const data = await res.json() as any;
  assert.ok(data.ticketNumber.startsWith('OT-'));
});

test('7. GET /api/cyclones/station-samples should return 2da Estación Ciclones samples and accurate averages', async () => {
  // Asegurar limpieza de datos temporales de prueba
  await fetch(`${baseUrl}/cyclones/station-samples?station=2DA%20ESTACI%C3%93N%20CICLONES`);
  const res = await fetch(`${baseUrl}/cyclones/station-samples?station=2DA%20ESTACI%C3%93N%20CICLONES`);
  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.station, '2DA ESTACIÓN CICLONES');
  assert.strictEqual(json.count >= 8, true);
  // Verificar cálculos en muestras iniciales
  assert.ok(json.generalAverages.solids_uf > 0);
  assert.ok(json.generalAverages.mesh200_uf > 0);
  assert.ok(json.keyAverages.uf_solids > 0);
  assert.ok(json.keyAverages.uf_mesh200 > 0);
});

test('8. POST & DELETE /api/cyclones/station-samples should register and delete sample', async () => {
  const res = await fetch(`${baseUrl}/cyclones/station-samples`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      station: '2DA ESTACIÓN CICLONES',
      sample_time: '06:00',
      battery_tag: 'CY3',
      solids_feed: 46.2,
      solids_of: 29.5,
      solids_uf: 70.2,
      mesh200_feed: 55.0,
      mesh200_of: 22.0,
      mesh200_uf: 24.1
    })
  });

  assert.strictEqual(res.status, 201);
  const data = await res.json() as any;
  assert.strictEqual(data.success, true);
  assert.ok(data.id);

  // Limpiar registro de prueba
  const delRes = await fetch(`${baseUrl}/cyclones/station-samples/${data.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(delRes.status, 200);
});

test('9. GET & POST /api/pumps/operational-sheet should fetch and save operational report', async () => {
  const getRes = await fetch(`${baseUrl}/pumps/operational-sheet?date=2026-08-27&shift=GUARDIA_A`);
  assert.strictEqual(getRes.status, 200);
  const getJson = await getRes.json() as any;
  assert.strictEqual(getJson.success, true);
  assert.strictEqual(getJson.data.sentina_pumps.length, 8);
  assert.strictEqual(getJson.data.intermedia_pumps.length, 6);
  assert.strictEqual(getJson.data.torre5_pumps.length, 10);

  // Modificar y guardar
  const updatedSentina = [...getJson.data.sentina_pumps];
  updatedSentina[0].status = 'Stand by';

  const postRes = await fetch(`${baseUrl}/pumps/operational-sheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      report_date: '2026-08-27',
      shift_code: 'GUARDIA_A',
      operator_name: 'Supervisor Turno Test',
      sentina_pumps: updatedSentina,
      intermedia_pumps: getJson.data.intermedia_pumps,
      torre5_pumps: getJson.data.torre5_pumps,
      levels: getJson.data.levels,
      main_indicators: getJson.data.main_indicators,
      pozas_sentina: getJson.data.pozas_sentina,
      additional_obs: getJson.data.additional_obs
    })
  });

  assert.strictEqual(postRes.status, 200);
  const postJson = await postRes.json() as any;
  assert.strictEqual(postJson.success, true);
});

test('10. GET /api/admin/backup and POST /api/admin/restore should backup and restore operational data', async () => {
  const backupRes = await fetch(`${baseUrl}/admin/backup`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(backupRes.status, 200);
  const backupJson = await backupRes.json() as any;
  assert.strictEqual(backupJson.success, true);
  assert.ok(backupJson.backup);
  assert.ok(Array.isArray(backupJson.backup.users));
  assert.ok(Array.isArray(backupJson.backup.crew_members));
  assert.ok(Array.isArray(backupJson.backup.pump_station_sheets));

  const restoreRes = await fetch(`${baseUrl}/admin/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ backup: backupJson.backup })
  });
  assert.strictEqual(restoreRes.status, 200);
  const restoreJson = await restoreRes.json() as any;
  assert.strictEqual(restoreJson.success, true);
  assert.ok(restoreJson.summary);
});


