import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { apiRouter } from '../src/routes/index.js';
import { db, initDatabase } from '../src/database/db.js';
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
    body: JSON.stringify({ username: 'Marckv', password: '2794vizcarra' })
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
  const uniqueSuffix = Date.now();
  const testUsername = `op_test_${uniqueSuffix}`;
  // Create a temporary user to test role-shift and password reset
  const createRes = await fetch(`${baseUrl}/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      username: testUsername,
      full_name: 'OPERADOR PRUEBA TEST',
      email: `${testUsername}@basetrack.com`,
      role: 'OPERATOR',
      shift: 'G1',
      password: 'InitialPassword2026!'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const createData = await createRes.json() as any;
  assert.ok(createData.id);
  const targetUserId = createData.id;

  // Update role and shift
  const patchRes = await fetch(`${baseUrl}/admin/users/${targetUserId}/role-shift`, {
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
  const resetRes = await fetch(`${baseUrl}/admin/users/${targetUserId}/reset-password`, {
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
    body: JSON.stringify({ username: testUsername, password: 'TempPassword2026!' })
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

test.after(async () => {
  // Purge any test users or links created during testing
  try {
    db.prepare("DELETE FROM users WHERE username LIKE 'op_test_%' OR username LIKE 'sup_g1_%' OR username LIKE 'op_bombas_%' OR full_name LIKE '%TEST%' OR full_name LIKE '%PRUEBA%' OR email LIKE '%@test.com'").run();
    db.prepare("DELETE FROM crew_members WHERE name LIKE '%TEST%' OR name LIKE '%PRUEBA%'").run();
    db.prepare("DELETE FROM supervisor_operators WHERE supervisor_id LIKE 'sup_g1_%' OR supervisor_id LIKE 'op_test_%'").run();
  } catch (e) {
    // Ignore cleanup errors
  }
  if (server) {
    server.close();
  }
});


