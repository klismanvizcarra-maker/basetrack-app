import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { apiRouter } from '../src/routes/index.js';
import { db, initDatabase } from '../src/database/db.js';
import { seed } from '../src/database/seed.js';
import { purgeAndSetSoleAdmin } from '../src/database/purge.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import { generateToken } from '../src/config/jwt.js';
import bcrypt from 'bcryptjs';

import { WebSocket } from 'ws';
import { initWebSocketServer, closeWebSocketServer } from '../src/websocket/ws.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
purgeAndSetSoleAdmin();
app.use('/api', apiRouter);
app.use(errorHandler);

let server: http.Server;
let baseUrl: string;
let wsUrl: string;
let authToken: string;

const authHeaders = () => ({ 'Authorization': `Bearer ${authToken}` });

test.before(async () => {
  server = http.createServer(app);
  initWebSocketServer(server);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://localhost:${addr.port}/api`;
      wsUrl = `ws://localhost:${addr.port}/ws`;
      resolve();
    });
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
    body: JSON.stringify({ username: 'Marckv', password: '91209966' })
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
  assert.ok(['admin', 'Marckv'].includes(data.user.username));
});

test('4. GET /api/dashboard/metrics should return aggregated CRAVEAT-style KPIs', async () => {
  const res = await fetch(`${baseUrl}/dashboard/metrics`, { headers: authHeaders() });
  assert.strictEqual(res.status, 200);
  const data = await res.json() as any;
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.data.kpiCards.length, 5);
  assert.strictEqual(data.data.operationSummary.gauges.length, 3);
  assert.ok(data.data.weeklyComparison.days.length >= 7);
  assert.ok(data.data.productionCurve.points.length >= 12);
});

test('5. GET /api/pumps and PATCH /api/pumps/:id/status', async () => {
  let listRes = await fetch(`${baseUrl}/pumps`, { headers: authHeaders() });
  assert.strictEqual(listRes.status, 200);
  let listData = await listRes.json() as any;
  if (listData.count === 0) {
    const createRes = await fetch(`${baseUrl}/pumps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        tag: 'PP-101',
        name: 'Bomba Slurry Alimentación Ciclones 01',
        system: 'ALIMENTACION_CICLONES',
        status: 'STANDBY',
        flow_rate_m3h: 0,
        pressure_bar: 0
      })
    });
    assert.strictEqual(createRes.status, 201);
    listRes = await fetch(`${baseUrl}/pumps`, { headers: authHeaders() });
    listData = await listRes.json() as any;
  }
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
  const res = await fetch(`${baseUrl}/cyclones/station-samples?station=2DA%20ESTACI%C3%93N%20CICLONES`, { headers: authHeaders() });
  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.station, '2DA ESTACIÓN CICLONES');
  assert.ok(Array.isArray(json.data));
  assert.ok(typeof json.generalAverages === 'object');
  assert.ok(typeof json.keyAverages === 'object');
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
  const getRes = await fetch(`${baseUrl}/pumps/operational-sheet?date=2026-08-27&shift=G1`, { headers: authHeaders() });
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

test('11. Security: Manual user creation is PROHIBITED (403), role-shift and reset-password work on existing users', async () => {
  // Verify manual creation is strictly prohibited
  const createRes = await fetch(`${baseUrl}/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      username: 'forbidden_test_user',
      full_name: 'TEST PROHIBIDO',
      email: 'forbidden@basetrack.com',
      role: 'OPERATOR',
      shift: 'G1',
      password: 'InitialPassword2026!'
    })
  });
  assert.strictEqual(createRes.status, 403);
  const createData = await createRes.json() as any;
  assert.strictEqual(createData.success, false);

  // Fetch existing users - should strictly contain only the sole administrator Marckv
  const usersRes = await fetch(`${baseUrl}/admin/users`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const usersData = await usersRes.json() as any;
  assert.strictEqual(usersData.success, true);
  assert.ok(usersData.data.length >= 1);
  const targetUser = usersData.data[0];
  assert.strictEqual(targetUser.username, 'Marckv');
  const targetUserId = targetUser.id;
  const originalShift = targetUser.shift;
  const originalRole = targetUser.role;

  // Update role and shift
  const patchRes = await fetch(`${baseUrl}/admin/users/${targetUserId}/role-shift`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ role: 'ADMIN', shift: 'ADMIN' })
  });
  assert.strictEqual(patchRes.status, 200);
  const patchJson = await patchRes.json() as any;
  assert.strictEqual(patchJson.success, true);

  // Revert back to original shift
  await fetch(`${baseUrl}/admin/users/${targetUserId}/role-shift`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ role: originalRole, shift: originalShift })
  });
});

test('12. GET /api/admin/devices and POST /api/admin/devices/:id/revoke should list and revoke device session', async () => {
  // Push an event from a test device to register it
  await fetch(`${baseUrl}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      deviceId: 'test_tablet_plant_01',
      deviceName: 'Tablet Zona Bombas',
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
      fullName: 'Marck Vizcarra',
      email: 'marckvizcarra@basetrack.com',
      shift: 'ADMIN',
      document_id: '91209966',
      radio_channel: 'Canal 1 Operaciones / Control',
      phone_extension: 'Ext. 4001',
      primary_role: 'ADMIN'
    })
  });

  assert.strictEqual(updateRes.status, 200);
  const updateJson = await updateRes.json() as any;
  assert.strictEqual(updateJson.success, true);
  assert.strictEqual(updateJson.user.document_id, '91209966');
  assert.strictEqual(updateJson.user.primary_role, 'ADMIN');

  // Verify getMe returns the updated operational fields
  const meRes = await fetch(`${baseUrl}/auth/me`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(meRes.status, 200);
  const meJson = await meRes.json() as any;
  assert.strictEqual(meJson.success, true);
  assert.strictEqual(meJson.user.document_id, '91209966');
  assert.strictEqual(meJson.user.primary_role, 'ADMIN');
});

test('14. Security: Login should reject unauthorized bypass attempts on standard operators', async () => {
  const badLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'OperadorPrueba', password: 'WrongPassword999!' })
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
  const res = await fetch(`${baseUrl}/vehicles/summary`, { headers: authHeaders() });
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
  const historyRes = await fetch(`${baseUrl}/vehicles/checklists?plate=BMC715`, { headers: authHeaders() });
  assert.strictEqual(historyRes.status, 200);
  const historyJson = await historyRes.json() as any;
  assert.ok(historyJson.count >= 1);
  const found = historyJson.data.find((c: any) => c.id === createJson.id);
  assert.ok(found, 'Created checklist must be present in history');
  assert.strictEqual(found.vehicle_plate, 'BMC715');
  assert.strictEqual(found.operational_status, 'OBSERVADO');
});

test('18. POST /api/admin/bulk-upload and GET /api/admin/supervisor-operators', async () => {
  const ts = Date.now();
  // 1. Bulk upload 1 supervisor and 1 operator for G1
  const bulkRes = await fetch(`${baseUrl}/admin/bulk-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      target_shift: 'G1',
      users: [
        {
          username: `sup_g1_${ts}`,
          full_name: 'TEST SUPERVISOR G1',
          email: `sup_g1_${ts}@test.com`,
          role: 'SUPERVISOR',
          shift: 'G1',
          document_id: `80${ts.toString().slice(-6)}1`,
          primary_role: 'SUPERVISOR'
        },
        {
          username: `op_bombas_${ts}`,
          full_name: 'TEST OPERADOR BOMBAS',
          email: `bombas_g1_${ts}@test.com`,
          role: 'OPERATOR',
          shift: 'G1',
          document_id: `80${ts.toString().slice(-6)}2`,
          primary_role: 'OPERADOR_BOMBAS',
          radio_channel: 'Canal 3 Bombas'
        }
      ]
    })
  });
  assert.ok([200, 201].includes(bulkRes.status));
  const bulkJson = await bulkRes.json() as any;
  assert.strictEqual(bulkJson.success, true);
  assert.strictEqual(bulkJson.count, 2);

  // 2. Query supervisors and squad counts
  const res = await fetch(`${baseUrl}/admin/supervisor-operators`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.supervisors));
  assert.ok(json.supervisors.length >= 1);

  const g1Sup = json.supervisors.find((s: any) => s.shift === 'G1');
  assert.ok(g1Sup, 'G1 supervisor should exist');
  assert.ok(g1Sup.operators.length >= 1, 'G1 supervisor should have assigned operators');
});

