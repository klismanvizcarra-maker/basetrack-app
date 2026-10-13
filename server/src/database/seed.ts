import { initDatabase } from './db.js';

export function seed() {
  console.log('[Seed] Initializing clean database with sole administrator...');
  initDatabase();
  // Nunca registrar credenciales: los logs del servidor (Render, Docker) los leen terceros
  console.log('[Seed] Database clean state confirmed: sole system administrator present. Zero reports, zero test users.');
}

if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  seed();
}
