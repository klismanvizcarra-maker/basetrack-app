/**
 * Fecha operativa (AAAA-MM-DD) en hora de faena, Perú UTC-5 sin horario de verano.
 * Equivale a siteToday() de server/src/utils/site-date.ts. Usar toISOString() directamente
 * adelanta la fecha un día entre las 19:00 y las 24:00 locales, justo durante el turno noche.
 */
export function siteToday(): string {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}
