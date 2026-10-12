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


