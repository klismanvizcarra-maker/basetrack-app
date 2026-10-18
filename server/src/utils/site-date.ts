/**
 * Fecha operativa (AAAA-MM-DD) en hora de faena, Perú UTC-5 sin horario de verano.
 * El servidor corre en UTC: usar toISOString() directamente adelanta la fecha un día
 * entre las 19:00 y las 24:00 locales, justo durante el turno noche.
 */
export function siteToday(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().split('T')[0];
}

/**
 * Primera guardia válida (G1–G4) entre los candidatos, en orden de prioridad.
 * La "guardia" del administrador (ADMIN) u otros valores no son guardias: si ninguno es válido
 * se devuelve '' (sin guardia) en lugar de suponer una.
 */
export function resolveGuardCode(...candidates: unknown[]): string {
  const legacy: Record<string, string> = { GUARDIA_A: 'G1', GUARDIA_B: 'G2', GUARDIA_C: 'G3', GUARDIA_D: 'G4' };
  for (const c of candidates) {
    const upper = String(c ?? '').toUpperCase().trim();
    const code = legacy[upper] || upper;
    if (['G1', 'G2', 'G3', 'G4'].includes(code)) return code;
  }
  return '';
}
