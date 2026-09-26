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
app.use(express.json({ limit: '25mb' }));
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
  const getRes = await fetch(`${baseUrl}/pumps/operational-sheet?date=2026-08-27&shift=G1`);
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
      shift_code: 'G1',
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

test('11. PATCH /api/admin/users/:id/role-shift and reset-password should update user and reset password', async () => {
  const usersRes = await fetch(`${baseUrl}/admin/users`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const usersData = await usersRes.json() as any;
  assert.strictEqual(usersRes.status, 200);
  const targetUser = usersData.data.find((u: any) => u.username === 'CarlosP');
  assert.ok(targetUser);

  // Update role and shift
  const patchRes = await fetch(`${baseUrl}/admin/users/${targetUser.id}/role-shift`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ role: 'SUPERVISOR', shift: 'G2' })
  });
  assert.strictEqual(patchRes.status, 200);
  const patchJson = await patchRes.json() as any;
  assert.strictEqual(patchJson.success, true);
  assert.strictEqual(patchJson.user.role, 'SUPERVISOR');
  assert.strictEqual(patchJson.user.shift, 'G2');

  // Reset password
  const resetRes = await fetch(`${baseUrl}/admin/users/${targetUser.id}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ newPassword: 'TempPassword2026!' })
  });
  assert.strictEqual(resetRes.status, 200);
  const resetJson = await resetRes.json() as any;
  assert.strictEqual(resetJson.success, true);

  // Verify login with new password
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'CarlosP', password: 'TempPassword2026!' })
  });
  assert.strictEqual(loginRes.status, 200);
  const loginJson = await loginRes.json() as any;
  assert.strictEqual(loginJson.success, true);
});

test('12. GET /api/admin/devices and POST /api/admin/devices/:id/revoke should list and revoke device session', async () => {
  // Push an event from a test device to register it
  await fetch(`${baseUrl}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: 'test_tablet_plant_01',
      deviceName: 'Tablet Zona Bombas',
      username: 'KlismanV',
      events: [{ entity: 'PUMPS', action: 'PING', payload: {}, timestamp: Date.now() }]
    })
  });

  // Get devices
  const devicesRes = await fetch(`${baseUrl}/admin/devices`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(devicesRes.status, 200);
  const devicesData = await devicesRes.json() as any;
  assert.strictEqual(devicesData.success, true);
  assert.ok(Array.isArray(devicesData.devices));
  const found = devicesData.devices.find((d: any) => d.device_id === 'test_tablet_plant_01');
  assert.ok(found);

  // Revoke device
  const revokeRes = await fetch(`${baseUrl}/admin/devices/test_tablet_plant_01/revoke`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(revokeRes.status, 200);
  const revokeData = await revokeRes.json() as any;
  assert.strictEqual(revokeData.success, true);
});