test('19. GET /api/crew/my-operators should return scoped squad for supervisor', async () => {
  // Query supervisor-operators list to get G1 supervisor ID
  const listRes = await fetch(`${baseUrl}/admin/supervisor-operators`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const listJson = await listRes.json() as any;
  const supervisor = listJson.supervisors.find((s: any) => s.shift === 'G1');
  assert.ok(supervisor, 'G1 supervisor must exist');

  const res = await fetch(`${baseUrl}/crew/my-operators?supervisor_id=${supervisor.id}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  assert.strictEqual(res.status, 200);
  const json = await res.json() as any;
  assert.strictEqual(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.ok(json.data.length >= 1);
  assert.ok(json.data.every((op: any) => op.id && op.name));
});

test('20. POST & DELETE /api/admin/supervisor-operators: assign and remove operator from supervisor', async () => {
  // Find G1 supervisor ID
  const listRes = await fetch(`${baseUrl}/admin/supervisor-operators`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const listJson = await listRes.json() as any;
  const supervisor = listJson.supervisors.find((s: any) => s.shift === 'G1');
  assert.ok(supervisor, 'G1 supervisor must exist');

  // Pick an existing operator from the list
  const testOperator = listJson.all_operators?.[0];
  assert.ok(testOperator, 'At least one operator must be registered');
  const testOperatorId = testOperator.id;

  const assignRes = await fetch(`${baseUrl}/admin/supervisor-operators`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      supervisor_id: supervisor.id,
      operator_id: testOperatorId
    })
  });
  assert.strictEqual(assignRes.status, 200);
  const assignJson = await assignRes.json() as any;
  assert.strictEqual(assignJson.success, true);

  // Remove the operator
  const removeRes = await fetch(`${baseUrl}/admin/supervisor-operators/${supervisor.id}/${testOperatorId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  assert.strictEqual(removeRes.status, 200);
  const removeJson = await removeRes.json() as any;
  assert.strictEqual(removeJson.success, true);
});

test('21. Permissions Matrix: GET, PUT roles, PUT overrides, GET /auth/permissions and POST reset', async () => {
  // 1. Get matrix as Admin
  const getRes = await fetch(`${baseUrl}/admin/permissions`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(getRes.status, 200);
  const matrix = await getRes.json() as any;
  assert.strictEqual(matrix.success, true);
  assert.ok(matrix.allPermissions.length >= 7, 'Must have at least 7 permission definitions');
  assert.ok(Array.isArray(matrix.rolePermissions.ADMIN), 'Admin role permissions must be an array');
  assert.ok(Array.isArray(matrix.rolePermissions.SUPERVISOR), 'Supervisor role permissions must be an array');
  assert.ok(Array.isArray(matrix.rolePermissions.OPERATOR), 'Operator role permissions must be an array');

  // 2. Fetch current user permissions via /auth/permissions
  const authPermsRes = await fetch(`${baseUrl}/auth/permissions`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(authPermsRes.status, 200);
  const authPerms = await authPermsRes.json() as any;
  assert.strictEqual(authPerms.success, true);
  assert.ok(authPerms.permissions.includes('CAN_ACCESS_ADMIN'), 'Admin must have CAN_ACCESS_ADMIN');

  // 3. Update role permissions (grant CAN_CLOSE_SHIFT to OPERATOR as a test)
  const updatedOperatorPerms = [...matrix.rolePermissions.OPERATOR, 'CAN_CLOSE_SHIFT'];
  const putRoleRes = await fetch(`${baseUrl}/admin/permissions/roles`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      role: 'OPERATOR',
      permissions: updatedOperatorPerms
    })
  });
  assert.strictEqual(putRoleRes.status, 200);
  const putRoleJson = await putRoleRes.json() as any;
  assert.strictEqual(putRoleJson.success, true);

  // 4. Update user override for a specific user
  const userOverrideRes = await fetch(`${baseUrl}/admin/permissions/users/2`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      permissions: { CAN_MANAGE_CREW: true }
    })
  });
  assert.strictEqual(userOverrideRes.status, 200);

  // 5. Reset permissions to default
  const resetRes = await fetch(`${baseUrl}/admin/permissions/reset`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(resetRes.status, 200);
  const resetJson = await resetRes.json() as any;
  assert.strictEqual(resetJson.success, true);
  // Default operator should NOT have CAN_CLOSE_SHIFT
  assert.strictEqual(resetJson.rolePermissions.OPERATOR.includes('CAN_CLOSE_SHIFT'), false);
});

test('22. POST /api/admin/reset-app: require admin password confirmation and perform full system reset', async () => {
  // 1. Rejects request without password
  const noPassRes = await fetch(`${baseUrl}/admin/reset-app`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({})
  });
  assert.strictEqual(noPassRes.status, 400);

  // 2. Rejects request with incorrect password
  const wrongPassRes = await fetch(`${baseUrl}/admin/reset-app`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ password: 'WrongPassword123!' })
  });
  assert.strictEqual(wrongPassRes.status, 401);

  // 3. Succeeds with correct admin password (91209966)
  const resetRes = await fetch(`${baseUrl}/admin/reset-app`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ password: '91209966' })
  });
  assert.strictEqual(resetRes.status, 200);
  const resetJson = await resetRes.json() as any;
  assert.strictEqual(resetJson.success, true);

  // 4. Verify only admin user remains in users table
  const usersRes = await fetch(`${baseUrl}/admin/users`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(usersRes.status, 200);
  const usersJson = await usersRes.json() as any;
  assert.strictEqual(usersJson.count, 1);
  assert.strictEqual(usersJson.data[0].role, 'ADMIN');
});

