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
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
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
  assert.strictEqual(data.user.username, 'admin');
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
