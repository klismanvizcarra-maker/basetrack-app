/**
 * Aislamiento del entorno de pruebas.
 *
 * Se precarga con `--import` antes que cualquier módulo de la suite, para que
 * `src/database/db.ts` abra una base SQLite temporal y desechable en lugar de
 * `server/data/basetrack.db`. Sin esto, cada `npm run backend:test` ejecutaba
 * `purgeAndSetSoleAdmin()` sobre la base de desarrollo real y la dejaba vacía.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'basetrack-test-'));

process.env.DB_PATH = path.join(tempDir, 'basetrack.test.db');
process.env.NODE_ENV = 'test';

process.on('exit', () => {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // El sistema operativo limpia el directorio temporal si falla aquí
  }
});