test('23. POST, GET & PATCH /api/shift-handover: create, list with parsed crew/checklist, and accept', async () => {
  // 1. Create shift handover with assigned_crew and checklist_data
  const mockCrew = [
    { key: 'PUMPS_OPERATOR', title: 'Operador de Bombas', operatorName: 'JUAN PEREZ', documentId: '12345678', radioChannel: 'Canal 1' }
  ];
  const mockChecklist = [
    { id: 'CHK-1', title: 'Seguridad e IPERC', status: 'CONFORME', notes: 'Charla 5m OK' }
  ];

  const createRes = await fetch(`${baseUrl}/shift-handover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      shift_code: 'G4_DIA_TEST23',
      date: '2026-10-02',
      shift_type: 'DIA',
      outgoing_supervisor: 'FERNANDEZ ASCURRA DANTE PACO',
      outgoing_dni: '18110964',
      outgoing_role: 'Supervisor de guardia',
      incoming_supervisor: 'ALIAGA CASTAÑEDA EMILIO URIEL',
      incoming_dni: '46593500',
      incoming_role: 'Supervisor de guardia',
      plant_status: 'Operación continua 100% estable',
      tonnage_processed: 24500,
      safety_incidents: 'Cero incidentes',
      pending_tasks: 'Verificar nivel de poza sentina',
      status: 'SUBMITTED',
      assigned_crew: mockCrew,
      checklist_data: mockChecklist
    })
  });
  assert.strictEqual(createRes.status, 201);
  const createJson = await createRes.json() as any;
  assert.strictEqual(createJson.success, true);
  const handoverId = createJson.id;
  assert.ok(handoverId);

  // 2. Fetch all and verify crew and checklist are parsed objects/arrays
  const listRes = await fetch(`${baseUrl}/shift-handover`, { headers: authHeaders() });
  assert.strictEqual(listRes.status, 200);
  const listJson = await listRes.json() as any;
  assert.strictEqual(listJson.success, true);
  const found = listJson.data.find((h: any) => h.id === handoverId);
  assert.ok(found);
  assert.strictEqual(found.shift_code, 'G4_DIA_TEST23');
  assert.strictEqual(found.status, 'SUBMITTED');
  assert.ok(Array.isArray(found.assigned_crew));
  assert.strictEqual(found.assigned_crew[0].operatorName, 'JUAN PEREZ');
  assert.ok(Array.isArray(found.checklist_data));
  assert.strictEqual(found.checklist_data[0].status, 'CONFORME');

  // 3. Accept handover
  const acceptRes = await fetch(`${baseUrl}/shift-handover/${handoverId}/accept`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      incoming_supervisor: 'ALIAGA CASTAÑEDA EMILIO URIEL',
      incoming_dni: '46593500',
      incoming_role: 'Supervisor de guardia'
    })
  });
  assert.strictEqual(acceptRes.status, 200);
  const acceptJson = await acceptRes.json() as any;
  assert.strictEqual(acceptJson.success, true);
});

test('24. GET & PUT /api/admin/plant-parameters: fetch defaults and calibrate plant targets', async () => {
  // 1. Fetch parameters
  const getRes = await fetch(`${baseUrl}/admin/plant-parameters`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(getRes.status, 200);
  const getJson = await getRes.json() as any;
  assert.strictEqual(getJson.success, true);
  assert.ok(getJson.data);
  assert.strictEqual(getJson.data.tonnage_target_shift, 24500);
  assert.strictEqual(getJson.data.tailings_min_freeboard_meters, 2.5);

  // 2. Calibrate parameters
  const putRes = await fetch(`${baseUrl}/admin/plant-parameters`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      tonnage_target_shift: 25000,
      cyclones_target_mesh200_of: 81.5,
      tailings_min_freeboard_meters: 2.8
    })
  });
  assert.strictEqual(putRes.status, 200);
  const putJson = await putRes.json() as any;
  assert.strictEqual(putJson.success, true);
  assert.strictEqual(putJson.data.tonnage_target_shift, 25000);
  assert.strictEqual(putJson.data.cyclones_target_mesh200_of, 81.5);
  assert.strictEqual(putJson.data.tailings_min_freeboard_meters, 2.8);

  // 3. Verify persistence
  const verifyRes = await fetch(`${baseUrl}/admin/plant-parameters`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const verifyJson = await verifyRes.json() as any;
  assert.strictEqual(verifyJson.data.tonnage_target_shift, 25000);
});

test('25. WebSocket: Connect, Register device, and Broadcast Realtime Events in sub-50ms', async () => {
  // 1. Connect Client A (Field Tablet)
  const clientA = new WebSocket(wsUrl);
  const welcomeA = await new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando WELCOME en Client A')), 2000);
    clientA.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'WELCOME') {
          clearTimeout(timeout);
          resolve(msg);
        }
      } catch {}
    });
  });
  assert.strictEqual(welcomeA.type, 'WELCOME');
  assert.ok(welcomeA.serverTime);

  // 2. Register Client A
  clientA.send(JSON.stringify({
    type: 'REGISTER',
    deviceId: 'test_ws_device_tablet',
    deviceName: 'Tablet Terreno Concentradora',
    token: authToken
  }));

  const regA = await new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando REGISTERED en Client A')), 2000);
    clientA.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'REGISTERED') {
          clearTimeout(timeout);
          resolve(msg);
        }
      } catch {}
    });
  });
  assert.strictEqual(regA.type, 'REGISTERED');
  assert.strictEqual(regA.deviceId, 'test_ws_device_tablet');

  // 3. Connect Client B (Control Room PC)
  const clientB = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando OPEN en Client B')), 2000);
    clientB.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  const regBPromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando REGISTERED en Client B')), 2000);
    clientB.on('message', (data) => {
      try {
        if (JSON.parse(data.toString()).type === 'REGISTERED') {
          clearTimeout(timeout);
          resolve();
        }
      } catch {}
    });
  });
  clientB.send(JSON.stringify({
    type: 'REGISTER',
    deviceId: 'test_ws_device_scada',
    deviceName: 'PC Sala de Control',
    token: authToken
  }));
  await regBPromise;

  // 4. Client B listens for incoming real-time broadcast
  const receivedOnBPromise = new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando broadcast en Client B')), 3000);
    clientB.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'EVENT' && msg.event?.entity === 'cyclones') {
          clearTimeout(timeout);
          resolve(msg);
        }
      } catch {}
    });
  });

  // 5. Client A transmits a real-time cyclone operational reading
  const startTs = Date.now();
  clientA.send(JSON.stringify({
    type: 'EVENT',
    event: {
      entity: 'cyclones',
      action: 'CREATE',
      data: { stationId: 'CYC-01', pressure_psi: 19.8, operator: 'Marckv' },
      key: 'basetrack_cyclones_samples'
    }
  }));

  // 6. Verify Client B receives the event with instant sub-50ms latency
  const eventOnB = await receivedOnBPromise;
  const elapsedMs = Date.now() - startTs;
  assert.strictEqual(eventOnB.type, 'EVENT');
  assert.strictEqual(eventOnB.event.entity, 'cyclones');
  assert.strictEqual(eventOnB.event.action, 'CREATE');
  assert.strictEqual(eventOnB.event.data.pressure_psi, 19.8);
  assert.strictEqual(eventOnB.event.deviceId, 'test_ws_device_tablet');
  assert.ok(elapsedMs < 100, `Broadcast latency must be rapid (elapsed: ${elapsedMs}ms)`);

  // 7. Verify sync status endpoint reflects active WebSocket connections
  const statusRes = await fetch(`${baseUrl}/sync/status`);
  assert.strictEqual(statusRes.status, 200);
  const statusJson = await statusRes.json() as any;
  assert.strictEqual(statusJson.success, true);
  assert.ok(statusJson.wsClients >= 2, `Expected >= 2 wsClients, got ${statusJson.wsClients}`);

  // Cleanup client sockets
  clientA.close();
  clientB.close();
});

test('26. Closed Operational Loop: Pumps Falla auto-creates OT, locks pump, and Maintenance Pase restores Operativo', async () => {
  const testDate = '2026-10-15';
  const testShift = 'G1';

  // 1. Operator saves pump sheet marking PU012 as 'Falla'
  const postSheetRes = await fetch(`${baseUrl}/pumps/operational-sheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      report_date: testDate,
      shift_code: testShift,
      operator_name: 'Operador Bombas Test',
      sentina_pumps: [{ tag: 'PU001', status: 'Operativo' }],
      intermedia_pumps: [{ tag: 'PU012', status: 'Falla' }, { tag: 'PU013', status: 'Operativo' }],
      torre5_pumps: [{ tag: 'PU021', status: 'Operativo' }],
      levels: { orca: '12.4', espejo: '3850.2', captacion: '5.1' },
      main_indicators: {},
      pozas_sentina: [],
      additional_obs: {}
    })
  });
  assert.strictEqual(postSheetRes.status, 200);
  const postSheetJson = await postSheetRes.json() as any;
  assert.strictEqual(postSheetJson.success, true);

  // 2. Verify that an OT was automatically created in maintenance
  const maintRes = await fetch(`${baseUrl}/maintenance`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(maintRes.status, 200);
  const maintJson = await maintRes.json() as any;
  const autoTicket = maintJson.data.find((t: any) => t.equipment_tag === 'PU012' && t.status === 'PENDING');
  assert.ok(autoTicket, 'Automatic maintenance ticket for PU012 must exist in PENDING');
  assert.strictEqual(autoTicket.source_module, 'PUMPS_STATION');
  assert.strictEqual(autoTicket.priority, 'HIGH');
  const ticketId = autoTicket.id;

  // 3. Operational Lock Enforcement: Try setting PU012 back to Operativo directly from pumps sheet
  const bypassRes = await fetch(`${baseUrl}/pumps/operational-sheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      report_date: testDate,
      shift_code: testShift,
      operator_name: 'Operador Bombas Test',
      sentina_pumps: [{ tag: 'PU001', status: 'Operativo' }],
      intermedia_pumps: [{ tag: 'PU012', status: 'Operativo' }, { tag: 'PU013', status: 'Operativo' }],
      torre5_pumps: [{ tag: 'PU021', status: 'Operativo' }],
      levels: {},
      main_indicators: {},
      pozas_sentina: [],
      additional_obs: {}
    })
  });
  assert.strictEqual(bypassRes.status, 200);
  const bypassJson = await bypassRes.json() as any;
  const lockedPump = bypassJson.data.intermedia_pumps.find((p: any) => p.tag === 'PU012');
  assert.strictEqual(lockedPump.status, 'Falla', 'Pump must remain locked in Falla while maintenance ticket is active');

  // 4. Maintenance starts work: PATCH status to IN_PROGRESS
  const attendRes = await fetch(`${baseUrl}/maintenance/${ticketId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      status: 'IN_PROGRESS',
      assigned_to: 'Técnico Mecánico Carlos'
    })
  });
  assert.strictEqual(attendRes.status, 200);
  const attendJson = await attendRes.json() as any;
  assert.strictEqual(attendJson.success, true);
  assert.strictEqual(attendJson.data.targetPumpStatus, 'Mantenimiento');

  // Verify sheet now reflects 'Mantenimiento'
  const sheetAfterAttendRes = await fetch(`${baseUrl}/pumps/operational-sheet?date=${testDate}&shift=${testShift}`, { headers: authHeaders() });
  const sheetAfterAttendJson = await sheetAfterAttendRes.json() as any;
  const pumpInMaint = sheetAfterAttendJson.data.intermedia_pumps.find((p: any) => p.tag === 'PU012');
  assert.strictEqual(pumpInMaint.status, 'Mantenimiento', 'Pump must transition to Mantenimiento');

  // 5. Maintenance completes work and grants Pase Operativo: PATCH status to RESOLVED
  const passRes = await fetch(`${baseUrl}/maintenance/${ticketId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      status: 'RESOLVED',
      operational_pass_by: 'Supervisor Mantenimiento Manuel',
      resolution_notes: 'Cambio de impulsor y prueba hidrostática exitosa'
    })
  });
  assert.strictEqual(passRes.status, 200);
  const passJson = await passRes.json() as any;
  assert.strictEqual(passJson.success, true);
  assert.strictEqual(passJson.data.targetPumpStatus, 'Operativo');
  assert.strictEqual(passJson.data.operational_pass_by, 'Supervisor Mantenimiento Manuel');

  // Verify sheet now reflects 'Operativo'
  const finalSheetRes = await fetch(`${baseUrl}/pumps/operational-sheet?date=${testDate}&shift=${testShift}`, { headers: authHeaders() });
  const finalSheetJson = await finalSheetRes.json() as any;
  const restoredPump = finalSheetJson.data.intermedia_pumps.find((p: any) => p.tag === 'PU012');
  assert.strictEqual(restoredPump.status, 'Operativo', 'Pump must be restored to Operativo following maintenance pass');
});

test('27. Dynamic Mining Truck Fleet: Create truck, update plate/data, create checklist, dar de baja and reactivate without touching code', async () => {
  // 1. Alta de camioneta CAM-05 / BCV123
  const createTruckRes = await fetch(`${baseUrl}/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      plate: 'BCV123',
      tag: 'CAM-05',
      model: 'Toyota Hilux 4x4 Turbodiésel',
      color: 'Blanco Industrial',
      area: 'Operaciones Mina / Relaves',
      baseOdometer: 15400,
      is_active: 1
    })
  });
  assert.strictEqual(createTruckRes.status, 201);
  const createTruckJson = await createTruckRes.json() as any;
  assert.strictEqual(createTruckJson.success, true);
  assert.strictEqual(createTruckJson.data.plate, 'BCV123');
  const truckId = createTruckJson.data.id;

  // 2. Summary should now include 5 active trucks
  const summaryRes = await fetch(`${baseUrl}/vehicles/summary`, { headers: authHeaders() });
  const summaryJson = await summaryRes.json() as any;
  assert.strictEqual(summaryJson.success, true);
  assert.strictEqual(summaryJson.data.length, 5);
  const hasBCV123 = summaryJson.data.find((v: any) => v.plate === 'BCV123');
  assert.ok(hasBCV123);
  assert.strictEqual(hasBCV123.tag, 'CAM-05');

  // 3. Update plate to BCV124 and tag to CAM-05B
  const updateRes = await fetch(`${baseUrl}/vehicles/${truckId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      plate: 'BCV124',
      tag: 'CAM-05B',
      model: 'Toyota Hilux 4x4 Turbodiésel V6',
      area: 'Operaciones Mina / Relaves',
      baseOdometer: 15500
    })
  });
  assert.strictEqual(updateRes.status, 200);
  const updateJson = await updateRes.json() as any;
  assert.strictEqual(updateJson.success, true);
  assert.strictEqual(updateJson.data.plate, 'BCV124');

  // 4. Create checklist for the newly added and updated truck BCV124
  const chkRes = await fetch(`${baseUrl}/vehicles/checklists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      vehicle_plate: 'BCV124',
      date: '2026-10-11',
      time: '08:00',
      shift: 'G2',
      shift_type: 'DIA',
      driver_name: 'OPERADOR CAMIONETA TEST',
      driver_dni: '70809012',
      odometer: 15650,
      items: [
        { code: 'LUCES', name: 'Luces principales', status: 'B' }
      ],
      operational_status: 'APTO'
    })
  });
  assert.strictEqual(chkRes.status, 201);
  const chkJson = await chkRes.json() as any;
  assert.strictEqual(chkJson.success, true);

  // 5. Dar de baja camioneta (is_active = 0)
  const deactivateRes = await fetch(`${baseUrl}/vehicles/${truckId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ is_active: 0 })
  });
  assert.strictEqual(deactivateRes.status, 200);
  const deactivateJson = await deactivateRes.json() as any;
  assert.strictEqual(deactivateJson.is_active, 0);

  // 6. Creating a new checklist for a deactivated truck must be rejected
  const rejectedChkRes = await fetch(`${baseUrl}/vehicles/checklists`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      vehicle_plate: 'BCV124',
      date: '2026-10-11',
      time: '09:00',
      shift: 'G2',
      shift_type: 'DIA',
      driver_name: 'OPERADOR RECHAZADO',
      driver_dni: '70809012',
      odometer: 15700
    })
  });
  assert.strictEqual(rejectedChkRes.status, 400);

  // 7. Reactivate truck (is_active = 1)
  const reactivateRes = await fetch(`${baseUrl}/vehicles/${truckId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ is_active: 1 })
  });
  assert.strictEqual(reactivateRes.status, 200);
  const reactivateJson = await reactivateRes.json() as any;
  assert.strictEqual(reactivateJson.is_active, 1);
});

