import path from 'node:path';
import fs from 'node:fs';
import { db, dbFilePath } from './db.js';

// Los respaldos se guardan junto a la base activa (en producción, dentro del disco persistente)
const backupsDir = path.join(path.dirname(dbFilePath), 'backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Generación de timestamp seguro en hora local de faena (UTC-5)
const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const backupFileName = `basetrack_backup_${timestamp}.db`;
const backupFilePath = path.join(backupsDir, backupFileName);

console.log(`[Backup] Iniciando respaldo en caliente de base de datos SQLite en modo WAL...`);
console.log(`[Backup] Archivo de destino: ${backupFilePath}`);

try {
  // VACUUM INTO es la sentencia atómica y no bloqueante recomendada por SQLite
  // para bases de datos en modo WAL en producción
  db.exec(`VACUUM INTO '${backupFilePath.replace(/'/g, "''")}';`);

  const stats = fs.statSync(backupFilePath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✔ [Backup] Respaldo completado con éxito.`);
  console.log(`  - Tamaño: ${sizeMb} MB (${stats.size} bytes)`);
  console.log(`  - Ruta: ${backupFilePath}`);

  // Política de retención: Mantener los 15 respaldos más recientes
  const allBackups = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('basetrack_backup_') && f.endsWith('.db'))
    .sort()
    .reverse();

  if (allBackups.length > 15) {
    const toDelete = allBackups.slice(15);
    for (const oldFile of toDelete) {
      fs.unlinkSync(path.join(backupsDir, oldFile));
      console.log(`  - Purgado respaldo antiguo: ${oldFile}`);
    }
  }

} catch (error) {
  console.error(`❌ [Backup] Error crítico durante el respaldo de SQLite:`, error);
  process.exit(1);
}
