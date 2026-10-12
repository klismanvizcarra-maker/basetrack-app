import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const versionFilePath = path.join(rootDir, 'public', 'version.json');
const pkgPath = path.join(rootDir, 'package.json');

let pkg = { version: '1.1.0' };
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
} catch (e) {
  // fallback
}

let existing = {
  title: 'BASETRACK APP - Monitoreo Operacional Minero',
  description: 'Sistema operacional en tiempo real para faena industrial y relaves mineros.'
};

if (fs.existsSync(versionFilePath)) {
  try {
    existing = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
  } catch (e) {
    // fallback
  }
}

const now = new Date();
const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '.');
const timeMs = now.getTime();
const buildSuffix = Math.floor(timeMs / 1000).toString(36);

const newVersionData = {
  version: pkg.version || existing.version || '1.1.0',
  build: `${dateStr}.b${buildSuffix}`,
  buildTime: timeMs,
  releaseDate: now.toISOString(),
  title: existing.title || 'BASETRACK APP - Auto-Actualización en Tiempo Real',
  description: existing.description || 'Despliegue en producción con sincronización reactiva y PWA.'
};

fs.writeFileSync(versionFilePath, JSON.stringify(newVersionData, null, 2) + '\n', 'utf8');
console.log(`[Version Generator] public/version.json actualizado: Build ${newVersionData.build} (${new Date(timeMs).toLocaleString()})`);