test('28. POST /api/admin/broadcast-update should broadcast real-time update signal to all connected clients', async () => {
  const updateRes = await fetch(`${baseUrl}/admin/broadcast-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      version: '1.1.0',
      message: 'Actualización en tiempo real desplegada'
    })
  });

  assert.strictEqual(updateRes.status, 200);
  const updateJson = await updateRes.json() as any;
  assert.strictEqual(updateJson.success, true);
  assert.strictEqual(updateJson.version, '1.1.0');
});

test('29. Security: data reads and cloud sync reject anonymous requests (401)', async () => {
  const protectedReads = [
    '/dashboard/metrics', '/pumps', '/pumps/operational-sheet', '/cyclones', '/cyclones/station-samples',
    '/tailings', '/shift-handover', '/maintenance', '/vehicles/summary', '/vehicles/checklists', '/sync/pull'
  ];
  for (const path of protectedReads) {
    const res = await fetch(`${baseUrl}${path}`);
    assert.strictEqual(res.status, 401, `GET ${path} debe exigir token`);
  }

  const pushRes = await fetch(`${baseUrl}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: 'anon_device',
      events: [{ entity: 'AUTH', action: 'FORCE_LOGOUT', payload: { deviceId: 'victim' }, timestamp: Date.now() }]
    })
  });
  assert.strictEqual(pushRes.status, 401);

  // /sync/status permanece público para pruebas de conectividad
  const statusRes = await fetch(`${baseUrl}/sync/status`);
  assert.strictEqual(statusRes.status, 200);
});

