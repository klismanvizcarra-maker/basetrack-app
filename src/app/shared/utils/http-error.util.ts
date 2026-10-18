/**
 * Solo una falla de red (sin respuesta del servidor o timeout) autoriza el modo local/offline.
 * Un 4xx/5xx es una respuesta real del servidor: no debe enmascararse como guardado exitoso.
 */
export function isNetworkError(err: any): boolean {
  return err?.status === 0 || err?.name === 'TimeoutError';
}

/** Mensaje legible de un error HTTP, priorizando el que envía el servidor. */
export function serverErrorMessage(err: any, fallback: string): string {
  return err?.error?.message || err?.error?.error || fallback;
}
