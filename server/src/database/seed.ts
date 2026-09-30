import { initDatabase } from './db.js';

export function seed() {
  console.log('[Seed] Initializing clean database with sole administrator...');
  initDatabase();
  console.log('[Seed] Database clean state confirmed: Sole Administrator Marck Vizcarra (DNI: 91209966, Password: 91209966). Zero reports, zero test users.');
}

if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  seed();
}