test('30. Security: non-admin users cannot emit reserved sync actions nor escalate by username', async () => {
  const operatorToken = generateToken({
    userId: 'test_operator_no_db',
    username: 'admin',
    role: 'OPERATOR',
    shift: 'G1',
    fullName: 'Operador de Prueba'
  });

  const pushRes = await fetch(`${baseUrl}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${operatorToken}` },
    body: JSON.stringify({
      deviceId: 'operator_device',
      events: [{ entity: 'AUTH', action: 'FORCE_LOGOUT', payload: { deviceId: 'victim' }, timestamp: Date.now() }]
    })
  });
  assert.strictEqual(pushRes.status, 403);

  // Un operador llamado 'admin' no obtiene privilegios de ADMIN
  const backupRes = await fetch(`${baseUrl}/admin/backup`, {
    headers: { 'Authorization': `Bearer ${operatorToken}` }
  });
  assert.strictEqual(backupRes.status, 403);
});

test('31. Security: unauthenticated WebSocket clients cannot receive nor emit realtime events', async () => {
  const anon = new WebSocket(wsUrl);
  const received: any[] = [];
  anon.on('message', (data) => {
    try { received.push(JSON.parse(data.toString())); } catch {}
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando OPEN')), 2000);
    anon.on('open', () => { clearTimeout(timeout); resolve(); });
  });

  anon.send(JSON.stringify({ type: 'REGISTER', deviceId: 'anon_ws', deviceName: 'Anon', username: 'Marckv' }));
  anon.send(JSON.stringify({ type: 'EVENT', event: { entity: 'AUTH', action: 'FORCE_LOGOUT', payload: {} } }));

  // Un evento legítimo emitido por el servidor no debe llegar al socket anónimo
  await fetch(`${baseUrl}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      deviceId: 'admin_device_ws_check',
      events: [{ entity: 'pumps', action: 'UPDATE', payload: { key: 'basetrack_pumps_telemetry', data: [] }, timestamp: Date.now() }]
    })
  });
  await new Promise(r => setTimeout(r, 200));

  const types = received.map(m => m.type);
  assert.ok(types.includes('UNAUTHORIZED'), 'REGISTER sin token debe responder UNAUTHORIZED');
  assert.ok(!types.includes('REGISTERED'), 'REGISTER sin token no debe registrarse');
  assert.ok(!types.includes('EVENT'), 'Un socket anónimo no debe recibir eventos');
  anon.close();
});

test('32. Security: sync events never store or relay passwords', async () => {
  const pushRes = await fetch(`${baseUrl}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      deviceId: 'device_secret_check',
      events: [{
        entity: 'users_registry',
        action: 'SET',
        payload: { key: 'basetrack_users_registry', data: { marckv: { username: 'Marckv', password: 'SuperSecreta123' } } },
        timestamp: Date.now()
      }]
    })
  });
  assert.strictEqual(pushRes.status, 200);

  const pullRes = await fetch(`${baseUrl}/sync/pull?sinceId=0&deviceId=another_device`, { headers: authHeaders() });
  const pullJson = await pullRes.json() as any;
  const raw = JSON.stringify(pullJson.events);
  assert.ok(raw.includes('users_registry'), 'El evento debe existir');
  assert.ok(!raw.includes('SuperSecreta123'), 'La contraseña no debe almacenarse');
  assert.ok(!raw.includes('"password"'), 'El campo password no debe almacenarse');
});

test('33. Security: Reset App rejects the former public master passwords', async () => {
  for (const masterPassword of ['Basetrack2026!']) {
    const res = await fetch(`${baseUrl}/admin/reset-app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ password: masterPassword })
    });
    assert.strictEqual(res.status, 401, `Reset App no debe aceptar ${masterPassword}`);
  }
});

test('34. Bulk import assigns random temporary passwords that must be changed on first login', async () => {
  const ts = Date.now();
  const username = `op_temp_${ts}`;
  const bulkRes = await fetch(`${baseUrl}/admin/bulk-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      users: [
        { username, full_name: 'TEST TEMPORAL', email: `${username}@test.com`, role: 'OPERATOR', shift: 'G2', document_id: `81${ts.toString().slice(-6)}` },
        // La contraseña pública de la plantilla se ignora y se reemplaza por una aleatoria
        { username: `${username}_b`, full_name: 'TEST TEMPORAL B', email: `${username}_b@test.com`, password: 'Basetrack2026!', role: 'OPERATOR', shift: 'G2', document_id: `82${ts.toString().slice(-6)}` }
      ]
    })
  });
  assert.strictEqual(bulkRes.status, 201);
  const bulkJson = await bulkRes.json() as any;
  assert.strictEqual(bulkJson.temporaryCredentials.length, 2);
  const temp = bulkJson.temporaryCredentials.find((c: any) => c.username === username).temporaryPassword;
  assert.match(temp, /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);

  // La contraseña pública ya no sirve
  const publicLogin = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `${username}_b`, password: 'Basetrack2026!' })
  });
  assert.strictEqual(publicLogin.status, 401);

  // Con la temporal entra, pero marcado para cambiarla
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: temp })
  });
  assert.strictEqual(loginRes.status, 200);
  const loginJson = await loginRes.json() as any;
  assert.strictEqual(loginJson.user.mustChangePassword, true);
  const opHeaders = { 'Authorization': `Bearer ${loginJson.token}` };

  // Todo bloqueado salvo perfil y cambio de contraseña
  const blocked = await fetch(`${baseUrl}/pumps`, { headers: opHeaders });
  assert.strictEqual(blocked.status, 403);
  assert.strictEqual(((await blocked.json()) as any).code, 'PASSWORD_CHANGE_REQUIRED');
  const me = await fetch(`${baseUrl}/auth/me`, { headers: opHeaders });
  assert.strictEqual(me.status, 200);
  assert.strictEqual(((await me.json()) as any).user.mustChangePassword, true);

  // No acepta una contraseña pública como definitiva
  const weak = await fetch(`${baseUrl}/auth/change-password`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...opHeaders },
    body: JSON.stringify({ currentPassword: temp, newPassword: 'Basetrack2026!' })
  });
  assert.strictEqual(weak.status, 400);

  const change = await fetch(`${baseUrl}/auth/change-password`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...opHeaders },
    body: JSON.stringify({ currentPassword: temp, newPassword: 'NuevaClaveSegura#2026' })
  });
  assert.strictEqual(change.status, 200);

  const unblocked = await fetch(`${baseUrl}/pumps`, { headers: opHeaders });
  assert.strictEqual(unblocked.status, 200);
});