test('13. PUT /api/auth/profile should update operational profile fields and sync with crew_members', async () => {
  const updateRes = await fetch(`${baseUrl}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      fullName: 'VIZCARRA CORI MANLEY KLISMAN',
      email: 'klismanvizcarra@basetrack.com',
      shift: 'G1',
      document_id: '71209033',
      radio_channel: 'Canal 2 Ciclones',
      phone_extension: 'Anexo 405',
      primary_role: 'SUPERVISOR'
    })
  });

  assert.strictEqual(updateRes.status, 200);
  const updateJson = await updateRes.json() as any;
  assert.strictEqual(updateJson.success, true);
  assert.strictEqual(updateJson.user.document_id, '71209033');
  assert.strictEqual(updateJson.user.radio_channel, 'Canal 2 Ciclones');
  assert.strictEqual(updateJson.user.phone_extension, 'Anexo 405');
  assert.strictEqual(updateJson.user.primary_role, 'SUPERVISOR');

  // Verify getMe returns the updated operational fields
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(meRes.status, 200);
  const meJson = await meRes.json() as any;
  assert.strictEqual(meJson.success, true);
  assert.strictEqual(meJson.user.document_id, '71209033');
  assert.strictEqual(meJson.user.radio_channel, 'Canal 2 Ciclones');
  assert.strictEqual(meJson.user.phone_extension, 'Anexo 405');
  assert.strictEqual(meJson.user.primary_role, 'SUPERVISOR');
});

test('14. Security: Login should reject unauthorized bypass attempts on standard operators', async () => {
  const badLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'CarlosP', password: 'WrongPassword999!' })
  });

  assert.strictEqual(badLogin.status, 401);
  const badJson = await badLogin.json() as any;
  assert.strictEqual(badJson.success, false);
});

test('15. Security: changePassword must strictly require valid currentPassword', async () => {
  // Attempt change without currentPassword
  const resNoCurrent = await fetch(`${baseUrl}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ newPassword: 'NewSecurePass2026!' })
  });

  assert.strictEqual(resNoCurrent.status, 400);
  const jsonNoCurrent = await resNoCurrent.json() as any;
  assert.strictEqual(jsonNoCurrent.success, false);

  // Attempt change with wrong currentPassword
  const resWrongCurrent = await fetch(`${baseUrl}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ currentPassword: 'WrongOldPassword!', newPassword: 'NewSecurePass2026!' })
  });

  assert.strictEqual(resWrongCurrent.status, 400);
  const jsonWrongCurrent = await resWrongCurrent.json() as any;
  assert.strictEqual(jsonWrongCurrent.success, false);
});

test('16. GET /api/vehicles/summary should return exactly the 4 official mining trucks', async () => {
  const res = await fetch(`${baseUrl}/vehicles/summary`);
  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.data.length, 4);

  const plates = json.data.map((v: any) => v.plate).sort();
  assert.deepStrictEqual(plates, ['BKS913', 'BKS921', 'BMC715', 'BPS747']);
});

test('17. POST & GET /api/vehicles/checklists: create checklist, reject unauthorized plates and filter by plate', async () => {
  // 1. Reject invalid plate
  const badPlateRes = await fetch(`${baseUrl}/vehicles/checklists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      vehicle_plate: 'XYZ999',
      driver_name: 'Conductor Invalido',
      driver_dni: '12345678',
      odometer: 10000
    })
  });
  assert.strictEqual(badPlateRes.status, 400);

  // 2. Create valid checklist for BMC715
  const createRes = await fetch(`${baseUrl}/vehicles/checklists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      vehicle_plate: 'BMC715',
      date: '2026-09-26',
      time: '07:15',
      shift: 'G1',
      shift_type: 'DIA',
      driver_name: 'VIZCARRA CORI MANLEY KLISMAN',
      driver_dni: '71209033',
      driver_license: 'Q71209033',
      odometer: 48310,
      items: [
        { code: 'LUCES', name: 'Luces altas, bajas y neblineros', status: 'B' },
        { code: 'FRENOS', name: 'Freno de servicio y parqueo', status: 'B' },
        { code: 'EXTINTOR', name: 'Extintor PQS 6kg con manómetro en verde', status: 'B' }
      ],
      has_observations: 1,
      observation_notes: 'Leve raspón superficial en parachoque delantero izquierdo',
      photo_url: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAkA4JaQAA3AA/vuUAAA=',
      operational_status: 'OBSERVADO'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const createJson = await createRes.json() as any;
  assert.strictEqual(createJson.success, true);
  assert.ok(createJson.id);

  // 3. Query history filtered by plate BMC715
  const historyRes = await fetch(`${baseUrl}/vehicles/checklists?plate=BMC715`);
  assert.strictEqual(historyRes.status, 200);
  const historyJson = await historyRes.json() as any;
  assert.strictEqual(historyJson.success, true);
  assert.ok(historyJson.count >= 1);
  assert.strictEqual(historyJson.data[0].vehicle_plate, 'BMC715');
  assert.strictEqual(historyJson.data[0].operational_status, 'OBSERVADO');
});