test('35. Admin password reset generates a temporary password (never the DNI) and forces a change', async () => {
  const usersRes = await fetch(`${baseUrl}/admin/users`, { headers: authHeaders() });
  const users = ((await usersRes.json()) as any).data as any[];
  const target = users.find(u => u.role !== 'ADMIN');
  assert.ok(target, 'Debe existir un usuario no administrador');

  const resetRes = await fetch(`${baseUrl}/admin/users/${target.id}/reset-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ newPassword: '' })
  });
  assert.strictEqual(resetRes.status, 200);
  const resetJson = await resetRes.json() as any;
  assert.match(resetJson.temporaryPassword, /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  assert.notStrictEqual(resetJson.temporaryPassword, target.document_id);

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: target.username, password: resetJson.temporaryPassword })
  });
  assert.strictEqual(((await loginRes.json()) as any).user.mustChangePassword, true);
});

test('36. Pump Shift Closure and History: closes shift with station availability metrics and retrieves history', async () => {
  const payload = {
    report_date: '2026-10-14',
    shift_code: 'G1',
    operator_name: 'Marckv Admin',
    sentina_pumps: [
      { tag: 'PU001', status: 'Operativo' },
      { tag: 'PU002', status: 'Operativo' },
      { tag: 'PU003', status: 'Operativo' },
      { tag: 'PU004', status: 'Operativo' },
      { tag: 'PU005', status: 'Operativo' },
      { tag: 'PU006', status: 'Operativo' },
      { tag: 'PU007', status: 'Operativo' },
      { tag: 'PU008', status: 'Stand by' }
    ],
    intermedia_pumps: [
      { tag: 'PU011', status: 'Operativo' },
      { tag: 'PU012', status: 'Operativo' },
      { tag: 'PU013', status: 'Operativo' },
      { tag: 'PU014', status: 'Operativo' },
      { tag: 'PU015', status: 'Operativo' },
      { tag: 'PU016', status: 'Falla' }
    ],
    torre5_pumps: [
      { tag: 'PU021', status: 'Operativo' },
      { tag: 'PU022', status: 'Operativo' },
      { tag: 'PU023', status: 'Operativo' },
      { tag: 'PU024', status: 'Operativo' },
      { tag: 'PU025', status: 'Operativo' },
      { tag: 'PU026', status: 'Operativo' },
      { tag: 'PU027', status: 'Operativo' },
      { tag: 'PU028', status: 'Operativo' },
      { tag: 'PU029', status: 'Operativo' },
      { tag: 'PU030', status: 'Mantenimiento' }
    ],
    main_indicators: {
      ph_aforador: '7.85',
      ph_cortafugas: '8.10',
      bombeo_turno_intermedia: '2450.5'
    },
    notes: 'Cierre de turno de prueba con 21 bombas operativas'
  };

  const closeRes = await fetch(`${baseUrl}/pumps/shift-closure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });

  assert.strictEqual(closeRes.status, 200);
  const closeJson = await closeRes.json() as any;
  assert.strictEqual(closeJson.success, true);
  assert.strictEqual(closeJson.data.sentina_operating, 7);
  assert.strictEqual(closeJson.data.sentina_total, 8);
  assert.strictEqual(closeJson.data.sentina_availability_pct, 87.5);
  assert.strictEqual(closeJson.data.intermedia_operating, 5);
  assert.strictEqual(closeJson.data.intermedia_total, 6);
  assert.strictEqual(closeJson.data.intermedia_availability_pct, 83.3);
  assert.strictEqual(closeJson.data.torre5_operating, 9);
  assert.strictEqual(closeJson.data.torre5_total, 10);
  assert.strictEqual(closeJson.data.torre5_availability_pct, 90.0);
  assert.strictEqual(closeJson.data.overall_operating, 21);
  assert.strictEqual(closeJson.data.overall_total, 24);
  assert.strictEqual(closeJson.data.overall_availability_pct, 87.5);
  assert.strictEqual(closeJson.data.ph_aforador, 7.85);
  assert.strictEqual(closeJson.data.ph_cortafugas, 8.1);
  assert.strictEqual(closeJson.data.bombeo_intermedia, 2450.5);

  // Retrieve history
  const historyRes = await fetch(`${baseUrl}/pumps/shift-history`, {
    headers: authHeaders()
  });
  assert.strictEqual(historyRes.status, 200);
  const historyJson = await historyRes.json() as any;
  assert.strictEqual(historyJson.success, true);
  assert.ok(historyJson.count >= 1);
  assert.ok(historyJson.summary.avg_overall_pct > 0);
  assert.strictEqual(historyJson.summary.avg_ph_aforador, 7.85);
});

test('37. Security: login only trusts the stored hash (no hardcoded admin master passwords)', async () => {
  const login = (username: string, password: string) => fetch(`${baseUrl}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const admin = db.prepare("SELECT id, password_hash FROM users WHERE username = 'Marckv'").get() as { id: string; password_hash: string };
  const originalHash = admin.password_hash;
  try {
    // Simula que el administrador cambió su contraseña
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync('AdminRotada#2026', 10), admin.id);

    for (const legacy of ['91209966', '123456']) {
      const res = await login('Marckv', legacy);
      assert.strictEqual(res.status, 401, `El login de admin no debe aceptar la contraseña fija ${legacy}`);
    }
    assert.strictEqual((await login('Marckv', 'AdminRotada#2026')).status, 200);
  } finally {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(originalHash, admin.id);
  }
});

test('38. Security: operators cannot log in using their DNI as password', async () => {
  const ts = Date.now();
  const username = `op_dni_${ts}`;
  const dni = `83${ts.toString().slice(-6)}`;
  const bulkRes = await fetch(`${baseUrl}/admin/bulk-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      users: [{ username, full_name: `TEST DNI ${ts}`, email: `${username}@test.com`, role: 'OPERATOR', shift: 'G3', document_id: dni }]
    })
  });
  assert.strictEqual(bulkRes.status, 201);

  for (const identifier of [username, dni]) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, password: dni })
    });
    assert.strictEqual(res.status, 401, `El DNI no debe servir como contraseña (identificador: ${identifier})`);
  }
});

test('39. Security: restarting the server does not reset the admin password hash', async () => {
  const admin = db.prepare("SELECT id, password_hash FROM users WHERE username = 'Marckv'").get() as { id: string; password_hash: string };
  const originalHash = admin.password_hash;
  try {
    const rotatedHash = bcrypt.hashSync('AdminRotada#2026', 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(rotatedHash, admin.id);

    initDatabase(); // mismo camino que un reinicio / deploy

    const after = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(admin.id) as { password_hash: string };
    assert.strictEqual(after.password_hash, rotatedHash, 'initDatabase no debe sobrescribir la contraseña del admin');
    assert.strictEqual(bcrypt.compareSync('91209966', after.password_hash), false);
  } finally {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(originalHash, admin.id);
  }
});

test('40. Security: default maintenance account must change its public password', async () => {
  initDatabase();
  const maint = db.prepare("SELECT id FROM users WHERE username = 'mantenimiento'").get() as { id: string } | undefined;
  assert.ok(maint, 'la cuenta mantenimiento debe existir');

  // Simula una cuenta creada antes del arreglo (sin cambio obligatorio)
  db.prepare('UPDATE users SET must_change_password = 0, password_hash = ? WHERE id = ?').run(bcrypt.hashSync('mantenimiento123', 10), maint!.id);
  initDatabase();
  const after = db.prepare('SELECT must_change_password FROM users WHERE id = ?').get(maint!.id) as { must_change_password: number };
  assert.strictEqual(after.must_change_password, 1);
});

test('41. Maintenance Lifecycle: MAINTENANCE role permissions, tag normalization, and DELETE with un-lock', async () => {
  const maintToken = generateToken({
    id: 'test-maint-id',
    username: 'mantenimiento_tester',
    role: 'MAINTENANCE',
    fullName: 'Tecnico Mantenimiento'
  });

  // 1. Role MAINTENANCE should be able to create a ticket (has CAN_RECORD_DATA)
  const createRes = await fetch(`${baseUrl}/maintenance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${maintToken}`
    },
    body: JSON.stringify({
      equipment_tag: 'pu025',
      title: 'Cambio de empaquetadura prensaestopa',
      description: 'Goteo excesivo de agua de sello',
      priority: 'HIGH'
    })
  });

  assert.strictEqual(createRes.status, 201);
  const createData = await createRes.json() as any;
  assert.strictEqual(createData.success, true);
  const createdId = createData.id;

  // 2. Verify tag was normalized to uppercase PU025
  const getRes = await fetch(`${baseUrl}/maintenance`, {
    headers: { 'Authorization': `Bearer ${maintToken}` }
  });
  const getData = await getRes.json() as any;
  const createdTicket = getData.data.find((t: any) => t.id === createdId);
  assert.ok(createdTicket);
  assert.strictEqual(createdTicket.equipment_tag, 'PU025');

  // 3. User with MAINTENANCE role (lacking CAN_DELETE_RECORDS) cannot delete
  const forbidDeleteRes = await fetch(`${baseUrl}/maintenance/${createdId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${maintToken}` }
  });
  assert.strictEqual(forbidDeleteRes.status, 403);

  // 4. Admin (with CAN_DELETE_RECORDS) can delete ticket successfully
  const adminDeleteRes = await fetch(`${baseUrl}/maintenance/${createdId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  assert.strictEqual(adminDeleteRes.status, 200);
  const deleteData = await adminDeleteRes.json() as any;
  assert.strictEqual(deleteData.success, true);
});

test('42. Pase Operativo: OPERATOR no puede resolver una OT, MAINTENANCE sí (CLAUDE.md §3.4)', async () => {
  const operatorToken = generateToken({
    username: 'operador_pase_tester',
    role: 'OPERATOR',
    shift: 'G1',
    fullName: 'Operador Pase Tester'
  } as any);
  const maintToken = generateToken({
    username: 'mantenimiento_pase_tester',
    role: 'MAINTENANCE',
    shift: 'GENERAL',
    fullName: 'Tecnico Pase Tester'
  } as any);

  const createRes = await fetch(`${baseUrl}/maintenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      equipment_tag: 'PU042',
      title: 'Falla de sello mecánico',
      description: 'Fuga en sello de bomba slurry',
      priority: 'HIGH'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const ticketId = ((await createRes.json()) as any).id;
  assert.ok(ticketId);

  const resolve = (token: string) => fetch(`${baseUrl}/maintenance/${ticketId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ status: 'RESOLVED', resolution_notes: 'Sello reemplazado' })
  });

  // 1. El operador tiene CAN_RECORD_DATA, pero no puede emitir el Pase Operativo
  const operatorRes = await resolve(operatorToken);
  assert.strictEqual(operatorRes.status, 403);
  const afterOperator = db.prepare('SELECT status, operational_pass_by FROM maintenance_requests WHERE id = ?').get(ticketId) as any;
  assert.strictEqual(afterOperator.status, 'PENDING');
  assert.ok(!afterOperator.operational_pass_by);

  // 2. Mantenimiento sí lo emite y queda registrado quién firmó el pase
  const maintRes = await resolve(maintToken);
  assert.strictEqual(maintRes.status, 200);
  const afterMaint = db.prepare('SELECT status, operational_pass_by, operational_pass_at FROM maintenance_requests WHERE id = ?').get(ticketId) as any;
  assert.strictEqual(afterMaint.status, 'RESOLVED');
  assert.strictEqual(afterMaint.operational_pass_by, 'Tecnico Pase Tester');
  assert.ok(afterMaint.operational_pass_at);
});

test('43. Validación de lecturas y del administrador fantasma (relaves, ciclones, relevo)', async () => {
  const post = (path: string, body: unknown) => fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });

  // Relaves: estado de línea fuera del catálogo y borde libre negativo se rechazan con 400 (no 500)
  assert.strictEqual((await post('/tailings', { station_tag: 'DESC-01', pumping_line_status: 'ROTO' })).status, 400);
  assert.strictEqual((await post('/tailings', { station_tag: 'DESC-01', pumping_line_status: 'NORMAL', freeboard_meters: -1 })).status, 400);
  assert.strictEqual((await post('/tailings', { station_tag: 'DESC-01', pumping_line_status: 'NORMAL', freeboard_meters: 'abc' })).status, 400);
  assert.strictEqual((await post('/tailings', { station_tag: 'DESC-01', pumping_line_status: 'NORMAL', solids_percentage: 150 })).status, 400);
  assert.strictEqual((await post('/tailings', { station_tag: 'DESC-01', pumping_line_status: 'ALERT', freeboard_meters: 0.8 })).status, 201);

  // Ciclones: % -200M debe estar entre 0 y 100
  const sample = { sample_time: '08:00', battery_tag: 'BATERÍA D', mesh200_uf: 120 };
  assert.strictEqual((await post('/cyclones/station-samples', sample)).status, 400);
  assert.strictEqual((await post('/cyclones/station-samples', { ...sample, mesh200_uf: 14.5 })).status, 201);

  // Relevo: Marckv nunca figura como supervisor, ni implícitamente por ser quien registra
  const adminRow = db.prepare("SELECT full_name FROM users WHERE LOWER(username) = 'marckv'").get() as { full_name: string };
  const implicitAdmin = await post('/shift-handover', { shift_code: 'G1_TEST43', shift_type: 'DIA', incoming_supervisor: 'SUPERVISOR ENTRANTE 43' });
  assert.strictEqual(implicitAdmin.status, 400);
  const explicitAdmin = await post('/shift-handover', { shift_code: 'G1_TEST43', shift_type: 'DIA', outgoing_supervisor: 'SUPERVISOR SALIENTE 43', incoming_supervisor: adminRow.full_name });
  assert.strictEqual(explicitAdmin.status, 400);
  const valid = await post('/shift-handover', { shift_code: 'G1_TEST43', shift_type: 'DIA', outgoing_supervisor: 'SUPERVISOR SALIENTE 43', incoming_supervisor: 'SUPERVISOR ENTRANTE 43' });
  assert.strictEqual(valid.status, 201);
});

// --- Revocación y suspensión aplicadas en el servidor (token_version + cierre de sockets) ---

function createRealTestUser(username: string, password: string): string {
  const id = `test_${username}`;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, full_name, role, shift, must_change_password)
    VALUES (?, ?, ?, ?, ?, 'OPERATOR', 'G1', 0)
  `).run(id, username, `${username}@test.local`, bcrypt.hashSync(password, 4), username.toUpperCase());
  return id;
}

async function loginAs(username: string, password: string, deviceId?: string): Promise<Response> {
  return fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(deviceId ? { 'X-Device-Id': deviceId } : {}) },
    body: JSON.stringify({ username, password })
  });
}

/** Abre un socket, lo registra y resuelve con el socket, sus mensajes y una promesa de cierre */
async function openRegisteredSocket(token: string, deviceId: string) {
  const ws = new WebSocket(wsUrl);
  const messages: any[] = [];
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  const registered = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando respuesta a REGISTER')), 2000);
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        messages.push(msg);
        if (msg.type === 'REGISTERED' || msg.type === 'UNAUTHORIZED') { clearTimeout(timeout); resolve(msg.type); }
      } catch {}
    });
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout esperando OPEN')), 2000);
    ws.on('open', () => { clearTimeout(timeout); resolve(); });
  });
  ws.send(JSON.stringify({ type: 'REGISTER', deviceId, deviceName: 'Terminal de prueba', token }));
  return { ws, messages, closed, result: await registered };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms))]);
}

test('44. Security: revoking a device invalidates the old JWT, closes its socket, and a new login re-enables it', async () => {
  const username = 'operador_revocado_tester';
  const password = 'ClaveRevocacion#2026';
  const deviceId = 'tablet_revocada_44';
  createRealTestUser(username, password);

  const loginRes = await loginAs(username, password, deviceId);
  assert.strictEqual(loginRes.status, 200);
  const oldToken = ((await loginRes.json()) as any).token;

  const sock = await openRegisteredSocket(oldToken, deviceId);
  assert.strictEqual(sock.result, 'REGISTERED');
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { 'Authorization': `Bearer ${oldToken}` } })).status, 200);

  const revokeRes = await fetch(`${baseUrl}/admin/devices/${deviceId}/revoke`, { method: 'POST', headers: authHeaders() });
  assert.strictEqual(revokeRes.status, 200);

  // El servidor cierra el canal sin depender de que el cliente respete FORCE_LOGOUT
  assert.strictEqual(await withTimeout(sock.closed, 2000, 'El socket revocado no fue cerrado'), 4001);
  assert.ok(sock.messages.some(m => m.type === 'EVENT' && m.event?.action === 'FORCE_LOGOUT'));

  // El JWT anterior ya no sirve en REST (con o sin la cabecera de la terminal) ni para re-registrar el socket
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { 'Authorization': `Bearer ${oldToken}` } })).status, 401);
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { 'Authorization': `Bearer ${oldToken}`, 'X-Device-Id': deviceId } })).status, 401);
  const retry = await openRegisteredSocket(oldToken, deviceId);
  assert.strictEqual(retry.result, 'UNAUTHORIZED');
  retry.ws.close();

  // La terminal revocada tampoco sirve con el token del Administrador, hasta un nuevo inicio de sesión
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { ...authHeaders(), 'X-Device-Id': deviceId } })).status, 401);

  // Un nuevo login desde la misma terminal la rehabilita
  const relogin = await loginAs(username, password, deviceId);
  assert.strictEqual(relogin.status, 200);
  const newToken = ((await relogin.json()) as any).token;
  const row = db.prepare('SELECT is_revoked FROM connected_devices WHERE device_id = ?').get(deviceId) as { is_revoked: number };
  assert.strictEqual(row.is_revoked, 0);
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { 'Authorization': `Bearer ${newToken}`, 'X-Device-Id': deviceId } })).status, 200);
  const fresh = await openRegisteredSocket(newToken, deviceId);
  assert.strictEqual(fresh.result, 'REGISTERED');
  fresh.ws.close();
});

test('45. Security: suspending a user closes their sockets and their old JWT stays invalid after reactivation', async () => {
  const username = 'operador_suspendido_tester';
  const password = 'ClaveSuspension#2026';
  const userId = createRealTestUser(username, password);

  const loginRes = await loginAs(username, password, 'tablet_suspendida_45');
  const oldToken = ((await loginRes.json()) as any).token;
  const sock = await openRegisteredSocket(oldToken, 'tablet_suspendida_45');
  assert.strictEqual(sock.result, 'REGISTERED');

  const suspend = await fetch(`${baseUrl}/admin/users/${userId}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ isActive: false })
  });
  assert.strictEqual(suspend.status, 200);
  assert.strictEqual(await withTimeout(sock.closed, 2000, 'El socket del usuario suspendido no fue cerrado'), 4001);
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { 'Authorization': `Bearer ${oldToken}` } })).status, 403);

  const reactivate = await fetch(`${baseUrl}/admin/users/${userId}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ isActive: true })
  });
  assert.strictEqual(reactivate.status, 200);
  // Reactivar no resucita el token emitido antes de la suspensión
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { 'Authorization': `Bearer ${oldToken}` } })).status, 401);
  const relogin = await loginAs(username, password);
  assert.strictEqual(relogin.status, 200);
});

test('46. Security: password change and admin reset invalidate previously issued JWTs', async () => {
  const username = 'operador_clave_tester';
  const password = 'ClaveOriginal#2026';
  const userId = createRealTestUser(username, password);

  const oldToken = ((await (await loginAs(username, password)).json()) as any).token;
  const change = await fetch(`${baseUrl}/auth/change-password`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${oldToken}` },
    body: JSON.stringify({ currentPassword: password, newPassword: 'ClaveNueva#2026x' })
  });
  assert.strictEqual(change.status, 200);
  const changedToken = ((await change.json()) as any).token;
  assert.ok(changedToken, 'El cambio de contraseña devuelve un token vigente');
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { 'Authorization': `Bearer ${oldToken}` } })).status, 401);
  assert.strictEqual((await fetch(`${baseUrl}/pumps`, { headers: { 'Authorization': `Bearer ${changedToken}` } })).status, 200);

  const reset = await fetch(`${baseUrl}/admin/users/${userId}/reset-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({})
  });
  assert.strictEqual(reset.status, 200);
  assert.strictEqual((await fetch(`${baseUrl}/auth/me`, { headers: { 'Authorization': `Bearer ${changedToken}` } })).status, 401);
});

test.after(async () => {
  // Purge any test users or links created during testing and restore clean slate
  try {
    purgeAndSetSoleAdmin();
  } catch (e) {
    // Ignore cleanup errors
  }
  closeWebSocketServer();
  if (server) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});


